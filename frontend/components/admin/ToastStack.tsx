"use client";

import { useEffect } from "react";
import type { SerializedOrder } from "@/lib/types";
import { formatSum } from "@/lib/format";
import { playOrderSound } from "@/lib/sound";

export type ToastKind = "success" | "error" | "info" | "order";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
  order?: SerializedOrder;
  sound?: boolean;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
  onViewOrder?: (orderId: number) => void;
}

const KIND_STYLES: Record<ToastKind, string> = {
  success: "border-green-200",
  error: "border-red-200",
  info: "border-blue-200",
  order: "border-green-200",
};

const KIND_ICON: Record<ToastKind, string> = {
  success: "✅",
  error: "❌",
  info: "ℹ️",
  order: "🆕",
};

/** Brauzer bildirishnomalari yoqilganmi? */
export function notificationsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "Notification" in window &&
    Notification.permission === "granted" &&
    window.localStorage.getItem("restaurant_admin_notifications") === "on"
  );
}

/** Foydalanuvchi rozilik bergan bo'lsa — brauzer bildirishnomasi */
export function notifyNewOrder(order: SerializedOrder) {
  if (!notificationsEnabled()) return;
  try {
    const n = new Notification(`🆕 Yangi buyurtma #${order.id}`, {
      body: `${order.customer.name} — ${order.items.length} ta taom, ${formatSum(order.totalAmount)}. Tayyor bo'lishi: ${order.requiredTime}`,
      tag: `order-${order.id}`,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ba'zi brauzerlarda ruxsatsiz Notification xato beradi
  }
}

export function ToastStack({ toasts, onDismiss, onViewOrder }: Props) {
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[60] flex w-72 flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          onDismiss={() => onDismiss(t.id)}
          onViewOrder={onViewOrder ? () => onViewOrder(t.order!.id) : undefined}
        />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
  onViewOrder,
}: {
  toast: ToastItem;
  onDismiss: () => void;
  onViewOrder?: () => void;
}) {
  // 7 soniyadan so'ng avtomatik yopiladi
  useEffect(() => {
    const timer = setTimeout(onDismiss, 7000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  useEffect(() => {
    if (toast.sound) playOrderSound();
  }, [toast.sound]);

  return (
    <div
      className={`animate-slide-up pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-3 shadow-lg shadow-stone-900/10 ${KIND_STYLES[toast.kind]}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg">
        {KIND_ICON[toast.kind]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-stone-900">{toast.title}</p>
        {toast.body && (
          <p className="mt-0.5 text-xs text-stone-500">{toast.body}</p>
        )}
        {toast.kind === "order" && toast.order && (
          <>
            <p className="mt-0.5 text-xs text-stone-500">
              {toast.order.customer.name} · {formatSum(toast.order.totalAmount)} ·{" "}
              ⏰ {toast.order.requiredTime}
            </p>
            {onViewOrder && (
              <button
                onClick={onViewOrder}
                className="mt-1.5 rounded-full bg-green-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-green-700"
              >
                Ko'rish
              </button>
            )}
          </>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-stone-300 hover:text-stone-500"
        aria-label="Yopish"
      >
        ✕
      </button>
    </div>
  );
}
