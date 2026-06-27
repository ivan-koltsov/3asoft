/**
 * @hatch/contracts — Shared Kernel
 *
 * The ubiquitous language of the Hatch platform: branded IDs, value objects,
 * canonical events, event envelopes, and port interfaces.
 *
 * This package is the single source of truth for cross-context types.
 * Domain and application layers depend ONLY on this package — never on
 * adapters, ORMs, or vendor SDKs.
 */

export * from './ids';
export * from './value-objects';
export * from './event-envelope';
export * from './events';
export * from './ports';
