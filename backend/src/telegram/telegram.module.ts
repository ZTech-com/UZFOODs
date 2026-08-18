import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import {
  BullMqOrderQueue,
  MemoryOrderQueue,
  ORDER_NOTIFICATIONS_QUEUE,
  OrderNotificationsQueue,
} from './telegram.queue';
import { StatusModule } from '../status/status.module';

@Module({
  imports: [StatusModule],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    {
      provide: ORDER_NOTIFICATIONS_QUEUE,
      inject: [ConfigService, TelegramService],
      useFactory: (
        config: ConfigService,
        telegram: TelegramService,
      ): OrderNotificationsQueue => {
        const backend = config.get<string>('QUEUE_BACKEND') ?? 'redis';
        return backend === 'memory'
          ? new MemoryOrderQueue(telegram)
          : new BullMqOrderQueue(config, telegram);
      },
    },
  ],
  exports: [TelegramService, ORDER_NOTIFICATIONS_QUEUE],
})
export class TelegramModule {}
