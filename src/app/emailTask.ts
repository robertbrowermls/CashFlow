import type { RuntimeConfig } from './config';
import { sendErrorEmail, sendInfoEmail } from './email';
import { logger } from '../index';
import { getHtml } from './puppeteer';
import { join } from 'path';
import { format } from 'date-fns';
import { DB } from './db';
import { ReportData } from './reportData';
import { Trade } from './trade';

export async function runEmailTask(config: RuntimeConfig): Promise<void> {
  logger.info('Email task:', 'Started.');

  try {
    const cwd = process.cwd();
    const now = new Date();
    const db = await DB.getInstance();
    
    const reportData: ReportData = {
      appName: config.APP_NAME,
      title: 'Trades By Symbol'
    };

    reportData.tradesBySymbol = Object.keys(db.data!.tradesBySymbol).map(symbol => {
      return { symbol, trades: db.data!.tradesBySymbol[symbol] };
    });

    const html = getHtml('tradesBySymbol.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_trades_by_symbols.html`), config.ENABLE_HTML_REPORTS);
    await sendInfoEmail(config, html);
    logger.info('Email task:', 'Succeeded.');
  } catch (error) {
    logger.error('Email task:', error);
    await sendErrorEmail(config, error);
    return;
  }
}