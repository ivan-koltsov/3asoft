/**
 * Inbound Adapter — Vendor Webhook Controller
 *
 * Receives raw vendor events, passes them through the ACL via
 * the CaptureVendUseCase, and returns the capture result.
 */

import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { IsObject, IsNotEmpty } from 'class-validator';
import { toOperatorId } from '@hatch/contracts';
import { CaptureVendUseCase } from '../../application/capture-vend.use-case';
import { TenantTransactionInterceptor } from '../../../database/tenant-transaction.interceptor';

// ── DTO ──────────────────────────────────────────────────────────

export class VendorWebhookDto {
  @IsObject()
  @IsNotEmpty()
  rawPayload!: Record<string, unknown>;
}

export class VendCaptureResponseDto {
  status!: string;
  idempotencyKey?: string;
}

// ── Controller ───────────────────────────────────────────────────

@Controller('vendor/webhook')
@UseInterceptors(TenantTransactionInterceptor)
export class VendorWebhookController {
  constructor(private readonly captureVendUseCase: CaptureVendUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleVendEvent(
    @Headers('x-operator-id') operatorIdHeader: string,
    @Body() dto: VendorWebhookDto,
  ): Promise<VendCaptureResponseDto> {
    if (!operatorIdHeader) {
      throw new BadRequestException('X-Operator-Id header is required');
    }

    const result = await this.captureVendUseCase.execute({
      operatorId: toOperatorId(operatorIdHeader),
      rawEvent: { rawPayload: dto.rawPayload },
    });

    return {
      status: result.status,
      idempotencyKey: result.event.idempotencyKey,
    };
  }
}
