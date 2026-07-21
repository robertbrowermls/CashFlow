import nodemailer from 'nodemailer';

import type { RuntimeConfig } from './config';
import { logger } from './logger';

function getSmtpSettings(config: RuntimeConfig) {
  return {
    host: process.env.SMTP_HOST || config.SMTP_CONFIG.host,
    user: process.env.SMTP_USER || config.SMTP_CONFIG.user,
    pass: process.env.SMTP_PASS || config.SMTP_CONFIG.pass,
    from: process.env.SMTP_FROM || config.SMTP_CONFIG.from || process.env.SMTP_USER || config.SMTP_CONFIG.user,
    port: Number(process.env.SMTP_PORT || config.SMTP_CONFIG.port || 587),
    secure: process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : config.SMTP_CONFIG.secure ?? false,
  };
}

async function sendNotificationEmail(config: RuntimeConfig, subject: string, text: string, type: 'Error' | 'Success' | 'Warning' | 'Info'): Promise<void> {
  if (!config.EMAIL_RECIPIENTS.length) {
    logger.warn('No email recipients configured.');
    return;
  }

  const { host, user, pass, from, port, secure } = getSmtpSettings(config);

  if (!host || !user || !pass) {
    logger.warn(`SMTP configuration is incomplete. Skipping ${type} email.`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: config.EMAIL_RECIPIENTS.join(', '),
    subject,
    html: text,
  });

  logger.info(`${type} email sent to:`, config.EMAIL_RECIPIENTS.join(', '));
}

export async function sendErrorEmail(config: RuntimeConfig, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  
  await sendNotificationEmail(
    config,
    `${config.APP_NAME} scheduled task failed`,
    `The scheduled task failed.\n\n${message}`,
    'Error'
  );
}

export async function sendSuccessEmail(config: RuntimeConfig): Promise<void> {
  await sendNotificationEmail(
    config,
    `${config.APP_NAME} scheduled task completed successfully`,
    'The scheduled task completed successfully.',
    'Success'
  );
}

export async function sendWarningEmail(config: RuntimeConfig, text: string): Promise<void> {
  await sendNotificationEmail(
    config,
    `${config.APP_NAME} warning`,
    text,
    'Warning'
  );
}

export async function sendInfoEmail(config: RuntimeConfig, text: string): Promise<void> {
  await sendNotificationEmail(
    config,
    `${config.APP_NAME} info`,
    text,
    'Info'
  );
}
