"use client";

import type { OrderStatus, StatsResponse } from "@/lib/types";
import { formatSum } from "@/lib/format";

interface Props {
  stats: StatsResponse;
  /** KPI kartasi bosilganda Orders tabiga filterlar bilan o'tish */
  onNavigateToOrders: (filters: {
    status?: OrderStatus;
    from?: string;
    to?: string;
  }) => void;
}

function todayRange(): { from: string; to: string } {
  const d = new Date();
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: key, to: key };
}

export function Dashboard({ stats, onNavigateToOrders }: Props) {
  const { kpi } = stats;
  const today = todayRange();
  const go = (filters: { status?: OrderStatus; from?: string; to?: string }) =>
    onNavigateToOrders(filters);

  const cards: {
    label: string;
    value: string;
    sub?: string;
    accent: string;
    icon: string;
    onClick: () => void;
  }[] = [
    {
      label: "Bugungi buyurtmalar",
      value: String(kpi.todayOrders),
      sub: `${kpi.todayCancelled} ta bekor`,
      accent: "bg-green-600",
      icon: "📦",
      onClick: () => go(today),
    },
    {
      label: "Bugungi tushum",
      value: formatSum(kpi.todayRevenue),
      sub: `Kecha: ${formatSum(kpi.yesterdayRevenue)}`,
      accent: "bg-emerald-600",
      icon: "💰",
      onClick: () => go(today),
    },
    {
      label: "Kutilayotgan",
      value: String(kpi.pending),
      accent: "bg-amber-500",
      icon: "⏳",
      onClick: () => go({ status: "PENDING" }),
    },
    {
      label: "Tayyorlanayotgan",
      value: String(kpi.preparing),
      accent: "bg-blue-600",
      icon: "👨‍🍳",
      onClick: () => go({ status: "PREPARING" }),
    },
    {
      label: "Tayyor",
      value: String(kpi.ready),
      accent: "bg-teal-600",
      icon: "🍽",
      onClick: () => go({ status: "READY" }),
    },
    {
      label: "Yakunlangan",
      value: String(kpi.completed),
      accent: "bg-stone-700",
      icon: "✅",
      onClick: () => go({ status: "COMPLETED" }),
    },
    {
      label: "Bekor qilingan",
      value: String(kpi.cancelled),
      accent: "bg-red-600",
      icon: "❌",
      onClick: () => go({ status: "CANCELLED" }),
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI kartalar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={c.onClick}
            className="rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md active:scale-[0.98]"
            title="Buyurtmalarga o'tish"
          >
            <div className="flex items-center justify-between">
              <span className={`h-2 w-8 rounded-full ${c.accent}`} />
              <span className="text-xl">{c.icon}</span>
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-stone-900">
              {c.label}
            </p>
            <p className="mt-0.5 truncate text-xl font-bold text-stone-900">
              {c.value}
            </p>
            {c.sub && <p className="mt-0.5 truncate text-[11px] text-stone-400">{c.sub}</p>}
          </button>
        ))}
      </div>

      {/* Analytics */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Haftalik chart */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-bold text-stone-900">Oxirgi 7 kun</h3>
            <span className="text-xs text-stone-400">
              {kpi.last7Orders} ta · {formatSum(kpi.last7Revenue)}
            </span>
          </div>
          <WeeklyBars weekly={stats.weekly} />
        </div>

        {/* 30 kunlik umumiy */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-stone-900">Davr ko'rsatkichlari</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            <Row label="Oxirgi 30 kun — buyurtmalar" value={String(kpi.last30Orders)} />
            <Row label="Oxirgi 30 kun — tushum" value={formatSum(kpi.last30Revenue)} />
            <Row label="O'rtacha buyurtma qiymati (7 kun)" value={formatSum(kpi.averageOrderValue)} />
            <Row
              label="Bekor qilish darajasi (7 kun)"
              value={`${kpi.cancelledRate}%`}
            />
            <Row
              label="Jami buyurtmalar"
              value={`${stats.totals.orders} · ${formatSum(stats.totals.revenue)}`}
            />
          </dl>
        </div>

        {/* Eng ko'p sotilgan (quantity) */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-stone-900">
            🏆 Eng ko'p sotilgan (7 kun)
          </h3>
          {stats.topByQuantity.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">Ma'lumot yo'q</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {stats.topByQuantity.map((t, i) => (
                <li key={t.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-stone-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">
                      {i + 1}
                    </span>
                    {t.name}
                  </span>
                  <span className="font-semibold text-stone-900">{t.quantity} ta</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Eng ko'p daromad (revenue) */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-stone-900">
            💰 Eng ko'p daromad (7 kun)
          </h3>
          {stats.topByRevenue.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">Ma'lumot yo'q</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {stats.topByRevenue.map((t, i) => (
                <li key={t.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-stone-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[11px] font-bold text-green-700">
                      {i + 1}
                    </span>
                    {t.name}
                  </span>
                  <span className="font-semibold text-stone-900">
                    {formatSum(t.revenue)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Band vaqtlar */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-stone-900">⏰ Eng band vaqtlar (7 kun)</h3>
          {stats.busyHours.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">Ma'lumot yo'q</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.busyHours.map((b) => (
                <span
                  key={b.hour}
                  className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700"
                >
                  {String(b.hour).padStart(2, "0")}:00 — {b.orders} ta
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-stone-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-semibold text-stone-900">{value}</dd>
    </div>
  );
}

function WeeklyBars({ weekly }: { weekly: StatsResponse["weekly"] }) {
  const max = Math.max(1, ...weekly.map((w) => w.orders));
  return (
    <div className="mt-3 flex h-28 items-end gap-2">
      {weekly.map((w) => {
        const date = new Date(w.date + "T00:00:00");
        const label = date.toLocaleDateString("uz-UZ", { weekday: "short" });
        const height = Math.max(4, Math.round((w.orders / max) * 100));
        return (
          <div key={w.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-semibold text-stone-600">{w.orders}</span>
            <div
              className="w-full rounded-t-md bg-green-600/80"
              style={{ height: `${height}%` }}
            />
            <span className="text-[10px] text-stone-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
