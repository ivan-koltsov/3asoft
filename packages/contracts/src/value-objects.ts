/**
 * Value Objects — immutable domain primitives.
 */

/** The result of an authorization decision. */
export enum AuthorizationDecision {
  /** Badge is entitled — dispense. */
  ALLOWED = 'ALLOWED',
  /** Badge is not entitled — deny. */
  DENIED = 'DENIED',
  /** Decision could not be made — fail closed (deny). */
  ERROR = 'ERROR',
}

/** The outcome of attempting to capture a vend. */
export enum VendStatus {
  /** Vend was newly captured. */
  CAPTURED = 'CAPTURED',
  /** Vend was a duplicate — no-op. */
  DUPLICATE = 'DUPLICATE',
}

/** Denial / error reason codes for authorization audit trail. */
export enum AuthorizationDenialReason {
  NO_ENTITLEMENT = 'NO_ENTITLEMENT',
  MACHINE_NOT_FOUND = 'MACHINE_NOT_FOUND',
  BADGE_NOT_FOUND = 'BADGE_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
