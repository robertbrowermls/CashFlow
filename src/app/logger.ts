import fs from 'node:fs';
import path from 'node:path';
import { getDateTimeFormat } from './helpers';
import { RuntimeConfig } from './config';

export type LogLevel = 'error' | 'warn' | 'info' | 'log' | 'debug';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  log: 2,
  debug: 3,
};

function normalizeLogLevel(level?: string): LogLevel {
  const candidate = (level || process.env.LOG_LEVEL || 'info').toLowerCase();

  if (candidate === 'trace') {
    return 'debug';
  }

  return (candidate in LEVEL_PRIORITY ? candidate : 'info') as LogLevel;
}

function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatMessage(level: LogLevel, args: unknown[]): string {
  const timestamp = new Date();
  const parts = args.map((value) => stringify(value));
  const dateTimeFormat = getDateTimeFormat();
  return `[${dateTimeFormat.format(timestamp)}] [${level.toUpperCase()}] ${parts.join(' ')}`;
}

function writeToFile(message: string): void {
  const filePath = process.env.LOG_FILE || path.resolve(process.cwd(), 'logs', 'app.log');
  const directory = path.dirname(filePath);

  fs.mkdirSync(directory, { recursive: true });
  fs.appendFileSync(filePath, `${message}\n`, 'utf8');
}

function getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case 'error':
      return console.error.bind(console);
    case 'warn':
      return console.warn.bind(console);
    case 'info':
      return console.info.bind(console);
    case 'debug':
      return console.debug.bind(console);
    case 'log':
    default:
      return console.log.bind(console);
  }
}

export interface LoggerOptions {
  level?: LogLevel;
  filePath?: string;
  config?: RuntimeConfig;
}

export function createLogger(options: LoggerOptions = {}): {
  level: LogLevel;
  setLevel: (level: string) => void;
  log: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
} {
  function resolveLevel(): LogLevel {
    return normalizeLogLevel(options.level || process.env.LOG_LEVEL || 'info');
  }

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[resolveLevel()];
  }

  function emit(level: LogLevel, args: unknown[]): void {
    if (!shouldLog(level)) {
      return;
    }

    const message = formatMessage(level, args);
    getConsoleMethod(level)(message);
    writeToFile(message);
  }

  return {
    get level() {
      return resolveLevel();
    },
    set level(nextLevel: LogLevel) {
      options.level = normalizeLogLevel(nextLevel);
    },
    setLevel(nextLevel: string): void {
      options.level = normalizeLogLevel(nextLevel);
    },
    log: (...args: unknown[]) => emit('log', args),
    debug: (...args: unknown[]) => emit('debug', args),
    info: (...args: unknown[]) => emit('info', args),
    warn: (...args: unknown[]) => emit('warn', args),
    error: (...args: unknown[]) => emit('error', args),
  };
}

export const logger = createLogger();
