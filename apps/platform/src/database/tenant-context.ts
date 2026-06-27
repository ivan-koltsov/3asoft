/**
 * Tenant Context — extracts operator ID from the request and provides
 * a transaction-scoped Knex connection with RLS context set.
 *
 * The middleware reads X-Operator-Id from the header. In production this
 * would come from the API gateway / Cognito JWT. For V1, the header
 * simulates that.
 *
 * The TenantConnection provides a Knex transaction that has already
 * executed `SET LOCAL app.current_operator_id = '<operator_id>'`,
 * ensuring all queries in this request are RLS-scoped.
 */

import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  Inject,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import { Knex } from 'knex';
import { KNEX } from './database.module';
import { OperatorId, toOperatorId } from '@hatch/contracts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TENANT_ID = Symbol('TENANT_ID');
export const TENANT_CONNECTION = Symbol('TENANT_CONNECTION');

/**
 * Middleware: extract and validate X-Operator-Id header.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const operatorId = req.headers['x-operator-id'];

    if (!operatorId || typeof operatorId !== 'string') {
      throw new BadRequestException('X-Operator-Id header is required');
    }

    if (!UUID_REGEX.test(operatorId)) {
      throw new BadRequestException('X-Operator-Id must be a valid UUID');
    }

    // Attach to request for downstream providers
    (req as any).tenantId = toOperatorId(operatorId);
    next();
  }
}

/**
 * Request-scoped provider: extracts the tenantId set by the middleware.
 */
export const TenantIdProvider = {
  provide: TENANT_ID,
  scope: Scope.REQUEST,
  useFactory: (req: Request): OperatorId => {
    return (req as any).tenantId;
  },
  inject: [REQUEST],
};

/**
 * Request-scoped provider: creates a Knex transaction with the tenant
 * context set via SET LOCAL. This transaction is automatically committed
 * or rolled back by the TenantTransactionInterceptor.
 */
export const TenantConnectionProvider = {
  provide: TENANT_CONNECTION,
  scope: Scope.REQUEST,
  useFactory: async (db: Knex, req: Request): Promise<Knex> => {
    const tenantId = (req as any).tenantId as OperatorId;
    if (!tenantId) {
      // Fail-closed: if no tenant context, return a raw connection
      // that RLS will block everything on.
      return db;
    }

    const trx = await db.transaction();
    // SET LOCAL scopes the variable to this transaction only — no leak.
    await trx.raw(`SET LOCAL app.current_operator_id = ?`, [tenantId]);
    // Store the transaction on the request so the interceptor can commit/rollback.
    (req as any).__tenantTrx = trx;
    return trx;
  },
  inject: [KNEX, REQUEST],
};
