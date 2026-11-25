import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, title?: string) => void;
  confirmAction: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, message, type }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast]
  );

  const confirmAction = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const normalized: ConfirmOptions =
      typeof options === 'string' ? { message: options } : options;
    return new Promise((resolve) => {
      setPendingConfirm({
        ...normalized,
        resolve,
      });
    });
  }, []);

  const handleConfirmChoice = (accepted: boolean) => {
    if (pendingConfirm) {
      pendingConfirm.resolve(accepted);
      setPendingConfirm(null);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, confirmAction }}>
      {children}

      {/* Toast Stack (RTL bottom-left) */}
      <div
        dir="rtl"
        className="fixed bottom-4 left-4 z-[90] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((toast) => {
          const icon =
            toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#D7FF38] shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : toast.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-[#FF5A1F] shrink-0" />
            );

          const borderClass =
            toast.type === 'success'
              ? 'border-[#D7FF38]/40'
              : toast.type === 'error'
              ? 'border-red-500/40'
              : toast.type === 'warning'
              ? 'border-amber-500/40'
              : 'border-[#33362D]';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto bg-[#1C1E19]/95 backdrop-blur-md border ${borderClass} rounded-xl p-3.5 shadow-2xl flex items-start gap-3 text-right animate-in fade-in slide-in-from-bottom-2 duration-200`}
            >
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <p className="text-xs font-bold text-[#F2EBDD] mb-0.5">{toast.title}</p>
                )}
                <p className="text-xs text-[#F2EBDD]/85 leading-relaxed">{toast.message}</p>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-[#F2EBDD]/40 hover:text-white p-0.5 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {pendingConfirm && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => handleConfirmChoice(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#1C1E19] border border-[#2F3229] rounded-2xl p-6 shadow-2xl space-y-4 text-right"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle
                className={`w-5 h-5 shrink-0 ${
                  pendingConfirm.destructive ? 'text-red-400' : 'text-[#FF5A1F]'
                }`}
              />
              <h3 className="text-sm font-black text-[#F2EBDD] font-mono">
                {pendingConfirm.title || 'تأكيد الإجراء'}
              </h3>
            </div>

            <p className="text-xs text-[#F2EBDD]/80 leading-relaxed">{pendingConfirm.message}</p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => handleConfirmChoice(false)}
                className="px-4 py-2 rounded-xl border border-[#32362D] text-xs font-bold text-[#F2EBDD]/70 hover:text-white hover:bg-[#252820] cursor-pointer transition-colors"
              >
                {pendingConfirm.cancelLabel || 'إلغاء'}
              </button>
              <button
                onClick={() => handleConfirmChoice(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  pendingConfirm.destructive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-[#FF5A1F] hover:bg-[#FF3300] text-white'
                }`}
              >
                {pendingConfirm.confirmLabel || 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
