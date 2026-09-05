/**
 * KS Sentinel 2.0 — Local Sentinel Agent Lifecycle
 * Module 3: Local Sentinel Agent
 *
 * Explicit lifecycle state machine for the agent process.
 */

const EventEmitter = require('events');

const LifecycleState = Object.freeze({
  STARTING: 'STARTING',
  READY: 'READY',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED'
});

// Allowed transitions map
const VALID_TRANSITIONS = {
  [LifecycleState.STARTING]: [LifecycleState.READY, LifecycleState.STOPPING],
  [LifecycleState.READY]: [LifecycleState.CONNECTING, LifecycleState.STOPPING],
  [LifecycleState.CONNECTING]: [LifecycleState.CONNECTED, LifecycleState.READY, LifecycleState.STOPPING],
  [LifecycleState.CONNECTED]: [LifecycleState.CONNECTING, LifecycleState.READY, LifecycleState.STOPPING],
  [LifecycleState.STOPPING]: [LifecycleState.STOPPED],
  [LifecycleState.STOPPED]: []
};

class AgentLifecycle extends EventEmitter {
  constructor() {
    super();
    this.currentState = LifecycleState.STARTING;
    this.stateHistory = [
      { state: this.currentState, timestamp: new Date().toISOString() }
    ];
  }

  get state() {
    return this.currentState;
  }

  /**
   * Transition to a new lifecycle state if allowed.
   */
  transitionTo(nextState, reason = '') {
    if (this.currentState === nextState) return;

    const allowed = VALID_TRANSITIONS[this.currentState] || [];
    if (!allowed.includes(nextState)) {
      throw new Error(`Invalid lifecycle transition from ${this.currentState} to ${nextState}`);
    }

    const previousState = this.currentState;
    this.currentState = nextState;
    const record = { state: nextState, previousState, reason, timestamp: new Date().toISOString() };
    this.stateHistory.push(record);

    this.emit('stateChange', { previousState, currentState: nextState, reason });
  }

  isStoppingOrStopped() {
    return this.currentState === LifecycleState.STOPPING || this.currentState === LifecycleState.STOPPED;
  }
}

module.exports = {
  LifecycleState,
  AgentLifecycle
};

