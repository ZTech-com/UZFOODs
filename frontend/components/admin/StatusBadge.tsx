"use client";

import type { OrderStatus } from "@/lib/types";

const STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PREPARING: "bg-blue-100 text-blue-800",
  READY: "bg-green-100 text-green-800",
  COMPLETED: "bg-stone-200 text-stone-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "⏳ Kutilmoqda",
  PREPARING: "👨‍🍳 Tayyorlanmoqda",
  READY: "✅ Tayyor",
  COMPLETED: "🏁 Yakunlandi",
  CANCELLED: "❌ Bekor qilingan",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
