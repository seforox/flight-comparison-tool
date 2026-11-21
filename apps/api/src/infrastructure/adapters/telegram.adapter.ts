import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { NotificationProvider } from '../../domain/interfaces/notification.provider';

@Injectable()
export class TelegramAdapter implements NotificationProvider {
  private readonly bot: Telegraf;
  private readonly logger = new Logger(TelegramAdapter.name);

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not defined. Telegram notifications will fail.');
      this.bot = new Telegraf('mock-token');
    } else {
      this.bot = new Telegraf(token);
    }
  }

  async sendNotification(telegramChatId: string, message: string): Promise<void> {
    if (process.env.NODE_ENV === 'test') return; // Seguridad extra
    try {
      await this.bot.telegram.sendMessage(telegramChatId, message);
      this.logger.log(`Mensaje enviado a ${telegramChatId}`);
    } catch (error) {
      this.logger.error(`Error enviando mensaje de Telegram: ${error}`);
      throw error;
    }
  }
}
