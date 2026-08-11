"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  showToast: (kind: ToastKind, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now();
    setToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed bottom-5 right-5 z-50 flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = toast.kind === "success" ? CheckCircle2 : CircleAlert;
          const iconClass = toast.kind === "success" ? "text-success" : "text-danger";

          return (
            <div key={toast.id} className="flex items-start gap-3 rounded-lg border bg-white p-3.5 text-sm shadow-card">
              <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${iconClass}`} />
              <p className="flex-1 leading-5 text-ink">{toast.message}</p>
              <button
                type="button"
                aria-label="ปิดการแจ้งเตือน"
                className="-mr-1 -mt-1 rounded p-1 text-muted hover:bg-slate-100 hover:text-ink"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("ต้องเรียก useToast ภายใน ToastProvider");
  return context;
}
