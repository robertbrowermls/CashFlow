import fs from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  appName?: string;
  scanSchedule?: string;
  emailSchedule?: string;
  tradeSchedule?: string;
  cancelOpenOrdersSchedule?: string;
  closeExpiringPositionsSchedule?: string;
  closePricePerDaySchedule?: string;
  pricePerDaySchedule?: string;
  timezone?: string;
  minAccountBalance?: number;
  startingAccountBalance?: number;
  compoundingDelta?: number | null;
  marketTypes?: string[];
  exchangeCodes?: string[];
  maxStockPrice?: number;
  getQuotesApiChunkSize?: number;
  minAverageVolume?: number;
  minSpread?: number;
  maxSpread?: number;
  minRor?: number;
  maxTrades?: number;
  maxDebit?: number;
  minDaysToExpiration?: number;
  priceAdjustment?: number;
  optionExpirationDays?: number;
  apiBaseUrl?: string;
  authorization?: string;
  emailRecipients?: string[];
  maxOrderAgeInMinutes?: number;
  daysBeforeExpirationToExitPosition?: number;
  percentPricePerDayToExitPosition?: number;
  smtp?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    from?: string;
  };
  logging?: {
    level?: string;
    file?: string;
  };
  enableHtmlReports?: boolean;
}

export interface RuntimeConfig {
  APP_NAME: string;
  SCAN_SCHEDULE: string;
  EMAIL_SCHEDULE: string;
  TRADE_SCHEDULE: string;
  CANCEL_OPEN_ORDERS_SCHEDULE: string;
  CLOSE_EXPIRING_POSITIONS_SCHEDULE: string;
  CLOSE_PRICE_PER_DAY_SCHEDULE: string;
  TIMEZONE: string;
  MIN_ACCOUNT_BALANCE: number;
  STARTING_ACCOUNT_BALANCE: number;
  COMPOUNDING_DELTA: number | null;
  MARKET_TYPES: string[];
  EXCHANGE_CODES: string[];
  MAX_STOCK_PRICE: number;
  GET_QUOTES_API_CHUNK_SIZE: number;
  MIN_AVERAGE_VOLUME: number;
  MIN_SPREAD: number;
  MAX_SPREAD: number;
  MAX_DEBIT: number;
  MIN_DAYS_TO_EXPIRATION: number;
  MIN_ROR: number;
  MAX_TRADES: number;
  PRICE_ADJUSTMENT: number;
  OPTION_EXPIRATION_DATE: string;
  API_BASE_URL: string;
  AUTHORIZATION?: string;
  EMAIL_RECIPIENTS: string[];
  MAX_ORDER_AGE_IN_MINUTES: number;
  DAYS_BEFORE_EXPIRATION_TO_EXIT_POSITION: number;
  PERCENT_PRICE_PER_DAY_TO_EXIT_POSITION: number;
  SMTP_CONFIG: NonNullable<AppConfig['smtp']>;
  ENABLE_HTML_REPORTS: boolean;
}

