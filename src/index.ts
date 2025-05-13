// index.ts
import { AzuroScheduler } from './scheduler';
import { logger } from './logger';

logger.info('[INFO] Starting Azuro Twitter Scheduler');

const scheduler = new AzuroScheduler();

// Start the scheduler
scheduler.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('[INFO] Received SIGINT. Gracefully shutting down...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('[INFO] Received SIGTERM. Gracefully shutting down...');
  scheduler.stop();
  process.exit(0);
});

logger.info('[INFO] Scheduler running. Press Ctrl+C to stop.');