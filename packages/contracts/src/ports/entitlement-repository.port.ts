/**
 * Outbound Port — Entitlement Repository
 *
 * The access domain queries entitlements through this port.
 * Implementations are outbound adapters (e.g. Postgres).
 */

import { BadgeId, EntitlementId, MachineId, OperatorId } from '../ids';

export interface Entitlement {
  readonly id: EntitlementId;
  readonly operatorId: OperatorId;
  readonly badgeId: BadgeId;
  readonly machineId: MachineId;
  readonly isActive: boolean;
}

export interface EntitlementRepository {
  /**
   * Find all entitlements for a badge on a specific machine.
   * Returns only active entitlements.
   */
  findEntitlements(
    operatorId: OperatorId,
    badgeId: BadgeId,
    machineId: MachineId,
  ): Promise<Entitlement[]>;
}

export const ENTITLEMENT_REPOSITORY = Symbol('EntitlementRepository');
