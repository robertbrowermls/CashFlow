import type { RuntimeConfig } from './config';
import { getOptionsChains } from './api/market_data/getOptionsChains';
import { sendErrorEmail, sendInfoEmail } from './email';
import { logger } from '../index';
import { getHtml } from './puppeteer';
import { join } from 'path';
import { Option } from './api/market_data/getOptionsChainsResponse';
import { getOptionsExpirations } from './api/market_data/getOptionsExpirations';
import { getMarketLookup } from './api/market_data/getMarketLookup';
import { getQuotes } from './api/market_data/getQuotes';
import { format } from 'date-fns';
import { daysBetweenDates, daysFromToday, findHighestRateOfReturn, findPricePairs, getCompoundingFactor, sanitizeWindowsFilename } from './helpers';
import { Trade } from './trade';
import { DB } from './db';
import { ReportData } from './reportData';
import { getUserProfile } from './api/user/getUserProfile';
import { getAccountBalance } from './api/accounts/getAccountBalance';


export async function runScanTask(config: RuntimeConfig): Promise<void> {
  logger.info('Scan task:', 'Started.');

  try {
    const cwd = process.cwd();
    const now = new Date();
    const db = await DB.getInstance();
    const bestTrades: Trade[] = [];

    const tradesBySymbol = (db.data!.tradesBySymbol ?? {}) as Record<string, Trade[]>;
    const totalTradeCount = Object.values(tradesBySymbol).reduce((total, symbolTrades) => {
      return total + (Array.isArray(symbolTrades) ? symbolTrades.length : 0);
    }, 0);

    logger.info('Scan task:', `Found ${totalTradeCount} trades in the database across ${Object.keys(tradesBySymbol).length} symbols.`);

    const reportData: ReportData = {
      appName: config.APP_NAME,
      minAccountBalance: config.MIN_ACCOUNT_BALANCE
    };

    const userProfile = await getUserProfile(config);

    if (userProfile.account.status !== "active") {

      if (config.ENABLE_HTML_REPORTS) {
        reportData.userProfile = userProfile;
        getHtml('userProfile.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_user_profile.html`));
      }

      const error = `Account status is "${userProfile.account.status}".`;
      logger.error('Trade task:', error);
      throw new Error(error);
    }

    const accountBalance = await getAccountBalance(config, userProfile.account.account_number);

    if (accountBalance.total_cash < config.MIN_ACCOUNT_BALANCE) {
      if (config.ENABLE_HTML_REPORTS) {
        reportData.accountBalance = accountBalance;
        getHtml('accountBalance.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_account_balance.html`));
      }

      const error = `Total cash (${accountBalance.total_cash}) is below the minimum cash balance of (${config.MIN_ACCOUNT_BALANCE}). Consider adding funds to meet the minimum requirement.`;
      logger.error('Trade task:', error);
      throw new Error(error);
    }

    const accountProfit = accountBalance.total_cash - config.STARTING_ACCOUNT_BALANCE;
    logger.info('Scan task:', `Account profit = ${accountProfit}.`);

    const marketLookup = await getMarketLookup(config, config.MARKET_TYPES, config.EXCHANGE_CODES);
    if (marketLookup.length === 0) {
      const error = `No securities found in market lookup that match the allowed types: ${config.MARKET_TYPES.join(", ")}.}`;
      logger.error('Scan task:', error);
      throw new Error(error);
    }

    if (config.ENABLE_HTML_REPORTS) {
      reportData.marketLookup = marketLookup;
      getHtml('marketLookup.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_market_lookup.html`));
    }

    const allowedSymbols = marketLookup.map(security => security.symbol);
    const quotes = await getQuotes(config, allowedSymbols);
    const allowedQuotes = quotes.filter(quote =>
      quote.last <= config.MAX_STOCK_PRICE &&
      quote.average_volume >= config.MIN_AVERAGE_VOLUME);

    if (allowedQuotes.length === 0) {
      const error = `No quotes found that match the allowed criteria.`;
      logger.error('Scan task:', error);
      throw new Error(error);
    }

    if (config.ENABLE_HTML_REPORTS) {
      reportData.quotes = allowedQuotes;
      getHtml('quotes.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_quotes.html`));
    }

    for (const quote of allowedQuotes) {
      const optionsExpirations = await getOptionsExpirations(config, quote.symbol);
      const allowedOptionsExpirations = optionsExpirations.filter((date) => date <= config.OPTION_EXPIRATION_DATE);

      if (allowedOptionsExpirations.length > 0) {
        if (config.ENABLE_HTML_REPORTS) {
          reportData.optionsExpirations = allowedOptionsExpirations;
          getHtml('optionsExpirations.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_${sanitizeWindowsFilename(quote.symbol)}_options_expirations.html`));
        }
      }

      const optionsChains: Option[] = [];
      const trades: Trade[] = [];
      for (const expiration of allowedOptionsExpirations) {

        const optionsChainsForExpiration = await getOptionsChains(config, quote.symbol, expiration);
        const validOptionsChains = optionsChainsForExpiration.filter(option =>
          option.type === 'option' &&
          option.option_type === 'call' &&
          option.strike < quote.last &&
          option.bid !== null &&
          option.ask !== null &&
          option.bid !== 0 &&
          option.contract_size === 100 &&
          !option.root_symbol.endsWith("1") &&
          !option.root_symbol.endsWith("2"));
        optionsChains.push(...validOptionsChains);

      }

      optionsChains.sort((a: Option, b: Option) => b.strike - a.strike);
      if (optionsChains.length > 0) {
        if (config.ENABLE_HTML_REPORTS) {
          reportData.optionsChains = optionsChains;
          getHtml('optionsChains.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_${sanitizeWindowsFilename(quote.symbol)}_options_chains.html`));

        }
      }

      const pairs = findPricePairs(optionsChains, config.MIN_SPREAD, config.MAX_SPREAD);
      const highestStrikePrice = pairs.length > 0
        ? Math.max(...pairs.map(pair => pair[0].strike))
        : Number.NEGATIVE_INFINITY;
      const atTheMoneyPairs = pairs.filter(pair => pair[0].strike === highestStrikePrice);
      atTheMoneyPairs.sort((a: Option[], b: Option[]) => b[0].strike - a[0].strike);

      for (const pair of atTheMoneyPairs) {

        const short = pair[0];
        const long = pair[1];

        const debitBeforeAdjustment = ((long.bid + long.ask) / 2) - ((short.bid + short.ask) / 2);
        const priceAdjustment = debitBeforeAdjustment * config.PRICE_ADJUSTMENT;
        const debit = debitBeforeAdjustment + priceAdjustment;
        const risk = debit;
        const gain = (short.strike - long.strike) - debit;
        const ror = gain / debit;

        const maxLoss = config.MAX_SPREAD - config.MAX_SPREAD * config.MIN_ROR;
        const normalizationFactor = Math.trunc(maxLoss / risk) || 1;

        const delta = config.COMPOUNDING_DELTA ?? Math.trunc((maxLoss / 2) * 100);
        const compoundingFactor = getCompoundingFactor(delta, accountProfit);
        const quantity = normalizationFactor * compoundingFactor;

        // logger.debug(`maxLoss = ${maxLoss}`);
        // logger.debug(`risk = ${risk}`);
        // logger.debug(`normalizationFactor = ${normalizationFactor}`);
        // logger.debug(`accountBalance.total_cash = ${accountBalance.total_cash}`);
        // logger.debug(`config.STARTING_ACCOUNT_BALANCE = ${config.STARTING_ACCOUNT_BALANCE}`);
        // logger.debug(`accountProfit = ${accountProfit}`);
        // logger.debug(`delta = ${delta}`);
        // logger.debug(`compoundingFactor = ${compoundingFactor}`);
        // logger.debug(`quantity = ${quantity}`);

        trades.push({
          shortSymbol: short.symbol,
          longSymbol: long.symbol,
          underlying: quote.symbol,
          price: quote.last,
          shortExpiration: short.expiration_date,
          longExpiration: long.expiration_date,
          shortStrike: short.strike,
          longStrike: long.strike,
          shortBid: short.bid,
          shortAsk: short.ask,
          longBid: long.bid,
          longAsk: long.ask,
          priceAdjustment: config.PRICE_ADJUSTMENT,
          shortPrice: (short.bid + short.ask) / 2,
          longPrice: (long.bid + long.ask) / 2,
          debit,
          gain,
          ror,
          timestamp: now.toISOString(),
          quantity
        });
      }

      const tradesForSymbol = trades.filter(trade => {
        return trade.shortStrike <= config.MAX_STOCK_PRICE &&
          trade.shortStrike - trade.longStrike <= config.MAX_SPREAD &&
          trade.shortPrice < trade.longPrice &&
          trade.debit <= config.MAX_DEBIT &&
          daysBetweenDates(trade.shortExpiration, now.toISOString()) >= config.MIN_DAYS_TO_EXPIRATION &&
          trade.ror > config.MIN_ROR
      });

      if (tradesForSymbol.length > 0) {
        if (config.ENABLE_HTML_REPORTS) {
          reportData.title = `${quote.symbol} Trades`;
          reportData.trades = tradesForSymbol;
          getHtml('trades.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_${sanitizeWindowsFilename(quote.symbol)}_trades.html`));
        }
      }

      const bestTradeForSymbol = findHighestRateOfReturn(tradesForSymbol);

      if (bestTradeForSymbol) {
        if (!Array.isArray(tradesBySymbol[quote.symbol])) {
          tradesBySymbol[quote.symbol] = [];
        }

        tradesBySymbol[quote.symbol].push(bestTradeForSymbol);
        db.data!.tradesBySymbol = tradesBySymbol;
        await db.write();
        bestTrades.push(bestTradeForSymbol);
      }
    }

    bestTrades.sort((a, b) => b.ror - a.ror);

    if (bestTrades.length === 0) {
      const message = 'No trades found.'
      logger.warn('Scan task:', message);
      return;
    }

    if (bestTrades.length > 0) {
      reportData.trades = bestTrades;
      const symbolsInReport = Object.keys(tradesBySymbol || {}).sort((a, b) => a.localeCompare(b));
      reportData.tradesBySymbol = symbolsInReport.map(symbol => {
        return { symbol, trades: (tradesBySymbol[symbol] ?? []).sort((a, b) => b.ror - a.ror) };
      });

      const html = getHtml('scan.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_scan.html`), config.ENABLE_HTML_REPORTS);
      await sendInfoEmail(config, html);
    }

    logger.info('Scan task:', 'Succeeded.');

  } catch (error) {
    logger.error('Scan task:', error);
    await sendErrorEmail(config, error);
    return;
  }
}