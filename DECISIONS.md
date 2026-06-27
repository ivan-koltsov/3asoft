# DECISIONS.md — Architecture Decision Records

## ADR-001: Monorepo Tool — Turborepo + pnpm

**Context:** Need a monorepo setup for shared kernel + NestJS app.

**Decision:** Turborepo + pnpm workspaces.

**Why:** Turborepo provides caching and task orchestration. pnpm is disk-efficient with strict dependency isolation (no phantom dependencies). The assignment mentions Turborepo as the production stack, so aligning with it reduces future friction.

**Alternatives rejected:**
- Nx — heavier, more opinionated, overkill for two packages.
- Yarn workspaces — pnpm's strictness catches more bugs at install time.
- Lerna — effectively deprecated in favor of Turborepo/Nx.

---

## ADR-002: Query Builder — Knex.js (not an ORM)

**Context:** Need database access with full SQL control for RLS (`SET LOCAL`), idempotent inserts (`ON CONFLICT DO NOTHING`), and raw migration SQL.

**Decision:** Knex.js as query builder + migration tool.

**Why:** Full SQL control is non-negotiable for this domain:
- `SET LOCAL app.current_operator_id` must execute per-transaction for RLS.
- `INSERT ... ON CONFLICT (operator_id, idempotency_key) DO NOTHING` is the exactly-once spine.
- RLS policies require raw DDL in migrations.
- Knex gives us parameterized queries (SQL injection safe) with full control over the generated SQL.

**Alternatives rejected:**
- **TypeORM** — abstraction fights us: its query builder obscures `SET LOCAL`, and its migration runner doesn't handle raw RLS DDL cleanly. Entity decorators would also violate the hexagonal dependency rule by coupling domain to ORM.
- **Prisma** — raw query support has improved, but `$executeRaw` for `SET LOCAL` per-transaction is awkward. Prisma's schema-first approach doesn't fit well with hand-crafted RLS policies.
- **Raw `pg` client** — maximum control but loses Knex's query builder, migration tracking, and connection pooling. Too low-level for the non-critical queries.

---

## ADR-003: Migration Tool — Knex Built-in (with custom runner)

**Context:** Need to apply DDL including RLS policies, create roles, and manage schema.

**Decision:** Custom migration runner using Knex's raw SQL capabilities with a simple tracking table (`_migrations`).

**Why:** Knex's built-in migration runner (`knex migrate:latest`) works but assumes its own directory conventions and lifecycle. A custom runner gives us:
- Explicit ordering and naming
- Admin-user connection for DDL (separate from app user)
- Simple tracking via `_migrations` table
- Full TypeScript with no config files

**Alternatives rejected:**
- **node-pg-migrate** — good but adds another dependency for something we can do in 50 lines.
- **Knex CLI migrations** — adds `knexfile.js` config complexity and hides the admin/app user separation.

---

## ADR-004: Test Runner — Jest

**Context:** Need unit and integration tests for NestJS.

**Decision:** Jest with ts-jest.

**Why:** NestJS ecosystem standard. Built-in mocking, good TypeScript support via ts-jest, and the `@nestjs/testing` package integrates directly.

**Alternatives rejected:**
- Vitest — faster, but NestJS tooling (`@nestjs/testing`) is designed for Jest. Switching adds friction for no benefit in a 4h scope.

---

## ADR-005: RLS Tenant Context — SET LOCAL per Transaction

**Context:** Multi-tenant RLS requires setting `app.current_operator_id` as a PostgreSQL session variable.

**Decision:** `SET LOCAL app.current_operator_id = ?` executed at the start of each request's transaction. `SET LOCAL` scopes the variable to the transaction — it cannot leak between requests.

**Why:**
- **Security**: `SET LOCAL` (vs `SET`) ensures the variable is transaction-scoped. If the transaction ends (commit/rollback), the variable is gone. No risk of one request's tenant context bleeding into another request on a pooled connection.
- **Simplicity**: A NestJS request-scoped provider creates the transaction and sets the context. The TenantTransactionInterceptor commits/rolls back.
- **Correctness**: RLS policies use `current_setting('app.current_operator_id')::uuid` — no hand-filtered `WHERE operator_id = ?` in app code.

**Alternatives rejected:**
- `SET` (session-scoped) — dangerous with connection pooling; a connection returned to the pool retains the previous tenant's context.
- Application-level WHERE clauses — error-prone (one missed WHERE = data leak), not defense-in-depth.

---

## ADR-006: Idempotency Strategy — UNIQUE Constraint + ON CONFLICT DO NOTHING

**Context:** Vendor will redeliver vend events. We must capture each vend exactly once.

**Decision:** `UNIQUE(operator_id, idempotency_key)` constraint on the `vends` table. `INSERT ... ON CONFLICT DO NOTHING` makes duplicates a silent no-op.

