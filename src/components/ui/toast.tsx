"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { Check, Info, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "info" | "error";

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    // Haptic feedback on mobile if supported
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(type === "error" ? [30, 50, 30] : 15);
      } catch {
        // Ignore vibration errors if not allowed
      }
    }

    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Floating Island Toast Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-full bg-zinc-950/95 text-white text-xs font-medium shadow-xl shadow-zinc-950/20 border border-zinc-800/80 backdrop-blur-md animate-in slide-in-from-top-3 fade-in zoom-in-95 duration-200"
          >
            {t.type === "success" && (
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            )}
            {t.type === "info" && (
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Info className="w-2.5 h-2.5" />
              </span>
            )}
            {t.type === "error" && (
              <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-2.5 h-2.5" />
              </span>
            )}
            <span className="truncate">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if used outside provider
    return {
      showToast: (message: string) => {
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(15);
          } catch {}
        }
      },
    };
  }
  return context;
}

