import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeObligations,
  generateMonthlyObligations,
  recordPledgePayment,
} from '../services/pledgesService';
import { subscribeMembers } from '../services/membersService';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatCurrency } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { ARABIC_MONTHS, PLEDGE_STATUS, PAYMENT_METHODS, MEMBER_STATUS } from '../constants';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  Receipt,
  Search,
  Download,
  CreditCard,
  Sparkles,
  CheckCircle2,
  X,
  UserX,
} from 'lucide-react';

export default function MonthlyPledges() {
  const { currentUser } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [members, setMembers] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [searchMember, setSearchMember] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Dedicated "Unpaid Members" Tab/Mode
  const [unpaidOnlyMode, setUnpaidOnlyMode] = useState(false);
  const [unpaidTypeFilter, setUnpaidTypeFilter] = useState('ALL_OUTSTANDING'); // 'COMPLETELY_UNPAID' | 'PARTIALLY_PAID' | 'ALL_OUTSTANDING'

  // Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [targetObligation, setTargetObligation] = useState(null);
  const [payFormData, setPayFormData] = useState({
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'نقدي',
    notes: '',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Generate Modal / State
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let unsubs = [];
    unsubs.push(
      subscribeMembers((data) => {
        setMembers(data);
      })
    );
    unsubs.push(
      subscribeObligations((data) => {
        setObligations(data);
        setLoading(false);
      })
    );

    return () => {
      unsubs.forEach((u) => {
        if (typeof u === 'function') u();
      });
    };
  }, []);

  // Dynamically compute available years (no hardcoded boundaries)
  const availableYears = useMemo(() => {
    const yearSet = new Set();
    const minSpan = Math.min(2020, currentYear - 5);
    const maxSpan = Math.max(2030, currentYear + 5);
    for (let y = minSpan; y <= maxSpan; y++) {
      yearSet.add(y);
    }
    obligations.forEach((o) => {
      const yr = Number(o.year);
      if (!isNaN(yr) && yr > 1900 && yr < 2200) yearSet.add(yr);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [obligations, currentYear]);

  // Filtered Obligations for Selected Month & Year
  const periodObligations = useMemo(() => {
    return obligations.filter(
      (o) => o.year === Number(selectedYear) && o.month === Number(selectedMonth)
    );
  }, [obligations, selectedYear, selectedMonth]);

  // Combined Active Members & Period Obligations
  const displayItems = useMemo(() => {
    const activeMembers = members.filter((m) => m.status !== MEMBER_STATUS.ARCHIVED);

    // If an obligation exists, use it. If not, synthesize expected based on member pledge
    return activeMembers
      .map((member) => {
        const ob = periodObligations.find((o) => o.memberId === member.id);
        const expected = ob ? ob.expectedAmount : Number(member.monthlyPledge || 0);
        const paid = ob ? ob.totalPaid : 0;
        const remaining = ob ? ob.remainingAmount : expected;
        const status = ob
          ? ob.status
          : paid >= expected && expected > 0
          ? PLEDGE_STATUS.FULLY_PAID
          : paid > 0
          ? PLEDGE_STATUS.PARTIALLY_PAID
          : PLEDGE_STATUS.UNPAID;

        return {
          memberId: member.id,
          memberName: member.fullName,
          memberPhone: member.phone,
          startDate: member.startDate,
          year: Number(selectedYear),
          month: Number(selectedMonth),
          expectedAmount: expected,
          totalPaid: paid,
          remainingAmount: remaining,
          status,
          obligationId: ob?.id || null,
        };
      })
      .filter((item) => {
        // Search filter
        const matchesSearch =
          item.memberName.toLowerCase().includes(searchMember.toLowerCase()) ||
          item.memberPhone?.includes(searchMember);

        // Standard Status filter
        let matchesStatus = true;
        if (!unpaidOnlyMode && statusFilter !== 'ALL') {
          matchesStatus = item.status === statusFilter;
        }

        // Unpaid mode filter
        let matchesUnpaid = true;
        if (unpaidOnlyMode) {
          if (unpaidTypeFilter === 'COMPLETELY_UNPAID') {
            matchesUnpaid = item.totalPaid === 0 && item.remainingAmount > 0;
          } else if (unpaidTypeFilter === 'PARTIALLY_PAID') {
            matchesUnpaid = item.totalPaid > 0 && item.remainingAmount > 0;
          } else {
            // Any outstanding
            matchesUnpaid = item.remainingAmount > 0;
          }
        }

        return matchesSearch && matchesStatus && matchesUnpaid;
      });
  }, [
    members,
    periodObligations,
    selectedYear,
    selectedMonth,
    searchMember,
    statusFilter,
    unpaidOnlyMode,
    unpaidTypeFilter,
  ]);

  // Statistics for this period
  const stats = useMemo(() => {
    const totalExpected = displayItems.reduce((s, i) => s + i.expectedAmount, 0);
    const totalPaid = displayItems.reduce((s, i) => s + i.totalPaid, 0);
    const totalRemaining = displayItems.reduce((s, i) => s + i.remainingAmount, 0);
    const fullyPaidCount = displayItems.filter(
      (i) => i.status === PLEDGE_STATUS.FULLY_PAID
    ).length;
    const unpaidCount = displayItems.filter((i) => i.remainingAmount > 0).length;

    return { totalExpected, totalPaid, totalRemaining, fullyPaidCount, unpaidCount };
  }, [displayItems]);

  // Handle Automatic Obligations Generation
  const handleGenerateObligations = async () => {
    setGenerating(true);
    try {
      const result = await generateMonthlyObligations(
        members,
        selectedYear,
        selectedMonth,
        currentUser
      );
      notifySuccess(
        `تم توليد اشتراكات شهر ${selectedMonth}/${selectedYear} بنجاح (${result.created.length} عضو جديد، ${result.skipped.length} مستثنى أو مسجل مسبقًا)`
      );
    } catch (err) {
      notifyError(err.message || 'فشل توليد الاشتراكات الشهرية');
    } finally {
      setGenerating(false);
    }
  };

  // Open Payment Modal
  const handleOpenPay = (item) => {
    setTargetObligation(item);
    setPayFormData({
      amount: item.remainingAmount || item.expectedAmount,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'نقدي',
      notes: '',
    });
    setShowPayModal(true);
  };

  // Submit Payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!targetObligation) return;

    setSubmittingPayment(true);
    try {
      await recordPledgePayment({
        memberId: targetObligation.memberId,
        memberName: targetObligation.memberName,
        year: targetObligation.year,
        month: targetObligation.month,
        amount: payFormData.amount,
        paymentDate: payFormData.paymentDate,
        paymentMethod: payFormData.paymentMethod,
        notes: payFormData.notes,
        adminUser: currentUser,
      });

      notifySuccess(
        `تم تسجيل سداد مبلغ ${payFormData.amount} ج.م للعضو ${targetObligation.memberName} بنجاح`
      );
      setShowPayModal(false);
    } catch (err) {
      notifyError(err.message || 'فشل تسجيل السداد');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const columns = [
      { key: 'memberName', label: 'اسم العضو' },
      { key: 'memberPhone', label: 'رقم الهاتف' },
      { key: 'year', label: 'السنة' },
      { key: 'month', label: 'الشهر' },
      { key: 'expectedAmount', label: 'قيمة الاشتراك المطلوب (ج.م)' },
      { key: 'totalPaid', label: 'المسدد فعليًا (ج.م)' },
      { key: 'remainingAmount', label: 'المتبقي المستحق (ج.م)' },
      { key: 'status', label: 'حالة السداد' },
    ];
    const filename = unpaidOnlyMode
      ? `تقرير_المتأخرين_عن_السداد_${selectedMonth}_${selectedYear}`
      : `اشتراكات_شهر_${selectedMonth}_${selectedYear}`;

    exportToCsv(displayItems, columns, filename);
  };

  if (loading) {
    return <LoadingSpinner message="جاري تحميل سجل الاشتراكات الشهرية..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            الاشتراكات الشهرية
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            متابعة استحقاقات الاشتراكات وسداد الأعضاء كليًا وجزئيًا
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={displayItems.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            <span>تصدير CSV</span>
          </button>

          <button
            onClick={handleGenerateObligations}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-900/20 transition-all disabled:opacity-50"
          >
            <Sparkles size={18} />
            <span>{generating ? 'جاري التوليد...' : 'توليد اشتراكات هذا الشهر'}</span>
          </button>
        </div>
      </div>

      {/* Month & Year Selector + Period Stats Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-2xl shrink-0">
              <Receipt size={22} />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold block">
                تحديد فترة الاشتراك المستهدفة
              </span>
              <div className="flex items-center gap-2 mt-1">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                >
                  {ARABIC_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      سنة {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 w-full md:w-auto text-center">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block font-semibold">المطلوب تحصيله</span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                {formatCurrency(stats.totalExpected)}
              </span>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="text-[10px] text-emerald-600 block font-semibold">المحصل فعليًا</span>
              <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(stats.totalPaid)}
              </span>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200/60 dark:border-rose-800/60">
              <span className="text-[10px] text-rose-600 block font-semibold">المتبقي المستحق</span>
              <span className="text-sm font-extrabold text-rose-700 dark:text-rose-300">
                {formatCurrency(stats.totalRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Feature: Find Unpaid Members toggle banner */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUnpaidOnlyMode(false)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                !unpaidOnlyMode
                  ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              عرض جميع الأعضاء ({displayItems.length})
            </button>

            <button
              onClick={() => setUnpaidOnlyMode(true)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                unpaidOnlyMode
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              <UserX size={14} />
              <span>عرض الأعضاء الذين لم يدفعوا هذا الشهر ({stats.unpaidCount})</span>
            </button>
          </div>

          {unpaidOnlyMode && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 font-semibold ml-1">تصفية المتأخرين:</span>
              <select
                value={unpaidTypeFilter}
                onChange={(e) => setUnpaidTypeFilter(e.target.value)}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL_OUTSTANDING">أي متبقي (كلي أو جزئي)</option>
                <option value="COMPLETELY_UNPAID">لم يدفع إطلاقًا (0 ج.م)</option>
                <option value="PARTIALLY_PAID">دفع جزئيًا ومتبقي عليه</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Search & Status Filter */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchMember}
            onChange={(e) => setSearchMember(e.target.value)}
            placeholder="بحث بالاسم أو رقم الهاتف..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
          />
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        {!unpaidOnlyMode && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg ${
                statusFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setStatusFilter(PLEDGE_STATUS.FULLY_PAID)}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg ${
                statusFilter === PLEDGE_STATUS.FULLY_PAID
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              مدفوع بالكامل
            </button>
            <button
              onClick={() => setStatusFilter(PLEDGE_STATUS.PARTIALLY_PAID)}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg ${
                statusFilter === PLEDGE_STATUS.PARTIALLY_PAID
                  ? 'bg-white dark:bg-slate-700 text-amber-600 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              مدفوع جزئيًا
            </button>
            <button
              onClick={() => setStatusFilter(PLEDGE_STATUS.UNPAID)}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg ${
                statusFilter === PLEDGE_STATUS.UNPAID
                  ? 'bg-white dark:bg-slate-700 text-rose-600 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              غير مدفوع
            </button>
          </div>
        )}
      </div>

      {/* Obligations Table */}
      {displayItems.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات اشتراكات مطابقة"
          description="لم يتم العثور على أي نتائج وفقًا لمعايير البحث الحالية."
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">اسم العضو</th>
                  <th className="py-3.5 px-4">رقم الهاتف</th>
                  <th className="py-3.5 px-4">المبلغ المطلوب</th>
                  <th className="py-3.5 px-4">المسدد فعليًا</th>
                  <th className="py-3.5 px-4">المتبقي المستحق</th>
                  <th className="py-3.5 px-4">حالة السداد</th>
                  <th className="py-3.5 px-4 text-center">إجراء السداد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayItems.map((item) => {
                  const isFullyPaid = item.status === PLEDGE_STATUS.FULLY_PAID;
                  const isPartiallyPaid = item.status === PLEDGE_STATUS.PARTIALLY_PAID;

                  return (
                    <tr
                      key={item.memberId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white text-sm">
                        {item.memberName}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono">
                        {item.memberPhone || '-'}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(item.expectedAmount)}
                      </td>

                      <td className="py-3.5 px-4 text-emerald-600 font-extrabold">
                        {formatCurrency(item.totalPaid)}
                      </td>

                      <td className="py-3.5 px-4 font-extrabold">
                        {item.remainingAmount > 0 ? (
                          <span className="text-rose-600">{formatCurrency(item.remainingAmount)}</span>
                        ) : (
                          <span className="text-slate-400">0 ج.م</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            isFullyPaid
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : isPartiallyPaid
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {item.remainingAmount > 0 ? (
                          <button
                            onClick={() => handleOpenPay(item)}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition-colors"
                          >
                            <CreditCard size={13} />
                            <span>سداد اشتراك</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                            <CheckCircle2 size={15} />
                            <span>مسدد بالكامل</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && targetObligation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  تسجيل سداد اشتراك شهري
                </h3>
                <span className="text-xs text-teal-600 font-bold">
                  {targetObligation.memberName} (شهر {targetObligation.month}/{targetObligation.year})
                </span>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">المسدد سابقًا</span>
                  <span className="font-bold text-emerald-600">
                    {formatCurrency(targetObligation.totalPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">المتبقي المطلوب</span>
                  <span className="font-bold text-rose-600">
                    {formatCurrency(targetObligation.remainingAmount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  المبلغ المسدد الآن (ج.م) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={payFormData.amount}
                  onChange={(e) =>
                    setPayFormData({
                      ...payFormData,
                      amount: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base font-extrabold focus:outline-none focus:border-teal-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  يدعم النظام السداد الجزئي؛ سيتم خصم هذا المبلغ من المتبقي وتحديث الخزينة تلقائيًا.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  تاريخ الدفع *
                </label>
                <input
                  type="date"
                  required
                  value={payFormData.paymentDate}
                  onChange={(e) =>
                    setPayFormData({ ...payFormData, paymentDate: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  طريقة السداد
                </label>
                <select
                  value={payFormData.paymentMethod}
                  onChange={(e) =>
                    setPayFormData({ ...payFormData, paymentMethod: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ملاحظات السداد (اختياري)
                </label>
                <input
                  type="text"
                  value={payFormData.notes}
                  onChange={(e) =>
                    setPayFormData({ ...payFormData, notes: e.target.value })
                  }
                  placeholder="ملاحظات حول الدفعة..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  {submittingPayment ? 'جاري التسجيل...' : 'تأكيد استلام الاشتراك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
