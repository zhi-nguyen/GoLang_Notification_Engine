import React from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import { XMarkSolid } from './Icons';

const TOAST_INDICATORS: Record<string, { dot: string; border: string }> = {
  success: { dot: 'bg-[#49cc90]', border: 'border-l-[#49cc90]' },
  error: { dot: 'bg-[#f93e3e]', border: 'border-l-[#f93e3e]' },
  info: { dot: 'bg-[#61affe]', border: 'border-l-[#61affe]' },
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useNotificationContext();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const indicator = TOAST_INDICATORS[toast.type] || TOAST_INDICATORS.info;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-md bg-white border border-[#e0e0e0] border-l-4 ${indicator.border} shadow-lg flex items-start gap-3 text-[#3b4151]`}
          >
            {/* Solid color dot indicator */}
            <span className={`w-2.5 h-2.5 rounded-full ${indicator.dot} shrink-0 mt-1`} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <h4 className="text-xs font-semibold text-[#1b1b1b] truncate">{toast.title}</h4>
                <span className="text-[10px] text-[#8a8a8a] font-mono ml-2">{toast.timestamp}</span>
              </div>
              <p className="text-xs text-[#6b7280] line-clamp-2">{toast.body}</p>
            </div>

            <button
              onClick={() => dismissToast(toast.id)}
              className="text-[#8a8a8a] hover:text-[#3b4151] p-1 rounded hover:bg-[#f7f7f7] transition-colors"
            >
              <XMarkSolid className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
