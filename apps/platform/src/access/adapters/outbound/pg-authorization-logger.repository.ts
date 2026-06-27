/**
 * Outbound Adapter — Postgres Authorization Logger
 */

import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import {
  AuthorizationLogger,
  AuthorizationLogEntry,
} from '@hatch/contracts';
import { TENANT_CONNECTION } from '../../../database/tenant-context';

@Injectable()
export class PgAuthorizationLogger implements AuthorizationLogger {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: Knex,
  ) {}

  async logDecision(entry: AuthorizationLogEntry): Promise<void> {
    await this.db('authorization_logs').insert({
      operator_id: entry.operatorId,
      badge_id: entry.badgeId,
      machine_id: entry.machineId,
      decision: entry.decision,
      reason: entry.reason ?? null,
    });
  }
}
