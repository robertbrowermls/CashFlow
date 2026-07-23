import { loadConfig, resolveRuntimeConfig } from './app/config';
import { startCancelOpenOrdersScheduler, startCloseExpiringPositionsScheduler, startClosePricePerDayScheduler, startEmailScheduler, startScanScheduler, startTradeScheduler } from './app/scheduler';

const config = loadConfig();
const runtimeConfig = resolveRuntimeConfig(config);

startScanScheduler(runtimeConfig);
startEmailScheduler(runtimeConfig);
startTradeScheduler(runtimeConfig);
startCancelOpenOrdersScheduler(runtimeConfig);
startCloseExpiringPositionsScheduler(runtimeConfig);
startClosePricePerDayScheduler(runtimeConfig);