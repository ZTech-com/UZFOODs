import type {
  CreateOrderDto,
  MenuItem,
  OrderFilters,
  OrderStatus,
  OrdersPage,
  SerializedOrder,
  SerializedOrderDetail,
  StatsResponse,
} from "./types";

// API URL aniqlash:
// - NEXT_PUBLIC_API_URL belgilangan bo'lsa — o'sha URL ishlatiladi (Vercel frontend → alohida backend)
// - Yo'q bo'lsa — same origin (Docker: backend frontend'ni xizmat qiladi)
// - Development'da — localhost:3001
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? (
    typeof window !== "undefined" && !window.location.hostname.includes("localhost")
      ? "" // production — same origin (Docker/Render)
      : "http://localhost:3001"
  );

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ── Token (admin) ──
const TOKEN_KEY = "restaurant_admin_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

// ── Asosiy so'rov ──
async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg =
      body && typeof body === "object" && "message" in body
        ? (body as { message: unknown }).message
        : res.statusText;
    throw new ApiError(
      res.status,
      typeof msg === "string" ? msg : JSON.stringify(msg),
    );
  }
  return res.json() as Promise<T>;
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

function orderQuery(f: OrderFilters): string {
  return queryString({
    status: f.status,
    search: f.search,
    from: f.from,
    to: f.to,
    sort: f.sort,
    time: f.time,
    minAmount: f.minAmount,
    maxAmount: f.maxAmount,
    page: f.page,
    pageSize: f.pageSize,
  });
}

// ── API ──
export const api = {
  // Ommaviy
  getMenu: () => request<MenuItem[]>("/menu"),
  createOrder: (dto: CreateOrderDto, idempotencyKey?: string) =>
    request<SerializedOrder>("/orders", {
      method: "POST",
      body: JSON.stringify(dto),
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    }),
  getOrder: (id: number) => request<SerializedOrderDetail>(`/orders/${id}`),

  // Admin
  login: (username: string, password: string) =>
    request<{ accessToken: string }>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getStats: () => request<StatsResponse>("/admin/stats", {}, true),
  listOrders: (f: OrderFilters) =>
    request<OrdersPage>(`/admin/orders${orderQuery(f)}`, {}, true),
  listDeletedOrders: (f: OrderFilters) =>
    request<OrdersPage>(`/admin/orders/deleted${orderQuery(f)}`, {}, true),
  updateStatus: (id: number, status: OrderStatus, reason?: string) =>
    request<SerializedOrder>(
      `/orders/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status, reason }) },
      true,
    ),
  bulkOrders: (
    action: "complete" | "cancel" | "delete",
    ids: number[],
    reason?: string,
  ) =>
    request<{ action: string; ok: number; processed: number }>(
      "/admin/orders/bulk",
      { method: "POST", body: JSON.stringify({ action, ids, reason }) },
      true,
    ),
  softDeleteOrder: (id: number) =>
    request<SerializedOrder>(`/admin/orders/${id}`, { method: "DELETE" }, true),
  restoreOrder: (id: number) =>
    request<SerializedOrder>(
      `/admin/orders/${id}/restore`,
      { method: "POST" },
      true,
    ),
  permanentDeleteOrder: (id: number) =>
    request<{ deleted: boolean }>(
      `/admin/orders/${id}/permanent`,
      { method: "DELETE" },
      true,
    ),
  exportOrders: (f: OrderFilters) => {
    const token = getToken();
    return fetch(`${API_URL}/api/admin/orders/export${orderQuery(f)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(async (res) => {
      if (!res.ok) throw new ApiError(res.status, "Export xatosi");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  },

  // Menyu boshqaruvi (admin)
  listMenuItems: () => request<MenuItem[]>("/admin/menu-items", {}, true),
  createMenuItem: (dto: {
    name: string;
    description?: string;
    price: number;
    category: string;
    imageUrl?: string;
    available?: boolean;
  }) =>
    request<MenuItem>(
      "/admin/menu-items",
      { method: "POST", body: JSON.stringify(dto) },
      true,
    ),
  updateMenuItem: (
    id: number,
    dto: Partial<{
      name: string;
      description: string;
      price: number;
      category: string;
      imageUrl: string;
      available: boolean;
    }>,
  ) =>
    request<MenuItem>(
      `/admin/menu-items/${id}`,
      { method: "PATCH", body: JSON.stringify(dto) },
      true,
    ),
  deleteMenuItem: (id: number) =>
    request<{ deleted: boolean; soft?: boolean }>(
      `/admin/menu-items/${id}`,
      { method: "DELETE" },
      true,
    ),
};
