/**
 * KS Sentinel 2.0 — Desktop Shell
 * Module 1: Web OS Shell
 *
 * Full-viewport desktop compositor: TopBar → WindowManager → Dock.
 * CommandBar is rendered as a toggled overlay.
 */

import React, { useState, useEffect, useCallback } from 'react';
import TopBar from './TopBar';
import Dock from './Dock';
import CommandBar from './CommandBar';
import WindowManager from '../window/WindowManager';

export default function Desktop() {
  const [commandBarOpen, setCommandBarOpen] = useState(false);

  const toggleCommandBar = useCallback(() => {
    setCommandBarOpen((prev) => !prev);
  }, []);

  const closeCommandBar = useCallback(() => {
    setCommandBarOpen(false);
  }, []);

  // Global keyboard shortcut: Ctrl+K opens Command Bar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandBar();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandBar]);

  return (
    <div className="desktop">
      <TopBar onToggleCommandBar={toggleCommandBar} />

      <div className="desktop-workspace">
        <WindowManager />
      </div>

      <Dock />

      <CommandBar isOpen={commandBarOpen} onClose={closeCommandBar} />
    </div>
  );
}
