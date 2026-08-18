"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MenuItem, SerializedOrder } from "@/lib/types";
import { formatSum } from "@/lib/format";

interface CartEntry {
  item: MenuItem;
  qty: number;
}

interface Props {
  cart: CartEntry[];
  totalAmount: number;
  onClose: () => void;
  onSuccess: (order: SerializedOrder) => void;
}

/** Hozirgi vaqtdan keyingi soatga yaxlitlangan vaqt */
function defaultRequiredTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function OrderForm({ cart, totalAmount, onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [requiredTime, setRequiredTime] = useState(defaultRequiredTime);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValid = name.trim().length >= 2;
  const phoneValid = /^\+?[\d\s-]{8,20}$/.test(phone.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nameValid || !phoneValid) return;

    setSubmitting(true);
    try {
      const order = await api.createOrder({
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          telegramUsername: telegram.trim() ? telegram.trim() : undefined,
        },
        requiredTime,
        items: cart.map((c) => ({
          menuItemId: c.item.id,
          quantity: c.qty,
        })),
      });
      onSuccess(order);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.status === 429) {
          setError(
            "Ko'p so'rov yuborildi. Buyurtma qilishdan oldin bir necha daqiqa kuting.",
          );
        }
      } else {
        setError("Xatolik yuz berdi. Qayta urinib ko'ring.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="animate-slide-up w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-300" />

        <h2 className="text-lg font-bold text-stone-900">
          Buyurtma ma'lumotlari
        </h2>

        {/* Tanlangan taomlar qisqacha */}
        <div className="mt-3 max-h-32 space-y-1 overflow-y-auto rounded-xl bg-stone-50 p-3 text-sm">
          {cart.map((c) => (
            <div key={c.item.id} className="flex justify-between">
              <span className="text-stone-600">
                {c.item.name} × {c.qty}
              </span>
              <span className="font-medium text-stone-900">
                {formatSum(c.item.price * c.qty)}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-stone-200 pt-1 font-bold text-stone-900">
            <span>Jami</span>
            <span>{formatSum(totalAmount)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Ismingiz *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan: Aziza Karimova"
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
              maxLength={100}
            />
            {name && !nameValid && (
              <p className="mt-1 text-xs text-red-600">
                Ism kamida 2 ta belgidan iborat bo'lishi kerak
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Telefon raqam *
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              inputMode="tel"
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
              maxLength={20}
            />
            {phone && !phoneValid && (
              <p className="mt-1 text-xs text-red-600">
                Telefon raqam noto'g'ri formatda
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Telegram username (ixtiyoriy)
            </label>
            <input
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="@username"
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
              maxLength={64}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Ovqat qachon tayyor bo'lishi kerak? *
            </label>
            <input
              type="time"
              value={requiredTime}
              onChange={(e) => setRequiredTime(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !nameValid || !phoneValid}
            className="w-full rounded-full bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-600/30 transition disabled:opacity-50"
          >
            {submitting ? "Yuborilmoqda..." : `Buyurtmani tasdiqlash — ${formatSum(totalAmount)}`}
          </button>
        </form>
      </div>
    </div>
  );
}
