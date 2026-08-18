export type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  category: string;
  available: boolean;
}

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

export interface CreateOrderDto {
  customer: {
    name: string;
    phone: string;
    telegramUsername?: string;
  };
  requiredTime: string;
  items: { menuItemId: number; quantity: number }[];
  note?: string;
}

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

export interface OrdersPage {
  items: SerializedOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export type OrderSort =
  | "newest"
  | "oldest"
  | "highest"
  | "lowest"
  | "soonest"
  | "latest";

export type OrderTimeFilter = "upcoming" | "overdue" | "completed";

export interface OrderFilters {
  status?: OrderStatus;
  search?: string;
  from?: string;
  to?: string;
  sort?: OrderSort;
  time?: OrderTimeFilter;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
}
