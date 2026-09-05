/**
 * KS Sentinel 2.0 — Local Sentinel Agent Process Entry Point
 * Module 3: Local Sentinel Agent
 */

const { LocalSentinelAgent } = require('./agent');

const agent = new LocalSentinelAgent();

// Graceful termination handler
let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nReceived ${signal}. Shutting down Local Sentinel Agent gracefully...`);
  try {
    await agent.stop(`Process received ${signal}`);
  } catch (err) {
    console.error('Error during agent shutdown:', err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

// Start agent
agent.start().catch((err) => {
  console.error('[FATAL AGENT ERROR]:', err);
  process.exit(1);
});

