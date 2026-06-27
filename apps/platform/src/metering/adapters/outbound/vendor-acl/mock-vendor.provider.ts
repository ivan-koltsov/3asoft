/**
 * Mock Vendor Provider — in-process mock for testing.
 *
 * Generates realistic-looking vendor events without needing a separate
 * container or external service.
 */

import { RawVendorEvent } from '@hatch/contracts';
import { v4 as uuidv4 } from 'uuid';

const MOCK_PRODUCT_CODES = ['MDB-001-COLA', 'MDB-002-WATER', 'MDB-003-CHIPS', 'MDB-004-CANDY'];
const MOCK_AMOUNTS = [150, 100, 200, 125]; // cents

export class MockVendorProvider {
  /**
   * Generate a mock vendor vend event.
   * All fields use vendor dialect — this is what the real vendor would send.
   */
  generateVendEvent(overrides?: Partial<Record<string, unknown>>): RawVendorEvent {
    const productIndex = Math.floor(Math.random() * MOCK_PRODUCT_CODES.length);

    return {
      rawPayload: {
        vendor_event_id: uuidv4(),
        vendor_machine_id: overrides?.vendor_machine_id ?? 'NAYAX-VM-001',
        vendor_product_code: overrides?.vendor_product_code ?? MOCK_PRODUCT_CODES[productIndex],
        vendor_amount_cents: overrides?.vendor_amount_cents ?? MOCK_AMOUNTS[productIndex],
        vendor_card_id: overrides?.vendor_card_id ?? 'CARD-12345',
        vendor_timestamp: overrides?.vendor_timestamp ?? new Date().toISOString(),
        ...overrides,
      },
    };
  }

  /**
   * Generate a duplicate event (same vendor_event_id) to test idempotency.
   */
  generateDuplicateEvent(originalEventId: string, overrides?: Partial<Record<string, unknown>>): RawVendorEvent {
    const event = this.generateVendEvent(overrides);
    event.rawPayload.vendor_event_id = originalEventId;
    return event;
  }
}
