/**
 * Outbound Port — Authorization Logger
 *
 * Records authorization decisions for audit trail.
 */

import { BadgeId, MachineId, OperatorId } from '../ids';
import { AuthorizationDecision, AuthorizationDenialReason } from '../value-objects';

export interface AuthorizationLogEntry {
  readonly operatorId: OperatorId;
  readonly badgeId: BadgeId;
  readonly machineId: MachineId;
  readonly decision: AuthorizationDecision;
  readonly reason?: AuthorizationDenialReason;
}

export interface AuthorizationLogger {
  /** Log an authorization decision for the audit trail. */
  logDecision(entry: AuthorizationLogEntry): Promise<void>;
}

export const AUTHORIZATION_LOGGER = Symbol('AuthorizationLogger');
