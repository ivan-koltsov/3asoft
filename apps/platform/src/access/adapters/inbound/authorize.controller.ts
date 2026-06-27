/**
 * Inbound Adapter — Authorize Controller
 *
 * HTTP endpoint for authorization requests. Validates input via DTOs,
 * delegates to the use-case, and returns the decision.
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
import { IsString, IsUUID } from 'class-validator';
import { toBadgeId, toMachineId, toOperatorId } from '@hatch/contracts';
import { AuthorizeAccessUseCase } from '../../application/authorize-access.use-case';
import { TenantTransactionInterceptor } from '../../../database/tenant-transaction.interceptor';

// ── DTO ──────────────────────────────────────────────────────────

export class AuthorizeRequestDto {
  @IsUUID()
  badgeId!: string;

  @IsUUID()
  machineId!: string;
}

export class AuthorizeResponseDto {
  decision!: string;
  reason?: string;
}

// ── Controller ───────────────────────────────────────────────────

@Controller('authorize')
@UseInterceptors(TenantTransactionInterceptor)
export class AuthorizeController {
  constructor(private readonly authorizeUseCase: AuthorizeAccessUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async authorize(
    @Headers('x-operator-id') operatorIdHeader: string,
    @Body() dto: AuthorizeRequestDto,
  ): Promise<AuthorizeResponseDto> {
    if (!operatorIdHeader) {
      throw new BadRequestException('X-Operator-Id header is required');
    }

    const result = await this.authorizeUseCase.execute({
      operatorId: toOperatorId(operatorIdHeader),
      badgeId: toBadgeId(dto.badgeId),
      machineId: toMachineId(dto.machineId),
    });

    return {
      decision: result.decision,
      reason: result.reason,
    };
  }
}
