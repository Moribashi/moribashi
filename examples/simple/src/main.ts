import { buildApp } from './app.js';

// --- App setup ---

const app = await buildApp();

// --- Start ---

await app.start();

// Graceful shutdown
const shutdown = async () => {
  await app.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
