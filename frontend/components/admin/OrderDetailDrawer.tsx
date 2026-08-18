"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { OrderStatus, SerializedOrder } from "@/lib/types";
import { formatClock, formatDateTime, formatSum } from "@/lib/format";
import { StatusBadge, STATUS_LABELS } from "./StatusBadge";
import { ConfirmDialog } from "./ConfirmDialog";

const CANCEL_REASONS = [
  "Mijoz bekor qildi",
  "Mahsulot mavjud emas",
  "Restoran band",
  "Noto'g'ri buyurtma",
  "Boshqa",
];

const TELEGRAM_LABEL: Record<string, string> = {
  PENDING: "⏳ Navbatda",
  SENT: "✅ Yuborildi",
  FAILED: "❌ Xatolik",
};

interface Props {
  orderId: number | null;
  onClose: () => void;
  notify: (kind: "success" | "error", title: string, body?: string) => void;
}

export function OrderDetailDrawer({ orderId, onClose, notify }: Props) {
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-detail", orderId],
    queryFn: () => api.getOrder(orderId!),
    enabled: orderId !== null,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["order-detail", orderId] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ s, r }: { s: OrderStatus; r?: string }) =>
      api.updateStatus(orderId!, s, r),
    onSuccess: () => {
      invalidate();
      notify("success", "Status yangilandi");
    },
    onError: (e: Error) => notify("error", "Xatolik", e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.softDeleteOrder(orderId!),
    onSuccess: () => {
      invalidate();
      notify("success", "Buyurtma o'chirildi (arxivda saqlanadi)");
      onClose();
    },
    onError: (e: Error) => notify("error", "Xatolik", e.message),
  });

  if (!orderId) return null;

  function printReceipt(o: SerializedOrder) {
    const lines = [
      "<html><head><title>Receipt</title><style>",
      "body{font-family:monospace;width:280px;margin:20px auto;font-size:14px}",
      "h1{font-size:18px;margin:0 0 4px}.line{border-top:1px dashed #000;margin:8px 0}",
      "table{width:100%;border-collapse:collapse}.r{text-align:right}",
      ".b{font-weight:bold;font-size:16px;margin-top:8px}",
      "</style></head><body>",
      `<h1>ORDER #${o.id}</h1>`,
      `<div>${o.customer.name}</div>`,
      `<div>${o.customer.phone}</div>`,
      '<div class="line"></div>',
      ...o.items.map(
        (i) =>
          `<div>${i.name} x${i.quantity} <span class="r" style="float:right">${formatSum(i.price * i.quantity)}</span></div>`,
      ),
      '<div class="line"></div>',
      `<div class="b">TOTAL: ${formatSum(o.totalAmount)}</div>`,
      `<div>READY: ${o.requiredTime}</div>`,
      `<div>STATUS: ${STATUS_LABELS[o.status]}</div>`,
      o.note ? `<div>NOTE: ${o.note}</div>` : "",
      '<div class="line"></div>',
      `<div>${formatDateTime(o.createdAt)}</div>`,
      "</body></html>",
    ].join("");
    const w = window.open("", "_blank", "width=340,height=600");
    if (!w) return;
    w.document.write(lines);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  const actionsFor = (status: OrderStatus) => {
    switch (status) {
      case "PENDING":
        return [{ label: "✅ Qabul qilish", s: "PREPARING" as OrderStatus }];
      case "PREPARING":
        return [{ label: "✅ Tayyor", s: "READY" as OrderStatus }];
      case "READY":
        return [{ label: "🏁 Yakunlash", s: "COMPLETED" as OrderStatus }];
      default:
        return [];
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="animate-slide-up h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Buyurtma #${orderId} detali`}
      >
        {isLoading || !order ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-stone-200" />
            ))}
          </div>
        ) : (
          <div className="p-5">
            {/* Sarlavha */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-stone-900">
                    Buyurtma #{order.id}
                  </h2>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  🕐 {formatDateTime(order.createdAt)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-stone-400 hover:bg-stone-100"
                aria-label="Yopish"
              >
                ✕
              </button>
            </div>

            {order.isOverdue && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                ⚠️ KECHIKKAN — {order.overdueMinutes} daqiqa kechikdi (kerak edi:{" "}
                {order.requiredTime})
              </div>
            )}

            {/* Mijoz */}
            <div className="mt-4 rounded-2xl border border-stone-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-400">
                👤 Mijoz
              </h3>
              <p className="mt-1 text-sm font-semibold text-stone-900">
                {order.customer.name}
              </p>
              <p className="text-sm text-stone-600">📞 {order.customer.phone}</p>
              {order.customer.telegramUsername && (
                <p className="text-sm text-stone-600">
                  ✈️ @{order.customer.telegramUsername}
                </p>
              )}
            </div>

            {/* Taomlar */}
            <div className="mt-3 rounded-2xl border border-stone-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-400">
                🍽 Taomlar
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {order.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <span className="text-stone-700">
                      {i.name} × {i.quantity}
                    </span>
                    <span className="text-stone-900">{formatSum(i.price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-stone-200 pt-2 text-sm font-bold text-stone-900">
                <span>💰 Jami</span>
                <span>{formatSum(order.totalAmount)}</span>
              </div>
            </div>

            {/* Ma'lumot */}
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-stone-200 p-4 text-sm">
              <div>
                <p className="text-xs text-stone-400">⏰ Kerakli vaqt</p>
                <p className="font-semibold">{order.requiredTime}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">📡 Telegram</p>
                <p className="font-semibold">
                  {TELEGRAM_LABEL[order.telegramStatus] ?? order.telegramStatus}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-400">🔄 Oxirgi yangilanish</p>
                <p className="font-semibold">{formatDateTime(order.updatedAt ?? order.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">📝 Izoh</p>
                <p className="font-semibold">{order.note ?? "—"}</p>
              </div>
              {order.cancelledReason && (
                <div className="col-span-2">
                  <p className="text-xs text-stone-400">Bekor qilish sababi</p>
                  <p className="font-semibold text-red-600">{order.cancelledReason}</p>
                </div>
              )}
            </div>

            {/* Harakatlar */}
            <div className="mt-4 flex flex-wrap gap-2">
              {actionsFor(order.status).map((a) => (
                <button
                  key={a.s}
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ s: a.s })}
                  className="rounded-full bg-green-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {a.label}
                </button>
              ))}
              {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                <button
                  onClick={() => setCancelOpen(true)}
                  className="rounded-full border border-red-300 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  ❌ Bekor qilish
                </button>
              )}
              <button
                onClick={() => printReceipt(order)}
                className="rounded-full border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                🖨 Print
              </button>
              {order.deletedAt === null && (
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="rounded-full border border-stone-300 px-4 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100"
                >
                  🗑 O'chirish
                </button>
              )}
            </div>

            {/* Holat tarixi */}
            <div className="mt-5 rounded-2xl border border-stone-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-400">
                📜 Holat tarixi
              </h3>
              <ol className="mt-3 space-y-0">
                {order.history.map((h, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                          i === order.history.length - 1
                            ? "bg-green-600 text-white"
                            : "bg-stone-200 text-stone-400"
                        }`}
                      >
                        {i === order.history.length - 1 ? "●" : i + 1}
                      </div>
                      {i < order.history.length - 1 && (
                        <div className="w-0.5 flex-1 bg-stone-200" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-stone-800">
                        {STATUS_LABELS[h.status]}
                        {h.status === "CANCELLED" && h.reason && (
                          <span className="ml-1 text-xs text-red-600">— {h.reason}</span>
                        )}
                      </p>
                      <p className="text-xs text-stone-400">
                        {formatClock(h.createdAt)} · {h.changedBy ?? "system"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Bekor qilish — sabab bilan */}
        <ConfirmDialog
          open={cancelOpen}
          title="Buyurtmani bekor qilish"
          message="Buyurtmani bekor qilishga ishonchingiz komilmi?"
          confirmLabel="Bekor qilish"
          danger
          busy={statusMutation.isPending}
          onConfirm={() => statusMutation.mutate({ s: "CANCELLED", r: reason })}
          onCancel={() => setCancelOpen(false)}
        >
          <div className="mt-3">
            <label className="text-xs font-medium text-stone-600">Sabab:</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-red-500"
            >
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </ConfirmDialog>

        {/* O'chirish (soft) */}
        <ConfirmDialog
          open={deleteOpen}
          title="Buyurtmani o'chirish"
          message="Bu buyurtmani o'chirishga ishonchingiz komilmi? O'chirilgan buyurtma arxivda saqlanadi va istalgan payt tiklanadi."
          confirmLabel="O'chirish"
          danger
          busy={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setDeleteOpen(false)}
        />
      </div>
    </div>
  );
}
