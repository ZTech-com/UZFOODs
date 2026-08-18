import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { TelegramModule } from '../telegram/telegram.module';
import { GatewayModule } from '../gateway/gateway.module';
import { StatusModule } from '../status/status.module';

@Module({
  imports: [TelegramModule, GatewayModule, StatusModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