**Why:**
- **Database-level guarantee**: No application-level locking, no Redis, no distributed coordination. The database is the source of truth.
- **Simplicity**: One SQL statement handles both insert and dedup.
- **Performance**: `ON CONFLICT DO NOTHING` is a single atomic operation — no SELECT-then-INSERT race condition.
- **Feedback**: `rowCount` tells us if it was a new capture (1) or duplicate (0).

**Alternatives rejected:**
- Application-level dedup (check-then-insert) — race condition under concurrent requests.
- Redis-based dedup — adds infrastructure complexity and a second source of truth.
- `INSERT ... ON CONFLICT DO UPDATE SET ...` — UPDATE has side effects we don't want for a true no-op.

---

## ADR-007: Fail-Closed Authorization

**Context:** "Wrongly denying a snack is a minor annoyance; wrongly dispensing is unrecoverable."

**Decision:** The `AuthorizeAccessUseCase.execute()` method wraps the entire flow in try/catch. Any exception → `DENIED` with `INTERNAL_ERROR` reason. The method NEVER throws.

**Why:** The fail-closed invariant is non-negotiable. By catching at the use-case level (not the controller), we ensure that:
- Database errors → DENY
- Strategy bugs → DENY
- Null pointer exceptions → DENY
- Even logging failures → DENY (double try/catch)

**Tested explicitly**: The test suite includes 3 separate fail-closed test cases (repo throws, strategy throws, logger also throws).

---

## ADR-008: Anti-Corruption Layer — Single Adapter with Binding Table

**Context:** Vendor dialect (MDB, DEX, vendor product codes) must never reach the domain.

**Decision:** A single `VendorAclAdapter` class translates vendor events to canonical `VendCapturedEvent` using a `VendorBindingTable` for vocabulary mapping.

**Why:**
- **Boundary clarity**: The vendor's type definitions exist ONLY in the ACL adapter. The domain imports only from `@hatch/contracts`.
- **Binding table**: Product code mapping (`MDB-001-COLA` → `BEVERAGE-COLA`) is explicit and auditable. Unknown codes get `UNMAPPED-` prefix for visibility.
- **Extensibility**: When we onboard a second vendor (Cantaloupe), we write a second adapter implementing the same `VendorAcl` port. The domain doesn't change.

---

## ADR-009: Tenant ID from Header (V1)

**Context:** In production, tenant ID comes from Cognito JWT via API Gateway. For V1, we need a simpler mechanism.

**Decision:** `X-Operator-Id` HTTP header, validated as UUID by middleware.

**Why:** Simulates the production flow (API Gateway injects tenant claim) without requiring Cognito setup. The middleware validates format, and the request-scoped provider makes it available to all services.

**Trade-off acknowledged**: This is NOT production auth. Anyone can set the header. In production, Cognito JWT verification replaces the header extraction.

---

## ADR-010: Hexagonal Structure — Proportional Layering

**Context:** DDD hexagonal architecture for two bounded contexts.

**Decision:** Full hexagonal layering for both access and metering contexts: `domain/`, `application/`, `adapters/inbound/`, `adapters/outbound/`. Shared kernel in `packages/contracts/`.

**Why:**
- Access context has real domain logic (strategy pattern, fail-closed invariant) — full hexagon is justified.
- Metering context is thinner (ACL → persist) but still benefits from the boundary discipline: the use-case doesn't know about Postgres or the vendor.
- The dependency rule is enforced by the import structure: domain and application import only from `@hatch/contracts`, never from adapters.

---

## ADR-011: AI Agent Curation Notes

**Context:** Built with agentic AI coding tools as required.

**Key curation decisions:**
1. **Shared kernel designed first by hand** — the branded IDs, event envelope, and port interfaces define the contracts. AI generated the boilerplate but the type structure was directed.
2. **Fail-closed try/catch structure** — AI initially generated a simpler version without the double try/catch for logging failures. Manually added the nested catch and the explicit test case.
3. **RLS policy review** — verified that `FORCE ROW LEVEL SECURITY` is used (not just `ENABLE`), so even the table owner is filtered. AI initially missed `FORCE`.
4. **Idempotency check** — AI initially used Knex's `.onConflict().ignore()` which doesn't return rowCount reliably. Switched to raw SQL to get the `rowCount` feedback.
5. **Integration test as admin vs app user** — the RLS tests must connect as `hatch_app` (subject to RLS) to prove isolation. Setup inserts as admin. AI initially used the same connection for both, which wouldn't test RLS properly.
6. **SET LOCAL vs SET** — explicitly chose `SET LOCAL` (transaction-scoped) over `SET` (session-scoped). AI suggested `SET` initially; corrected to prevent connection pool tenant leaks.
