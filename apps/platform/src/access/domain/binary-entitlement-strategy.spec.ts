/**
 * Unit Tests — BinaryEntitlementStrategy
 *
 * Tests the pure domain logic of the binary entitlement evaluation.
 */

import { AuthorizationDecision, toEntitlementId, toOperatorId, toBadgeId, toMachineId, Entitlement } from '@hatch/contracts';
import { BinaryEntitlementStrategy } from './binary-entitlement-strategy';

describe('BinaryEntitlementStrategy', () => {
  let strategy: BinaryEntitlementStrategy;

  beforeEach(() => {
    strategy = new BinaryEntitlementStrategy();
  });

  const makeEntitlement = (isActive: boolean): Entitlement => ({
    id: toEntitlementId('ent-1'),
    operatorId: toOperatorId('op-1'),
    badgeId: toBadgeId('badge-1'),
    machineId: toMachineId('machine-1'),
    isActive,
  });

  it('should return ALLOWED when at least one active entitlement exists', () => {
    const entitlements = [makeEntitlement(true)];
    expect(strategy.evaluate(entitlements)).toBe(AuthorizationDecision.ALLOWED);
  });

  it('should return ALLOWED when multiple entitlements exist and at least one is active', () => {
    const entitlements = [makeEntitlement(false), makeEntitlement(true)];
    expect(strategy.evaluate(entitlements)).toBe(AuthorizationDecision.ALLOWED);
  });

  it('should return DENIED when no entitlements exist', () => {
    expect(strategy.evaluate([])).toBe(AuthorizationDecision.DENIED);
  });

  it('should return DENIED when all entitlements are inactive', () => {
    const entitlements = [makeEntitlement(false), makeEntitlement(false)];
    expect(strategy.evaluate(entitlements)).toBe(AuthorizationDecision.DENIED);
  });
});
