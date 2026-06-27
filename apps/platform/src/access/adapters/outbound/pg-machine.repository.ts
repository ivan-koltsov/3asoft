/**
 * Outbound Adapter — Postgres Machine Repository
 */

import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import {
  MachineRepository,
  Machine,
  MachineId,
  OperatorId,
  toMachineId,
  toOperatorId,
} from '@hatch/contracts';
import { TENANT_CONNECTION } from '../../../database/tenant-context';

@Injectable()
export class PgMachineRepository implements MachineRepository {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: Knex,
  ) {}

  async findMachine(
    machineId: MachineId,
    _operatorId: OperatorId,
  ): Promise<Machine | null> {
    // RLS enforces operator_id filtering. We query by machine ID only.
    const row = await this.db('machines')
      .select('id', 'operator_id', 'name', 'external_ref')
      .where({ id: machineId })
      .first();

    if (!row) return null;

    return {
      id: toMachineId(row.id),
      operatorId: toOperatorId(row.operator_id),
      name: row.name,
      externalRef: row.external_ref,
    };
  }
}
