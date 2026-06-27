/**
 * AuthorizeAccessUseCase — Application layer
 *
 * Orchestrates the authorization flow:
 * 1. Validate machine exists for this tenant
 * 2. Load entitlements for the badge + machine
 * 3. Delegate to the entitlement strategy
 * 4. Log the decision (audit trail)
 * 5. Return the decision
 *
 * FAIL-CLOSED: Any exception at any step → DENY + log.
 * The use-case depends only on ports (from contracts) — never on
 * adapters, DB clients, or vendor SDKs.
 */

import { Injectable, Inject } from '@nestjs/common';
import {
  OperatorId,
  BadgeId,
  MachineId,
  AuthorizationDecision,
  AuthorizationDenialReason,
  EntitlementRepository,
  ENTITLEMENT_REPOSITORY,
  MachineRepository,
  MACHINE_REPOSITORY,
  AuthorizationLogger,
  AUTHORIZATION_LOGGER,
  EntitlementStrategy,
  ENTITLEMENT_STRATEGY,
} from '@hatch/contracts';

export interface AuthorizeRequest {
  readonly operatorId: OperatorId;
  readonly badgeId: BadgeId;
  readonly machineId: MachineId;
}

export interface AuthorizeResult {
  readonly decision: AuthorizationDecision;
  readonly reason?: AuthorizationDenialReason;
}

@Injectable()
export class AuthorizeAccessUseCase {
  constructor(
    @Inject(MACHINE_REPOSITORY)
    private readonly machineRepo: MachineRepository,
    @Inject(ENTITLEMENT_REPOSITORY)
    private readonly entitlementRepo: EntitlementRepository,
    @Inject(ENTITLEMENT_STRATEGY)
    private readonly strategy: EntitlementStrategy,
    @Inject(AUTHORIZATION_LOGGER)
    private readonly logger: AuthorizationLogger,
  ) {}

  /**
   * Execute the authorization decision.
   *
   * INVARIANT: This method NEVER throws. It always returns a decision.
   * On any error, it returns DENIED with INTERNAL_ERROR reason.
   */
  async execute(request: AuthorizeRequest): Promise<AuthorizeResult> {
    try {
      return await this.doAuthorize(request);
    } catch (error) {
      // FAIL-CLOSED: any unhandled error → deny
      const result: AuthorizeResult = {
        decision: AuthorizationDecision.DENIED,
        reason: AuthorizationDenialReason.INTERNAL_ERROR,
      };

      // Best-effort logging of the error decision
      try {
        await this.logger.logDecision({
          operatorId: request.operatorId,
          badgeId: request.badgeId,
          machineId: request.machineId,
          decision: result.decision,
          reason: result.reason,
        });
      } catch {
        // If even logging fails, we still deny. Never throw from here.
      }

      return result;
    }
  }

  private async doAuthorize(request: AuthorizeRequest): Promise<AuthorizeResult> {
    const { operatorId, badgeId, machineId } = request;

    // Step 1: Verify machine exists and belongs to this operator
    const machine = await this.machineRepo.findMachine(machineId, operatorId);
    if (!machine) {
      const result: AuthorizeResult = {
        decision: AuthorizationDecision.DENIED,
        reason: AuthorizationDenialReason.MACHINE_NOT_FOUND,
      };
      await this.logger.logDecision({
        operatorId, badgeId, machineId,
        decision: result.decision,
        reason: result.reason,
      });
      return result;
    }

    // Step 2: Load entitlements
    const entitlements = await this.entitlementRepo.findEntitlements(
      operatorId, badgeId, machineId,
    );

    // Step 3: Delegate to strategy
    const decision = this.strategy.evaluate(entitlements);

    const reason = decision === AuthorizationDecision.DENIED
      ? AuthorizationDenialReason.NO_ENTITLEMENT
      : undefined;

    const result: AuthorizeResult = { decision, reason };

    // Step 4: Log the decision
    await this.logger.logDecision({
      operatorId, badgeId, machineId,
      decision: result.decision,
      reason: result.reason,
    });

    return result;
  }
}
