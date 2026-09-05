/**
 * KS Sentinel 2.0 — Local Sentinel Agent Capability Discovery Foundation
 * Module 4: Remote Machine Information
 *
 * Establishes the capability catalog abstraction.
 * Registers explicit, typed, read-only capabilities.
 *
 * STRICT SECURITY POLICY:
 * Future capabilities will be explicit, typed, policy-governed capabilities
 * mediated by the Execution Broker.
 * Under NO circumstances does this file or the agent provide generic
 * execute(command), runShell(), or arbitrary OS process execution.
 */

class CapabilityRegistry {
  constructor() {
    this.capabilities = new Map();

    // Module 4 Explicit Capability: Safe, Read-Only Machine Information
    this.registerCapability({
      id: 'machine.info.read',
      name: 'Machine Information Read',
      version: '1.0.0',
      description: 'Safe, read-only host platform, OS, CPU, memory, storage, and uptime metadata',
      enabled: true
    });
  }

  /**
   * Register a defined capability.
   */
  registerCapability(cap) {
    if (!cap || !cap.id) throw new Error('Capability must have an id');
    this.capabilities.set(cap.id, cap);
  }

  /**
   * Check if a capability is registered and enabled.
   */
  hasCapability(id) {
    const cap = this.capabilities.get(id);
    return Boolean(cap && cap.enabled);
  }

  /**
   * Return a read-only list of capability descriptors.
   */
  getCapabilityDescriptors() {
    const list = [];
    for (const [id, cap] of this.capabilities.entries()) {
      list.push({
        id,
        name: cap.name,
        version: cap.version,
        description: cap.description,
        enabled: Boolean(cap.enabled)
      });
    }
    return list;
  }

  /**
   * Number of registered capabilities.
   */
  get count() {
    return this.capabilities.size;
  }
}

module.exports = {
  CapabilityRegistry
};
