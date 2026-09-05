import React, { useEffect, useState } from 'react';

export default function App() {
  const [gatewayStatus, setGatewayStatus] = useState('checking...');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setGatewayStatus(data.status === 'ok' ? 'ONLINE' : 'UNHEALTHY');
      })
      .catch((err) => {
        setGatewayStatus('OFFLINE');
        setError(err.message);
      });
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '1.8rem' }}>
          KS SENTINEL 2.0
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Web-based Virtual Operating Environment
        </p>
      </header>

      <main style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-green)' }}>
          Module 0: Architecture Foundation Baseline
        </h2>
        
        <div style={{ display: 'grid', gap: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Status: </span>
            <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>LOCKED BASELINE</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Gateway Connection: </span>
            <span style={{ color: gatewayStatus === 'ONLINE' ? 'var(--accent-green)' : '#ff4444', fontWeight: 'bold' }}>
              {gatewayStatus}
            </span>
          </div>
          {error && (
            <div style={{ color: '#ff8888', fontSize: '0.8rem' }}>
              Note: Express gateway is offline or unreachable on proxy port 5000 ({error}).
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

