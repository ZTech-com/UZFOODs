"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError, clearToken } from "@/lib/api";
import type { OrderFilters, OrderStatus, SerializedOrder } from "@/lib/types";
import { Dashboard } from "@/components/admin/Dashboard";
import { OrdersView } from "@/components/admin/OrdersView";
import { DeletedOrders } from "@/components/admin/DeletedOrders";
import { MenuManager } from "@/components/admin/MenuManager";
import { useRealtimeOrders } from "@/components/admin/useRealtimeOrders";
import { getSocket } from "@/lib/socket";
import {
  ToastStack,
  notificationsEnabled,
  notifyNewOrder,
  type ToastItem,
} from "@/components/admin/ToastStack";

type Tab = "dashboard" | "orders" | "deleted" | "menu";

let toastSeq = 0;

export default function AdminDashboardPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("dashboard");
  const [filters, setFiltersState] = useState<OrderFilters>({ page: 1, pageSize: 20 });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [realtime, setRealtime] = useState<"connecting" | "connected" | "offline">(
    "connecting",
  );
  const [notifOn, setNotifOn] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const notify = useCallback(
    (kind: ToastItem["kind"], title: string, body?: string, order?: SerializedOrder) => {
      const item: ToastItem = {
        id: ++toastSeq,
        kind,
        title,
        body,
        order,
        sound: kind === "order",
      };
      setToasts((prev) => [...prev.slice(-3), item]);
      if (kind === "order" && order) notifyNewOrder(order);
    },
    [],
  );

  const dismissToast = useCallback(
    (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const setFilters = useCallback((patch: Partial<OrderFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  /** Dashboard KPI kartasidan Orders tabiga filterlar bilan o'tish */
  const navigateToOrders = useCallback(
    (f: { status?: OrderStatus; from?: string; to?: string }) => {
      setFilters({ status: f.status, from: f.from, to: f.to, page: 1 });
      setTab("orders");
    },
    [setFilters],
  );

  // Real-vaqt: yangi buyurtma → toast + bildirishnoma
  useRealtimeOrders((order) => {
    notify("order", `Yangi buyurtma #${order.id}`, undefined, order);
  });

  // Socket holati indikatori (avtomatik reconnect socket.io'da o'rnatilgan)
  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setRealtime("connected");
    const onDisconnect = () => setRealtime("offline");
    const onConnecting = () => setRealtime("connecting");
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("reconnect_attempt", onConnecting);
    setRealtime(socket.connected ? "connected" : "connecting");
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("reconnect_attempt", onConnecting);
    };
  }, []);

  // "/" — qidiruvga fokus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && tab === "orders") {
        const input = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Qidirish"]',
        );
        if (input && document.activeElement !== input) {
          e.preventDefault();
          input.focus();
        }
      }
      if (e.key === "Escape") setHighlightId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab]);

  useEffect(() => {
    setNotifOn(notificationsEnabled());
  }, []);

  const statsQuery = useQuery({ queryKey: ["admin-stats"], queryFn: api.getStats });
  const statsError = statsQuery.error;

  // 401 → login sahifasiga
  useEffect(() => {
    if (statsError instanceof ApiError && statsError.status === 401) {
      clearToken();
      router.replace("/admin/login");
    }
  }, [statsError, router]);

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      window.localStorage.setItem("restaurant_admin_notifications", "on");
      setNotifOn(true);
    }
  }

  function viewOrderFromToast(orderId: number) {
    setTab("orders");
    setHighlightId(orderId);
    setTimeout(() => setHighlightId(null), 6000);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "dashboard", label: "📊 Dashboard" },
    { key: "orders", label: "📦 Buyurtmalar" },
    { key: "deleted", label: "🗑 O'chirilgan" },
    { key: "menu", label: "🍽 Menyu" },
  ];

  return (
    <div className="space-y-5">
      <ToastStack toasts={toasts} onDismiss={dismissToast} onViewOrder={viewOrderFromToast} />

      {/* Sarlavha qatori */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-stone-200/70 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                tab === t.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Realtime holat */}
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              realtime === "connected"
                ? "bg-green-50 text-green-700"
                : realtime === "offline"
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700"
            }`}
            title="Real-vaqt ulanish holati"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                realtime === "connected"
                  ? "bg-green-600"
                  : realtime === "offline"
                    ? "bg-red-600 animate-pulse"
                    : "bg-amber-500 animate-pulse-dot"
              }`}
            />
            {realtime === "connected"
              ? "Real-time"
              : realtime === "offline"
                ? "Qayta ulanmoqda..."
                : "Ulanmoqda..."}
          </span>

          {notifOn ? (
            <span className="text-xs font-medium text-green-700">🔔 yoqilgan</span>
          ) : "Notification" in window ? (
            <button
              onClick={enableNotifications}
              className="rounded-full border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
              title="Yangi buyurtma kelganda brauzer bildirishnomasi"
            >
              🔔 Bildirishnomalar
            </button>
          ) : null}
        </div>
      </div>

      {tab === "dashboard" && statsQuery.data && (
        <Dashboard stats={statsQuery.data} onNavigateToOrders={navigateToOrders} />
      )}

      {tab === "orders" && (
        <OrdersView
          filters={filters}
          setFilters={setFilters}
          notify={(kind, title, body) => notify(kind, title, body)}
          highlightId={highlightId}
        />
      )}

      {tab === "deleted" && (
        <DeletedOrders notify={(kind, title, body) => notify(kind, title, body)} />
      )}

      {tab === "menu" && <MenuManager />}
    </div>
  );
}
