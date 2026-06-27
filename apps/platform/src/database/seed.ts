/**
 * Seed data for local development and testing.
 *
 * Creates two operators (tenants), machines, badges, and entitlements
 * to exercise the full authorize + vend capture flow.
 */

import knex from 'knex';

const OPERATOR_A_ID = '11111111-1111-1111-1111-111111111111';
const OPERATOR_B_ID = '22222222-2222-2222-2222-222222222222';

const MACHINE_A1_ID = 'aaaa1111-1111-1111-1111-111111111111';
const MACHINE_B1_ID = 'bbbb1111-1111-1111-1111-111111111111';

const BADGE_A1_ID = 'aabb1111-1111-1111-1111-111111111111';
const BADGE_A2_ID = 'aabb2222-2222-2222-2222-222222222222';
const BADGE_B1_ID = 'bbcc1111-1111-1111-1111-111111111111';

async function seed() {
  const db = knex({
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
    // Operators — inserted as admin (no RLS context needed on this table)
    await db.raw(`
      INSERT INTO operators (id, name) VALUES
        ('${OPERATOR_A_ID}', 'Operator Alpha'),
        ('${OPERATOR_B_ID}', 'Operator Beta')
      ON CONFLICT (id) DO NOTHING
    `);

    // Switch to app user context for RLS-scoped inserts
    // Operator A data
    await db.transaction(async (trx) => {
      await trx.raw(`SET LOCAL app.current_operator_id = '${OPERATOR_A_ID}'`);

      await trx.raw(`
        INSERT INTO machines (id, operator_id, external_ref, name) VALUES
          ('${MACHINE_A1_ID}', '${OPERATOR_A_ID}', 'VENDOR-MACH-001', 'Lobby Vending A1')
        ON CONFLICT (id) DO NOTHING
      `);

      await trx.raw(`
        INSERT INTO badges (id, operator_id, external_ref) VALUES
          ('${BADGE_A1_ID}', '${OPERATOR_A_ID}', 'BADGE-ALPHA-001'),
          ('${BADGE_A2_ID}', '${OPERATOR_A_ID}', 'BADGE-ALPHA-002')
        ON CONFLICT (id) DO NOTHING
      `);

      // Badge A1 is entitled to Machine A1; Badge A2 is NOT entitled (for deny testing)
      await trx.raw(`
        INSERT INTO entitlements (operator_id, badge_id, machine_id, is_active) VALUES
          ('${OPERATOR_A_ID}', '${BADGE_A1_ID}', '${MACHINE_A1_ID}', true)
        ON CONFLICT DO NOTHING
      `);
    });

    // Operator B data
    await db.transaction(async (trx) => {
      await trx.raw(`SET LOCAL app.current_operator_id = '${OPERATOR_B_ID}'`);

      await trx.raw(`
        INSERT INTO machines (id, operator_id, external_ref, name) VALUES
          ('${MACHINE_B1_ID}', '${OPERATOR_B_ID}', 'VENDOR-MACH-002', 'Cafeteria Vending B1')
        ON CONFLICT (id) DO NOTHING
      `);

      await trx.raw(`
        INSERT INTO badges (id, operator_id, external_ref) VALUES
          ('${BADGE_B1_ID}', '${OPERATOR_B_ID}', 'BADGE-BETA-001')
        ON CONFLICT (id) DO NOTHING
      `);

      await trx.raw(`
        INSERT INTO entitlements (operator_id, badge_id, machine_id, is_active) VALUES
          ('${OPERATOR_B_ID}', '${BADGE_B1_ID}', '${MACHINE_B1_ID}', true)
        ON CONFLICT DO NOTHING
      `);
    });

    console.log('Seed data applied.');
  } finally {
    await db.destroy();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
