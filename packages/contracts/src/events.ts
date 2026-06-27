/**
 * Canonical Domain Events — the ubiquitous language as types.
 *
 * These events are vendor-agnostic. The vendor ACL translates vendor dialect
 * into these canonical forms. The domain never sees vendor types.
 */

import { BadgeId, MachineId, OperatorId, VendId } from './ids';
import { AuthorizationDecision, AuthorizationDenialReason } from './value-objects';

/** Raised when a badge tap is received and authorization is requested. */
export interface AuthorizationRequestedEvent {
  readonly type: 'AuthorizationRequested';
  readonly operatorId: OperatorId;
  readonly badgeId: BadgeId;
  readonly machineId: MachineId;
}

/** Raised after the authorization decision is made. */
export interface AuthorizationDecidedEvent {
  readonly type: 'AuthorizationDecided';
  readonly operatorId: OperatorId;
  readonly badgeId: BadgeId;
  readonly machineId: MachineId;
  readonly decision: AuthorizationDecision;
  readonly reason?: AuthorizationDenialReason;
}

/** The canonical vend event — a single metered dispense. */
export interface VendCapturedEvent {
  readonly type: 'VendCaptured';
  readonly vendId: VendId;
  readonly operatorId: OperatorId;
  readonly machineId: MachineId;
  readonly badgeId: BadgeId;
  /** Vendor-agnostic idempotency key (derived from vendor's event ID). */
  readonly idempotencyKey: string;
  /** Canonical product identifier (mapped from vendor product code). */
  readonly productCode: string;
  /** Amount in the smallest currency unit (cents). */
  readonly amount: number;
  /** When the vend occurred at the machine. */
  readonly vendedAt: Date;
}

export type DomainEvent =
  | AuthorizationRequestedEvent
  | AuthorizationDecidedEvent
  | VendCapturedEvent;
