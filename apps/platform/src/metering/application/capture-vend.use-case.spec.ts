/**
 * Unit Tests — CaptureVendUseCase
 *
 * Tests vend capture orchestration including:
 * - First capture → CAPTURED
 * - Duplicate capture → DUPLICATE (no-op)
 * - ACL translation is called correctly
 */

import {
  VendStatus,
  VendorAcl,
  VendRepository,
  VendCapturedEvent,
  RawVendorEvent,
  toOperatorId,
  toVendId,
  toMachineId,
  toBadgeId,
} from '@hatch/contracts';
import { CaptureVendUseCase } from './capture-vend.use-case';

describe('CaptureVendUseCase', () => {
  const operatorId = toOperatorId('11111111-1111-1111-1111-111111111111');

  const mockCanonicalEvent: VendCapturedEvent = {
    type: 'VendCaptured',
    vendId: toVendId('vend-1'),
    operatorId,
    machineId: toMachineId('machine-1'),
    badgeId: toBadgeId('badge-1'),
    idempotencyKey: 'vendor-event-123',
    productCode: 'BEVERAGE-COLA',
    amount: 150,
    vendedAt: new Date('2024-01-01T12:00:00Z'),
  };

  const mockRawEvent: RawVendorEvent = {
    rawPayload: {
      vendor_event_id: 'vendor-event-123',
      vendor_machine_id: 'machine-1',
      vendor_product_code: 'MDB-001-COLA',
      vendor_amount_cents: 150,
      vendor_card_id: 'badge-1',
      vendor_timestamp: '2024-01-01T12:00:00Z',
    },
  };

  let acl: jest.Mocked<VendorAcl>;
  let vendRepo: jest.Mocked<VendRepository>;
  let useCase: CaptureVendUseCase;

  beforeEach(() => {
    acl = {
      translateVendEvent: jest.fn().mockReturnValue(mockCanonicalEvent),
    };
    vendRepo = {
      captureVend: jest.fn(),
    };

    useCase = new CaptureVendUseCase(acl, vendRepo);
  });

  it('should capture a new vend (CAPTURED)', async () => {
    vendRepo.captureVend.mockResolvedValue(VendStatus.CAPTURED);

    const result = await useCase.execute({ operatorId, rawEvent: mockRawEvent });

    expect(result.status).toBe(VendStatus.CAPTURED);
    expect(result.event).toBe(mockCanonicalEvent);
    expect(acl.translateVendEvent).toHaveBeenCalledWith(operatorId, mockRawEvent);
    expect(vendRepo.captureVend).toHaveBeenCalledWith(mockCanonicalEvent);
  });

  it('should return DUPLICATE when vend already exists (no-op)', async () => {
    vendRepo.captureVend.mockResolvedValue(VendStatus.DUPLICATE);

    const result = await useCase.execute({ operatorId, rawEvent: mockRawEvent });

    expect(result.status).toBe(VendStatus.DUPLICATE);
    expect(result.event).toBe(mockCanonicalEvent);
  });

  it('should pass raw event through ACL for translation', async () => {
    vendRepo.captureVend.mockResolvedValue(VendStatus.CAPTURED);

    await useCase.execute({ operatorId, rawEvent: mockRawEvent });

    // ACL is called with the correct operator and raw event
    expect(acl.translateVendEvent).toHaveBeenCalledTimes(1);
    expect(acl.translateVendEvent).toHaveBeenCalledWith(operatorId, mockRawEvent);
  });

  it('should propagate ACL errors (invalid vendor format)', async () => {
    acl.translateVendEvent.mockImplementation(() => {
      throw new Error('Vendor payload missing required field: vendor_event_id');
    });

    await expect(
      useCase.execute({ operatorId, rawEvent: { rawPayload: {} } }),
    ).rejects.toThrow('Vendor payload missing required field');

    // Repository should NOT have been called
    expect(vendRepo.captureVend).not.toHaveBeenCalled();
  });
});
