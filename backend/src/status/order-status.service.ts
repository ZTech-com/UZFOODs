import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../gateway/orders.gateway';
import { ALLOWED_TRANSITIONS, OrderStatus } from '../common/order-status';
import { AuditService } from '../common/audit.service';
import { serializeOrder, SerializedOrder } from '../common/serialize';

/** Holat o'zgarganda chiqariladigan hodisa nomi */
export const ORDER_STATUS_CHANGED_EVENT = 'order.status.changed';

export interface UpdateStatusOptions {
  /** Bekor qilish sababi (CANCELLED bo'lganda) */
  reason?: string;
  /** Kim o'zgartirdi: 'admin' | 'telegram' | 'system' */
  actor?: string;
  ip?: string;
}

/**
 * Holat o'zgartirish — yagona joy.
 * REST admin endpoint'idan ham, Telegram inline tugmalaridan ham shu
 * servis chaqiriladi (DB + tarix + audit + socket + Telegram sinxron).
 */
@Injectable()
export class OrderStatusService {
  private readonly logger = new Logger(OrderStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  async updateStatus(
    orderId: number,
    newStatus: OrderStatus,
    opts: UpdateStatusOptions = {},
  ): Promise<SerializedOrder> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { menuItem: true } },
      },
    });
    if (!order || order.deletedAt) {
      throw new NotFoundException('Buyurtma topilmadi');
    }

    if (order.status === newStatus) {
      return serializeOrder(order);
    }

    // SQLite client'da status String sifatida keladi — xavfsiz kasting
    const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Holatni "${order.status}" dan "${newStatus}" ga o'zgartirib bo'lmaydi`,
      );
    }

    const reason =
      newStatus === OrderStatus.CANCELLED ? (opts.reason?.trim() || null) : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus, cancelledReason: reason },
        include: {
          customer: true,
          items: { include: { menuItem: true } },
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: newStatus,
          reason,
          changedBy: opts.actor ?? 'system',
        },
      });
      return result;
    });

    const actor = opts.actor ?? 'system';
    if (actor === 'admin') {
      await this.audit.log({
        admin: 'admin',
        action: 'STATUS_CHANGED',
        entity: 'Order',
        entityId: orderId,
        oldValue: order.status,
        newValue: newStatus,
        ip: opts.ip,
      });
    }

    const serialized = serializeOrder(updated);
    this.ordersGateway.emitOrderUpdated(serialized);
    // Telegram'dagi xabar ham tahrirlanishi kerak (agar yuborilgan bo'lsa)
    this.eventEmitter.emit(ORDER_STATUS_CHANGED_EVENT, { orderId });
    this.logger.log(`Buyurtma #${orderId} holati: ${newStatus} (${actor})`);
    return serialized;
  }
}
