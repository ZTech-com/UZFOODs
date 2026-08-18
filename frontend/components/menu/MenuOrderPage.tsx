"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import type { MenuItem, SerializedOrder } from "@/lib/types";
import { formatSum } from "@/lib/format";
import { OrderForm } from "./OrderForm";
import { OrderSuccess } from "./OrderSuccess";

type Cart = Record<number, number>; // menuItemId → miqdor

export function MenuOrderPage() {
  const { data: menu, isLoading, isError } = useQuery({
    queryKey: ["menu"],
    queryFn: api.getMenu,
  });

  const [cart, setCart] = useState<Cart>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [lastOrder, setLastOrder] = useState<SerializedOrder | null>(null);

  const categories = useMemo(() => {
    if (!menu) return [];
    const map = new Map<string, MenuItem[]>();
    for (const item of menu) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [menu]);

  const activeItems = useMemo(() => {
    if (!activeCategory) return menu ?? [];
    return (menu ?? []).filter((i) => i.category === activeCategory);
  }, [menu, activeCategory]);

  const cartEntries = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({
          item: menu?.find((m) => m.id === Number(id)),
          qty,
        }))
        .filter(
          (e): e is { item: MenuItem; qty: number } =>
            Boolean(e.item) && e.qty > 0,
        ),
    [cart, menu],
  );

  const totalAmount = cartEntries.reduce(
    (sum, e) => sum + (e.item?.price ?? 0) * e.qty,
    0,
  );
  const totalCount = cartEntries.reduce((sum, e) => sum + e.qty, 0);

  function addItem(id: number) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function removeItem(id: number) {
    setCart((c) => {
      const next = { ...c };
      if (!next[id] || next[id] <= 1) delete next[id];
      else next[id] -= 1;
      return next;
    });
  }

  function reset() {
    setCart({});
    setLastOrder(null);
  }

  if (lastOrder) {
    return (
      <OrderSuccess
        order={lastOrder}
        onNewOrder={reset}
        onViewStatus={() => setLastOrder(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md pb-32">
      {/* Sarlavha */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-stone-900">🍽 Restoran</h1>
            <p className="text-xs text-stone-500">
              Oldindan buyurtma — darsdan oldin qiling
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
          >
            Admin
          </Link>
        </div>

        {/* Kategoriya tablari */}
        {categories.length > 1 && (
          <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === null
                  ? "bg-green-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              Barchasi
            </button>
            {categories.map(([name]) => (
              <button
                key={name}
                onClick={() => setActiveCategory(name)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === name
                    ? "bg-green-600 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {name}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="px-4 pt-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-stone-200"
              />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Menyuni yuklab bo'lmadi. Internet aloqani tekshiring va qayta
            urinib ko'ring.
          </div>
        )}

        {activeItems.map((item) => {
          const qty = cart[item.id] ?? 0;
          return (
            <div
              key={item.id}
              className="mb-3 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              {/* Rasm o'rniga emoji avatar */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-3xl">
                🍜
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-stone-900">{item.name}</h3>
                {item.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">
                    {item.description}
                  </p>
                )}
                <p className="mt-1 text-sm font-bold text-green-700">
                  {formatSum(item.price)}
                </p>
              </div>

              {/* Stepper */}
              <div className="flex shrink-0 flex-col items-center gap-1">
                {qty === 0 ? (
                  <button
                    onClick={() => addItem(item.id)}
                    className="flex h-10 w-14 items-center justify-center rounded-full bg-green-600 text-lg font-bold text-white active:scale-95"
                    aria-label={`${item.name} qo'shish`}
                  >
                    +
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-full bg-green-600 px-2 py-1 text-white">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-lg font-bold hover:bg-white/20"
                      aria-label="Kamaytirish"
                    >
                      −
                    </button>
                    <span className="min-w-5 text-center font-bold">{qty}</span>
                    <button
                      onClick={() => addItem(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-lg font-bold hover:bg-white/20"
                      aria-label="Ko'paytirish"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {menu && menu.length === 0 && (
          <div className="rounded-2xl bg-stone-100 p-8 text-center text-sm text-stone-500">
            Menyu hozircha bo'sh. Keyinroq qayta kirib ko'ring.
          </div>
        )}
      </main>

      {/* Pastki savat paneli */}
      {totalCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-stone-500">
                {totalCount} ta taom tanlandi
              </p>
              <p className="text-lg font-bold text-stone-900">
                {formatSum(totalAmount)}
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-green-600/30 active:scale-95"
            >
              Buyurtma berish
            </button>
          </div>
        </div>
      )}

      {/* Buyurtma formasi (bottom sheet) */}
      {showForm && (
        <OrderForm
          cart={cartEntries}
          totalAmount={totalAmount}
          onClose={() => setShowForm(false)}
          onSuccess={(order) => {
            setShowForm(false);
            setLastOrder(order);
            setCart({});
          }}
        />
      )}
    </div>
  );
}
