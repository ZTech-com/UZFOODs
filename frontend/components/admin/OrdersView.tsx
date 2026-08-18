"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  OrderFilters,
  OrderStatus,
  OrderTimeFilter,
  SerializedOrder,
} from "@/lib/types";
import { formatClock, formatSum } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { ConfirmDialog } from "./ConfirmDialog";
import { OrderDetailDrawer } from "./OrderDetailDrawer";

const STATUS_FILTERS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "Barcha holatlar" },
  { value: "PENDING", label: "Kutilmoqda" },
  { value: "PREPARING", label: "Tayyorlanmoqda" },
  { value: "READY", label: "Tayyor" },
  { value: "COMPLETED", label: "Yakunlangan" },
  { value: "CANCELLED", label: "Bekor qilingan" },
];

const DATE_PRESETS: { value: string; label: string }[] = [
  { value: "", label: "Barcha sanalar" },
  { value: "today", label: "Bugun" },
  { value: "yesterday", label: "Kecha" },
  { value: "7d", label: "Oxirgi 7 kun" },
  { value: "30d", label: "Oxirgi 30 kun" },
  { value: "custom", label: "Maxsus sana" },
];

const SORTS: { value: OrderFilters["sort"]; label: string }[] = [
  { value: "newest", label: "Yangi birinchi" },
  { value: "oldest", label: "Eski birinchi" },
  { value: "highest", label: "Eng katta summa" },
  { value: "lowest", label: "Eng kichik summa" },
  { value: "soonest", label: "Eng yaqin vaqt" },
  { value: "latest", label: "Eng kech vaqt" },
];

const TIMES: { value: OrderTimeFilter | ""; label: string }[] = [
  { value: "", label: "Barcha vaqt" },
  { value: "upcoming", label: "Kutilayotgan" },
  { value: "overdue", label: "Kechikkan" },
  { value: "completed", label: "Bajarilgan" },
];

interface Props {
  filters: OrderFilters;
  setFilters: (patch: Partial<OrderFilters>) => void;
  notify: (kind: "success" | "error", title: string, body?: string) => void;
  highlightId?: number | null;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetRange(preset: string): { from?: string; to?: string } {
  const now = new Date();
  if (preset === "today") return { from: dateKey(now), to: dateKey(now) };
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: dateKey(y), to: dateKey(y) };
  }
  if (preset === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: dateKey(d), to: dateKey(now) };
  }
  if (preset === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { from: dateKey(d), to: dateKey(now) };
  }
  return {};
}

