import React from 'react';

/**
 * System Overview — Placeholder
 * Module 1 demo application. Real system data arrives in Module 3+ (Local Agent).
 */
export default function SystemOverview() {
  return (
    <div className="app-system-overview">
      <div className="app-section">
        <h2 className="app-heading">System Overview</h2>
        <p className="app-text app-text-muted">
          System telemetry requires the Local Sentinel Agent (Module 3+).
        </p>
      </div>

      <div className="app-placeholder-grid">
        <div className="app-placeholder-card">
          <span className="app-placeholder-icon">▣</span>
          <span className="app-placeholder-label">CPU</span>
          <span className="app-placeholder-value">[PLACEHOLDER]</span>
        </div>
        <div className="app-placeholder-card">
          <span className="app-placeholder-icon">▦</span>
          <span className="app-placeholder-label">Memory</span>
          <span className="app-placeholder-value">[PLACEHOLDER]</span>
        </div>
        <div className="app-placeholder-card">
          <span className="app-placeholder-icon">▤</span>
          <span className="app-placeholder-label">Storage</span>
          <span className="app-placeholder-value">[PLACEHOLDER]</span>
        </div>
        <div className="app-placeholder-card">
          <span className="app-placeholder-icon">▥</span>
          <span className="app-placeholder-label">Network</span>
          <span className="app-placeholder-value">[PLACEHOLDER]</span>
        </div>
      </div>

      <div className="app-section" style={{ marginTop: '1rem' }}>
        <p className="app-text app-text-muted" style={{ fontSize: '0.75rem' }}>
          Machine status, agent connection, and real telemetry will be
          available after Module 3 (Local Sentinel Agent) and Module 4
          (Remote Machine Information) are implemented.
        </p>
      </div>
    </div>
  );
}
