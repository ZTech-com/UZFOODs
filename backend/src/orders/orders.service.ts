import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../gateway/orders.gateway';
import { ORDER_NOTIFICATIONS_QUEUE, OrderNotificationsQueue } from '../telegram/telegram.queue';
import { OrderStatus } from '../common/order-status';
import { OrderStatusService } from '../status/order-status.service';
import {
  serializeOrder,
  serializeOrderDetail,
  toNumber,
  SerializedOrder,
  SerializedOrderDetail,
} from '../common/serialize';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
    private readonly orderStatusService: OrderStatusService,
    @Inject(ORDER_NOTIFICATIONS_QUEUE) private readonly queue: OrderNotificationsQueue,
  ) {}

  async create(dto: CreateOrderDto, idempotencyKey?: string): Promise<SerializedOrder> {
    // Idempotency: bir xil kalit bilan takroriy so'rov — mavjud buyurtma qaytariladi
    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey },
        include: { customer: true, items: { include: { menuItem: true } } },
      });
      if (existing) {
        this.logger.log(`Idempotency: #${existing.id} buyurtmasi qaytarildi (${idempotencyKey})`);
        return serializeOrder(existing);
      }
    }

    const ids = dto.items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: ids }, available: true },
    });

    // Takroriy id'lar va mavjud bo'lmagan taomlarni tekshirish
    if (menuItems.length !== new Set(ids).size) {
      throw new BadRequestException(
        "Ba'zi taomlar menyuda mavjud emas yoki vaqtincha o'chirilgan",
      );
    }

    const totalAmount = dto.items.reduce((sum, item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
      return sum + toNumber(menuItem.price) * item.quantity;
    }, 0);

    // Mijozni telefon raqami bo'yicha topish yoki yaratish
    let customer = await this.prisma.customer.findUnique({
      where: { phone: dto.customer.phone },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          name: dto.customer.name,
          phone: dto.customer.phone,
          telegramUsername: dto.customer.telegramUsername ?? null,
        },
      });
    }

    // Buyurtma + taomlar + boshlang'ich holat tarixi — bitta transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId: customer.id,
          requiredTime: dto.requiredTime,
          totalAmount,
          note: dto.note?.trim() || null,
          idempotencyKey: idempotencyKey ?? null,
          items: {
            create: dto.items.map((item) => {
              const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
              return {
                menuItemId: menuItem.id,
                quantity: item.quantity,
                price: menuItem.price, // narx snapshot'i
              };
            }),
          },
          history: {
            create: { status: OrderStatus.PENDING, changedBy: 'system' },
          },
        },
        include: {
          customer: true,
          items: { include: { menuItem: true } },
        },
      });
      return created;
    });

    const serialized = serializeOrder(order);

    // Telegram xabari — background job (API javobini bloklamaydi)
    await this.queue.add(order.id);

    // Admin panelga real-vaqt xabar
    this.ordersGateway.emitOrderCreated(serialized);

    this.logger.log(`Yangi buyurtma #${order.id} qabul qilindi (jami: ${serialized.totalAmount})`);
    return serialized;
  }

  /** Buyurtma detali (mijoz kuzatuvi / admin drawer) — tarix bilan */
  async findOne(orderId: number): Promise<SerializedOrderDetail> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { menuItem: true } },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order || order.deletedAt) {
      throw new NotFoundException('Buyurtma topilmadi');
    }
    return serializeOrderDetail(order);
  }

  /** Holatni o'zgartirish — yagona manba: OrderStatusService */
  updateStatus(
    orderId: number,
    newStatus: OrderStatus,
    opts: { reason?: string; actor?: string; ip?: string } = {},
  ): Promise<SerializedOrder> {
    return this.orderStatusService.updateStatus(orderId, newStatus, opts);
  }
}
