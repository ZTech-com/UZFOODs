"use client";

import Link from "next/link";
import type { SerializedOrder } from "@/lib/types";

interface Props {
  order: SerializedOrder;
  onNewOrder: () => void;
  onViewStatus: () => void;
}

export function OrderSuccess({ order, onNewOrder }: Props) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
        ✅
      </div>
      <h1 className="mt-5 text-2xl font-bold text-stone-900">
        Buyurtma qabul qilindi!
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Buyurtma raqamingiz:{" "}
        <span className="font-bold text-green-700">#{order.id}</span>
      </p>
      <p className="mt-1 text-sm text-stone-600">
        Tayyor bo'lish vaqti:{" "}
        <span className="font-semibold">{order.requiredTime}</span>
      </p>
      <p className="mt-4 max-w-xs text-xs text-stone-500">
        Buyurtmangiz restoran egasiga yuborildi. Holatini quyidagi tugma orqali
        kuzatib boring.
      </p>

      <Link
        href={`/orders/${order.id}`}
        className="mt-6 w-full rounded-full bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-600/30"
      >
        Holatni kuzatish
      </Link>
      <button
        onClick={onNewOrder}
        className="mt-3 w-full rounded-full border border-stone-300 py-3.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
      >
        Yana buyurtma berish
      </button>
    </div>
  );
}
