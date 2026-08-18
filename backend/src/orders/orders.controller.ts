import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Yangi buyurtma — har bir IP 5 daqiqada faqat 1 marta buyurtma bera oladi
   * (spam/DoS himoyasi). Idempotency-Key header' bilan takroriy submit xavfsiz.
   */
  @Post()
  @Throttle({ default: { limit: 1, ttl: 300_000 } })
  create(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.create(dto, idempotencyKey?.trim() || undefined);
  }

  /** Buyurtma holatini tekshirish (mijoz uchun, id orqali) — tarix bilan */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  /** Holatni o'zgartirish — faqat admin (JWT) */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.ordersService.updateStatus(id, dto.status, {
      reason: dto.reason,
      actor: 'admin',
      ip,
    });
  }
}
