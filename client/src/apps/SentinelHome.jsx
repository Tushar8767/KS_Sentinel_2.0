import React from 'react';

/**
 * Sentinel Home — Welcome & About
 * Module 1 demo application. Shows system identity and module status.
 */
export default function SentinelHome() {
  return (
    <div className="app-sentinel-home">
      <div className="app-section">
        <h2 className="app-heading">Welcome to KS Sentinel 2.0</h2>
        <p className="app-text">
          Web-based Virtual Operating Environment providing secure, controlled
          remote access to authorized local-machine resources.
        </p>
      </div>

      <div className="app-section">
        <h3 className="app-subheading">Architecture</h3>
        <pre className="app-diagram">
{`Web OS Client (React + Vite)
        ↓
Secure Server Gateway (Express)
        ↓
Local Sentinel Agent (Windows)
        ↓
Authorized Capabilities`}
        </pre>
      </div>

      <div className="app-section">
        <h3 className="app-subheading">Module Status</h3>
        <div className="app-status-grid">
          <div className="app-status-row">
            <span className="app-status-label">Module 0 — Architecture Foundation</span>
            <span className="app-status-value app-status-locked">LOCKED</span>
          </div>
          <div className="app-status-row">
            <span className="app-status-label">Module 1 — Web OS Shell</span>
            <span className="app-status-value app-status-active">ACTIVE</span>
          </div>
          <div className="app-status-row">
            <span className="app-status-label">Module 2 — Dashboard</span>
            <span className="app-status-value app-status-active">ACTIVE</span>
          </div>
          <div className="app-status-row">
            <span className="app-status-label">Module 3 — Local Sentinel Agent</span>
            <span className="app-status-value app-status-active">ACTIVE</span>
          </div>
          <div className="app-status-row">
            <span className="app-status-label">Module 4 — Remote Machine Information</span>
            <span className="app-status-value app-status-active">ACTIVE</span>
          </div>
          <div className="app-status-row">
            <span className="app-status-label">Module 5 — Sentinel Workspace</span>
            <span className="app-status-value app-status-active">ACTIVE</span>
          </div>
          <div className="app-status-row">
            <span className="app-status-label">Module 6 — Projects</span>
            <span className="app-status-value app-status-active">ACTIVE</span>
          </div>
          <div className="app-status-row">
            <span className="app-status-label">Modules 7–27</span>
            <span className="app-status-value app-status-pending">PENDING</span>
          </div>
        </div>
      </div>

      <div className="app-section">
        <h3 className="app-subheading">Core Principles</h3>
        <ul className="app-list">
          <li>Local-first architecture</li>
          <li>Least privilege access</li>
          <li>Explicit authorization</li>
          <li>AI is not authority</li>
          <li>Capability-based security</li>
        </ul>
      </div>
    </div>
  );
}
