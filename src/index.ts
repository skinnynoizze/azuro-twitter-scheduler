// index.ts
import { AzuroScheduler } from './scheduler';
import { logger } from './logger';

logger.info('Starting Azuro Twitter Scheduler by @skinnynoizze');

const scheduler = new AzuroScheduler();

// Start the scheduler
scheduler.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Gracefully shutting down...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Gracefully shutting down...');
  scheduler.stop();
  process.exit(0);
});

logger.info('Scheduler running. Press Ctrl+C to stop.');