import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../common/order-status';
import { OrderStatusService } from '../status/order-status.service';
import { AuditService } from '../common/audit.service';
import {
  serializeOrder,
  toNumber,
  SerializedOrder,
  OrderWithRelations,
} from '../common/serialize';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/create-menu-item.dto';
import { ListOrdersQueryDto, OrderSort } from './dto/list-orders-query.dto';
import { BulkActionDto } from './dto/bulk-action.dto';

export interface StatsResponse {
  kpi: {
    todayOrders: number;
    todayRevenue: number;
    todayCancelled: number;
    yesterdayOrders: number;
    yesterdayRevenue: number;
    pending: number;
    preparing: number;
    ready: number;
    completed: number;
    cancelled: number;
    last7Orders: number;
    last7Revenue: number;
    last30Orders: number;
    last30Revenue: number;
    averageOrderValue: number;
    cancelledRate: number;
  };
  totals: { orders: number; revenue: number };
  statusDistribution: { status: OrderStatus; count: number }[];
  weekly: { date: string; orders: number; revenue: number }[];
  topByQuantity: { name: string; quantity: number; revenue: number }[];
  topByRevenue: { name: string; quantity: number; revenue: number }[];
  busyHours: { hour: number; orders: number }[];
}

/** Mahalliy sana kaliti: "2026-08-18" */
function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Hozirgi vaqt "HH:MM" (24 soatlik, zero-padded) */
function currentHHMM(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const SORT_MAP: Record<OrderSort, Prisma.OrderOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  oldest: [{ createdAt: 'asc' }],
  highest: [{ totalAmount: 'desc' }],
  lowest: [{ totalAmount: 'asc' }],
  // HH:MM zero-padded bo'lgani uchun lexicographic tartib to'g'ri ishlaydi
  soonest: [{ requiredTime: 'asc' }],
  latest: [{ requiredTime: 'desc' }],
};

