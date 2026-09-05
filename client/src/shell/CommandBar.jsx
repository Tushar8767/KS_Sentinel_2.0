/**
 * KS Sentinel 2.0 — Command Bar
 * Module 1: Web OS Shell
 *
 * Application launcher foundation. Maps ONLY to registered shell applications.
 * No shell/terminal/PowerShell/filesystem/OS commands.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { searchApps, appRegistry } from '../registry/appRegistry';
import { useWindows } from '../window/windowStore';
import { eventBus, EventTypes } from '../events/eventBus';

export default function CommandBar({ isOpen, onClose }) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);
  const { openApp, closeWindow, windows } = useWindows();

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setInput('');
      setResults([]);
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const executeCommand = useCallback(
    (rawInput) => {
      const trimmed = rawInput.trim();
      if (!trimmed) return;

      eventBus.publish(EventTypes.COMMAND_EXECUTED, { command: trimmed });

      const parts = trimmed.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ');

      if (cmd === 'open' && arg) {
        const matches = searchApps(arg);
        if (matches.length > 0) {
          openApp(matches[0].id);
          setResults([{ type: 'success', text: `Opened: ${matches[0].name}` }]);
        } else {
          setResults([{ type: 'error', text: `No application found matching "${arg}"` }]);
        }
      } else if (cmd === 'close' && arg) {
        const matches = searchApps(arg);
        if (matches.length > 0) {
          const win = windows.find((w) => w.appId === matches[0].id);
          if (win) {
            closeWindow(win.instanceId);
            setResults([{ type: 'success', text: `Closed: ${matches[0].name}` }]);
          } else {
            setResults([{ type: 'info', text: `${matches[0].name} is not open` }]);
          }
        } else {
          setResults([{ type: 'error', text: `No application found matching "${arg}"` }]);
        }
      } else if (cmd === 'apps') {
        setResults(
          appRegistry.map((app) => ({
            type: 'info',
            text: `${app.icon} ${app.name} — ${app.description}`,
          }))
        );
      } else if (cmd === 'help') {
        setResults([
          { type: 'info', text: 'Available commands:' },
          { type: 'info', text: '  open <app name>   — Launch or focus an application' },
          { type: 'info', text: '  close <app name>  — Close an application window' },
          { type: 'info', text: '  apps              — List all registered applications' },
          { type: 'info', text: '  help              — Show this help text' },
        ]);
      } else {
        setResults([
          { type: 'error', text: `Unknown command: "${trimmed}"` },
          { type: 'info', text: 'Type "help" for available commands.' },
        ]);
      }
    },
    [openApp, closeWindow, windows]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    executeCommand(input);
    setInput('');
  };

  const handleSuggestionClick = (appId) => {
    openApp(appId);
    onClose();
  };

  if (!isOpen) return null;

  // Live search suggestions
  const suggestions = input.trim() ? searchApps(input) : [];

  return (
    <div className="commandbar-overlay" onClick={onClose}>
      <div className="commandbar" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="commandbar-form">
          <span className="commandbar-prompt">›</span>
          <input
            ref={inputRef}
            className="commandbar-input"
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setResults([]);
            }}
            placeholder="Type a command... (help for commands)"
            autoComplete="off"
            spellCheck="false"
          />
        </form>

        {/* Live suggestions */}
        {suggestions.length > 0 && results.length === 0 && (
          <div className="commandbar-suggestions">
            {suggestions.map((app) => (
              <button
                key={app.id}
                className="commandbar-suggestion"
                onClick={() => handleSuggestionClick(app.id)}
              >
                <span className="commandbar-suggestion-icon">{app.icon}</span>
                <span className="commandbar-suggestion-name">{app.name}</span>
                <span className="commandbar-suggestion-desc">{app.description}</span>
              </button>
            ))}
          </div>
        )}

        {/* Command results */}
        {results.length > 0 && (
          <div className="commandbar-results">
            {results.map((r, i) => (
              <div key={i} className={`commandbar-result commandbar-result-${r.type}`}>
                {r.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
