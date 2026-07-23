import type { RuntimeConfig } from './config';
import { getOptionsChains } from './api/market_data/getOptionsChains';
import { sendErrorEmail, sendInfoEmail } from './email';
import { logger } from './logger';
import { getHtml } from './puppeteer';
import { join } from 'path';
import { Option } from './api/market_data/getOptionsChainsResponse';
import { getOptionsExpirations } from './api/market_data/getOptionsExpirations';
import { getUserProfile } from './api/user/getUserProfile';
import { getAccountBalance } from './api/accounts/getAccountBalance';
import { getMarketLookup } from './api/market_data/getMarketLookup';
import { getQuotes } from './api/market_data/getQuotes';
import { format } from 'date-fns';
import { daysBetweenDates, daysFromToday, findHighestRateOfReturn, findPricePairs, sanitizeWindowsFilename } from './helpers';
import { Trade } from './trade';
import { placeOrder } from './api/trading/placeOrder';
import { DB } from './db';
import { ReportData } from './reportData';

export async function runTradeTask(config: RuntimeConfig): Promise<void> {
  logger.info('Trade task:', 'Started.');

  try {
    const cwd = process.cwd();
    const now = new Date();
    const db = await DB.getInstance();
    const prevDbTrades = [...(db.data?.trades || [])];
    const prevDbOrders = [...(db.data?.orders || [])];
    logger.info('Trade task:', `Found ${prevDbTrades.length} trades and ${prevDbOrders.length} orders in the database.`);
    if (prevDbTrades.length + prevDbOrders.length >= config.MAX_TRADES) {
      const message = `The maximum number of ${config.MAX_TRADES} trades exist in the database.`;
      logger.info('Trade task:', message);
      return;
    }

    const reportData: ReportData = {
      appName: config.APP_NAME,
      minCashBalance: config.MIN_CASH_BALANCE
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

    if (accountBalance.total_cash < config.MIN_CASH_BALANCE) {
      if (config.ENABLE_HTML_REPORTS) {
        reportData.accountBalance = accountBalance;
        getHtml('accountBalance.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_account_balance.html`));
      }

      const error = `Total cash (${accountBalance.total_cash}) is below the minimum cash balance of (${config.MIN_CASH_BALANCE}). Consider adding funds to meet the minimum requirement.`;
      logger.error('Trade task:', error);
      throw new Error(error);
    }

    const marketLookup = await getMarketLookup(config, config.MARKET_TYPES, config.EXCHANGE_CODES);
    if (marketLookup.length === 0) {
      const error = `No securities found in market lookup that match the allowed types: ${config.MARKET_TYPES.join(", ")}.}`;
      logger.error('Trade task:', error);
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
      logger.error('Trade task:', error);
      throw new Error(error);
    }

    if (config.ENABLE_HTML_REPORTS) {
      reportData.quotes = allowedQuotes;
      getHtml('quotes.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_quotes.html`));
    }

    const bestTradesLookup: Record<string, Trade> = {};
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
          option.strike > quote.last &&
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
      pairs.sort((a: Option[], b: Option[]) => b[0].strike - a[0].strike);

      for (const pair of pairs) {

        const debitBeforePriceAdjustment = ((pair[1].bid + pair[1].ask) / 2) - ((pair[0].bid + pair[0].ask) / 2);
        const priceAdjustment = debitBeforePriceAdjustment * config.PRICE_ADJUSTMENT;
        const debit = debitBeforePriceAdjustment + priceAdjustment;
        const gain = (pair[0].strike - pair[1].strike) - debit;
        const ror = gain / debit;

        // CashCow
        // const creditBeforeAdjustment = ((pair[0].bid + pair[0].ask) / 2) - ((pair[1].bid + pair[1].ask) / 2);
        // const credit = creditBeforeAdjustment + (creditBeforeAdjustment * config.PRICE_ADJUSTMENT);
        // const risk = (pair[0].strike - pair[1].strike) - credit;
        // const ror = credit / risk;
        // const annualizedReturn = 365 / daysFromToday(expiration) * ror;

        trades.push({
          shortSymbol: pair[0].symbol,
          longSymbol: pair[1].symbol,
          underlying: quote.symbol,
          price: quote.last,
          shortExpiration: pair[0].expiration_date,
          longExpiration: pair[1].expiration_date,
          shortStrike: pair[0].strike,
          longStrike: pair[1].strike,
          shortBid: pair[0].bid,
          shortAsk: pair[0].ask,
          longBid: pair[1].bid,
          longAsk: pair[1].ask,
          priceAdjustment: config.PRICE_ADJUSTMENT,
          shortPrice: (pair[0].bid + pair[0].ask) / 2,
          longPrice: (pair[1].bid + pair[1].ask) / 2,
          debit,
          gain,
          ror,
          timestamp: now.toISOString()
        });
      }

      const tradesForSymbol = trades.filter(trade => {
        return trade.shortStrike <= config.MAX_STOCK_PRICE &&
          trade.shortStrike - trade.longStrike <= config.MAX_SPREAD &&
          trade.shortPrice < trade.longPrice &&
          trade.debit >= config.MIN_DEBIT &&
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
      if (bestTradeForSymbol && !bestTradesLookup[bestTradeForSymbol.shortSymbol]) {
        bestTradesLookup[bestTradeForSymbol.shortSymbol] = bestTradeForSymbol;
      }
    }

    const bestTrades = Object.values(bestTradesLookup);
    bestTrades.sort((a, b) => b.ror - a.ror);

    if (bestTrades.length > 0) {
      if (config.ENABLE_HTML_REPORTS) {
        reportData.title = 'Best Trades';
        reportData.trades = bestTrades;
        getHtml('trades.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_best_trades.html`));
      }
    }

    if (bestTrades.length === 0) {
      const message = 'No trades found.'
      logger.warn('Trade task:', message);
      // await sendWarningEmail(config, message);
      return;
    }

    const ordersPlaced: Trade[] = [];
    for (const trade of bestTrades) {

      if (db.data!.trades.length + db.data!.orders.length >= config.MAX_TRADES) {
        const message = `The maximum number of ${config.MAX_TRADES} active trades exist in the database.`;
        logger.info('Trade task:', message);
        break;
      }

      const existingTradeForSymbol = prevDbTrades.find(dbTrade => {
        return dbTrade.underlying === trade.underlying;
      }) || prevDbOrders.find(dbOrder => {
        return dbOrder.underlying === trade.underlying;
      });

      // Only one concurrent trade against a symbol allowed.
      if (existingTradeForSymbol) {
        continue;
      }

      const price = trade.debit < 0 ? trade.debit * -1 : trade.debit;
      const quantity = 1;

      try {

        logger.info(`Placing order for ${trade.underlying}.`);

        const placeOrderPreviewResponse = await placeOrder(config,
          accountBalance.account_number,
          trade.underlying,
          'debit',
          price,
          [trade.shortSymbol, trade.longSymbol],
          ['sell_to_open', 'buy_to_open'],
          quantity,
          true,
          config.APP_NAME);

        if (placeOrderPreviewResponse?.errors) {
          const error = `Failed to place order preview for symbol ${trade.underlying}: ${placeOrderPreviewResponse.errors.error}`;
          logger.error('Trade task:', error);
          throw new Error(error);
        }

        if (placeOrderPreviewResponse?.order?.status !== "ok") {
          const error = `Failed to place order preview for symbol ${trade.underlying}.`;
          throw new Error(error);
        }

        const placeOrderResponse = await placeOrder(config,
          accountBalance.account_number,
          trade.underlying,
          'debit', // limit doesn't work here
          price,
          [trade.shortSymbol, trade.longSymbol],
          ['sell_to_open', 'buy_to_open'],
          quantity,
          false,
          config.APP_NAME);

        if (placeOrderResponse?.errors) {
          const error = `Failed to place order for symbol ${trade.underlying}: ${placeOrderResponse.errors.error}`;
          logger.info('Trade task:', error);
          throw new Error(error);
        }

        if (placeOrderResponse?.order?.status !== "ok") {
          const error = `Failed to place order for symbol ${trade.underlying}.`;
          throw new Error(error);
        }

        db.data!.orders.push({ ...trade, ...placeOrderResponse?.order });
        ordersPlaced.push(trade);
        await db.write();

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Close Price Per Day task:', message);
        await sendErrorEmail(config, message);
        continue;
      }

    }

    if (ordersPlaced.length > 0) {

      if (config.ENABLE_HTML_REPORTS) {
        reportData.title = 'Orders';
        reportData.trades = db.data!.orders || [];
        reportData.trades.sort((a, b) => b.ror - a.ror);
        getHtml('trades.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_orders.html`));
      }

      reportData.title = 'Orders Placed';
      reportData.trades = ordersPlaced;
      reportData.trades.sort((a, b) => b.ror - a.ror);
      const html = getHtml('trades.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_orders_placed.html`), config.ENABLE_HTML_REPORTS);
      await sendInfoEmail(config, html);

    }

    logger.info('Trade task:', 'Succeeded.');

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Trade task:', message);
    await sendErrorEmail(config, message);
    return;
  }
}