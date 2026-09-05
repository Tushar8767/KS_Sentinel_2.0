/**
 * KS Sentinel 2.0 — Local Sentinel Agent Capability Discovery Foundation
 * Module 3: Local Sentinel Agent
 *
 * Establishes the capability catalog abstraction.
 * For Module 3, NO executable capabilities are registered.
 *
 * STRICT SECURITY POLICY:
 * Future capabilities will be explicit, typed, policy-governed capabilities
 * mediated by the Execution Broker.
 * Under NO circumstances does this file or the agent provide generic
 * execute(command), runShell(), or arbitrary OS process execution.
 */

class CapabilityRegistry {
  constructor() {
    // In Module 3: Zero executable capabilities are registered.
    this.capabilities = new Map();
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

