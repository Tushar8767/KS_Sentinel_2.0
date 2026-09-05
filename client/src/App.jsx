import React from 'react';
import { WindowProvider } from './window/windowStore';
import Desktop from './shell/Desktop';

/**
 * KS Sentinel 2.0 — Application Root
 * Module 1: Web OS Shell
 *
 * Wraps the Desktop shell with the centralized WindowProvider.
 * BrowserRouter remains in main.jsx (unchanged from Module 0).
 */
export default function App() {
  return (
    <WindowProvider>
      <Desktop />
    </WindowProvider>
  );
}
