/**
 * Branded IDs — nominal typing for domain identifiers.
 *
 * Branded types prevent accidental mixing of ID types at compile time.
 * At runtime they are plain strings (UUIDs), but TypeScript treats
 * OperatorId, MachineId, etc. as incompatible types.
 */

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** Tenant identifier — the isolation boundary. */
export type OperatorId = Brand<string, 'OperatorId'>;

/** A vending machine belonging to one operator. */
export type MachineId = Brand<string, 'MachineId'>;

/** An opaque badge credential — non-PII. */
export type BadgeId = Brand<string, 'BadgeId'>;

/** A single vend (dispense event). */
export type VendId = Brand<string, 'VendId'>;

/** An entitlement record linking badge to machine. */
export type EntitlementId = Brand<string, 'EntitlementId'>;

/** Authorization log entry identifier. */
export type AuthorizationLogId = Brand<string, 'AuthorizationLogId'>;

// ── Factory helpers ──────────────────────────────────────────────────

export function toOperatorId(value: string): OperatorId {
  return value as OperatorId;
}

export function toMachineId(value: string): MachineId {
  return value as MachineId;
}

export function toBadgeId(value: string): BadgeId {
  return value as BadgeId;
}

export function toVendId(value: string): VendId {
  return value as VendId;
}

export function toEntitlementId(value: string): EntitlementId {
  return value as EntitlementId;
}

export function toAuthorizationLogId(value: string): AuthorizationLogId {
  return value as AuthorizationLogId;
}
