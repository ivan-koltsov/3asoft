/**
 * Vendor ACL Adapter — Anti-Corruption Layer
 *
 * Translates the vendor's dialect (MDB, DEX, vendor product codes)
 * into canonical domain events. This is the ONLY adapter that speaks
 * the vendor's language. The domain never imports vendor types.
 *
 * The adapter uses the binding table for vocabulary translation.
 */

import { Injectable } from '@nestjs/common';
import {
  VendorAcl,
  RawVendorEvent,
  VendCapturedEvent,
  OperatorId,
  toVendId,
  toMachineId,
  toBadgeId,
} from '@hatch/contracts';
import { VendorBindingTable } from './vendor-binding-table';
import { v4 as uuidv4 } from 'uuid';

/**
 * The shape of a vendor vend event — this type exists ONLY in the ACL.
 * The domain never sees this.
 */
interface VendorVendPayload {
  /** Vendor's unique event identifier */
  vendor_event_id: string;
  /** Vendor's machine identifier (e.g. "NAYAX-12345") */
  vendor_machine_id: string;
  /** MDB product code */
  vendor_product_code: string;
  /** Amount in vendor's currency representation */
  vendor_amount_cents: number;
  /** Badge/card ID as the vendor sees it */
  vendor_card_id: string;
  /** Vendor's timestamp (ISO string) */
  vendor_timestamp: string;
}

@Injectable()
export class VendorAclAdapter implements VendorAcl {
  private readonly bindingTable = new VendorBindingTable();

  translateVendEvent(
    operatorId: OperatorId,
    raw: RawVendorEvent,
  ): VendCapturedEvent {
    const payload = this.parseVendorPayload(raw.rawPayload);

    return {
      type: 'VendCaptured',
      vendId: toVendId(uuidv4()),
      operatorId,
      // The machine ID here is the canonical reference — in a full implementation,
      // we'd look up the machine by external_ref. For V1, we pass through
      // a UUID that the caller provides or we derive.
      machineId: toMachineId(payload.vendor_machine_id),
      badgeId: toBadgeId(payload.vendor_card_id),
      idempotencyKey: payload.vendor_event_id,
      productCode: this.bindingTable.translateProductCode(payload.vendor_product_code),
      amount: payload.vendor_amount_cents,
      vendedAt: new Date(payload.vendor_timestamp),
    };
  }

  /**
   * Parse and validate the vendor payload.
   * Throws if required fields are missing — fail-fast at the boundary.
   */
  private parseVendorPayload(raw: Record<string, unknown>): VendorVendPayload {
    const requiredFields = [
      'vendor_event_id',
      'vendor_machine_id',
      'vendor_product_code',
      'vendor_amount_cents',
      'vendor_card_id',
      'vendor_timestamp',
    ];

    for (const field of requiredFields) {
      if (raw[field] === undefined || raw[field] === null) {
        throw new Error(`Vendor payload missing required field: ${field}`);
      }
    }

    return {
      vendor_event_id: String(raw.vendor_event_id),
      vendor_machine_id: String(raw.vendor_machine_id),
      vendor_product_code: String(raw.vendor_product_code),
      vendor_amount_cents: Number(raw.vendor_amount_cents),
      vendor_card_id: String(raw.vendor_card_id),
      vendor_timestamp: String(raw.vendor_timestamp),
    };
  }
}
