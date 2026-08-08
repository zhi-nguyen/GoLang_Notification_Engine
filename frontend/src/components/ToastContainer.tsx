import React from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import { X, CheckCircle2, AlertCircle, Info, BellRing } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useNotificationContext();

  if (toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
      default:
        return <BellRing className="w-5 h-5 text-indigo-400 shrink-0 animate-bounce" />;
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto p-4 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl flex items-start gap-3 text-slate-100 animate-in slide-in-from-right duration-300 transition-all hover:border-indigo-500/50"
        >
          {getIcon(toast.type)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <h4 className="text-xs font-semibold text-slate-100 truncate">{toast.title}</h4>
              <span className="text-[10px] text-slate-500">{toast.timestamp}</span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-2">{toast.body}</p>
          </div>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
