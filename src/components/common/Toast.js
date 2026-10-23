import React from 'react';
import { useNotification } from '../../context/NotificationContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function Toast() {
  const { notifications, removeNotification } = useNotification();

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed top-5 left-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((item) => {
        let bg = 'bg-slate-900 text-white';
        let Icon = Info;

        if (item.type === 'success') {
          bg = 'bg-emerald-600 text-white border-emerald-500';
          Icon = CheckCircle2;
        } else if (item.type === 'error') {
          bg = 'bg-rose-600 text-white border-rose-500';
          Icon = AlertCircle;
        } else if (item.type === 'warning') {
          bg = 'bg-amber-600 text-white border-amber-500';
          Icon = AlertTriangle;
        }

        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-xl border text-sm font-medium transition-all transform animate-slide-in ${bg}`}
          >
            <div className="flex items-center gap-3">
              <Icon size={20} className="shrink-0" />
              <span>{item.message}</span>
            </div>
            <button
              onClick={() => removeNotification(item.id)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors mr-2 shrink-0"
              aria-label="إغلاق"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
