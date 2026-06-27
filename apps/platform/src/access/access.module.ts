/**
 * Access Module — wires the access bounded context.
 *
 * Binds port interfaces to their adapter implementations.
 * The domain/application layers never know about the adapters.
 */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import {
  ENTITLEMENT_REPOSITORY,
  MACHINE_REPOSITORY,
  AUTHORIZATION_LOGGER,
  ENTITLEMENT_STRATEGY,
} from '@hatch/contracts';

// Inbound adapters
import { AuthorizeController } from './adapters/inbound/authorize.controller';

// Outbound adapters
import { PgEntitlementRepository } from './adapters/outbound/pg-entitlement.repository';
import { PgMachineRepository } from './adapters/outbound/pg-machine.repository';
import { PgAuthorizationLogger } from './adapters/outbound/pg-authorization-logger.repository';

// Domain
import { BinaryEntitlementStrategy } from './domain/binary-entitlement-strategy';

// Application
import { AuthorizeAccessUseCase } from './application/authorize-access.use-case';

// Infrastructure
import { TenantContextMiddleware, TenantIdProvider, TenantConnectionProvider } from '../database/tenant-context';

@Module({
  controllers: [AuthorizeController],
  providers: [
    // Use-case
    AuthorizeAccessUseCase,

    // Port → Adapter bindings
    { provide: ENTITLEMENT_REPOSITORY, useClass: PgEntitlementRepository },
    { provide: MACHINE_REPOSITORY, useClass: PgMachineRepository },
    { provide: AUTHORIZATION_LOGGER, useClass: PgAuthorizationLogger },
    { provide: ENTITLEMENT_STRATEGY, useClass: BinaryEntitlementStrategy },

    // Tenant context (request-scoped)
    TenantIdProvider,
    TenantConnectionProvider,
  ],
})
export class AccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
