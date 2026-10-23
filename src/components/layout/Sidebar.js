import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck2,
  Receipt,
  HeartHandshake,
  TrendingDown,
  ArrowLeftRight,
  Settings,
  X,
  Sparkles,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/members', label: 'إدارة الأعضاء', icon: Users },
  { to: '/attendance', label: 'الحضور والغياب', icon: CalendarCheck2 },
  { to: '/pledges', label: 'الاشتراكات الشهرية', icon: Receipt },
  { to: '/donations', label: 'التبرعات الواردة', icon: HeartHandshake },
  { to: '/expenses', label: 'المصروفات والنفقات', icon: TrendingDown },
  { to: '/transactions', label: 'المعاملات المالية والخزينة', icon: ArrowLeftRight },
  { to: '/settings', label: 'الإعدادات وقواعد الغرامات', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:sticky top-0 right-0 z-50 h-screen w-64 bg-slate-900 text-slate-100 flex flex-col border-l border-slate-800 transition-transform duration-300 ease-in-out shrink-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header / Brand */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Sparkles size={18} />
            </div>
            <span className="font-extrabold text-white text-base tracking-wide">
              فريق التسبيح
            </span>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin">
          <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            القائمة الرئيسية
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 text-center">
          <p className="font-medium text-slate-300">لجنة فريق التسبيح</p>
          <p className="text-[10px] text-slate-500 mt-0.5">الإصدار 1.0 • نظام آمن</p>
        </div>
      </aside>
    </>
  );
}
