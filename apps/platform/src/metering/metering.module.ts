/**
 * Metering Module — wires the metering bounded context.
 */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import {
  VEND_REPOSITORY,
  VENDOR_ACL,
} from '@hatch/contracts';

// Inbound adapters
import { VendorWebhookController } from './adapters/inbound/vendor-webhook.controller';

// Outbound adapters
import { PgVendRepository } from './adapters/outbound/pg-vend.repository';
import { VendorAclAdapter } from './adapters/outbound/vendor-acl/vendor-acl.adapter';

// Application
import { CaptureVendUseCase } from './application/capture-vend.use-case';

// Infrastructure
import { TenantContextMiddleware, TenantIdProvider, TenantConnectionProvider } from '../database/tenant-context';

@Module({
  controllers: [VendorWebhookController],
  providers: [
    // Use-case
    CaptureVendUseCase,

    // Port → Adapter bindings
    { provide: VEND_REPOSITORY, useClass: PgVendRepository },
    { provide: VENDOR_ACL, useClass: VendorAclAdapter },

    // Tenant context (request-scoped)
    TenantIdProvider,
    TenantConnectionProvider,
  ],
})
export class MeteringModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
