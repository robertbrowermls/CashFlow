import type { RuntimeConfig } from './config';
import { sendErrorEmail, sendInfoEmail, sendWarningEmail } from './email';
import { logger } from './logger';
import { getHtml } from './puppeteer';
import { getUserProfile } from './api/user/getUserProfile';
import { join } from 'path';
import { format } from 'date-fns';
import { AccountPosition } from './api/accounts/getAccountPositionsResponse';
import { getAccountPositions } from './api/accounts/getAccountPositions';
import { isWithinDays as isWithinDays, isUSFederalHoliday, daysBetweenDates, daysFromToday, mergeTradesWithPrefixes } from './helpers';
import { DB } from './db';
import { placeOrder } from './api/trading/placeOrder';
import { getQuotes } from './api/market_data/getQuotes';
import { ReportData } from './reportData';
import { getOptionsChains } from './api/market_data/getOptionsChains';
import { Trade } from './trade';
import { Option } from "./api/market_data/getOptionsChainsResponse";

export async function runCloseExpiringPositionsTask(config: RuntimeConfig): Promise<void> {
  logger.info('Close Expiring Positions task:', 'Started.');

  try {
    const cwd = process.cwd();
    const now = new Date();
    const db = await DB.getInstance();

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
      logger.error('Close Expiring Positions task:', error);
      throw new Error(error);
    }

    const positions = await getAccountPositions(config, userProfile.account.account_number);
    const prevDbTrades = [...(db.data?.trades || [])];
    const prevDbClosedTrades = [...(db.data!.closedTrades || [])];
    const positionsExamined: { [symbol: string]: AccountPosition } = {};
    const tradesClosed: { [symbol: string]: Trade } = {};
    const positionsNotFoundInDb: string[] = [];
    const positionsOutOfTheMoneyLookup: { [symbol: string]: { symbol: string, shortStrike: number, price: number } } = {};

    if (positions && positions.length > 0) {

      if (config.ENABLE_HTML_REPORTS) {
        reportData.positions = positions;
        getHtml('accountPositions.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_account_positions.html`));
      }

      for (const position of positions) {
        const dbTrades = [...(db.data?.trades || [])];
        const dbTrade = dbTrades.find(t => {
          return t.longSymbol === position.symbol ||
            t.shortSymbol === position.symbol;
        });
        if (!dbTrade) {
          const message = `A position with symbol ${position.symbol} was not found in the database. The app cannot determine if it should exit this position. Consider manually exiting this position.`;
          logger.warn('Close Expiring Positions task:', message);
          positionsNotFoundInDb.push(position.symbol);
        } else {
          try {
            // If out of the money we do not want to
            // exit the position early. Instead we want
            // the contract to expire worthless.
            const quotes = await getQuotes(config, [dbTrade.underlying]);
            if (quotes.length === 0) {
              const message = `No quote found for symbol ${dbTrade.underlying}. The app cannot determine if it should exit this position.`;
              logger.warn('Close Expiring Positions task:', message);
              continue;
            }
            if (quotes.length > 0) {
              const quote = quotes[0];
              if (quote.last > dbTrade.shortStrike) {
                positionsOutOfTheMoneyLookup[dbTrade.underlying] = {
                  symbol: dbTrade.underlying,
                  shortStrike: dbTrade.shortStrike,
                  price: quote.last
                };
                continue;
              }
            }

            const optionsChains: Option[] = [];
            optionsChains.push(...(await getOptionsChains(config, dbTrade.underlying, dbTrade.shortExpiration)));
            optionsChains.push(...(await getOptionsChains(config, dbTrade.underlying, dbTrade.longExpiration)));
            const shortCall = optionsChains.find(option => option.symbol === dbTrade.shortSymbol);
            const longCall = optionsChains.find(option => option.symbol === dbTrade.longSymbol);

            if (!shortCall) {
              throw new Error(`Failed to find short call with symbol ${dbTrade.shortSymbol}.`);
            }
            if (!longCall) {
              throw new Error(`Failed to find long call with symbol ${dbTrade.longSymbol}.`);
            }

            const openTimestamp = dbTrade.timestamp;
            const openDebit = dbTrade.debit;
            const openDaysToExpiration = daysBetweenDates(dbTrade.longExpiration, openTimestamp);
            const openPricePerDay = openDebit / openDaysToExpiration;
            const currentDebitBeforeAdjustment = ((longCall.bid + longCall.ask) / 2) - ((shortCall.bid + shortCall.ask) / 2);
            const priceAdjustment = currentDebitBeforeAdjustment * dbTrade.priceAdjustment;
            const currentDebit = currentDebitBeforeAdjustment + priceAdjustment;
            const currentTimestamp = now.toISOString();
            const currentDaysToExpiration = daysBetweenDates(dbTrade.longExpiration, currentTimestamp);
            const currentPricePerDay = currentDebit / currentDaysToExpiration;
            const currentPricePerDayTooLow = currentPricePerDay < (openPricePerDay * config.PERCENT_PRICE_PER_DAY_TO_EXIT_POSITION);
            const currentGain = (shortCall.strike - longCall.strike) - currentDebit;
            const currentRor = currentGain / currentDebit;
            const quote = quotes[0];

            logger.debug('Close Expiring Positions task:', `open trade: ${JSON.stringify(dbTrade)}`);
            logger.debug('Close Expiring Positions task:', `current short call: ${JSON.stringify(shortCall)}`);
            logger.debug('Close Expiring Positions task:', `current long call: ${JSON.stringify(longCall)}`);
            logger.debug('Close Expiring Positions task:', `prevDebit: ${openDebit}, prevDaysToExpiration: ${openDaysToExpiration}, prevPricePerDay: ${openPricePerDay}`);
            logger.debug('Close Expiring Positions task:', `currentDebit: ${currentDebit}, currentDaysToExpiration: ${currentDaysToExpiration}, currentPricePerDay: ${currentPricePerDay}`);
            logger.debug('Close Expiring Positions task:', `pricePerDayTooLow: ${currentPricePerDayTooLow}`);

            if (!positionsExamined[position.symbol]) {
              positionsExamined[position.symbol] = position;
            }

            // If the expiration date is a federal holiday and the daysBeforeExpirationToExitPosition
            // configuration setting is set to 0 then it must be increased to one so that
            // th app can exit the position on the day before thr market is closed.
            let daysBeforeExpirationToExit = config.DAYS_BEFORE_EXPIRATION_TO_EXIT_POSITION;
            const expiresOnFederalHoliday = isUSFederalHoliday(dbTrade.longExpiration);
            if (expiresOnFederalHoliday && config.DAYS_BEFORE_EXPIRATION_TO_EXIT_POSITION === 0) {
              const message = `A position with symbol ${position.symbol} expires on ${dbTrade.longExpiration} which is a federal holiday, and the daysBeforeExpirationToExitPosition setting is 0. The app will exit this position one day earlier.`;
              logger.info('Close Expiring Positions task:', message);
              await sendInfoEmail(config, message);
              daysBeforeExpirationToExit = 1;
            }

            // Exit the position if it "expires soon".
            const expiresSoon = isWithinDays(now, dbTrade.longExpiration, daysBeforeExpirationToExit);
            if ((expiresSoon) && !tradesClosed[dbTrade.underlying]) {

              const exitingMessage = `Attempting to exit ${dbTrade.underlying} position because it expires soon.`;
              logger.info('Close Expiring Positions task:', exitingMessage);

              const quantity = 1; // TODO!

              const placeOrderPreviewResponse = await placeOrder(config,
                userProfile.account.account_number,
                dbTrade.underlying,
                'market',
                null,
                [dbTrade.shortSymbol, dbTrade.longSymbol],
                ['buy_to_close', 'sell_to_close'],
                quantity,
                true,
                config.APP_NAME);

              if (placeOrderPreviewResponse?.errors) {
                const error = `Failed to place order preview: ${placeOrderPreviewResponse.errors.error}`;
                logger.info('Trade task:', error);
                throw new Error(error);
              }

              if (placeOrderPreviewResponse?.order?.status !== "ok") {
                const error = 'Failed to place order preview.';
                throw new Error(error);
              }

              const placeOrderResponse = await placeOrder(config,
                userProfile.account.account_number,
                dbTrade.underlying,
                'market',
                null,
                [dbTrade.shortSymbol, dbTrade.longSymbol],
                ['buy_to_close', 'sell_to_close'],
                quantity,
                false,
                config.APP_NAME);

              if (placeOrderResponse?.errors) {
                const error = `Failed to place order preview: ${placeOrderResponse.errors.error}`;
                logger.info('Trade task:', error);
                throw new Error(error);
              }
              if (placeOrderResponse?.order?.status !== "ok") {
                const error = 'Failed to place order.';
                throw new Error(error);
              }

              db.data!.closedTrades = db.data!.closedTrades || [];

              const tradeToClose = {
                ...dbTrade,
                price: quote.last,
                shortBid: shortCall.bid,
                shortAsk: shortCall.ask,
                longBid: longCall.bid,
                longAsk: longCall.ask,
                priceAdjustment: dbTrade.priceAdjustment,
                shortPrice: (shortCall.bid + shortCall.ask) / 2,
                longPrice: (longCall.bid + longCall.ask) / 2,
                debit: currentDebit,
                gain: currentGain,
                ror: currentRor,
                timestamp: now.toISOString()
              };
              const closedTrade = mergeTradesWithPrefixes(dbTrade, tradeToClose);
              db.data!.closedTrades.push(closedTrade);
              db.data!.trades = db.data!.trades.filter(trade => trade.underlying !== dbTrade.underlying);
              db.write();
              tradesClosed[dbTrade.underlying] = dbTrade;

              const exitedMessage = `Successfully exited ${dbTrade.underlying} position because it was expiring soon.`;
              logger.info('Close Expiring Positions task:', exitedMessage);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Close Price Per Day task:', message);
            await sendErrorEmail(config, message);
            continue;
          }
        }
      }

    }

    if (positionsNotFoundInDb.length > 0) {
      const notFoundMessage = `Positions not found in DB: ${positionsNotFoundInDb.join(', ')}. The app cannot determine if it should exit these positions. Consider manually exiting these positions.`;
      logger.info('Close Expiring Positions task:', notFoundMessage);
      await sendWarningEmail(config, notFoundMessage);
    }

    const positionsOutOfTheMoney = Object.values(positionsOutOfTheMoneyLookup).map(p => `${p.symbol} (short strike: ${p.shortStrike}, price: ${p.price})`);
    if (positionsOutOfTheMoney.length > 0) {
      const outOfTheMoneyMessage = `Positions out of the money: ${positionsOutOfTheMoney.join(', ')}. The app won't exit these positions because we want to let the contracts expire.`;
      logger.info('Close Expiring Positions task:', outOfTheMoneyMessage);
    }

    const exitedPositions = Object.values(positionsExamined).filter(p => {
      const closedTrades = Object.values(tradesClosed);
      const found = closedTrades.find(t => t.longSymbol === p.symbol || t.shortSymbol === p.symbol);
      return found;
    });

    if (exitedPositions.length > 0) {
      if (config.ENABLE_HTML_REPORTS) {
        reportData.positions = exitedPositions;
        getHtml('exitedPositions.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_exited_positions.html`));
      }
    }

    const closedTrades = db.data!.closedTrades || [];
    if (closedTrades.length !== prevDbClosedTrades.length) {
      reportData.title = 'Closed Trades (expiring soon)';
      reportData.closedTrades = closedTrades;
      const html = getHtml('closedTrades.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_closed_trades.html`), config.ENABLE_HTML_REPORTS);
      await sendInfoEmail(config, html);
    }

    logger.info('Close Expiring Positions task:', 'Succeeded.');

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Close Expiring Positions task:', message);
    await sendErrorEmail(config, message);
    return;
  }
}