export function OrdersView({ filters, setFilters, notify, highlightId }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<null | "complete" | "cancel" | "delete">(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [datePreset, setDatePreset] = useState("");

  // Search debounce — har bir harfda request yuborilmaydi
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters({ search: searchInput.trim() || undefined, page: 1 });
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", filters],
    queryFn: () => api.listOrders(filters),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, s }: { id: number; s: OrderStatus }) => api.updateStatus(id, s),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => notify("error", "Xatolik", e.message),
  });

  const bulkMutation = useMutation({
    mutationFn: (action: "complete" | "cancel" | "delete") =>
      api.bulkOrders(action, Array.from(selected)),
    onSuccess: (res) => {
      notify("success", `Bulk ${res.action}: ${res.ok}/${res.processed} bajarildi`);
      setSelected(new Set());
      setBulkAction(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => {
      notify("error", "Xatolik", e.message);
      setBulkAction(null);
    },
  });

  function changeFilters(patch: Partial<OrderFilters>) {
    // Filtr o'zgarganda sahifa 1 ga qaytadi
    setFilters({ ...patch, page: 1 });
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const pageSize = filters.pageSize ?? 20;
  const page = filters.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Filtr paneli */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
              🔍
            </span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Qidirish: #raqam, ism, telefon, taom...  ( / )"
              className="w-full rounded-xl border border-stone-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-green-600"
            />
          </div>
          <button
            onClick={() => api.exportOrders(filters).catch((e: Error) => notify("error", "Export xatosi", e.message))}
            className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100"
            title="CSV export"
          >
            📥 Export
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <select
            value={filters.status ?? ""}
            onChange={(e) => changeFilters({ status: (e.target.value || undefined) as OrderStatus | undefined })}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            aria-label="Holat"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value);
              const range = presetRange(e.target.value);
              changeFilters({ from: range.from, to: range.to });
            }}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            aria-label="Sana"
          >
            {DATE_PRESETS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <select
            value={filters.sort ?? "newest"}
            onChange={(e) => changeFilters({ sort: e.target.value as OrderFilters["sort"] })}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            aria-label="Tartib"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={filters.time ?? ""}
            onChange={(e) => changeFilters({ time: (e.target.value || undefined) as OrderTimeFilter | undefined })}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            aria-label="Vaqt"
          >
            {TIMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <div className="col-span-2 flex gap-2 sm:col-span-3 lg:col-span-1">
            <input
              type="number"
              min={0}
              placeholder="Min so'm"
              value={filters.minAmount ?? ""}
              onChange={(e) => changeFilters({ minAmount: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
              aria-label="Min summa"
            />
            <input
              type="number"
              min={0}
              placeholder="Max so'm"
              value={filters.maxAmount ?? ""}
              onChange={(e) => changeFilters({ maxAmount: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
              aria-label="Max summa"
            />
          </div>

          {datePreset === "custom" && (
            <div className="col-span-2 flex gap-2 sm:col-span-3 lg:col-span-2">
              <input
                type="date"
                value={filters.from ?? ""}
                onChange={(e) => changeFilters({ from: e.target.value || undefined })}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                aria-label="Sanadan"
              />
              <input
                type="date"
                value={filters.to ?? ""}
                onChange={(e) => changeFilters({ to: e.target.value || undefined })}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                aria-label="Sanagacha"
              />
            </div>
          )}
        </div>

        {/* Bulk panel */}
        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-stone-100 p-2">
            <span className="text-sm font-semibold text-stone-700">
              {selected.size} ta tanlandi
            </span>
            <button
              onClick={() => setBulkAction("complete")}
              className="rounded-full bg-stone-800 px-3 py-1.5 text-xs font-bold text-white"
            >
              ✅ Yakunlash
            </button>
            <button
              onClick={() => setBulkAction("cancel")}
              className="rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600"
            >
              ❌ Bekor qilish
            </button>
            <button
              onClick={() => setBulkAction("delete")}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-600"
            >
              🗑 O'chirish
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-stone-500 hover:text-stone-700"
            >
              Bekor qilish tanlov
            </button>
          </div>
        )}
      </section>

      {/* Natijalar sarlavhasi */}
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>
          Jami: <b className="text-stone-900">{total}</b> ta buyurtma
          {filters.search && <> · "{filters.search}" bo'yicha</>}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse-dot" />
          real-vaqt
        </span>
      </div>

      {/* Loading / Empty / Error */}
      {ordersQuery.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-200" />
          ))}
        </div>
      )}

      {ordersQuery.error &&
        !(ordersQuery.error instanceof ApiError && ordersQuery.error.status === 401) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Buyurtmalarni yuklashda xatolik yuz berdi. Qayta urinib ko'ring.
          </div>
        )}

      {!ordersQuery.isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-400">
          Buyurtmalar mavjud emas.
          {Object.values(filters).some((v) => v !== undefined && v !== "") &&
            " Filtrlarni o'zgartirib ko'ring."}
        </div>
      )}

      {/* Orders: desktop table / mobile cards */}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="hidden w-full text-sm lg:table">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every((o) => selected.has(o.id))}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? new Set(items.map((o) => o.id)) : new Set(),
                      )
                    }
                    aria-label="Hammasini tanlash"
                  />
                </th>
                <th className="p-3">Order</th>
                <th className="p-3">Mijoz</th>
                <th className="p-3">Taomlar</th>
                <th className="p-3">Vaqt</th>
                <th className="p-3 text-right">Jami</th>
                <th className="p-3">Holat</th>
                <th className="p-3 text-right">Harakat</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setDetailId(o.id)}
                  className={`cursor-pointer border-b border-stone-100 transition hover:bg-green-50/40 ${
                    highlightId === o.id ? "bg-green-50 ring-2 ring-green-400" : ""
                  }`}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleSelect(o.id)}
                      aria-label={`#${o.id} tanlash`}
                    />
                  </td>
                  <td className="p-3 font-bold text-stone-900">
                    #{o.id}
                    {o.isOverdue && <OverdueBadge minutes={o.overdueMinutes} />}
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-stone-800">{o.customer.name}</p>
                    <p className="text-xs text-stone-400">{o.customer.phone}</p>
                  </td>
                  <td className="max-w-[200px] truncate p-3 text-stone-600">
                    {o.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">⏰ {o.requiredTime}</p>
                    <p className="text-xs text-stone-400">🕐 {formatClock(o.createdAt)}</p>
                  </td>
                  <td className="p-3 text-right font-bold text-stone-900">
                    {formatSum(o.totalAmount)}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <QuickActions
                      order={o}
                      onAction={(s) => statusMutation.mutate({ id: o.id, s })}
                      busy={statusMutation.isPending}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="divide-y divide-stone-100 lg:hidden">
            {items.map((o) => (
              <div
                key={o.id}
                className={`p-4 ${highlightId === o.id ? "bg-green-50 ring-2 ring-inset ring-green-400" : ""}`}
                onClick={() => setDetailId(o.id)}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(o.id);
                    }}
                    aria-label={`#${o.id} tanlash`}
                  />
                  <span className="font-bold text-stone-900">#{o.id}</span>
                  {o.isOverdue && <OverdueBadge minutes={o.overdueMinutes} />}
                  <div className="ml-auto">
                    <StatusBadge status={o.status} />
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium text-stone-800">
                  {o.customer.name} · {formatSum(o.totalAmount)}
                </p>
                <p className="text-xs text-stone-500">
                  ⏰ {o.requiredTime} · 🕐 {formatClock(o.createdAt)} ·{" "}
                  {o.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}
                </p>
                <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <QuickActions
                    order={o}
                    onAction={(s) => statusMutation.mutate({ id: o.id, s })}
                    busy={statusMutation.isPending}
                  />
                  <button
                    onClick={() => setDetailId(o.id)}
                    className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600"
                  >
                    Batafsil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <select
              value={pageSize}
              onChange={(e) => setFilters({ pageSize: Number(e.target.value), page: 1 })}
              className="rounded-xl border border-stone-300 px-2 py-1.5 text-sm outline-none"
              aria-label="Sahifa hajmi"
            >
              {[20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / sahifa
                </option>
              ))}
            </select>
            <span className="text-stone-500">
              {total === 0 ? 0 : (page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, total)} / {total}
            </span>
          </div>
          <div className="flex gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setFilters({ page: page - 1 })}
              className="rounded-full border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ←
            </button>
            <span className="px-2 py-1.5 text-sm text-stone-600">
              {page} / {pageCount}
            </span>
            <button
              disabled={page >= pageCount}
              onClick={() => setFilters({ page: page + 1 })}
              className="rounded-full border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <OrderDetailDrawer
        orderId={detailId}
        onClose={() => setDetailId(null)}
        notify={notify}
      />

      {/* Bulk confirmations */}
      <ConfirmDialog
        open={bulkAction === "complete"}
        title="Bulk: Yakunlash"
        message={`${selected.size} ta buyurtmani yakunlashga ishonchingiz komilmi? (Faqat READY holatdagilar yakunlanadi)`}
        confirmLabel="Yakunlash"
        busy={bulkMutation.isPending}
        onConfirm={() => bulkMutation.mutate("complete")}
        onCancel={() => setBulkAction(null)}
      />
      <ConfirmDialog
        open={bulkAction === "cancel"}
        title="Bulk: Bekor qilish"
        message={`${selected.size} ta buyurtmani bekor qilishga ishonchingiz komilmi?`}
        confirmLabel="Bekor qilish"
        danger
        busy={bulkMutation.isPending}
        onConfirm={() => bulkMutation.mutate("cancel")}
        onCancel={() => setBulkAction(null)}
      />
      <ConfirmDialog
        open={bulkAction === "delete"}
        title="Bulk: O'chirish"
        message={`${selected.size} ta buyurtmani o'chirishga ishonchingiz komilmi? O'chirilgan buyurtmalar arxivda saqlanadi.`}
        confirmLabel="O'chirish"
        danger
        busy={bulkMutation.isPending}
        onConfirm={() => bulkMutation.mutate("delete")}
        onCancel={() => setBulkAction(null)}
      />
    </div>
  );
}

function OverdueBadge({ minutes }: { minutes: number | null }) {
  return (
    <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
      ⚠️ KECHIKKAN {minutes !== null ? `(${minutes} min)` : ""}
    </span>
  );
}

function QuickActions({
  order,
  onAction,
  busy,
}: {
  order: SerializedOrder;
  onAction: (s: OrderStatus) => void;
  busy: boolean;
}) {
  const actions: { label: string; s: OrderStatus }[] = [];
  if (order.status === "PENDING") actions.push({ label: "✅ Qabul", s: "PREPARING" });
  if (order.status === "PREPARING") actions.push({ label: "✅ Tayyor", s: "READY" });
  if (order.status === "READY") actions.push({ label: "🏁 Yakunlash", s: "COMPLETED" });
  if (actions.length === 0) return <span className="text-xs text-stone-300">—</span>;
  return (
    <div className="flex justify-end gap-1.5">
      {actions.map((a) => (
        <button
          key={a.s}
          disabled={busy}
          onClick={() => onAction(a.s)}
          className="rounded-full bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
