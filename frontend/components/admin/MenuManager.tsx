"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MenuItem } from "@/lib/types";
import { formatSum } from "@/lib/format";

const EMPTY_FORM = { name: "", description: "", price: "", category: "" };

export function MenuManager() {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-menu"],
    queryFn: api.listMenuItems,
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createMenuItem({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Number(form.price),
        category: form.category.trim(),
      }),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Parameters<typeof api.updateMenuItem>[1] }) =>
      api.updateMenuItem(id, dto),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteMenuItem(id),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  const categories = Array.from(
    new Set((items ?? []).map((i) => i.category)),
  ).sort();

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category: item.category,
    });
  }

  const canCreate =
    form.name.trim().length >= 2 &&
    form.price !== "" &&
    Number(form.price) >= 0 &&
    form.category.trim().length >= 1;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Yangi taom qo'shish */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-stone-900">➕ Yangi taom qo'shish</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Taom nomi *"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
          />
          <input
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="Narx (so'm) *"
            inputMode="numeric"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
          />
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Kategoriya * (masalan: Asosiy taomlar)"
            list="menu-categories"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600 sm:col-span-2"
          />
          <datalist id="menu-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Tavsif (ixtiyoriy)"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600 sm:col-span-2"
          />
        </div>
        <button
          disabled={!canCreate || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="mt-3 rounded-full bg-green-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {createMutation.isPending ? "Qo'shilmoqda..." : "Qo'shish"}
        </button>
      </div>

      {/* Taomlar ro'yxati */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-stone-200" />
          ))}
        </div>
      )}

      {items?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-400">
          Menyu bo'sh — yuqoridan birinchi taomni qo'shing.
        </div>
      )}

      <div className="space-y-2">
        {items?.map((item) => {
          const editing = editingId === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border bg-white p-3 shadow-sm ${
                item.available ? "border-stone-200" : "border-stone-200 opacity-70"
              }`}
            >
              {editing ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-green-600"
                  />
                  <input
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    inputMode="numeric"
                    className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-green-600"
                  />
                  <input
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-green-600"
                  />
                  <input
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Tavsif"
                    className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-green-600"
                  />
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      onClick={() =>
                        updateMutation.mutate({
                          id: item.id,
                          dto: {
                            name: editForm.name.trim(),
                            price: Number(editForm.price),
                            category: editForm.category.trim(),
                            description: editForm.description.trim() || undefined,
                          },
                        })
                      }
                      className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-bold text-white"
                    >
                      Saqlash
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-600"
                    >
                      Bekor qilish
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {item.name}
                      {!item.available && (
                        <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                          o'chirilgan
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-stone-500">
                      {item.category} · {formatSum(item.price)}
                      {item.description ? ` · ${item.description}` : ""}
                    </p>
                  </div>

                  {/* Mavjudlik tugmasi */}
                  <button
                    onClick={() =>
                      updateMutation.mutate({
                        id: item.id,
                        dto: { available: !item.available },
                      })
                    }
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      item.available ? "bg-green-600" : "bg-stone-300"
                    }`}
                    aria-label={item.available ? "O'chirish" : "Yoqish"}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        item.available ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>

                  <button
                    onClick={() => startEdit(item)}
                    className="shrink-0 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`"${item.name}" taomini o'chirishni tasdiqlaysizmi?`)) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                    className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
