"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, setToken } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { accessToken } = await api.login(username.trim(), password);
      setToken(accessToken);
      router.replace("/admin");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Serverga ulanib bo'lmadi");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-stone-900">🔐 Admin panel</h1>
        <p className="mt-1 text-sm text-stone-500">
          Restoran egasi uchun kirish
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Login"
            autoComplete="username"
            className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parol"
            autoComplete="current-password"
            className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
          />

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="w-full rounded-full bg-green-600 py-3 text-sm font-bold text-white shadow-lg shadow-green-600/30 disabled:opacity-50"
          >
            {submitting ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-4 block text-center text-sm font-medium text-stone-500 hover:text-stone-700"
        >
          ← Mijoz sahifasiga qaytish
        </Link>
      </div>
    </div>
  );
}
