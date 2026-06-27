/**
 * Outbound Port — Vend Repository
 *
 * Persists vend events with idempotency guarantees.
 */

import { VendCapturedEvent } from '../events';
import { VendStatus } from '../value-objects';

export interface VendRepository {
  /**
   * Capture a vend event. Idempotent — if the idempotency key already exists,
   * returns DUPLICATE without modifying state.
   */
  captureVend(event: VendCapturedEvent): Promise<VendStatus>;
}

export const VEND_REPOSITORY = Symbol('VendRepository');