const ACTIVE_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.PREPARING];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderStatusService: OrderStatusService,
    private readonly audit: AuditService,
  ) {}

  // ────────────────────────────── Statistika ──────────────────────────────
  // Eslatma: PostgreSQL va SQLite'da bir xil ishlashi uchun barcha
  // so'rovlar Prisma API orqali (raw SQL'siz) yozilgan.
  // CANCELLED buyurtmalar tushumga va active hisoblarga QO'SHILMAYDI,
  // lekin alohida "cancelled" sifatida ko'rsatiladi. Soft-deletedlar hisobga olinmaydi.

  async getStats(): Promise<StatsResponse> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const weekAgo = new Date(startOfToday);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const monthAgo = new Date(startOfToday);
    monthAgo.setDate(monthAgo.getDate() - 29);

    const NOT_CANCELLED = { not: OrderStatus.CANCELLED };

    const agg = (gte: Date) =>
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte },
          status: NOT_CANCELLED,
          deletedAt: null,
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
      });
    const cancelledCount = (gte: Date) =>
      this.prisma.order.count({
        where: {
          createdAt: { gte },
          status: OrderStatus.CANCELLED,
          deletedAt: null,
        },
      });

    const [
      todayAgg,
      todayCancelled,
      yesterdayAgg,
      yesterdayCancelled,
      weekAgg,
      weekCancelled,
      monthAgg,
      totalsAgg,
      statusCounts,
      weekOrders,
      weekItems,
    ] = await Promise.all([
      agg(startOfToday),
      cancelledCount(startOfToday),
      agg(startOfYesterday),
      cancelledCount(startOfYesterday),
      agg(weekAgo),
      cancelledCount(weekAgo),
      agg(monthAgo),
      this.prisma.order.aggregate({
        where: { status: NOT_CANCELLED, deletedAt: null },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: weekAgo },
          deletedAt: null,
        },
        select: { createdAt: true, totalAmount: true, status: true },
      }),
      this.prisma.orderItem.findMany({
        where: {
          order: { createdAt: { gte: weekAgo }, deletedAt: null },
        },
        include: {
          menuItem: { select: { name: true } },
          order: { select: { status: true } },
        },
      }),
    ]);

    // Oxirgi 7 kun — kunlik guruhlash va busy hours (JS'da)
    const weeklyMap = new Map<string, { orders: number; revenue: number }>();
    const hourMap = new Map<number, number>();
    let weekOrdersCount = 0;
    let weekRevenue = 0;
    for (const order of weekOrders) {
      if (order.status === OrderStatus.CANCELLED) continue;
      const key = toLocalDateKey(order.createdAt);
      const entry = weeklyMap.get(key) ?? { orders: 0, revenue: 0 };
      entry.orders += 1;
      entry.revenue += toNumber(order.totalAmount);
      weeklyMap.set(key, entry);
      const hour = order.createdAt.getHours();
      hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
      weekOrdersCount += 1;
      weekRevenue += toNumber(order.totalAmount);
    }
    const weekly: StatsResponse['weekly'] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekAgo);
      day.setDate(weekAgo.getDate() + i);
      const key = toLocalDateKey(day);
      const entry = weeklyMap.get(key);
      weekly.push({
        date: key,
        orders: entry?.orders ?? 0,
        revenue: Math.round((entry?.revenue ?? 0) * 100) / 100,
      });
    }

    // Eng ko'p sotilgan (quantity) va eng ko'p daromad (revenue) — 7 kun
    const itemMap = new Map<string, { quantity: number; revenue: number }>();
    for (const oi of weekItems) {
      if (oi.order.status === OrderStatus.CANCELLED) continue;
      const name = oi.menuItem.name;
      const entry = itemMap.get(name) ?? { quantity: 0, revenue: 0 };
      entry.quantity += oi.quantity;
      entry.revenue += toNumber(oi.price) * oi.quantity;
      itemMap.set(name, entry);
    }
    const itemRows = Array.from(itemMap.entries()).map(([name, v]) => ({
      name,
      quantity: v.quantity,
      revenue: Math.round(v.revenue * 100) / 100,
    }));
    const topByQuantity = [...itemRows].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const topByRevenue = [...itemRows].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const busyHours = Array.from(hourMap.entries())
      .map(([hour, orders]) => ({ hour, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);

    const statusMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));
    const countFor = (status: OrderStatus) => statusMap.get(status) ?? 0;
    const totalWithCancelled = weekOrdersCount + weekCancelled;

    return {
      kpi: {
        todayOrders: todayAgg._count._all,
        todayRevenue: toNumber(todayAgg._sum.totalAmount),
        todayCancelled,
        yesterdayOrders: yesterdayAgg._count._all,
        yesterdayRevenue: toNumber(yesterdayAgg._sum.totalAmount),
        pending: countFor(OrderStatus.PENDING),
        preparing: countFor(OrderStatus.PREPARING),
        ready: countFor(OrderStatus.READY),
        completed: countFor(OrderStatus.COMPLETED),
        cancelled: countFor(OrderStatus.CANCELLED),
        last7Orders: weekAgg._count._all,
        last7Revenue: toNumber(weekAgg._sum.totalAmount),
        last30Orders: monthAgg._count._all,
        last30Revenue: toNumber(monthAgg._sum.totalAmount),
        averageOrderValue:
          weekOrdersCount > 0 ? Math.round((weekRevenue / weekOrdersCount) * 100) / 100 : 0,
        cancelledRate:
          totalWithCancelled > 0
            ? Math.round((weekCancelled / totalWithCancelled) * 1000) / 10
            : 0,
      },
      totals: {
        orders: totalsAgg._count._all,
        revenue: toNumber(totalsAgg._sum.totalAmount),
      },
      statusDistribution: statusCounts.map((s) => ({
        status: s.status as OrderStatus,
        count: s._count._all,
      })),
      weekly,
      topByQuantity,
      topByRevenue,
      busyHours,
    };
  }

  // ─────────────────────────── Buyurtmalar ro'yxati ───────────────────────────

  /** Umumiy filterlar: status, sana, qidiruv (ism/telefon/taom), summa, vaqt, sort */
  private buildWhere(query: ListOrdersQueryDto, includeDeleted = false): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    if (!includeDeleted) {
      where.deletedAt = null;
    } else {
      where.deletedAt = { not: null };
    }

    if (query.status) {
      where.status = query.status;
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) {
        // 'to' faqat sana bo'lgani uchun kun oxirigacha (23:59:59.999) qamrab olamiz
        where.createdAt.lte = new Date(`${query.to}T23:59:59.999`);
      }
    }
    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.totalAmount = {};
      if (query.minAmount !== undefined) where.totalAmount.gte = query.minAmount;
      if (query.maxAmount !== undefined) where.totalAmount.lte = query.maxAmount;
    }
    if (query.search) {
      const q = query.search;
      where.OR = [
        { customer: { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } },
        { items: { some: { menuItem: { name: { contains: q } } } } },
        // buyurtma raqami bo'yicha qidiruv
        ...(/^\d+$/.test(q) ? [{ id: Number(q) }] : []),
      ];
    }
    if (query.time) {
      const hhmm = currentHHMM();
      if (query.time === 'upcoming') {
        where.status = { in: ACTIVE_STATUSES };
        where.requiredTime = { gte: hhmm };
      } else if (query.time === 'overdue') {
        where.status = { in: ACTIVE_STATUSES };
        where.requiredTime = { lt: hhmm };
      } else if (query.time === 'completed') {
        where.status = { in: [OrderStatus.READY, OrderStatus.COMPLETED] };
      }
    }
    return where;
  }

  private orderInclude = {
    customer: true,
    items: { include: { menuItem: true } },
  } as const;

  async listOrders(query: ListOrdersQueryDto): Promise<{
    items: SerializedOrder[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where = this.buildWhere(query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const orderBy = SORT_MAP[query.sort ?? 'newest'];

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map(serializeOrder),
      total,
      page,
      pageSize,
    };
  }

  /** O'chirilgan (soft-deleted) buyurtmalar */
  async listDeletedOrders(query: ListOrdersQueryDto): Promise<{
    items: SerializedOrder[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where = this.buildWhere(query, true);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude,
        orderBy: { deletedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items: items.map(serializeOrder), total, page, pageSize };
  }

  // ─────────────────────── Soft delete / Restore / Permanent ───────────────────────

  async softDeleteOrder(orderId: number, admin: string, ip?: string): Promise<SerializedOrder> {
    const order = await this.loadOrder(orderId);
    if (order.deletedAt) {
      throw new BadRequestException('Buyurtma allaqachon o\'chirilgan');
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { deletedAt: new Date(), deletedBy: admin },
      include: this.orderInclude,
    });
    await this.audit.log({
      admin,
      action: 'ORDER_DELETED',
      entity: 'Order',
      entityId: orderId,
      oldValue: order.status,
      ip,
    });
    this.logger.log(`Buyurtma #${orderId} o'chirildi (soft) — ${admin}`);
    return serializeOrder(updated);
  }

  async restoreOrder(orderId: number, admin: string, ip?: string): Promise<SerializedOrder> {
    const order = await this.loadOrder(orderId);
    if (!order.deletedAt) {
      throw new BadRequestException('Buyurtma o\'chirilmagan');
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { deletedAt: null, deletedBy: null },
      include: this.orderInclude,
    });
    await this.audit.log({
      admin,
      action: 'ORDER_RESTORED',
      entity: 'Order',
      entityId: orderId,
      ip,
    });
    this.logger.log(`Buyurtma #${orderId} tiklandi — ${admin}`);
    return serializeOrder(updated);
  }

  /** PERMANENT DELETE — qaytarib bo'lmaydi. Faqat tasdiqlangan admin harakati. */
  async permanentDeleteOrder(orderId: number, admin: string, ip?: string) {
    const order = await this.loadOrder(orderId);
    if (!order.deletedAt) {
      throw new BadRequestException(
        'Avval buyurtmani o\'chirish (soft) kerak — permanent delete faqat o\'chirilgan buyurtmalar uchun',
      );
    }
    await this.audit.log({
      admin,
      action: 'ORDER_PERMANENT_DELETED',
      entity: 'Order',
      entityId: orderId,
      oldValue: `status=${order.status}, total=${order.totalAmount}`,
      ip,
    });
    await this.prisma.order.delete({ where: { id: orderId } });
    this.logger.warn(`Buyurtma #${orderId} PERMANENT o'chirildi — ${admin}`);
    return { deleted: true, id: orderId, permanent: true };
  }

  // ─────────────────────────────── Bulk actions ───────────────────────────────

  async bulkAction(dto: BulkActionDto, admin: string, ip?: string) {
    const results: { id: number; ok: boolean; error?: string }[] = [];
    for (const id of dto.ids) {
      try {
        if (dto.action === 'delete') {
          await this.softDeleteOrder(id, admin, ip);
        } else if (dto.action === 'cancel') {
          await this.orderStatusService.updateStatus(id, OrderStatus.CANCELLED, {
            reason: dto.reason ?? 'Admin bulk bekor qilish',
            actor: admin,
            ip,
          });
        } else if (dto.action === 'complete') {
          await this.orderStatusService.updateStatus(id, OrderStatus.COMPLETED, {
            actor: admin,
            ip,
          });
        }
        results.push({ id, ok: true });
      } catch (err) {
        results.push({
          id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    this.logger.log(`Bulk ${dto.action}: ${okCount}/${dto.ids.length} bajarildi — ${admin}`);
    return { action: dto.action, processed: results.length, ok: okCount, results };
  }

  // ─────────────────────────────── CSV Export ───────────────────────────────

  async exportOrdersCSV(query: ListOrdersQueryDto): Promise<string> {
    const where = this.buildWhere(query);
    const orders = await this.prisma.order.findMany({
      where,
      include: this.orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 5000, // katta datasetlarda cheklangan (server-side)
    });

    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = [
      'ID',
      'Yaratilgan',
      'Kerakli vaqt',
      'Holat',
      'Mijoz',
      'Telefon',
      'Taomlar',
      'Jami (so\'m)',
      'Telegram',
      'Izoh',
      'Bekor sababi',
    ];

    const rows = orders.map((o) => [
      o.id,
      o.createdAt.toISOString(),
      o.requiredTime,
      o.status,
      o.customer.name,
      o.customer.phone,
      o.items.map((i) => `${i.menuItem.name} x${i.quantity}`).join('; '),
      toNumber(o.totalAmount),
      o.telegramStatus,
      o.note ?? '',
      o.cancelledReason ?? '',
    ]);

    return [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  }

  // ─────────────────────────────── Menyu CRUD ───────────────────────────────

  /** Barcha taomlar (mavjud bo'lmaganlari ham) — admin panel menyu boshqaruvi uchun */
  async listMenuItems() {
    const items = await this.prisma.menuItem.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return items.map((item) => ({ ...item, price: toNumber(item.price) }));
  }

  async createMenuItem(dto: CreateMenuItemDto, admin: string, ip?: string) {
    const item = await this.prisma.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        imageUrl: dto.imageUrl ?? null,
        category: dto.category,
        available: dto.available ?? true,
      },
    });
    await this.audit.log({
      admin,
      action: 'PRODUCT_CREATED',
      entity: 'MenuItem',
      entityId: item.id,
      newValue: item.name,
      ip,
    });
    return { ...item, price: toNumber(item.price) };
  }

  async updateMenuItem(id: number, dto: UpdateMenuItemDto, admin: string, ip?: string) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Menyu taomi topilmadi');
    }
    const item = await this.prisma.menuItem.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        price: dto.price ?? undefined,
        imageUrl: dto.imageUrl ?? undefined,
        category: dto.category ?? undefined,
        available: dto.available ?? undefined,
      },
    });
    await this.audit.log({
      admin,
      action: 'PRODUCT_UPDATED',
      entity: 'MenuItem',
      entityId: id,
      oldValue: existing.name,
      newValue: item.name,
      ip,
    });
    return { ...item, price: toNumber(item.price) };
  }

  async removeMenuItem(id: number, admin: string, ip?: string) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Menyu taomi topilmadi');
    }
    try {
      await this.prisma.menuItem.delete({ where: { id } });
      await this.audit.log({
        admin,
        action: 'PRODUCT_DELETED',
        entity: 'MenuItem',
        entityId: id,
        oldValue: existing.name,
        ip,
      });
      return { deleted: true, id };
    } catch (err) {
      // Taomga buyurtmalar bog'langan bo'lsa — fizik o'chirish o'rniga soft-delete
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        await this.prisma.menuItem.update({
          where: { id },
          data: { available: false },
        });
        await this.audit.log({
          admin,
          action: 'PRODUCT_UNAVAILABLE',
          entity: 'MenuItem',
          entityId: id,
          oldValue: existing.name,
          ip,
        });
        return { deleted: true, id, soft: true };
      }
      throw err;
    }
  }

  // ─────────────────────────────── Yordamchilar ───────────────────────────────

  private async loadOrder(orderId: number): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: this.orderInclude,
    });
    if (!order) {
      throw new NotFoundException('Buyurtma topilmadi');
    }
    return order;
  }
}
