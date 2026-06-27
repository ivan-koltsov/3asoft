/**
 * Unit Tests — VendorAclAdapter
 *
 * Tests the anti-corruption layer translation from vendor dialect
 * to canonical domain events.
 */

import { toOperatorId, RawVendorEvent } from '@hatch/contracts';
import { VendorAclAdapter } from './vendor-acl.adapter';

describe('VendorAclAdapter', () => {
  let acl: VendorAclAdapter;
  const operatorId = toOperatorId('11111111-1111-1111-1111-111111111111');

  beforeEach(() => {
    acl = new VendorAclAdapter();
  });

  const makeRawEvent = (overrides?: Partial<Record<string, unknown>>): RawVendorEvent => ({
    rawPayload: {
      vendor_event_id: 'evt-001',
      vendor_machine_id: 'machine-uuid-123',
      vendor_product_code: 'MDB-001-COLA',
      vendor_amount_cents: 150,
      vendor_card_id: 'badge-uuid-456',
      vendor_timestamp: '2024-01-15T10:30:00Z',
      ...overrides,
    },
  });

  it('should translate a valid vendor event to canonical VendCapturedEvent', () => {
    const result = acl.translateVendEvent(operatorId, makeRawEvent());

    expect(result.type).toBe('VendCaptured');
    expect(result.operatorId).toBe(operatorId);
    expect(result.idempotencyKey).toBe('evt-001');
    expect(result.productCode).toBe('BEVERAGE-COLA'); // Translated via binding table
    expect(result.amount).toBe(150);
    expect(result.vendedAt).toEqual(new Date('2024-01-15T10:30:00Z'));
    expect(result.vendId).toBeDefined();
  });

  it('should use binding table to translate known product codes', () => {
    const result = acl.translateVendEvent(
      operatorId,
      makeRawEvent({ vendor_product_code: 'MDB-002-WATER' }),
    );
    expect(result.productCode).toBe('BEVERAGE-WATER');
  });

  it('should prefix unmapped product codes with UNMAPPED-', () => {
    const result = acl.translateVendEvent(
      operatorId,
      makeRawEvent({ vendor_product_code: 'UNKNOWN-999' }),
    );
    expect(result.productCode).toBe('UNMAPPED-UNKNOWN-999');
  });

  it('should throw on missing required fields', () => {
    const incomplete: RawVendorEvent = {
      rawPayload: {
        vendor_event_id: 'evt-001',
        // Missing other required fields
      },
    };

    expect(() => acl.translateVendEvent(operatorId, incomplete)).toThrow(
      'Vendor payload missing required field',
    );
  });

  it('should preserve the vendor_event_id as the idempotency key', () => {
    const eventId = 'unique-vendor-evt-42';
    const result = acl.translateVendEvent(
      operatorId,
      makeRawEvent({ vendor_event_id: eventId }),
    );
    expect(result.idempotencyKey).toBe(eventId);
  });
});
