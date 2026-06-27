# Hatch — Campus Cashless-Vending Platform

A multi-tenant cashless-vending platform built with NestJS, hexagonal DDD, and PostgreSQL Row-Level Security.

**Vertical slice**: Authorize access (badge tap → allow/deny) + Capture vends (exactly-once metering).

## Run in 60 Seconds

```bash
# 1. Clone and enter
git clone <repo-url> && cd hatch

# 2. Copy env file
cp .env.example .env

# 3. Start everything (Postgres + NestJS app with auto-migrations)
docker compose up --build
```

The app is running at `http://localhost:3000`.

## Run Tests

```bash
# Install dependencies
pnpm install

# Build contracts (shared kernel)
pnpm --filter @hatch/contracts build

# Run unit tests
pnpm --filter @hatch/platform test:unit

# Run integration tests (requires Postgres running)
# Start Postgres first:
docker compose up -d postgres

# Run migrations:
pnpm --filter @hatch/platform migrate

# Run integration tests:
pnpm --filter @hatch/platform test:integration

# Run ALL tests:
pnpm --filter @hatch/platform test
```

## Try the API

### Authorize a badge tap

```bash
# Entitled badge → ALLOWED
curl -s -X POST http://localhost:3000/api/v1/authorize \
  -H "Content-Type: application/json" \
  -H "X-Operator-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{"badgeId": "aabb1111-1111-1111-1111-111111111111", "machineId": "aaaa1111-1111-1111-1111-111111111111"}' | jq

# Non-entitled badge → DENIED
curl -s -X POST http://localhost:3000/api/v1/authorize \
  -H "Content-Type: application/json" \
  -H "X-Operator-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{"badgeId": "aabb2222-2222-2222-2222-222222222222", "machineId": "aaaa1111-1111-1111-1111-111111111111"}' | jq
```

### Capture a vend event (vendor webhook)

```bash
curl -s -X POST http://localhost:3000/api/v1/vendor/webhook \
  -H "Content-Type: application/json" \
  -H "X-Operator-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{
    "rawPayload": {
      "vendor_event_id": "evt-test-001",
      "vendor_machine_id": "aaaa1111-1111-1111-1111-111111111111",
      "vendor_product_code": "MDB-001-COLA",
      "vendor_amount_cents": 150,
      "vendor_card_id": "aabb1111-1111-1111-1111-111111111111",
      "vendor_timestamp": "2024-01-15T10:30:00Z"
    }
  }' | jq

# Send the same event again → DUPLICATE (no-op, exactly-once guarantee)
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Modular Monolith (NestJS)                  │
│                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────┐    │
│  │   Access Context     │    │   Metering Context        │    │
│  │                     │    │                          │    │
│  │  domain/            │    │  application/            │    │
│  │   └─ BinaryStrategy │    │   └─ CaptureVendUseCase  │    │
│  │  application/       │    │  adapters/               │    │
│  │   └─ AuthorizeUC    │    │   ├─ VendorACL (ACL)     │    │
│  │  adapters/          │    │   ├─ PgVendRepo          │    │
│  │   ├─ Controller     │    │   └─ WebhookController   │    │
│  │   ├─ PgRepos        │    │                          │    │
│  │   └─ PgLogger       │    │                          │    │
│  └─────────┬───────────┘    └────────────┬─────────────┘    │
│            │                             │                  │
│            └──────────┬──────────────────┘                  │
│                       │                                      │
│              ┌────────▼─────────┐                           │
│              │  Shared Kernel   │                           │
│              │ @hatch/contracts │                           │
│              │ (branded IDs,    │                           │
│              │  ports, events)  │                           │
│              └──────────────────┘                           │
└──────────────────────────────────────────────────────────────┘
                        │
               ┌────────▼─────────┐
               │   PostgreSQL 16   │
               │   with RLS        │
               │   (per-tenant     │
               │    isolation)     │
               └──────────────────┘
```

## Project Structure

```
├── packages/
│   └── contracts/              # Shared kernel — branded IDs, events, ports
│       └── src/
│           ├── ids.ts           # Branded ID types
│           ├── value-objects.ts # AuthorizationDecision, VendStatus
│           ├── event-envelope.ts
│           ├── events.ts        # Canonical domain events
│           └── ports/           # Port interfaces
├── apps/
│   └── platform/               # NestJS modular monolith
│       └── src/
│           ├── access/          # Access bounded context (hexagonal)
│           │   ├── domain/      # BinaryEntitlementStrategy
│           │   ├── application/ # AuthorizeAccessUseCase
│           │   └── adapters/    # Controllers + PG repos
│           ├── metering/        # Metering bounded context (hexagonal)
│           │   ├── application/ # CaptureVendUseCase
│           │   └── adapters/    # Webhook controller + PG repo + Vendor ACL
│           └── database/        # Migrations, tenant context, seeds
├── docker-compose.yml
├── Dockerfile
├── DECISIONS.md
└── turbo.json
```

## Key Design Invariants

1. **Fail-closed authorization**: Any error → DENY. Never fail open.
2. **Exactly-once vend capture**: `UNIQUE(operator_id, idempotency_key)` + `ON CONFLICT DO NOTHING`.
3. **RLS tenant isolation**: `SET LOCAL` per transaction. No hand-filtered WHERE clauses.
4. **Dependency rule**: domain/ and application/ import only from `@hatch/contracts`. Never from adapters.
5. **Anti-corruption layer**: Vendor dialect translated in one adapter. Domain never sees vendor types.

## What I'd Do Next

1. **Operator Export API** — read-only, scoped API key, paginated vend export for billing
2. **Unsettled vend sensor** — detect dispensed-but-unreported vends via deadline timer
3. **Transactional outbox** — reliable event publishing for cross-context communication
4. **Cognito integration** — replace X-Operator-Id header with JWT verification
5. **Multi-stage Dockerfile** — smaller production image with distroless base
6. **CI pipeline** — GitHub Actions with lint, test, build, and Docker push