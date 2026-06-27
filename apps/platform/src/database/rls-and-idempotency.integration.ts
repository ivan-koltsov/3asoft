/**
 * Integration Tests — RLS Cross-Tenant Isolation + Idempotent Vend Capture
 *
 * These tests connect to a real PostgreSQL database (via docker-compose)
 * and verify:
 *
 * 1. RLS cross-tenant negative test:
 *    Operator A inserts rows → Operator B's session CANNOT read them.
 *
 * 2. Idempotent vend capture:
 *    Same idempotency key → second INSERT is a no-op (rowCount = 0).
 *
 * Prerequisites: PostgreSQL running with migrations applied.
 * Run: docker compose up -d postgres && pnpm --filter platform migrate
 */

import knex, { Knex } from 'knex';

// Test constants — two completely separate operators
const OPERATOR_A_ID = '11111111-1111-1111-1111-111111111111';
const OPERATOR_B_ID = '22222222-2222-2222-2222-222222222222';

describe('PostgreSQL Integration', () => {
  let db: Knex;

  beforeAll(async () => {
    db = knex({
      client: 'pg',
      connection: {
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432', 10),
        database: process.env.DATABASE_NAME || 'hatch',
        user: process.env.DATABASE_USER || 'hatch_app',
        password: process.env.DATABASE_PASSWORD || 'change_me_in_production',
      },
    });

    // Ensure operators exist (insert as app user — operators table has no RLS)
    // Use admin connection for setup
    const adminDb = knex({
      client: 'pg',
      connection: {
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432', 10),
        database: process.env.DATABASE_NAME || 'hatch',
        user: process.env.DATABASE_ADMIN_USER || 'postgres',
        password: process.env.DATABASE_ADMIN_PASSWORD || 'postgres_admin_password',
      },
    });

    try {
      await adminDb.raw(`
        INSERT INTO operators (id, name) VALUES
          ('${OPERATOR_A_ID}', 'Test Operator A'),
          ('${OPERATOR_B_ID}', 'Test Operator B')
        ON CONFLICT (id) DO NOTHING
      `);

      // Insert machines for both operators (as admin, bypassing RLS)
      // We need the admin user to not be subject to RLS for setup
      await adminDb.raw(`SET app.current_operator_id = '${OPERATOR_A_ID}'`);
      await adminDb.raw(`
        INSERT INTO machines (id, operator_id, external_ref, name) VALUES
          ('aaaa1111-1111-1111-1111-111111111111', '${OPERATOR_A_ID}', 'VM-A1', 'Machine A1')
        ON CONFLICT (id) DO NOTHING
      `);

      await adminDb.raw(`SET app.current_operator_id = '${OPERATOR_B_ID}'`);
      await adminDb.raw(`
        INSERT INTO machines (id, operator_id, external_ref, name) VALUES
          ('bbbb1111-1111-1111-1111-111111111111', '${OPERATOR_B_ID}', 'VM-B1', 'Machine B1')
        ON CONFLICT (id) DO NOTHING
      `);
    } finally {
      await adminDb.destroy();
    }
  });

  afterAll(async () => {
    await db.destroy();
  });

  // ─────────────────────────────────────────────────────────────────
  // RLS CROSS-TENANT ISOLATION TEST
  // ─────────────────────────────────────────────────────────────────

  describe('RLS Cross-Tenant Isolation', () => {
    it('Operator A CANNOT read Operator B machines (and vice versa)', async () => {
      // Query as Operator A
      const opAMachines = await db.transaction(async (trx) => {
        await trx.raw(`SET LOCAL app.current_operator_id = '${OPERATOR_A_ID}'`);
        return trx('machines').select('id', 'operator_id', 'name');
      });

      // Query as Operator B
      const opBMachines = await db.transaction(async (trx) => {
        await trx.raw(`SET LOCAL app.current_operator_id = '${OPERATOR_B_ID}'`);
        return trx('machines').select('id', 'operator_id', 'name');
      });

      // Operator A sees only their machines
      expect(opAMachines.length).toBeGreaterThanOrEqual(1);
      expect(opAMachines.every((m: any) => m.operator_id === OPERATOR_A_ID)).toBe(true);

      // Operator B sees only their machines
      expect(opBMachines.length).toBeGreaterThanOrEqual(1);
      expect(opBMachines.every((m: any) => m.operator_id === OPERATOR_B_ID)).toBe(true);

      // NEGATIVE: Operator A's machines do NOT appear in Operator B's results
      const opAIds = opAMachines.map((m: any) => m.id);
      const opBIds = opBMachines.map((m: any) => m.id);
      const overlap = opAIds.filter((id: string) => opBIds.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('Operator A CANNOT insert a machine with Operator B operator_id', async () => {
      // Set context as Operator A, try to insert a machine for Operator B
      await expect(
        db.transaction(async (trx) => {
          await trx.raw(`SET LOCAL app.current_operator_id = '${OPERATOR_A_ID}'`);
          // This insert should be blocked by RLS — the operator_id doesn't match
          // the session variable. The policy's USING clause also applies to INSERT
          // WITH CHECK (implicitly via FORCE ROW LEVEL SECURITY).
          await trx('machines').insert({
            operator_id: OPERATOR_B_ID,
            external_ref: 'CROSS-TENANT-ATTACK',
            name: 'Should Not Exist',
          });
        }),
      ).rejects.toThrow(); // RLS violation
    });

    it('Operator B CANNOT read Operator A vends', async () => {
      // Insert a vend as Operator A
      await db.transaction(async (trx) => {
        await trx.raw(`SET LOCAL app.current_operator_id = '${OPERATOR_A_ID}'`);
        await trx.raw(`
          INSERT INTO vends (operator_id, machine_id, idempotency_key, amount)
          VALUES ('${OPERATOR_A_ID}', 'aaaa1111-1111-1111-1111-111111111111', 'rls-test-vend-001', 100)
          ON CONFLICT (operator_id, idempotency_key) DO NOTHING
        `);
      });

      // Try to read it as Operator B
      const opBVends = await db.transaction(async (trx) => {
        await trx.raw(`SET LOCAL app.current_operator_id = '${OPERATOR_B_ID}'`);
        return trx('vends').select('*');
      });

      // Operator B should see ZERO of Operator A's vends
      const crossTenantVends = opBVends.filter(
        (v: any) => v.operator_id === OPERATOR_A_ID,
      );
      expect(crossTenantVends).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // IDEMPOTENT VEND CAPTURE TEST
  // ─────────────────────────────────────────────────────────────────

  describe('Idempotent Vend Capture', () => {
    const idempotencyKey = `idem-test-${Date.now()}`;

    it('first insert should succeed (CAPTURED)', async () => {
      const result = await db.transaction(async (trx) => {
        await trx.raw(`SET LOCAL app.current_operator_id = '${OPERATOR_A_ID}'`);
        return trx.raw(
          `INSERT INTO vends (operator_id, machine_id, idempotency_key, amount)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (operator_id, idempotency_key) DO NOTHING`,
          [OPERATOR_A_ID, 'aaaa1111-1111-1111-1111-111111111111', idempotencyKey, 200],
        );
      });

      expect(result.rowCount).toBe(1); // Inserted
    });

    it('duplicate insert should be a no-op (DUPLICATE)', async () => {
      const result = await db.transaction(async (trx) => {
        await trx.raw(`SET LOCAL app.current_operator_id = '${OPERATOR_A_ID}'`);
        return trx.raw(
          `INSERT INTO vends (operator_id, machine_id, idempotency_key, amount)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (operator_id, idempotency_key) DO NOTHING`,
          [OPERATOR_A_ID, 'aaaa1111-1111-1111-1111-111111111111', idempotencyKey, 200],
        );
      });

      expect(result.rowCount).toBe(0); // No-op — duplicate
    });

    it('same idempotency key for DIFFERENT operator should succeed', async () => {
      // The UNIQUE constraint is (operator_id, idempotency_key),
      // so the same key for a different operator is fine.
      const result = await db.transaction(async (trx) => {
        await trx.raw(`SET LOCAL app.current_operator_id = '${OPERATOR_B_ID}'`);
        return trx.raw(
          `INSERT INTO vends (operator_id, machine_id, idempotency_key, amount)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (operator_id, idempotency_key) DO NOTHING`,
          [OPERATOR_B_ID, 'bbbb1111-1111-1111-1111-111111111111', idempotencyKey, 300],
        );
      });

      expect(result.rowCount).toBe(1); // Different operator → not a duplicate
    });
  });
});
