/**
 * KS Sentinel 2.0 — Shell Event Bus
 * Module 1: Web OS Shell
 * 
 * Lightweight publish/subscribe event system for shell-level events.
 * Future modules can publish domain events (security, agent, etc.) into this bus.
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event type. Use '*' to subscribe to all events.
   * Returns an unsubscribe function.
   */
  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Publish an event to all subscribers of the given type and wildcard subscribers.
   */
  publish(eventType, payload = {}) {
    const event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
    };
    this.listeners.get(eventType)?.forEach((cb) => cb(event));
    if (eventType !== '*') {
      this.listeners.get('*')?.forEach((cb) => cb(event));
    }
  }
}

export const eventBus = new EventBus();

export const EventTypes = {
  APP_OPENED: 'APP_OPENED',
  APP_CLOSED: 'APP_CLOSED',
  WINDOW_FOCUSED: 'WINDOW_FOCUSED',
  WINDOW_MINIMIZED: 'WINDOW_MINIMIZED',
  WINDOW_RESTORED: 'WINDOW_RESTORED',
  WINDOW_MAXIMIZED: 'WINDOW_MAXIMIZED',
  COMMAND_EXECUTED: 'COMMAND_EXECUTED',
  // Module 5 — Sentinel Workspace Events
  WORKSPACE_CREATED: 'WORKSPACE_CREATED',
  WORKSPACE_OPENED: 'WORKSPACE_OPENED',
  WORKSPACE_CLOSED: 'WORKSPACE_CLOSED',
  WORKSPACE_SWITCHED: 'WORKSPACE_SWITCHED',
  WORKSPACE_UPDATED: 'WORKSPACE_UPDATED',
  WORKSPACE_DELETED: 'WORKSPACE_DELETED',
  // Module 6 — Projects Events
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_OPENED: 'PROJECT_OPENED',
  PROJECT_CLOSED: 'PROJECT_CLOSED',
  PROJECT_SWITCHED: 'PROJECT_SWITCHED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_DELETED: 'PROJECT_DELETED',
};
