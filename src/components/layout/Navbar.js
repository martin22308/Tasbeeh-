import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeLedger, calculateFinancialTotals } from '../../services/financialLedgerService';
import { getSettings } from '../../services/settingsService';
import { formatCurrency } from '../../utils/formatters';
import { Menu, LogOut, Wallet, UserCheck, Shield } from 'lucide-react';

export default function Navbar({ onToggleSidebar }) {
  const { currentUser, adminProfile, logout, isConfigured } = useAuth();
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    let unsubscribe = () => {};
    async function initBalance() {
      const settings = await getSettings();
      unsubscribe = subscribeLedger((transactions) => {
        const totals = calculateFinancialTotals(transactions, settings.openingBalance || 0);
        setBalance(totals.currentBalance);
      });
    }
    initBalance();
    return () => unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="flex items-center justify-between px-4 sm:px-6 h-16">
        {/* Right side: Mobile Menu Button & Committee Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
            aria-label="القائمة"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Shield size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                لجنة فريق التسبيح
              </h1>
              <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium hidden sm:inline">
                نظام الإدارة المركزية والخزينة
              </span>
            </div>
          </div>
        </div>

        {/* Left side: Treasury Balance, Admin info & Logout */}
        <div className="flex items-center gap-3">
          {/* Quick Treasury Balance Pill */}
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3.5 py-1.5 rounded-xl shadow-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Wallet size={16} className="text-emerald-700 dark:text-emerald-400" />
            <div className="text-right">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold">
                الرصيد الفعلي الحالي
              </span>
              <span className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                {formatCurrency(balance)}
              </span>
            </div>
          </div>

          {/* User profile info */}
          {currentUser && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <UserCheck size={16} className="text-teal-600" />
              <div className="text-right text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[130px]">
                  {adminProfile?.displayName || currentUser.email}
                </span>
                <span className="text-[10px] text-slate-500">مسؤول معتمد</span>
              </div>
            </div>
          )}

          {/* Logout button */}
          {currentUser && isConfigured && (
            <button
              onClick={logout}
              title="تسجيل الخروج"
              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-colors"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
