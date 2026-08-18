import type { Customer, MenuItem, Order, OrderItem } from '@prisma/client';
import type { OrderStatus } from './order-status';

export interface SerializedOrderItem {
  id: number;
  menuItemId: number;
  name: string;
  quantity: number;
  price: number;
}

export interface SerializedOrder {
  id: number;
  customer: {
    id: number;
    name: string;
    phone: string;
    telegramUsername: string | null;
  };
  items: SerializedOrderItem[];
  totalAmount: number;
  requiredTime: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  telegramMessageId: number | null;
  telegramStatus: string;
  note: string | null;
  cancelledReason: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  isOverdue: boolean;
  overdueMinutes: number | null;
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
}

export interface SerializedOrderDetail extends SerializedOrder {
  history: OrderStatusHistoryItem[];
}

export type OrderWithRelations = Order & {
  customer: Customer;
  items: (OrderItem & { menuItem: MenuItem })[];
};

export type OrderDetailWithHistory = OrderWithRelations & {
  history: {
    status: string;
    reason: string | null;
    changedBy: string | null;
    createdAt: Date;
  }[];
};

/** Prisma Decimal → number */
export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'object' && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value);
}

const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'PREPARING'];

/**
 * Kechikkan buyurtma: kerakli vaqt o'tib ketgan va hali READY/COMPLETED/CANCELLED bo'lmagan.
 * Kerakli vaqt buyurtma kuni (createdAt) asosida hisoblanadi.
 */
export function computeOverdue(
  requiredTime: string,
  status: OrderStatus,
  createdAt: Date,
  now: Date = new Date(),
): { isOverdue: boolean; overdueMinutes: number | null } {
  if (!ACTIVE_STATUSES.includes(status)) {
    return { isOverdue: false, overdueMinutes: null };
  }
  const [h, m] = requiredTime.split(':').map((p) => parseInt(p, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return { isOverdue: false, overdueMinutes: null };
  }
  const expected = new Date(createdAt);
  expected.setHours(h, m, 0, 0);
  if (now <= expected) {
    return { isOverdue: false, overdueMinutes: null };
  }
  return {
    isOverdue: true,
    overdueMinutes: Math.floor((now.getTime() - expected.getTime()) / 60_000),
  };
}

export function serializeOrder(order: OrderWithRelations): SerializedOrder {
  const overdue = computeOverdue(order.requiredTime, order.status as OrderStatus, order.createdAt);
  return {
    id: order.id,
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      phone: order.customer.phone,
      telegramUsername: order.customer.telegramUsername ?? null,
    },
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.menuItem.name,
      quantity: item.quantity,
      price: toNumber(item.price),
    })),
    totalAmount: toNumber(order.totalAmount),
    requiredTime: order.requiredTime,
    status: order.status as OrderStatus,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    telegramMessageId: order.telegramMessageId ?? null,
    telegramStatus: order.telegramStatus,
    note: order.note ?? null,
    cancelledReason: order.cancelledReason ?? null,
    deletedAt: order.deletedAt?.toISOString() ?? null,
    deletedBy: order.deletedBy ?? null,
    isOverdue: overdue.isOverdue,
    overdueMinutes: overdue.overdueMinutes,
  };
}

export function serializeOrderDetail(order: OrderDetailWithHistory): SerializedOrderDetail {
  return {
    ...serializeOrder(order),
    history: order.history.map((h) => ({
      status: h.status as OrderStatus,
      reason: h.reason,
      changedBy: h.changedBy,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}
