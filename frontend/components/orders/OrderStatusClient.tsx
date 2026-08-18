"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OrderStatus } from "@/lib/types";
import { formatClock, formatSum } from "@/lib/format";

const STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  PENDING: { label: "⏳ Kutilmoqda", color: "bg-amber-100 text-amber-800" },
  PREPARING: { label: "👨‍🍳 Tayyorlanmoqda", color: "bg-blue-100 text-blue-800" },
  READY: { label: "✅ Tayyor", color: "bg-green-100 text-green-800" },
  COMPLETED: { label: "🏁 Yakunlandi", color: "bg-stone-200 text-stone-700" },
  CANCELLED: { label: "❌ Bekor qilingan", color: "bg-red-100 text-red-700" },
};

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "PENDING", label: "Qabul qilindi" },
  { status: "PREPARING", label: "Tayyorlanmoqda" },
  { status: "READY", label: "Tayyor" },
  { status: "COMPLETED", label: "Yakunlandi" },
];

export function OrderStatusClient() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.getOrder(orderId),
    refetchInterval: 5_000,
    enabled: Number.isFinite(orderId) && orderId > 0,
  });

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-stone-600">
        Noto'g'ri buyurtma raqami.{" "}
        <Link href="/" className="font-medium text-green-700">
          Menyuga qaytish
        </Link>
      </div>
    );
  }

  const meta = order ? STATUS_META[order.status] : null;
  const cancelled = order?.status === "CANCELLED";
  const currentStepIndex = order
    ? STEPS.findIndex((s) => s.status === order.status)
    : -1;

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-green-700">
          ← Menyuga qaytish
        </Link>
        <span className="text-xs text-stone-400">Buyurtma #{orderId}</span>
      </header>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-200" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Buyurtma topilmadi yoki serverga ulanib bo'lmadi.
        </div>
      )}

      {order && meta && (
        <>
          <div
            className={`rounded-2xl p-5 text-center ${
              cancelled ? "bg-red-50" : "border border-stone-200 bg-white shadow-sm"
            }`}
          >
            <p className="text-sm text-stone-500">Buyurtma holati</p>
            <p
              className={`mt-1 inline-block rounded-full px-4 py-1.5 text-sm font-bold ${meta.color}`}
            >
              {meta.label}
            </p>
            {cancelled ? (
              <p className="mt-3 text-sm text-red-700">
                Afsuski, buyurtmangiz bekor qilindi. Sabab:{" "}
                <b>{order.cancelledReason ?? "ko'rsatilmagan"}</b>
              </p>
            ) : (
              <p className="mt-3 text-sm text-stone-500">
                Buyurtma tushgan vaqt: {formatClock(order.createdAt)}
              </p>
            )}
          </div>

          {!cancelled && (
            <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
              {STEPS.map((step, i) => {
                const done = i <= currentStepIndex;
                const isLast = i === STEPS.length - 1;
                return (
                  <div key={step.status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          done ? "bg-green-600 text-white" : "bg-stone-200 text-stone-400"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </div>
                      {!isLast && (
                        <div
                          className={`w-0.5 flex-1 ${
                            i < currentStepIndex ? "bg-green-600" : "bg-stone-200"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pb-5">
                      <p
                        className={`text-sm font-medium ${
                          done ? "text-stone-900" : "text-stone-400"
                        }`}
                      >
                        {step.label}
                      </p>
                      {i === currentStepIndex && (
                        <p className="text-xs text-green-700">Hozirgi holat</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5">
            <h3 className="text-sm font-bold text-stone-900">Buyurtma tarkibi</h3>
            <div className="mt-2 space-y-1.5 text-sm">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="text-stone-600">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium text-stone-900">
                    {formatSum(item.price * item.quantity)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-stone-200 pt-2 font-bold text-stone-900">
                <span>Jami</span>
                <span>{formatSum(order.totalAmount)}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-stone-500">
              ⏰ Tayyor bo'lish vaqti:{" "}
              <span className="font-semibold text-stone-700">
                {order.requiredTime}
              </span>
            </p>
            {order.note && (
              <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-800">
                📝 Izoh: {order.note}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
