/**
 * Outbound Adapter — Postgres Vend Repository
 *
 * Persists vend events with idempotency guarantee:
 * INSERT ... ON CONFLICT (operator_id, idempotency_key) DO NOTHING
 *
 * If the vend already exists (duplicate delivery from vendor),
 * the insert is a no-op and we return VendStatus.DUPLICATE.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import {
  VendRepository,
  VendCapturedEvent,
  VendStatus,
} from '@hatch/contracts';
import { TENANT_CONNECTION } from '../../../database/tenant-context';

@Injectable()
export class PgVendRepository implements VendRepository {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: Knex,
  ) {}

  async captureVend(event: VendCapturedEvent): Promise<VendStatus> {
    // INSERT with ON CONFLICT DO NOTHING — the UNIQUE constraint on
    // (operator_id, idempotency_key) makes this exactly-once.
    //
    // We use raw SQL here to get the exact ON CONFLICT behavior.
    // Knex's .onConflict() doesn't give us the "was it inserted?" feedback
    // we need — we check rowCount instead.
    const result = await this.db.raw(
      `INSERT INTO vends (id, operator_id, machine_id, badge_id, idempotency_key, product_code, amount, vended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (operator_id, idempotency_key) DO NOTHING`,
      [
        event.vendId,
        event.operatorId,
        event.machineId,
        event.badgeId,
        event.idempotencyKey,
        event.productCode,
        event.amount,
        event.vendedAt,
      ],
    );

    // PostgreSQL returns rowCount = 0 when ON CONFLICT DO NOTHING fires.
    const wasInserted = result.rowCount > 0;
    return wasInserted ? VendStatus.CAPTURED : VendStatus.DUPLICATE;
  }
}
