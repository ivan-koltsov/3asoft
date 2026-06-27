/**
 * Unit Tests — AuthorizeAccessUseCase
 *
 * Tests the authorization orchestration including:
 * - Happy path (ALLOWED)
 * - Denied path (no entitlement)
 * - Machine not found (DENIED)
 * - Fail-closed (repository throws → DENIED + INTERNAL_ERROR)
 * - Fail-closed (strategy throws → DENIED + INTERNAL_ERROR)
 */

import {
  AuthorizationDecision,
  AuthorizationDenialReason,
  AuthorizationLogger,
  AuthorizationLogEntry,
  Entitlement,
  EntitlementRepository,
  EntitlementStrategy,
  Machine,
  MachineRepository,
  toOperatorId,
  toBadgeId,
  toMachineId,
  toEntitlementId,
} from '@hatch/contracts';
import { AuthorizeAccessUseCase } from './authorize-access.use-case';

describe('AuthorizeAccessUseCase', () => {
  // ── Test fixtures ──────────────────────────────────────────────

  const operatorId = toOperatorId('11111111-1111-1111-1111-111111111111');
  const badgeId = toBadgeId('aabb1111-1111-1111-1111-111111111111');
  const machineId = toMachineId('aaaa1111-1111-1111-1111-111111111111');

  const mockMachine: Machine = {
    id: machineId,
    operatorId,
    name: 'Test Machine',
    externalRef: 'VM-001',
  };

  const mockEntitlement: Entitlement = {
    id: toEntitlementId('ent-1'),
    operatorId,
    badgeId,
    machineId,
    isActive: true,
  };

  // ── Mock implementations ──────────────────────────────────────

  let machineRepo: jest.Mocked<MachineRepository>;
  let entitlementRepo: jest.Mocked<EntitlementRepository>;
  let strategy: jest.Mocked<EntitlementStrategy>;
  let logger: jest.Mocked<AuthorizationLogger>;
  let useCase: AuthorizeAccessUseCase;

  beforeEach(() => {
    machineRepo = {
      findMachine: jest.fn(),
    };
    entitlementRepo = {
      findEntitlements: jest.fn(),
    };
    strategy = {
      evaluate: jest.fn(),
    };
    logger = {
      logDecision: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new AuthorizeAccessUseCase(
      machineRepo,
      entitlementRepo,
      strategy,
      logger,
    );
  });

  // ── Tests ─────────────────────────────────────────────────────

  it('should ALLOW when machine exists and badge has active entitlement', async () => {
    machineRepo.findMachine.mockResolvedValue(mockMachine);
    entitlementRepo.findEntitlements.mockResolvedValue([mockEntitlement]);
    strategy.evaluate.mockReturnValue(AuthorizationDecision.ALLOWED);

    const result = await useCase.execute({ operatorId, badgeId, machineId });

    expect(result.decision).toBe(AuthorizationDecision.ALLOWED);
    expect(result.reason).toBeUndefined();
    expect(logger.logDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decision: AuthorizationDecision.ALLOWED }),
    );
  });

  it('should DENY when badge has no entitlement', async () => {
    machineRepo.findMachine.mockResolvedValue(mockMachine);
    entitlementRepo.findEntitlements.mockResolvedValue([]);
    strategy.evaluate.mockReturnValue(AuthorizationDecision.DENIED);

    const result = await useCase.execute({ operatorId, badgeId, machineId });

    expect(result.decision).toBe(AuthorizationDecision.DENIED);
    expect(result.reason).toBe(AuthorizationDenialReason.NO_ENTITLEMENT);
  });

  it('should DENY when machine is not found', async () => {
    machineRepo.findMachine.mockResolvedValue(null);

    const result = await useCase.execute({ operatorId, badgeId, machineId });

    expect(result.decision).toBe(AuthorizationDecision.DENIED);
    expect(result.reason).toBe(AuthorizationDenialReason.MACHINE_NOT_FOUND);
    // Should NOT have queried entitlements
    expect(entitlementRepo.findEntitlements).not.toHaveBeenCalled();
  });

  it('should DENY (fail-closed) when machine repository throws', async () => {
    machineRepo.findMachine.mockRejectedValue(new Error('DB connection lost'));

    const result = await useCase.execute({ operatorId, badgeId, machineId });

    expect(result.decision).toBe(AuthorizationDecision.DENIED);
    expect(result.reason).toBe(AuthorizationDenialReason.INTERNAL_ERROR);
  });

  it('should DENY (fail-closed) when entitlement repository throws', async () => {
    machineRepo.findMachine.mockResolvedValue(mockMachine);
    entitlementRepo.findEntitlements.mockRejectedValue(new Error('Query timeout'));

    const result = await useCase.execute({ operatorId, badgeId, machineId });

    expect(result.decision).toBe(AuthorizationDecision.DENIED);
    expect(result.reason).toBe(AuthorizationDenialReason.INTERNAL_ERROR);
  });

  it('should DENY (fail-closed) when strategy throws', async () => {
    machineRepo.findMachine.mockResolvedValue(mockMachine);
    entitlementRepo.findEntitlements.mockResolvedValue([mockEntitlement]);
    strategy.evaluate.mockImplementation(() => {
      throw new Error('Strategy bug');
    });

    const result = await useCase.execute({ operatorId, badgeId, machineId });

    expect(result.decision).toBe(AuthorizationDecision.DENIED);
    expect(result.reason).toBe(AuthorizationDenialReason.INTERNAL_ERROR);
  });

  it('should still DENY even if error-path logging fails', async () => {
    machineRepo.findMachine.mockRejectedValue(new Error('DB down'));
    logger.logDecision.mockRejectedValue(new Error('Logger also down'));

    const result = await useCase.execute({ operatorId, badgeId, machineId });

    // Even when everything is broken, we deny — never throw, never allow.
    expect(result.decision).toBe(AuthorizationDecision.DENIED);
    expect(result.reason).toBe(AuthorizationDenialReason.INTERNAL_ERROR);
  });

  it('should log every decision', async () => {
    machineRepo.findMachine.mockResolvedValue(mockMachine);
    entitlementRepo.findEntitlements.mockResolvedValue([mockEntitlement]);
    strategy.evaluate.mockReturnValue(AuthorizationDecision.ALLOWED);

    await useCase.execute({ operatorId, badgeId, machineId });

    expect(logger.logDecision).toHaveBeenCalledTimes(1);
    expect(logger.logDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId,
        badgeId,
        machineId,
        decision: AuthorizationDecision.ALLOWED,
      }),
    );
  });
});
