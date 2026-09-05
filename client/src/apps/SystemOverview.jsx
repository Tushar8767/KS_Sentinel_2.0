/**
 * KS Sentinel 2.0 — System Overview Application
 * Module 4 / Module 5 Integration
 *
 * Displays live host machine information from Module 4 telemetry provider.
 * When Local Sentinel Agent is connected, displays actual CPU, Memory, Storage,
 * and Network metrics. Gracefully handles offline state.
 */

import React, { useState, useEffect, useCallback } from 'react';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = Number(bytes);
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds) {
  if (!seconds || isNaN(seconds)) return '0m';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

export default function SystemOverview() {
  const [telemetry, setTelemetry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchTelemetry = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/machine/info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTelemetry(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch {
      setTelemetry({ available: false, message: 'Gateway communication error.' });
      setLastRefreshed(new Date().toLocaleTimeString());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const isAvailable = Boolean(telemetry && telemetry.available);
  const machine = telemetry?.machine;
  const cpu = telemetry?.cpu;
  const memory = telemetry?.memory;
  const storage = telemetry?.storage;
  const primaryNet = telemetry?.network && telemetry.network.length > 0 ? telemetry.network[0] : null;

  return (
    <div className="app-system-overview">
      <div className="app-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="app-heading">System Overview</h2>
          <p className="app-text app-text-muted">
            {isAvailable
              ? `Live Host Machine Telemetry — ${machine?.hostname || 'Host'} (${machine?.platform || 'Unknown'})`
              : 'Local Sentinel Agent is offline. Connect agent to stream host telemetry.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {lastRefreshed}
            </span>
          )}
          <button
            onClick={fetchTelemetry}
            style={{
              background: 'rgba(0, 229, 255, 0.08)',
              border: '1px solid rgba(0, 229, 255, 0.25)',
              borderRadius: '4px',
              color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              padding: '2px 8px',
              cursor: 'pointer'
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="app-placeholder-grid">
        {/* CPU Card */}
        <div className="app-placeholder-card">
          <span className="app-placeholder-icon">▣</span>
          <span className="app-placeholder-label">CPU</span>
          <span className="app-placeholder-value" style={{ color: isAvailable ? 'var(--text-main)' : 'var(--text-muted)' }}>
            {isAvailable && cpu
              ? `${cpu.cores} Cores (${cpu.speedMHz} MHz)`
              : isLoading ? 'Checking...' : '[OFFLINE]'}
          </span>
          {isAvailable && cpu?.model && (
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cpu.model}>
              {cpu.model}
            </span>
          )}
        </div>

        {/* Memory Card */}
        <div className="app-placeholder-card">
          <span className="app-placeholder-icon">▦</span>
          <span className="app-placeholder-label">Memory</span>
          <span className="app-placeholder-value" style={{ color: isAvailable ? 'var(--text-main)' : 'var(--text-muted)' }}>
            {isAvailable && memory
              ? `${formatBytes(memory.usedBytes)} / ${formatBytes(memory.totalBytes)} (${memory.usagePercent}%)`
              : isLoading ? 'Checking...' : '[OFFLINE]'}
          </span>
        </div>

        {/* Storage Card */}
        <div className="app-placeholder-card">
          <span className="app-placeholder-icon">▤</span>
          <span className="app-placeholder-label">Storage</span>
          <span className="app-placeholder-value" style={{ color: isAvailable ? 'var(--text-main)' : 'var(--text-muted)' }}>
            {isAvailable && storage
              ? `${formatBytes(storage.freeBytes)} Free (${storage.mount})`
              : isLoading ? 'Checking...' : '[OFFLINE]'}
          </span>
          {isAvailable && storage && (
            <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
              {storage.usagePercent}% Used of {formatBytes(storage.totalBytes)}
            </span>
          )}
        </div>

        {/* Network Card */}
        <div className="app-placeholder-card">
          <span className="app-placeholder-icon">▥</span>
          <span className="app-placeholder-label">Network</span>
          <span className="app-placeholder-value" style={{ color: isAvailable ? 'var(--text-main)' : 'var(--text-muted)' }}>
            {isAvailable && primaryNet
              ? `${primaryNet.address}`
              : isLoading ? 'Checking...' : '[OFFLINE]'}
          </span>
          {isAvailable && primaryNet && (
            <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
              {primaryNet.name} ({primaryNet.family})
            </span>
          )}
        </div>
      </div>

      <div className="app-section" style={{ marginTop: '1rem' }}>
        {isAvailable && machine ? (
          <p className="app-text app-text-muted" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            Device: <strong>{machine.hostname}</strong> • OS: <strong>{machine.osRelease || machine.osType} ({machine.architecture})</strong> • Uptime: <strong>{formatUptime(machine.uptimeSeconds)}</strong>
          </p>
        ) : (
          <p className="app-text app-text-muted" style={{ fontSize: '0.75rem' }}>
            Machine telemetry is offline. Start the Local Sentinel Agent (<code>npm run agent</code>) to stream real-time host telemetry.
          </p>
        )}
      </div>
    </div>
  );
}
