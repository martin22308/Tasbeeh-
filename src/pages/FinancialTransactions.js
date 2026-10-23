import React, { useState, useEffect, useMemo } from 'react';
import { subscribeLedger, calculateFinancialTotals } from '../services/financialLedgerService';
import { getSettings } from '../services/settingsService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { TRANSACTION_TYPE } from '../constants';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  Search,
  Download,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

export default function FinancialTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL'); // 'ALL' | 'income' | 'expense'
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  useEffect(() => {
    let unsub = () => {};
    async function init() {
      const s = await getSettings();
      setSettings(s);
      unsub = subscribeLedger((data) => {
        setTransactions(data);
        setLoading(false);
      });
    }
    init();
    return () => unsub();
  }, []);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.relatedPerson?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.transactionId?.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesType = true;
      if (typeFilter !== 'ALL') {
        matchesType = tx.type === typeFilter;
      }

      let matchesDirection = true;
      if (directionFilter !== 'ALL') {
        matchesDirection = tx.direction === directionFilter;
      }

      let matchesDate = true;
      if (startDateFilter && tx.date < startDateFilter) matchesDate = false;
      if (endDateFilter && tx.date > endDateFilter) matchesDate = false;

      return matchesSearch && matchesType && matchesDirection && matchesDate;
    });
  }, [transactions, searchQuery, typeFilter, directionFilter, startDateFilter, endDateFilter]);

  // Financial Ledger Totals
  const totals = useMemo(() => {
    return calculateFinancialTotals(transactions, settings.openingBalance || 0);
  }, [transactions, settings]);

  const handleExportCsv = () => {
    const columns = [
      { key: 'transactionId', label: 'رقم المعاملة' },
      { key: 'date', label: 'التاريخ' },
      { key: 'type', label: 'نوع المعاملة' },
      { key: 'direction', label: 'الاتجاه (وارد/منصرف)' },
      { key: 'amount', label: 'المبلغ (ج.م)' },
      { key: 'description', label: 'البيان' },
      { key: 'relatedPerson', label: 'الطرف المعني' },
      { key: 'createdBy', label: 'سجلت بواسطة' },
    ];
    exportToCsv(filteredTransactions, columns, 'دفتر_الخزينة_والمعاملات_المالية');
  };

  if (loading) {
    return <LoadingSpinner message="جاري تجهيز دفتر المعاملات والخزينة..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            دفتر المعاملات المالية والخزينة
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            السجل المالي الموحد لكافة حركات الوارد والمنصرف والاشتراكات والتبرعات والغرامات
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={filteredTransactions.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          <span>تصدير دفتر الخزينة CSV</span>
        </button>
      </div>

      {/* Financial Status Summary Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-emerald-500/10 text-emerald-600 rounded-2xl border border-emerald-500/20">
              <Wallet size={32} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 block mb-0.5">
                الرصيد الفعلي الإجمالي في الخزينة الآن
              </span>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">
                {formatCurrency(totals.currentBalance)}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                الرصيد = الرصيد الافتتاحي ({formatCurrency(totals.openingBalance)}) + إجمالي الوارد ({formatCurrency(totals.totalIncome)}) - إجمالي المصروفات ({formatCurrency(totals.totalExpenses)})
              </p>
            </div>
          </div>

          {/* Breakdown Mini Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
              <span className="text-slate-400 block mb-0.5">الاشتراكات المحصلة</span>
              <span className="font-extrabold text-teal-600">
                {formatCurrency(totals.totalPledges)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
              <span className="text-slate-400 block mb-0.5">التبرعات الواردة</span>
              <span className="font-extrabold text-blue-600">
                {formatCurrency(totals.totalDonations)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
              <span className="text-slate-400 block mb-0.5">الغرامات المحصلة</span>
              <span className="font-extrabold text-indigo-600">
                {formatCurrency(totals.totalFines)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
              <span className="text-slate-400 block mb-0.5">المصروفات المنصرفة</span>
              <span className="font-extrabold text-rose-600">
                {formatCurrency(totals.totalExpenses)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالبيان أو الطرف المعني أو رقم المعاملة..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
          />
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
          >
            <option value="ALL">كل الحركات (وارد ومنصرف)</option>
            <option value="income">وارد فقط (+)</option>
            <option value="expense">منصرف فقط (-)</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
          >
            <option value="ALL">جميع أنواع المعاملات</option>
            {Object.values(TRANSACTION_TYPE).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>من:</span>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
            <span>إلى:</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* Transactions Ledger Table */}
      {filteredTransactions.length === 0 ? (
        <EmptyState
          title="لا توجد حركات مالية مطابقة"
          description="لم يتم العثور على معاملات مالية تطابق معايير البحث الحالية."
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4">الاتجاه</th>
                  <th className="py-3.5 px-4">نوع المعاملة</th>
                  <th className="py-3.5 px-4">البيان / الوصف</th>
                  <th className="py-3.5 px-4">الطرف المعني</th>
                  <th className="py-3.5 px-4">المبلغ</th>
                  <th className="py-3.5 px-4">سجلت بواسطة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.direction === 'income';
                  return (
                    <tr
                      key={tx.id || tx.transactionId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isIncome
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          }`}
                        >
                          {isIncome ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                          <span>{isIncome ? 'وارد' : 'منصرف'}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {tx.type}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {tx.description}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {tx.relatedPerson || '-'}
                      </td>

                      <td className="py-3.5 px-4 font-black text-sm whitespace-nowrap">
                        <span className={isIncome ? 'text-emerald-600' : 'text-rose-600'}>
                          {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px] truncate max-w-[120px]">
                        {tx.createdBy || 'مسؤول'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
