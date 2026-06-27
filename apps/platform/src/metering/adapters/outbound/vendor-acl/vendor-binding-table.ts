/**
 * Vendor Binding Table — maps vendor vocabulary → canonical terms.
 *
 * This is the core of the anti-corruption layer. The vendor's dialect
 * (product codes, machine references, event types) is translated here
 * and ONLY here. The domain never sees vendor vocabulary.
 *
 * In production, this table might be database-driven or config-driven.
 * For V1, it's a simple in-memory map.
 */

export interface VendorProductMapping {
  /** Vendor's product code (e.g. "MDB-001-COLA") */
  readonly vendorCode: string;
  /** Our canonical product code */
  readonly canonicalCode: string;
  /** Human-readable name (optional) */
  readonly name?: string;
}

/**
 * The binding table. In production, this would be loaded from a database
 * or configuration service per-operator.
 */
const PRODUCT_BINDINGS: Map<string, VendorProductMapping> = new Map([
  ['MDB-001-COLA', { vendorCode: 'MDB-001-COLA', canonicalCode: 'BEVERAGE-COLA', name: 'Cola' }],
  ['MDB-002-WATER', { vendorCode: 'MDB-002-WATER', canonicalCode: 'BEVERAGE-WATER', name: 'Water' }],
  ['MDB-003-CHIPS', { vendorCode: 'MDB-003-CHIPS', canonicalCode: 'SNACK-CHIPS', name: 'Chips' }],
  ['MDB-004-CANDY', { vendorCode: 'MDB-004-CANDY', canonicalCode: 'SNACK-CANDY', name: 'Candy Bar' }],
]);

export class VendorBindingTable {
  /**
   * Translate a vendor product code to canonical.
   * Unknown codes pass through with a "UNMAPPED-" prefix for visibility.
   */
  translateProductCode(vendorCode: string): string {
    const mapping = PRODUCT_BINDINGS.get(vendorCode);
    return mapping ? mapping.canonicalCode : `UNMAPPED-${vendorCode}`;
  }

  /**
   * Translate a vendor machine reference to our canonical machine ID.
   * In V1, vendor machine refs are stored as external_ref on the machine table.
   * The ACL adapter handles the lookup; the binding table just normalizes the format.
   */
  normalizeMachineRef(vendorMachineRef: string): string {
    // Strip any vendor-specific prefixes
    return vendorMachineRef.replace(/^NAYAX-|^CANT-/, '');
  }
}
