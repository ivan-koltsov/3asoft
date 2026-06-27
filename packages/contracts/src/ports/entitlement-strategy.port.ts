/**
 * Domain Port — Entitlement Strategy (Strategy pattern)
 *
 * The authorization use-case delegates the entitlement decision to a
 * swappable strategy. The use-case depends on this port — never on the
 * strategy's internals.
 */

import { AuthorizationDecision } from '../value-objects';
import { Entitlement } from './entitlement-repository.port';

export interface EntitlementStrategy {
  /**
   * Evaluate whether the entitlements grant access.
   * Must be a pure function — no I/O, no side effects.
   */
  evaluate(entitlements: Entitlement[]): AuthorizationDecision;
}

export const ENTITLEMENT_STRATEGY = Symbol('EntitlementStrategy');
