export const NOTIFICATION_PROVIDER = 'NOTIFICATION_PROVIDER';

export interface NotificationProvider {
  sendNotification(telegramChatId: string, message: string): Promise<void>;
}
