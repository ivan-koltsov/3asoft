/**
 * CaptureVendUseCase — Application layer (Metering context)
 *
 * Orchestrates vend capture:
 * 1. Receive raw vendor event
 * 2. Translate through ACL → canonical VendCapturedEvent
 * 3. Persist with idempotency guarantee
 *
 * The use-case depends only on ports — never on adapters.
 */

import { Injectable, Inject } from '@nestjs/common';
import {
  OperatorId,
  VendStatus,
  VendRepository,
  VEND_REPOSITORY,
  VendorAcl,
  VENDOR_ACL,
  RawVendorEvent,
  VendCapturedEvent,
} from '@hatch/contracts';

export interface CaptureVendRequest {
  readonly operatorId: OperatorId;
  readonly rawEvent: RawVendorEvent;
}

export interface CaptureVendResult {
  readonly status: VendStatus;
  readonly event: VendCapturedEvent;
}

@Injectable()
export class CaptureVendUseCase {
  constructor(
    @Inject(VENDOR_ACL) private readonly acl: VendorAcl,
    @Inject(VEND_REPOSITORY) private readonly vendRepo: VendRepository,
  ) {}

  async execute(request: CaptureVendRequest): Promise<CaptureVendResult> {
    // Step 1: Translate vendor dialect → canonical event via ACL
    const canonicalEvent = this.acl.translateVendEvent(
      request.operatorId,
      request.rawEvent,
    );

    // Step 2: Persist with idempotency — duplicates are a silent no-op
    const status = await this.vendRepo.captureVend(canonicalEvent);

    return { status, event: canonicalEvent };
  }
}
