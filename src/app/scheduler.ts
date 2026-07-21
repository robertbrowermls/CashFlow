import cron from 'node-cron';
import type { RuntimeConfig } from './config';
import { logger } from './logger';
import { runTradeTask } from './tradeTask';
import { runCloseExpiringPositionsTask } from './closeExpiringPositionsTask';
import { runClosePricePerDayTask } from './closePricePerDayTask';
import { runCancelOpenOrdersTask } from './cancelOpenOrdersTask';
import { runScanTask } from './scanTask';
import { runEmailTask } from './emailTask';

export function startTradeScheduler(config: RuntimeConfig): void {
  logger.info(`Trade scheduler started. Trade task is set for ${config.TRADE_SCHEDULE} (${config.TIMEZONE}).`);
  const task = cron.schedule(
    config.TRADE_SCHEDULE,
    async () => {
      await runTradeTask(config);
    },
    {
      timezone: config.TIMEZONE,
    }
  );
  task.start();

  // Uncomment this line for development purposes to run the task immediately on startup
  // void runTradeTask(config);
}

export function startCancelOpenOrdersScheduler(config: RuntimeConfig): void {
  logger.info(`Cancel Open Orders scheduler started. Cancel Open Orders task is set for ${config.TRADE_SCHEDULE} (${config.TIMEZONE}).`);
  const task = cron.schedule(
    config.CANCEL_OPEN_ORDERS_SCHEDULE,
    async () => {
      await runCancelOpenOrdersTask(config);
    },
    {
      timezone: config.TIMEZONE,
    }
  );
  task.start();

  // Uncomment this line for development purposes to run the task immediately on startup
  // void runCancelOpenOrdersTask(config);
}

export function startCloseExpiringPositionsScheduler(config: RuntimeConfig): void {
  logger.info(`Close Expiring Positions scheduler started. Close Expiring Positions task is set for ${config.CLOSE_EXPIRING_POSITIONS_SCHEDULE} (${config.TIMEZONE}).`);
  const task = cron.schedule(
    config.CLOSE_EXPIRING_POSITIONS_SCHEDULE,
    async () => {
      await runCloseExpiringPositionsTask(config);
    },
    {
      timezone: config.TIMEZONE,
    }
  );
  task.start();

  // Uncomment this line for development purposes to run the task immediately on startup
  // void runCloseExpiringPositionsTask(config);
}

export function startClosePricePerDayScheduler(config: RuntimeConfig): void {
  logger.info(`Close Price Per Day scheduler started. Close Price Per Day task is set for ${config.CLOSE_PRICE_PER_DAY_SCHEDULE} (${config.TIMEZONE}).`);
  const task = cron.schedule(
    config.CLOSE_PRICE_PER_DAY_SCHEDULE,
    async () => {
      await runClosePricePerDayTask(config);
    },
    {
      timezone: config.TIMEZONE,
    }
  );
  task.start();

  // Uncomment this line for development purposes to run the task immediately on startup
  // void runClosePricePerDayTask(config);
}

export function startScanScheduler(config: RuntimeConfig): void {
  logger.info(`Scan scheduler started. Scan task is set for ${config.SCAN_SCHEDULE} (${config.TIMEZONE}).`);
  const task = cron.schedule(
    config.SCAN_SCHEDULE,
    async () => {
      await runScanTask(config);
    },
    {
      timezone: config.TIMEZONE,
    }
  );
  task.start();

  // Uncomment this line for development purposes to run the task immediately on startup
  // void runScanTask(config);
}

export function startEmailScheduler(config: RuntimeConfig): void {
  logger.info(`Email scheduler started. Email task is set for ${config.EMAIL_SCHEDULE} (${config.TIMEZONE}).`);
  const task = cron.schedule(
    config.EMAIL_SCHEDULE,
    async () => {
      await runEmailTask(config);
    },
    {
      timezone: config.TIMEZONE,
    }
  );
  task.start();

  // Uncomment this line for development purposes to run the task immediately on startup
  // void runEmailTask(config);
}

