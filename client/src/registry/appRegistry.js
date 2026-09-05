/**
 * KS Sentinel 2.0 — Centralized Application Registry
 * Module 1: Web OS Shell
 *
 * All shell applications are registered here.
 * Future modules add apps by pushing entries to this registry.
 * The Window Manager and Dock read from this registry — no hardcoded app logic.
 */

import Dashboard from '../apps/dashboard/Dashboard';
import SentinelHome from '../apps/SentinelHome';
import SystemOverview from '../apps/SystemOverview';
import DemoApp from '../apps/DemoApp';
import WorkspaceManager from '../apps/workspace/WorkspaceManager';

export const appRegistry = [
  {
    id: 'workspace-manager',
    name: 'Workspaces',
    icon: '⧉',
    component: WorkspaceManager,
    defaultWidth: 800,
    defaultHeight: 540,
    minWidth: 520,
    minHeight: 380,
    description: 'Sentinel Workspace management, local host root binding, and agent association',
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: '⊞',
    component: Dashboard,
    defaultWidth: 840,
    defaultHeight: 580,
    minWidth: 480,
    minHeight: 360,
    description: 'Operational overview and control console for KS Sentinel',
  },
  {
    id: 'sentinel-home',
    name: 'Sentinel Home',
    icon: '⌂',
    component: SentinelHome,
    defaultWidth: 650,
    defaultHeight: 480,
    minWidth: 400,
    minHeight: 300,
    description: 'KS Sentinel 2.0 Welcome & System Overview',
  },
  {
    id: 'system-overview',
    name: 'System Overview',
    icon: '◎',
    component: SystemOverview,
    defaultWidth: 600,
    defaultHeight: 420,
    minWidth: 380,
    minHeight: 280,
    description: 'System status and machine information (placeholder)',
  },
  {
    id: 'demo-app',
    name: 'Demo Application',
    icon: '◈',
    component: DemoApp,
    defaultWidth: 500,
    defaultHeight: 400,
    minWidth: 320,
    minHeight: 240,
    description: 'Architecture proof and window control demonstration',
  },
];

/**
 * Look up a registered application by its ID.
 */
export function getAppById(id) {
  return appRegistry.find((app) => app.id === id) || null;
}

/**
 * Search registered applications by name, id, or description.
 */
export function searchApps(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [...appRegistry];
  return appRegistry.filter(
    (app) =>
      app.name.toLowerCase().includes(q) ||
      app.id.toLowerCase().includes(q) ||
      app.description.toLowerCase().includes(q)
  );
}
