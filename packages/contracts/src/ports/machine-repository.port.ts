/**
 * Outbound Port — Machine Repository
 */

import { MachineId, OperatorId } from '../ids';

export interface Machine {
  readonly id: MachineId;
  readonly operatorId: OperatorId;
  readonly name: string;
  readonly externalRef: string;
}

export interface MachineRepository {
  /** Find a machine by ID within the operator's tenant. */
  findMachine(
    machineId: MachineId,
    operatorId: OperatorId,
  ): Promise<Machine | null>;
}

export const MACHINE_REPOSITORY = Symbol('MachineRepository');
