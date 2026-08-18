"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearToken, getToken } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
    }
  }, [router, pathname]);

  // Kirish sahifasida header ko'rsatilmaydi
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!getToken()) {
    return null; // redirect kutilyapti
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div>
              <h1 className="text-sm font-bold text-stone-900">Admin panel</h1>
              <p className="text-[11px] text-stone-500">
                Buyurtmalar boshqaruvi
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              clearToken();
              disconnectSocket();
              router.replace("/admin/login");
            }}
            className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
          >
            Chiqish
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
