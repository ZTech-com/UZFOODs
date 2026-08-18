import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  ORDER_STATUS_CHANGED_EVENT,
  OrderStatusService,
} from '../status/order-status.service';
import {
  OrderForMessage,
  buildOrderKeyboard,
  formatOrderMessage,
  parseCallbackData,
  STATUS_LABELS,
} from './telegram.format';
import { Context, Bot } from 'grammy';
import { OrderStatus } from '../common/order-status';
import { toNumber, OrderWithRelations, SerializedOrder } from '../common/serialize';

/** Callback tugma → yangi holat */
const CALLBACK_TO_STATUS: Record<string, OrderStatus> = {
  accept: 'PREPARING',
  reject: 'CANCELLED',
  ready: 'READY',
  complete: 'COMPLETED',
};

@Injectable()
export class TelegramService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;
  private readonly chatId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly orderStatusService: OrderStatusService,
  ) {
    this.chatId = this.config.get<string>('TELEGRAM_ADMIN_CHAT_ID') ?? '';
  }

  get isConfigured(): boolean {
    return this.bot !== null && this.chatId !== '';
  }

  async onApplicationBootstrap() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN topilmadi — Telegram xabarlari o\'chirilgan. ' +
          'BotFather orqali token oling va .env faylga qo\'shing.',
      );
      return;
    }

    this.bot = new Bot(token);

    // Inline tugmalar (Qabul qilish / Bekor qilish / ...)
    this.bot.on('callback_query:data', async (ctx) => {
      await this.handleCallback(ctx);
    });

    this.bot.catch((err) => {
      this.logger.error(`Telegram bot xatosi: ${err.message}`);
    });

    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
    const polling = this.config.get<string>('TELEGRAM_POLLING') === 'true';

    if (webhookUrl) {
      // Production: webhook (HTTPS domen talab qilinadi)
      await this.bot.api.setWebhook(webhookUrl);
      this.logger.log(`Telegram webhook o'rnatildi: ${webhookUrl}`);
    } else if (polling) {
      // Development: long-polling
      await this.bot.api.deleteWebhook().catch(() => undefined);
      void this.bot.start({ drop_pending_updates: true });
      this.logger.log('Telegram bot long-polling rejimida ishga tushdi');
    } else {
      this.logger.warn(
        'TELEGRAM_WEBHOOK_URL ham, TELEGRAM_POLLING=true ham berilmagan — ' +
          'bot ishlamaydi. Webhook yoki pollingni sozlang.',
      );
    }

    if (!this.chatId) {
      this.logger.warn('TELEGRAM_ADMIN_CHAT_ID topilmadi — xabarlar hech kimga yuborilmaydi');
    }
  }

  async onApplicationShutdown() {
    await this.bot?.stop();
  }

  /** Webhook orqali kelgan update'ni qayta ishlash */
  async handleUpdate(update: unknown): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Bot sozlanmagan, update qayta ishlanmadi');
      return;
    }
    await this.bot.handleUpdate(update as Parameters<Bot['handleUpdate']>[0]);
  }

  /** Buyurtma haqidagi xabarni restoran egasiga yuborish (queue worker'dan chaqiriladi) */
  async sendOrderNotification(orderId: number): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn(`Telegram sozlanmagan — order #${orderId} xabari yuborilmadi`);
      await this.markTelegramStatus(orderId, 'FAILED');
      return;
    }
    const order = await this.loadOrder(orderId);
    const text = formatOrderMessage(toOrderForMessage(order));
    const keyboard = buildOrderKeyboard(order.id, order.status as OrderStatus);

    const message = await this.bot!.api.sendMessage(this.chatId, text, {
      reply_markup: keyboard ?? undefined,
    });

    // Xabarni keyinchalik tahrirlash uchun message_id saqlanadi + holat SENT
    await this.prisma.order.update({
      where: { id: order.id },
      data: { telegramMessageId: message.message_id, telegramStatus: 'SENT' },
    });

    this.logger.log(`Telegram xabari yuborildi (order #${order.id})`);
  }

  /** Telegram yuborilishi muvaffaqiyatsiz bo'lsa holatni belgilash (queue worker'dan) */
  async markTelegramFailed(orderId: number): Promise<void> {
    await this.markTelegramStatus(orderId, 'FAILED');
  }

  private async markTelegramStatus(orderId: number, status: 'SENT' | 'FAILED'): Promise<void> {
    try {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { telegramStatus: status },
      });
    } catch (err) {
      this.logger.error(
        `telegramStatus yangilanmadi (#${orderId}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Inline tugma bosilganda holatni yangilash va xabarni tahrirlash */
  private async handleCallback(ctx: Context): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) {
      return;
    }

    // XAVFSIZLIK: faqat ruxsat etilgan admin chat'idagi foydalanuvchi
    // Telegram orqali holat o'zgartira oladi (callback tamper himoyasi)
    const fromId = ctx.callbackQuery.from.id;
    const allowedId = Number(this.chatId);
    if (!this.chatId || fromId !== allowedId) {
      this.logger.warn(
        `Ruxsatsiz Telegram callback: from=${fromId}, allowed=${this.chatId || 'none'}`,
      );
      await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' }).catch(() => undefined);
      return;
    }

    const parsed = parseCallbackData(data);
    if (!parsed) {
      await ctx.answerCallbackQuery({ text: "Noto'g'ri tugma" }).catch(() => undefined);
      return;
    }

    const newStatus = CALLBACK_TO_STATUS[parsed.action];
    try {
      // Xabarni tahrirlash ORDER_STATUS_CHANGED_EVENT orqali avtomatik bajariladi
      const order = await this.orderStatusService.updateStatus(parsed.orderId, newStatus);
      await ctx
        .answerCallbackQuery({ text: `Holat: ${STATUS_LABELS[order.status]}` })
        .catch(() => undefined);
    } catch (err) {
      this.logger.error(
        `Callback qayta ishlanmadi (${data}): ${err instanceof Error ? err.message : String(err)}`,
      );
      await ctx
        .answerCallbackQuery({ text: 'Xatolik yuz berdi, qayta urinib ko\'ring' })
        .catch(() => undefined);
    }
  }

  /**
   * Holat o'zgarganda (admin panel yoki Telegram tugmasi orqali)
   * Telegram'dagi buyurtma xabarini yangilangan holat bilan tahrirlaydi.
   */
  @OnEvent(ORDER_STATUS_CHANGED_EVENT)
  async handleOrderStatusChanged({ orderId }: { orderId: number }): Promise<void> {
    await this.editOrderMessage(orderId);
  }

  private async editOrderMessage(orderId: number): Promise<void> {
    if (!this.isConfigured) {
      return;
    }
    const order = await this.loadOrder(orderId);
    if (!order.telegramMessageId) {
      return; // Telegram xabari yuborilmagan (masalan, bot hali sozlanmagan edi)
    }
    const text = formatOrderMessage(toOrderForMessage(order), true);
    const keyboard = buildOrderKeyboard(order.id, order.status as OrderStatus);
    await this.bot!
      .api.editMessageText(
        this.chatId,
        order.telegramMessageId,
        text,
        keyboard ? { reply_markup: keyboard } : undefined,
      )
      .catch((err: Error) => {
        this.logger.warn(
          `Telegram xabarni tahrirlab bo'lmadi (order #${orderId}): ${err.message}`,
        );
      });
  }

  private async loadOrder(orderId: number): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { menuItem: true } },
      },
    });
    if (!order) {
      throw new Error(`Order #${orderId} topilmadi`);
    }
    return order;
  }
}

function toOrderForMessage(order: OrderWithRelations | SerializedOrder): OrderForMessage {
  return {
    id: order.id,
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
      telegramUsername: order.customer.telegramUsername ?? null,
    },
    items: order.items.map((item) => ({
      // SerializedOrder'da nom to'g'ridan-to'g'ri, OrderWithRelations'da menuItem ichida
      name: 'name' in item ? item.name : item.menuItem.name,
      quantity: item.quantity,
      price: toNumber(item.price),
    })),
    totalAmount: toNumber(order.totalAmount),
    requiredTime: order.requiredTime,
    createdAt: order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt),
    status: order.status as OrderStatus,
  };
}
