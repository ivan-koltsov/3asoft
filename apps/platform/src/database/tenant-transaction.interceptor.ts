/**
 * TenantTransactionInterceptor — commits or rolls back the per-request
 * tenant transaction created by TenantConnectionProvider.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      tap(async () => {
        const trx = (req as any).__tenantTrx;
        if (trx && !trx.isCompleted()) {
          await trx.commit();
        }
      }),
      catchError(async (err) => {
        const trx = (req as any).__tenantTrx;
        if (trx && !trx.isCompleted()) {
          await trx.rollback();
        }
        return throwError(() => err);
      }),
    );
  }
}
