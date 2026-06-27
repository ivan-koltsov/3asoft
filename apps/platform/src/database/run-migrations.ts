/**
 * Migration Runner — executes migrations in order.
 *
 * Simple, explicit runner. Tracks applied migrations in a `_migrations` table.
 * Designed to run on container startup or via `pnpm --filter platform migrate`.
 */

import knex from 'knex';
import { up as migration001 } from './migrations/001-initial-schema';

interface MigrationEntry {
  name: string;
  fn: (db: any) => Promise<void>;
}

const migrations: MigrationEntry[] = [
  { name: '001-initial-schema', fn: migration001 },
];

async function runMigrations() {
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
    // Create migrations tracking table
    await db.raw(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get already-applied migrations
    const applied = await db('_migrations').select('name');
    const appliedSet = new Set(applied.map((r: any) => r.name));

    // Run pending migrations
    for (const migration of migrations) {
      if (appliedSet.has(migration.name)) {
        console.log(`  ✓ ${migration.name} (already applied)`);
        continue;
      }

      console.log(`  → Applying ${migration.name}...`);
      await migration.fn(db);
      await db('_migrations').insert({ name: migration.name });
      console.log(`  ✓ ${migration.name} applied`);
    }

    console.log('All migrations applied.');
  } finally {
    await db.destroy();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
