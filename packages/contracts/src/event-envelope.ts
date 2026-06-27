/**
 * Event Envelope — the canonical wrapper for all domain events.
 *
 * Every event carries tenant context, an idempotency key for exactly-once
 * processing, a schema version for forward compatibility, and a timestamp.
 */

import { OperatorId } from './ids';

export interface EventEnvelope<T> {
  /** Tenant isolation — which operator this event belongs to. */
  readonly tenantId: OperatorId;

  /** Idempotency key for exactly-once delivery guarantees. */
  readonly idempotencyKey: string;

  /** Schema version for forward-compatible evolution. */
  readonly schemaVersion: number;

  /** When the event was produced. */
  readonly timestamp: Date;

  /** The domain event payload. */
  readonly payload: T;
}
