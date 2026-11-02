import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TokenBlacklistService implements OnModuleDestroy {
  constructor(
    @InjectQueue('flight-search-queue') private readonly queue: Queue,
  ) {}

  async blacklistToken(token: string, expSeconds?: number): Promise<void> {
    const client = await this.queue.client;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttl = expSeconds && expSeconds > nowSeconds ? expSeconds - nowSeconds : 7 * 24 * 3600;

    await (client as any).set(`blacklist:jwt:${token}`, '1', 'EX', ttl);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const client = await this.queue.client;
    const result = await client.get(`blacklist:jwt:${token}`);
    return result === '1';
  }

  async onModuleDestroy() {
    // BullMQ gestiona el cierre del cliente Redis
  }
}
