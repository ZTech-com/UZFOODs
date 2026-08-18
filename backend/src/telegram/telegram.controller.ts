import { Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { TelegramService } from './telegram.service';

/**
 * Telegram webhook endpoint'i.
 * Raw body (Buffer) — main.ts da ushbu yo'l uchun express.raw() o'rnatilgan.
 */
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  async webhook(@Req() req: Request) {
    const raw = req.body;
    let update: unknown;
    if (Buffer.isBuffer(raw)) {
      update = JSON.parse(raw.toString('utf8'));
    } else if (typeof raw === 'string') {
      update = JSON.parse(raw);
    } else {
      update = raw;
    }
    await this.telegramService.handleUpdate(update);
    return { ok: true };
  }
}
