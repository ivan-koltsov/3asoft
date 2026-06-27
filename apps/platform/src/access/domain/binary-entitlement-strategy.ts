/**
 * BinaryEntitlementStrategy — Domain logic
 *
 * The simplest entitlement strategy: allowed if at least one active
 * entitlement exists, denied otherwise.
 *
 * This is pure domain logic — no I/O, no side effects, no imports
 * from adapters or infrastructure. It depends only on the contracts
 * package (shared kernel).
 */

import {
  AuthorizationDecision,
  EntitlementStrategy,
  Entitlement,
} from '@hatch/contracts';

export class BinaryEntitlementStrategy implements EntitlementStrategy {
  /**
   * Binary evaluation: at least one active entitlement → ALLOWED.
   * No entitlements → DENIED.
   */
  evaluate(entitlements: Entitlement[]): AuthorizationDecision {
    if (entitlements.length > 0 && entitlements.some((e) => e.isActive)) {
      return AuthorizationDecision.ALLOWED;
    }
    return AuthorizationDecision.DENIED;
  }
}
