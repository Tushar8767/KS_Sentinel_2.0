import React, { useState } from 'react';

/**
 * Demo Application — Architecture Proof
 * Module 1 demo application. Proves window interactivity works.
 */
export default function DemoApp() {
  const [count, setCount] = useState(0);
  const [theme, setTheme] = useState('cyan');

  const themeColors = {
    cyan: 'var(--accent-cyan)',
    green: 'var(--accent-green)',
    purple: 'var(--accent-purple)',
  };

  return (
    <div className="app-demo">
      <div className="app-section">
        <h2 className="app-heading">Architecture Proof</h2>
        <p className="app-text app-text-muted">
          This window demonstrates that the Web OS shell supports interactive
          application content, centralized window management, and correct
          state isolation between windows.
        </p>
      </div>

      <div className="app-section">
        <h3 className="app-subheading">Interactive Counter</h3>
        <div className="demo-counter">
          <button
            className="demo-btn"
            onClick={() => setCount((c) => c - 1)}
          >
            −
          </button>
          <span className="demo-count" style={{ color: themeColors[theme] }}>
            {count}
          </span>
          <button
            className="demo-btn"
            onClick={() => setCount((c) => c + 1)}
          >
            +
          </button>
        </div>
      </div>

      <div className="app-section">
        <h3 className="app-subheading">Theme Accent</h3>
        <div className="demo-theme-row">
          {Object.keys(themeColors).map((t) => (
            <button
              key={t}
              className={`demo-theme-btn ${theme === t ? 'demo-theme-active' : ''}`}
              style={{ borderColor: themeColors[t], color: themeColors[t] }}
              onClick={() => setTheme(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="app-section">
        <h3 className="app-subheading">Window Controls Test</h3>
        <p className="app-text app-text-muted" style={{ fontSize: '0.75rem' }}>
          Try: drag this window by the title bar, resize from edges/corners,
          minimize, maximize, restore, and focus other windows.
        </p>
      </div>
    </div>
  );
}
