"use client";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Qo'shimcha: ixtiyoriy tanlov (masalan bekor qilish sababi) */
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="animate-slide-up w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="text-base font-bold text-stone-900">{title}</h3>
        <p className="mt-2 text-sm text-stone-600">{message}</p>

        {children}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-full border border-stone-300 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-full py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {busy ? "Bajarilmoqda..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
