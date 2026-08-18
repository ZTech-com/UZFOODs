import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { TelegramService } from './telegram.service';

export const ORDER_NOTIFICATIONS_QUEUE = 'ORDER_NOTIFICATIONS_QUEUE';

export interface OrderNotificationsQueue extends OnModuleDestroy {
  /** Buyurtma haqidagi Telegram xabarini navbatga qo'yadi (bloklamaydi) */
  add(orderId: number): Promise<void>;
}

interface JobData {
  orderId: number;
}

/**
 * BullMQ + Redis asosidagi navbat.
 * Telegram xabari alohida Worker'da yuboriladi — API javobi sekinlashmaydi.
 */
export class BullMqOrderQueue implements OrderNotificationsQueue {
  private readonly logger = new Logger(BullMqOrderQueue.name);
  private readonly queue: Queue<JobData>;
  private readonly worker: Worker<JobData>;

  constructor(config: ConfigService, telegram: TelegramService) {
    const connection = {
      host: config.get<string>('REDIS_HOST') ?? 'localhost',
      port: Number(config.get<string>('REDIS_PORT') ?? 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
    };

    this.queue = new Queue<JobData>('order-notifications', { connection });

    this.worker = new Worker<JobData>(
      'order-notifications',
      async (job) => {
        await telegram.sendOrderNotification(job.data.orderId);
      },
      { connection, concurrency: 5 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Telegram xabari yuborilmadi (order #${job?.data.orderId}): ${err.message}`,
      );
      // Buyurtma yo'qolmaydi — holati FAILED sifatida saqlanadi
      if (job?.data.orderId) {
        void telegram.markTelegramFailed(job.data.orderId).catch(() => undefined);
      }
    });
  }

  async add(orderId: number): Promise<void> {
    await this.queue.add(
      'send-order-notification',
      { orderId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 1_000,
        removeOnFail: 1_000,
      },
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
  }
}

/**
 * Redis'siz ishlash uchun in-memory "navbat" (faqat development).
 * QUEUE_BACKEND=memory bo'lganda ishlatiladi.
 * Xabar asinxron yuboriladi, API javobini bloklamaydi.
 */
export class MemoryOrderQueue implements OrderNotificationsQueue {
  private readonly logger = new Logger(MemoryOrderQueue.name);

  constructor(private readonly telegram: TelegramService) {}

  async add(orderId: number): Promise<void> {
    void this.telegram
      .sendOrderNotification(orderId)
      .catch((err: unknown) => {
        this.logger.error(
          `Telegram xabari yuborilmadi (order #${orderId}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        // Buyurtma yo'qolmaydi — holati FAILED sifatida saqlanadi
        void this.telegram.markTelegramFailed(orderId).catch(() => undefined);
      });
  }

  async onModuleDestroy() {
    // hech narsa
  }
}
