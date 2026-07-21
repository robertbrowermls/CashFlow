import type { RuntimeConfig } from './config';
import { sendErrorEmail, sendInfoEmail } from './email';
import { logger } from './logger';
import { getHtml } from './puppeteer';
import { getUserProfile } from './api/user/getUserProfile';
import { join } from 'path';
import { format } from 'date-fns';
import { getAccountBalance } from './api/accounts/getAccountBalance';
import { cancelOrder } from './api/trading/cancelOrder';
import { isMinutesExpired } from './helpers';
import { ReportData } from './reportData';
import { DB } from './db';
import { getAccountOrder } from './api/accounts/getAccountOrder';
import { Trade } from './trade';

export async function runCancelOpenOrdersTask(config: RuntimeConfig): Promise<void> {
  logger.info('Cancel Open Orders task:', `Started.`);

  try {
    const cwd = process.cwd();
    const now = new Date();
    const db = await DB.getInstance();
    const prevDbOrders = [...(db.data?.orders || [])];
    logger.info('Cancel Open Orders task:', `Found ${prevDbOrders.length} orders in the database.`);

    const reportData: ReportData = {
      appName: config.APP_NAME,
      minCashBalance: config.MIN_CASH_BALANCE
    };

    const userProfile = await getUserProfile(config);

    if (userProfile.account.status !== "active") {

      reportData.userProfile = userProfile;
      getHtml('userProfile.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_user_profile.html`), config.ENABLE_HTML_REPORTS);

      const error = `Account status is "${userProfile.account.status}".`;
      logger.error('Cancel Open Orders task:', error);
      throw new Error(error);
    }

    const accountBalance = await getAccountBalance(config, userProfile.account.account_number);

    if (accountBalance.total_cash < config.MIN_CASH_BALANCE) {

      reportData.accountBalance = accountBalance;
      getHtml('accountBalance.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_account_balance.html`), config.ENABLE_HTML_REPORTS);

      const warning = `Account balance (${accountBalance.total_cash}) is below the minimum cash balance threshold (${config.MIN_CASH_BALANCE}).`;
      logger.warn('Cancel Open Orders task:', warning);
    }


    const canceledOrders: Trade[] = [];
    const filledOrders: Trade[] = [];

    for (const dbOrder of prevDbOrders) {

      const accountOrder = await getAccountOrder(config, userProfile.account.account_number, dbOrder.id);

      if (accountOrder.status === 'filled') {

        const placedOrder = db.data!.orders.find(dbOrder => dbOrder.underlying === accountOrder.symbol);

        if (!placedOrder) {
          const error = `Failed to find ${accountOrder.symbol} order`;
          logger.error('Cancel Open Orders task:', error);
          await sendErrorEmail(config, error);
          continue;
        }

        db.data!.orders = db.data!.orders.filter(dbOrder => dbOrder.underlying !== accountOrder.symbol);
        db.data!.trades.push(placedOrder);
        db.write();

        filledOrders.push(placedOrder);
        logger.info(`An order for ${placedOrder.underlying} was filled.`)

      } else if (accountOrder.status === 'pending' || accountOrder.status === 'open') {

        const expired = isMinutesExpired(new Date(), accountOrder.create_date, config.MAX_ORDER_AGE_IN_MINUTES);

        if (expired) {

          const cancelingMessage = `Canceling ${accountOrder.symbol} order because it didn't get filled after ${config.MAX_ORDER_AGE_IN_MINUTES} minutes.`;
          logger.warn(cancelingMessage);

          const cancelOrderResponse = await cancelOrder(config, userProfile.account.account_number, dbOrder.id);

          if (cancelOrderResponse?.errors) {
            const error = `Failed to cancel order for symbol ${dbOrder.underlying}: ${cancelOrderResponse.errors.error}`;
            logger.error('Trade task:', error);
            await sendErrorEmail(config, error);
            continue;
          }

          if (cancelOrderResponse?.order?.status !== 'ok' && cancelOrderResponse?.order?.status !== 'pending_cancel') {
            const error = `Failed to cancel ${accountOrder.symbol} order`;
            logger.error('Cancel Open Orders task:', error);
            await sendErrorEmail(config, error);
            continue;
          }

          const placedOrder = db.data!.orders.find(dbOrder => dbOrder.underlying === accountOrder.symbol);

          if (!placedOrder) {
            const error = `Failed to find ${accountOrder.symbol} order`;
            logger.error('Cancel Open Orders task:', error);
            await sendErrorEmail(config, error);
            continue;
          }

          db.data!.orders = db.data!.orders.filter(dbOrder => dbOrder.underlying !== placedOrder.underlying);
          db.write();

          canceledOrders.push(placedOrder);

          const canceledMessage = `Successfully canceled ${placedOrder.underlying} order.`;
          logger.info(canceledMessage);
        }
      }
    }

    if (filledOrders.length > 0) {
      reportData.title = `Filled Orders`;
      reportData.trades = filledOrders;
      const html = getHtml('trades.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_filled_orders.html`), config.ENABLE_HTML_REPORTS);
      await sendInfoEmail(config, html);
    }

    if (canceledOrders.length > 0) {
      reportData.title = `Canceled Orders (not filled in time)`;
      reportData.trades = canceledOrders;
      const html = getHtml('trades.html', reportData, join(cwd, `logs/${format(now, 'yyyy-MM-dd-HH-mm')}_canceled_orders.html`), config.ENABLE_HTML_REPORTS);
      await sendInfoEmail(config, html);
    }

    logger.info('Cancel Open Orders task:', `Succeeded.`);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Cancel Open Orders task:', message);
    await sendErrorEmail(config, message);
    return;
  }
}