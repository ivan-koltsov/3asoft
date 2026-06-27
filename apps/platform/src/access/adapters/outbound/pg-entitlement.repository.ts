/**
 * Outbound Adapter — Postgres Entitlement Repository
 *
 * Queries entitlements using the tenant-scoped Knex connection.
 * RLS ensures only the current operator's rows are visible.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import {
  EntitlementRepository,
  Entitlement,
  OperatorId,
  BadgeId,
  MachineId,
  toEntitlementId,
  toOperatorId,
  toBadgeId,
  toMachineId,
} from '@hatch/contracts';
import { TENANT_CONNECTION } from '../../../database/tenant-context';

@Injectable()
export class PgEntitlementRepository implements EntitlementRepository {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: Knex,
  ) {}

  async findEntitlements(
    _operatorId: OperatorId,
    badgeId: BadgeId,
    machineId: MachineId,
  ): Promise<Entitlement[]> {
    // RLS handles operator filtering via app.current_operator_id.
    // We still parameterize badge_id and machine_id for correctness.
    const rows = await this.db('entitlements')
      .select('id', 'operator_id', 'badge_id', 'machine_id', 'is_active')
      .where({ badge_id: badgeId, machine_id: machineId, is_active: true });

    return rows.map((row: any) => ({
      id: toEntitlementId(row.id),
      operatorId: toOperatorId(row.operator_id),
      badgeId: toBadgeId(row.badge_id),
      machineId: toMachineId(row.machine_id),
      isActive: row.is_active,
    }));
  }
}
