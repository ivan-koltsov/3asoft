/**
 * Outbound Port — Vendor Anti-Corruption Layer
 *
 * Translates vendor dialect into canonical domain events.
 * The domain never imports vendor types — this port is the boundary.
 */

import { VendCapturedEvent } from '../events';
import { OperatorId } from '../ids';

/**
 * Raw vendor event — opaque to the domain.
 * The ACL adapter knows the vendor's shape; the domain sees only this generic envelope.
 */
export interface RawVendorEvent {
  /** The raw event payload from the vendor, as-is. */
  readonly rawPayload: Record<string, unknown>;
}

export interface VendorAcl {
  /**
   * Translate a raw vendor event into a canonical VendCapturedEvent.
   * Throws if the event cannot be translated (unknown vendor format).
   */
  translateVendEvent(
    operatorId: OperatorId,
    raw: RawVendorEvent,
  ): VendCapturedEvent;
}

export const VENDOR_ACL = Symbol('VendorAcl');