export function loadConfig(): AppConfig {
  const configPath = path.resolve(process.cwd(), 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as AppConfig;
}

export function resolveRuntimeConfig(config: AppConfig): RuntimeConfig {
  const logLevel = process.env.LOG_LEVEL || config.logging?.level || 'info';
  const logFile = process.env.LOG_FILE || config.logging?.file || 'logs/app.log';
  const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const configuredTimezone = process.env.TZ || config.timezone || systemTimezone;
  const runtimeTimezone = configuredTimezone === 'UTC' && !process.env.TZ
    ? systemTimezone
    : configuredTimezone;

  process.env.LOG_LEVEL = logLevel;
  process.env.LOG_FILE = logFile;

  const optionExpirationDays = Number(process.env.OPTION_EXPIRATION_DAYS || config.optionExpirationDays || 7);
  const optionExpirationDaysClamped = Math.max(1, Math.min(optionExpirationDays, 365)); // Ensure it's between 1 and 365
  const optionExpirationDate = new Date();
  optionExpirationDate.setDate(optionExpirationDate.getDate() + optionExpirationDaysClamped);

  return {
    MARKET_TYPES: process.env.MARKET_LOOKUP_TYPES?.split(",") || config.marketTypes || ['stock'],
    APP_NAME: process.env.APP_NAME || config.appName || 'CashCow',
    EXCHANGE_CODES: process.env.EXCHANGE_CODES?.split(",") || config.exchangeCodes || ['N', 'P', 'Q'],
    MAX_STOCK_PRICE: (process.env.MAX_STOCK_PRICE && parseFloat(process.env.MAX_STOCK_PRICE)) || config.maxStockPrice || 10,
    GET_QUOTES_API_CHUNK_SIZE: (process.env.GET_QUOTES_API_CHUNK_SIZE && parseFloat(process.env.GET_QUOTES_API_CHUNK_SIZE)) || config.getQuotesApiChunkSize || 100,
    MIN_AVERAGE_VOLUME: (process.env.MIN_AVERAGE_VOLUME && parseFloat(process.env.MIN_AVERAGE_VOLUME)) || config.minAverageVolume || 50000000,
    MIN_SPREAD: (process.env.MIN_SPREAD && parseFloat(process.env.MIN_SPREAD)) || config.minSpread || 0.50,
    MAX_SPREAD: (process.env.MAX_SPREAD && parseFloat(process.env.MAX_SPREAD)) || config.maxSpread || 0.50,
    MIN_ROR: (process.env.MIN_ROR && parseFloat(process.env.MIN_ROR)) || config.minRor || 0.33,
    MAX_DEBIT: (process.env.MAX_DEBIT && parseFloat(process.env.MAX_DEBIT)) || config.maxDebit || 0.50,
    MIN_DAYS_TO_EXPIRATION: (process.env.MIN_DAYS_TO_EXPIRATION && parseInt(process.env.MIN_DAYS_TO_EXPIRATION)) || config.minDaysToExpiration || 7,
    MAX_TRADES: (process.env.MAX_TRADES && parseFloat(process.env.MAX_TRADES)) || config.maxTrades || 1,
    PRICE_ADJUSTMENT: (process.env.PRICE_ADJUSTMENT && parseFloat(process.env.PRICE_ADJUSTMENT)) || config.priceAdjustment || 0.02,
    SCAN_SCHEDULE: process.env.TRADE_SCHEDULE || config.scanSchedule || "30 9-16 */5 * 1-5", // every monday through Friday at 13:00 (24 hour format)
    EMAIL_SCHEDULE: process.env.EMAIL_SCHEDULE || config.emailSchedule || "0 11 * * 1-5", // every monday through Friday at 13:00 (24 hour format)
    TRADE_SCHEDULE: process.env.TRADE_SCHEDULE || config.tradeSchedule || "*/5 10-15 * * 1-5", // every five minutes between 10am and 3pm Monday to Friday
    CANCEL_OPEN_ORDERS_SCHEDULE: process.env.CANCEL_OPEN_ORDERS_SCHEDULE || config.cancelOpenOrdersSchedule || "*/5 10-15 * * 1-5", // every five minutes between 10am and 3pm Monday to Friday
    CLOSE_EXPIRING_POSITIONS_SCHEDULE: process.env.CLOSE_EXPIRING_POSITIONS_SCHEDULE || config.closeExpiringPositionsSchedule || "45 15 * * 1-5", // Monday through Friday at 3:45PM
    CLOSE_PRICE_PER_DAY_SCHEDULE: process.env.CLOSE_PRICE_PER_DAY_SCHEDULE || config.closePricePerDaySchedule || "*/5 10-15 * * 1-5", // every five minutes between 10am and 3pm Monday to Friday
    TIMEZONE: runtimeTimezone,
    MIN_ACCOUNT_BALANCE: Number((process.env.MIN_ACCOUNT_BALANCE || config.minAccountBalance) ?? 2000),
    STARTING_ACCOUNT_BALANCE: Number((process.env.STARTING_ACCOUNT_BALANCE || config.startingAccountBalance) ?? 2000),
    COMPOUNDING_DELTA: Number((process.env.COMPOUNDING_DELTA || config.compoundingDelta) ?? null),
    OPTION_EXPIRATION_DATE: optionExpirationDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
    API_BASE_URL: process.env.API_BASE_URL || config.apiBaseUrl || 'https://sandbox.tradier.com',
    AUTHORIZATION: process.env.API_AUTHORIZATION || config.authorization,
    EMAIL_RECIPIENTS: process.env.EMAIL_RECIPIENTS?.split(",") || config.emailRecipients || [],
    MAX_ORDER_AGE_IN_MINUTES: (process.env.MAX_ORDER_AGE_IN_MINUTES && parseInt(process.env.MAX_ORDER_AGE_IN_MINUTES)) || config.maxOrderAgeInMinutes || 300, // 
    DAYS_BEFORE_EXPIRATION_TO_EXIT_POSITION: (process.env.DAYS_BEFORE_EXPIRATION_TO_EXIT_POSITION && parseInt(process.env.DAYS_BEFORE_EXPIRATION_TO_EXIT_POSITION)) || config.daysBeforeExpirationToExitPosition || 0,
    PERCENT_PRICE_PER_DAY_TO_EXIT_POSITION: (process.env.PERCENT_PRICE_PER_DAY_TO_EXIT_POSITION && parseFloat(process.env.PERCENT_PRICE_PER_DAY_TO_EXIT_POSITION)) || config.percentPricePerDayToExitPosition || 0.50,
    SMTP_CONFIG: config.smtp || {},
    ENABLE_HTML_REPORTS: (process.env.ENABLE_HTML_REPORTS && process.env.ENABLE_HTML_REPORTS === 'true') || config.enableHtmlReports || false
  };
}
