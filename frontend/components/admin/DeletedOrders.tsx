"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { SerializedOrder } from "@/lib/types";
import { formatDateTime, formatSum } from "@/lib/format";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  notify: (kind: "success" | "error", title: string, body?: string) => void;
}

export function DeletedOrders({ notify }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{
    type: "restore" | "permanent";
    order: SerializedOrder;
  } | null>(null);

  const query = useQuery({
    queryKey: ["admin-deleted", search],
    queryFn: () => api.listDeletedOrders({ search: search || undefined, pageSize: 50 }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-deleted"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.restoreOrder(id),
    onSuccess: () => {
      notify("success", "Buyurtma tiklandi");
      setPending(null);
      invalidate();
    },
    onError: (e: Error) => notify("error", "Xatolik", e.message),
  });

  const permanentMutation = useMutation({
    mutationFn: (id: number) => api.permanentDeleteOrder(id),
    onSuccess: () => {
      notify("success", "Buyurtma butunlay o'chirildi");
      setPending(null);
      invalidate();
    },
    onError: (e: Error) => notify("error", "Xatolik", e.message),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        🗑 Bu yerda o'chirilgan buyurtmalar arxivi. Restore bilan qaytarish yoki{" "}
        <b>permanent delete</b> bilan butunlay o'chirish mumkin (qaytarib bo'lmaydi).
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Qidirish: ism, telefon, #raqam..."
        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
      />

      {query.isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-200" />
          ))}
        </div>
      )}

      {query.error &&
        !(query.error instanceof ApiError && query.error.status === 401) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            O'chirilgan buyurtmalarni yuklab bo'lmadi.
          </div>
        )}

      {!query.isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-400">
          O'chirilgan buyurtmalar yo'q.
        </div>
      )}

      <div className="space-y-2">
        {items.map((o) => (
          <div
            key={o.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm opacity-90"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-stone-900">
                #{o.id}
                <span className="ml-2 text-xs font-normal text-stone-400">
                  {o.customer.name} · {o.customer.phone}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                {formatSum(o.totalAmount)} · ⏰ {o.requiredTime} ·{" "}
                {o.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}
              </p>
              <p className="text-xs text-stone-400">
                O'chirilgan: {formatDateTime(o.deletedAt ?? "")} ·{" "}
                {o.deletedBy ?? "admin"}
              </p>
            </div>
            <button
              onClick={() => setPending({ type: "restore", order: o })}
              className="rounded-full bg-green-600 px-4 py-2 text-xs font-bold text-white"
            >
              ↺ Restore
            </button>
            <button
              onClick={() => setPending({ type: "permanent", order: o })}
              className="rounded-full border border-red-300 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
            >
              🗑 Permanent
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pending?.type === "restore"}
        title="Buyurtmani tiklash"
        message={`#${pending?.order.id} buyurtmasini tiklashga ishonchingiz komilmi?`}
        confirmLabel="Tiklash"
        busy={restoreMutation.isPending}
        onConfirm={() => pending && restoreMutation.mutate(pending.order.id)}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={pending?.type === "permanent"}
        title="PERMANENT DELETE"
        message={`#${pending?.order.id} buyurtmasini butunlay o'chirish — BU AMALNI QAYTARIB BO'LMAYDI. Bu buyurtma database tarixidan butunlay yo'qoladi. Davom etasizmi?`}
        confirmLabel="Butunlay o'chirish"
        danger
        busy={permanentMutation.isPending}
        onConfirm={() => pending && permanentMutation.mutate(pending.order.id)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
