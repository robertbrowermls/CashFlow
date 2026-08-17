import { loadConfig, resolveRuntimeConfig } from './app/config';
import { createLogger } from './app/logger';
import { startCancelOpenOrdersScheduler, startCloseExpiringPositionsScheduler, startClosePricePerDayScheduler, startEmailScheduler, startScanScheduler, startTradeScheduler } from './app/scheduler';

const config = loadConfig();
const runtimeConfig = resolveRuntimeConfig(config);
export const logger = createLogger({ config: runtimeConfig });
startScanScheduler(runtimeConfig);
startEmailScheduler(runtimeConfig);
startTradeScheduler(runtimeConfig);
startCancelOpenOrdersScheduler(runtimeConfig);
startCloseExpiringPositionsScheduler(runtimeConfig);
startClosePricePerDayScheduler(runtimeConfig);