/**
 * Migration 001 — Initial schema with RLS
 *
 * Creates all tables for the access and metering bounded contexts,
 * enables Row-Level Security on every tenant-scoped table, and
 * creates the application user with restricted privileges.
 *
 * Security model:
 * - The `hatch_app` user is the application connection user
 * - RLS policies filter by `app.current_operator_id` session variable
 * - FORCE ROW LEVEL SECURITY ensures even table owners are filtered
 * - The idempotency key on vends ensures exactly-once capture
 */

import { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  // ── Extension ──────────────────────────────────────────────────
  await db.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // ── Operators (tenants) ────────────────────────────────────────
  await db.raw(`
    CREATE TABLE IF NOT EXISTS operators (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name        VARCHAR(255) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Machines ───────────────────────────────────────────────────
  await db.raw(`
    CREATE TABLE IF NOT EXISTS machines (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      operator_id   UUID NOT NULL REFERENCES operators(id),
      external_ref  VARCHAR(255) NOT NULL,
      name          VARCHAR(255) NOT NULL,
      status        VARCHAR(50) NOT NULL DEFAULT 'active',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(operator_id, external_ref)
    )
  `);

  // ── Badges ─────────────────────────────────────────────────────
  await db.raw(`
    CREATE TABLE IF NOT EXISTS badges (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      operator_id   UUID NOT NULL REFERENCES operators(id),
      external_ref  VARCHAR(255) NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(operator_id, external_ref)
    )
  `);

  // ── Entitlements ───────────────────────────────────────────────
  await db.raw(`
    CREATE TABLE IF NOT EXISTS entitlements (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      operator_id   UUID NOT NULL REFERENCES operators(id),
      badge_id      UUID NOT NULL REFERENCES badges(id),
      machine_id    UUID NOT NULL REFERENCES machines(id),
      is_active     BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Authorization Logs ─────────────────────────────────────────
  await db.raw(`
    CREATE TABLE IF NOT EXISTS authorization_logs (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      operator_id   UUID NOT NULL REFERENCES operators(id),
      badge_id      UUID NOT NULL,
      machine_id    UUID NOT NULL,
      decision      VARCHAR(20) NOT NULL,
      reason        VARCHAR(50),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Vends ──────────────────────────────────────────────────────
  // The UNIQUE constraint on (operator_id, idempotency_key) is the
  // exactly-once spine: INSERT ... ON CONFLICT DO NOTHING makes
  // duplicate vendor deliveries a silent no-op.
  await db.raw(`
    CREATE TABLE IF NOT EXISTS vends (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      operator_id     UUID NOT NULL REFERENCES operators(id),
      machine_id      UUID NOT NULL REFERENCES machines(id),
      badge_id        UUID,
      idempotency_key VARCHAR(255) NOT NULL,
      product_code    VARCHAR(100),
      amount          INTEGER NOT NULL DEFAULT 0,
      vended_at       TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(operator_id, idempotency_key)
    )
  `);

  // ── Indexes ────────────────────────────────────────────────────
  await db.raw('CREATE INDEX IF NOT EXISTS idx_machines_operator ON machines(operator_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_badges_operator ON badges(operator_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_entitlements_lookup ON entitlements(operator_id, badge_id, machine_id) WHERE is_active = true');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_vends_operator ON vends(operator_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_auth_logs_operator ON authorization_logs(operator_id)');

  // ── Row-Level Security ─────────────────────────────────────────
  // Enable RLS on all tenant-scoped tables.
  // FORCE ensures even the table owner is subject to policies.
  const tenantTables = ['machines', 'badges', 'entitlements', 'authorization_logs', 'vends'];

  for (const table of tenantTables) {
    await db.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await db.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);

    // Policy: rows visible only when operator_id matches the session variable.
    await db.raw(`
      CREATE POLICY ${table}_tenant_isolation ON ${table}
        USING (operator_id = current_setting('app.current_operator_id')::uuid)
    `);
  }

  // ── Application user ──────────────────────────────────────────
  // Create the app user if it doesn't exist and grant appropriate permissions.
  // In production, the password comes from a secrets manager.
  await db.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hatch_app') THEN
        CREATE ROLE hatch_app WITH LOGIN PASSWORD 'change_me_in_production';
      END IF;
    END
    $$
  `);

  // Grant permissions on all current tables
  await db.raw('GRANT USAGE ON SCHEMA public TO hatch_app');
  await db.raw('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hatch_app');
  await db.raw('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hatch_app');
}
