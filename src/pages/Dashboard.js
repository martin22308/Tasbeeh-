import React, { useState, useEffect, useMemo } from 'react';
import { subscribeMembers } from '../services/membersService';
import {
  subscribeMeetings,
  subscribeAllAttendanceRecords,
  subscribeFines,
} from '../services/attendanceService';
import { subscribeObligations, subscribePledgePayments } from '../services/pledgesService';
import { subscribeDonations } from '../services/donationsService';
import { subscribeExpenses } from '../services/expensesService';
import { subscribeLedger, calculateFinancialTotals } from '../services/financialLedgerService';
import { getSettings } from '../services/settingsService';
import { formatCurrency, formatNumber, formatDate, getMonthName } from '../utils/formatters';
import { ARABIC_MONTHS, TRANSACTION_TYPE, FINE_TYPES } from '../constants';
import StatCard from '../components/common/StatCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  Wallet,
  Receipt,
  HeartHandshake,
  TrendingDown,
  AlertCircle,
  Users,
  CalendarCheck,
  TrendingUp,
  Clock,
  Filter,
  AlertTriangle,
  BookOpen,
  BookMarked,
  FileCheck2,
  CheckCircle2,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [finesPayments, setFinesPayments] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [pledgePayments, setPledgePayments] = useState([]);
  const [donations, setDonations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState({});

  // Global Period Filters
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Fine Analytics Specific Filters
  const [fineFilterMeetingId, setFineFilterMeetingId] = useState('ALL');
  const [fineFilterType, setFineFilterType] = useState('ALL');
  const [fineFilterPaidStatus, setFineFilterPaidStatus] = useState('ALL');
  const [fineFilterMemberSearch, setFineFilterMemberSearch] = useState('');

  useEffect(() => {
    let unsubs = [];

    async function loadData() {
      const currentSettings = await getSettings();
      setSettings(currentSettings);

      unsubs.push(subscribeMembers((data) => setMembers(data)));
      unsubs.push(subscribeMeetings((data) => setMeetings(data)));
      unsubs.push(subscribeAllAttendanceRecords((data) => setAttendanceRecords(data)));
      unsubs.push(subscribeFines((data) => setFinesPayments(data)));
      unsubs.push(subscribeObligations((data) => setObligations(data)));
      unsubs.push(subscribePledgePayments((data) => setPledgePayments(data)));
      unsubs.push(subscribeDonations((data) => setDonations(data)));
      unsubs.push(subscribeExpenses((data) => setExpenses(data)));
      unsubs.push(
        subscribeLedger((data) => {
          setTransactions(data);
          setLoading(false);
        })
      );
    }

    loadData();

    return () => {
      unsubs.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  // Dynamically compute available years from data + wide span (eliminates hardcoded boundaries)
  const availableYears = useMemo(() => {
    const yearSet = new Set();
    const minSpan = Math.min(2020, currentYear - 5);
    const maxSpan = Math.max(2030, currentYear + 5);
    for (let y = minSpan; y <= maxSpan; y++) {
      yearSet.add(y);
    }
    const checkDate = (dStr) => {
      if (!dStr) return;
      const yr = new Date(dStr).getFullYear();
      if (!isNaN(yr) && yr > 1900 && yr < 2200) yearSet.add(yr);
    };
    transactions.forEach((tx) => checkDate(tx.date));
    meetings.forEach((m) => checkDate(m.date));
    donations.forEach((d) => checkDate(d.date));
    expenses.forEach((e) => checkDate(e.date));
    pledgePayments.forEach((p) => checkDate(p.paymentDate));
    attendanceRecords.forEach((a) => checkDate(a.meetingDate || a.date));
    obligations.forEach((o) => {
      const yr = Number(o.year);
      if (!isNaN(yr) && yr > 1900 && yr < 2200) yearSet.add(yr);
    });

    return Array.from(yearSet).sort((a, b) => b - a);
  }, [
    transactions,
    meetings,
    donations,
    expenses,
    pledgePayments,
    attendanceRecords,
    obligations,
    currentYear,
  ]);

  // Filtered transactions & obligations according to selected year and month
  const filteredData = useMemo(() => {
    const filterByDate = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      if (selectedYear !== 'all' && d.getFullYear() !== Number(selectedYear)) return false;
      if (selectedMonth !== 'all' && d.getMonth() + 1 !== Number(selectedMonth)) return false;
      return true;
    };

    const periodDonations = donations.filter((d) => filterByDate(d.date));
    const periodExpenses = expenses.filter((e) => filterByDate(e.date));
    const periodPayments = pledgePayments.filter((p) => filterByDate(p.paymentDate));

    // Obligations for the selected period
    const periodObligations = obligations.filter((o) => {
      if (selectedYear !== 'all' && Number(o.year) !== Number(selectedYear)) return false;
      if (selectedMonth !== 'all' && Number(o.month) !== Number(selectedMonth)) return false;
      return true;
    });

    // Total outstanding pledges for the period
    const outstandingPledges = periodObligations.reduce(
      (sum, o) => sum + Number(o.remainingAmount || 0),
      0
    );

    // Global all-time financial totals according to ledger & settings
    const overallTotals = calculateFinancialTotals(transactions, settings.openingBalance || 0);

    return {
      periodDonations,
      periodExpenses,
      periodPayments,
      periodObligations,
      outstandingPledges,
      overallTotals,
    };
  }, [
    donations,
    expenses,
    pledgePayments,
    obligations,
    transactions,
    settings,
    selectedYear,
    selectedMonth,
  ]);

  // Active members count
  const activeMembersCount = useMemo(() => {
    return members.filter((m) => m.status !== 'مؤرشف').length;
  }, [members]);

  // Attendance Fines Deep Analytics & Aggregations
  const finesAnalytics = useMemo(() => {
    // Build map of meeting dates for filtering attendance records
    const meetingMap = new Map();
    meetings.forEach((m) => meetingMap.set(m.id, m));

    // Filter attendance records based on current filters
    const filteredRecords = attendanceRecords.filter((rec) => {
      const meeting = meetingMap.get(rec.meetingId);
      const meetingDateStr = rec.meetingDate || meeting?.date || '';

      // Date/Year/Month filter
      if (meetingDateStr) {
        const d = new Date(meetingDateStr);
        if (!isNaN(d.getTime())) {
          if (selectedYear !== 'all' && d.getFullYear() !== Number(selectedYear)) return false;
          if (selectedMonth !== 'all' && d.getMonth() + 1 !== Number(selectedMonth)) return false;
        }
      }

      // Specific Meeting filter
      if (fineFilterMeetingId !== 'ALL' && rec.meetingId !== fineFilterMeetingId) {
        return false;
      }

      // Member name search
      if (fineFilterMemberSearch.trim()) {
        const query = fineFilterMemberSearch.trim().toLowerCase();
        if (!rec.memberName?.toLowerCase().includes(query)) return false;
      }

      // Paid status filter
      if (fineFilterPaidStatus === 'PAID') {
        if (rec.totalAssessedFine === 0 || rec.fineRemainingAmount > 0) return false;
      } else if (fineFilterPaidStatus === 'UNPAID') {
        if (rec.totalAssessedFine === 0 || rec.fineRemainingAmount === 0) return false;
      }

      // Fine Type filter
      if (fineFilterType === 'LATE' && (!rec.lateFee || Number(rec.lateFee) <= 0)) return false;
      if (fineFilterType === 'NOTEBOOK' && (!rec.notebookFine || Number(rec.notebookFine) <= 0)) return false;
      if (fineFilterType === 'BIBLE' && (!rec.bibleFine || Number(rec.bibleFine) <= 0)) return false;
      if (fineFilterType === 'HOMEWORK' && (!rec.homeworkFine || Number(rec.homeworkFine) <= 0)) return false;
      if (fineFilterType === 'ABSENCE' && (!rec.absenceFine || Number(rec.absenceFine) <= 0)) return false;

      return true;
    });

    // Aggregate overall fines
    let totalAssessedFines = 0;
    let totalCollectedFines = 0;
    let totalOutstandingFines = 0;

    // Breakdown for each of the 5 penalty types
    const breakdown = {
      late: { assessed: 0, collected: 0, outstanding: 0 },
      notebook: { assessed: 0, collected: 0, outstanding: 0 },
      bible: { assessed: 0, collected: 0, outstanding: 0 },
      homework: { assessed: 0, collected: 0, outstanding: 0 },
      absence: { assessed: 0, collected: 0, outstanding: 0 },
    };

    filteredRecords.forEach((rec) => {
      const late = Number(rec.lateFee || 0);
      const nb = Number(rec.notebookFine || 0);
      const bible = Number(rec.bibleFine || 0);
      const hw = Number(rec.homeworkFine || 0);
      const absence = Number(rec.absenceFine || 0);

      const totalAssessed = late + nb + bible + hw + absence;
      const totalPaid = Number(rec.fineAmountPaid || 0);
      const totalRemaining = Math.max(0, totalAssessed - totalPaid);

      totalAssessedFines += totalAssessed;
      totalCollectedFines += totalPaid;
      totalOutstandingFines += totalRemaining;

      // Accumulate assessed
      breakdown.late.assessed += late;
      breakdown.notebook.assessed += nb;
      breakdown.bible.assessed += bible;
      breakdown.homework.assessed += hw;
      breakdown.absence.assessed += absence;

      // Proportional payment & remaining allocation per penalty type
      if (totalAssessed > 0) {
        const payRatio = Math.min(1, totalPaid / totalAssessed);
        breakdown.late.collected += late * payRatio;
        breakdown.notebook.collected += nb * payRatio;
        breakdown.bible.collected += bible * payRatio;
        breakdown.homework.collected += hw * payRatio;
        breakdown.absence.collected += absence * payRatio;

        breakdown.late.outstanding += late * (1 - payRatio);
        breakdown.notebook.outstanding += nb * (1 - payRatio);
        breakdown.bible.outstanding += bible * (1 - payRatio);
        breakdown.homework.outstanding += hw * (1 - payRatio);
        breakdown.absence.outstanding += absence * (1 - payRatio);
      }
    });

    // Chart Data 1: Assessed vs Collected by Penalty Category
    const finesByCategoryChart = [
      {
        name: 'التأخير',
        assessed: Math.round(breakdown.late.assessed),
        collected: Math.round(breakdown.late.collected),
        outstanding: Math.round(breakdown.late.outstanding),
      },
      {
        name: 'النوتة',
        assessed: Math.round(breakdown.notebook.assessed),
        collected: Math.round(breakdown.notebook.collected),
        outstanding: Math.round(breakdown.notebook.outstanding),
      },
      {
        name: 'الكتاب المقدس',
        assessed: Math.round(breakdown.bible.assessed),
        collected: Math.round(breakdown.bible.collected),
        outstanding: Math.round(breakdown.bible.outstanding),
      },
      {
        name: 'الواجب',
        assessed: Math.round(breakdown.homework.assessed),
        collected: Math.round(breakdown.homework.collected),
        outstanding: Math.round(breakdown.homework.outstanding),
      },
      {
        name: 'الغياب',
        assessed: Math.round(breakdown.absence.assessed),
        collected: Math.round(breakdown.absence.collected),
        outstanding: Math.round(breakdown.absence.outstanding),
      },
    ];

    // Chart Data 2: Outstanding Fines Breakdown (Donut)
    const outstandingByFineType = [
      { name: 'التأخير', value: Math.round(breakdown.late.outstanding), color: '#f59e0b' },
      { name: 'النوتة', value: Math.round(breakdown.notebook.outstanding), color: '#3b82f6' },
      { name: 'الكتاب المقدس', value: Math.round(breakdown.bible.outstanding), color: '#8b5cf6' },
      { name: 'الواجب', value: Math.round(breakdown.homework.outstanding), color: '#ec4899' },
      { name: 'الغياب', value: Math.round(breakdown.absence.outstanding), color: '#f43f5e' },
    ].filter((item) => item.value > 0);

    return {
      filteredRecords,
      totalAssessedFines,
      totalCollectedFines,
      totalOutstandingFines,
      breakdown,
      finesByCategoryChart,
      outstandingByFineType,
    };
  }, [
    attendanceRecords,
    meetings,
    selectedYear,
    selectedMonth,
    fineFilterMeetingId,
    fineFilterType,
    fineFilterPaidStatus,
    fineFilterMemberSearch,
  ]);

  // Monthly breakdown for Charts (1 to 12 of selected year)
  const monthlyChartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      monthNumber: i + 1,
      monthName: getMonthName(i + 1),
      income: 0,
      pledges: 0,
      donations: 0,
      fines: 0,
      expenses: 0,
      net: 0,
    }));

    transactions.forEach((tx) => {
      if (!tx.date) return;
      const d = new Date(tx.date);
      if (isNaN(d.getTime()) || (selectedYear !== 'all' && d.getFullYear() !== Number(selectedYear))) return;
      const mIdx = d.getMonth();
      const amt = Number(tx.amount || 0);

      if (tx.type === TRANSACTION_TYPE.PLEDGE_PAYMENT) {
        months[mIdx].pledges += amt;
        months[mIdx].income += amt;
      } else if (tx.type === TRANSACTION_TYPE.DONATION) {
        months[mIdx].donations += amt;
        months[mIdx].income += amt;
      } else if (tx.type === TRANSACTION_TYPE.FINE_PAYMENT) {
        months[mIdx].fines += amt;
        months[mIdx].income += amt;
      } else if (tx.type === TRANSACTION_TYPE.EXPENSE) {
        months[mIdx].expenses += amt;
      }
    });

    // Compute net balance per month
    months.forEach((m) => {
      m.net = m.income - m.expenses;
    });

    return months;
  }, [transactions, selectedYear]);

  // Pledge Collection vs Outstanding
  const pledgeComparisonData = useMemo(() => {
    const collected = filteredData.periodObligations.reduce(
      (sum, o) => sum + Number(o.totalPaid || 0),
      0
    );
    const outstanding = filteredData.outstandingPledges;

    return [
      { name: 'المحصل فعليًا', value: collected, color: '#0d9488' },
      { name: 'المتبقي المستحق', value: outstanding, color: '#f43f5e' },
    ];
  }, [filteredData]);

  // Recent transactions / activity
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 7);
  }, [transactions]);

  if (loading) {
    return <LoadingSpinner message="جاري تجهيز لوحة التحكم المركزية..." />;
  }

  const { overallTotals } = filteredData;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Title & Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            لوحة التحكم والمؤشرات المالية
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            متابعة دقيقة ومباشرة لخزينة اللجنة والاشتراكات الشهرية والغرامات وتحصيلاتها
          </p>
        </div>

        {/* Year and Month Filters */}
        <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <Filter size={16} className="text-slate-400 mr-2" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">كل السنين (كافة السنوات)</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                سنة {yr}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">كل شهور السنة</option>
            {ARABIC_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary Financial Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Current Available Balance (Strict Formula) */}
        <StatCard
          title="الرصيد الفعلي الحالي بالخزينة"
          value={formatCurrency(overallTotals.currentBalance)}
          subtitle={`رصيد افتتاحي: ${formatCurrency(overallTotals.openingBalance)}`}
          icon={Wallet}
          color="emerald"
        />

        {/* Collected Pledges */}
        <StatCard
          title="إجمالي الاشتراكات المحصلة"
          value={formatCurrency(overallTotals.totalPledges)}
          subtitle="المبالغ المدفوعة فعليًا فقط"
          icon={Receipt}
          color="teal"
        />

        {/* Donations */}
        <StatCard
          title="إجمالي التبرعات الواردة"
          value={formatCurrency(overallTotals.totalDonations)}
          subtitle="المبالغ المتبرع بها فعليًا"
          icon={HeartHandshake}
          color="blue"
        />

        {/* Expenses */}
        <StatCard
          title="إجمالي المصروفات المنصرفة"
          value={formatCurrency(overallTotals.totalExpenses)}
          subtitle="المصروفات المعتمدة والمسجلة"
          icon={TrendingDown}
          color="rose"
        />

        {/* Total Collected Fines (Actual Received) */}
        <StatCard
          title="إجمالي الغرامات المحصلة فعليًا"
          value={formatCurrency(overallTotals.totalFines)}
          subtitle="المبالغ المحصلة المودعة بالخزينة"
          icon={TrendingUp}
          color="indigo"
        />

        {/* Outstanding Pledges */}
        <StatCard
          title="اشتراكات متبقية مستحقة"
          value={formatCurrency(filteredData.outstandingPledges)}
          subtitle="اشتراكات لم تسدد لهذه الفترة"
          icon={AlertCircle}
          color="amber"
        />

        {/* Active Members */}
        <StatCard
          title="عدد الأعضاء النشطين"
          value={`${formatNumber(activeMembersCount)} عضو`}
          subtitle={`إجمالي المسجلين: ${formatNumber(members.length)}`}
          icon={Users}
          color="purple"
        />

        {/* Meetings */}
        <StatCard
          title="عدد الاجتماعات المنعقدة"
          value={`${formatNumber(meetings.length)} اجتماع`}
          subtitle="جلسات الحضور المنفذة"
          icon={CalendarCheck}
          color="teal"
        />
      </div>

      {/* ========================================================================= */}
      {/* ATTENDANCE FINES & PENALTIES FULL ANALYTICS SECTION                      */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                مؤشرات وتحليلات غرامات الحضور والمخالفات
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              متابعة دقيقة للغرامات المستحقة والمحصلة وغير المدفوعة مصنفة بحسب نوع المخالفة
            </p>
          </div>

          {/* Fines Sub-Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Meeting Filter */}
            <select
              value={fineFilterMeetingId}
              onChange={(e) => setFineFilterMeetingId(e.target.value)}
              className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
            >
              <option value="ALL">جميع الاجتماعات</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({formatDate(m.date)})
                </option>
              ))}
            </select>

            {/* Paid Status Filter */}
            <select
              value={fineFilterPaidStatus}
              onChange={(e) => setFineFilterPaidStatus(e.target.value)}
              className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
            >
              <option value="ALL">كل حالات السداد</option>
              <option value="UNPAID">غير مسدد / به متبقي</option>
              <option value="PAID">مسدد بالكامل</option>
            </select>

            {/* Fine Type Filter */}
            <select
              value={fineFilterType}
              onChange={(e) => setFineFilterType(e.target.value)}
              className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
            >
              <option value="ALL">جميع أنواع الغرامات</option>
              <option value="LATE">التأخير فقط</option>
              <option value="NOTEBOOK">عدم إحضار النوتة</option>
              <option value="BIBLE">عدم إحضار الكتاب المقدس</option>
              <option value="HOMEWORK">عدم عمل الواجب</option>
              <option value="ABSENCE">الغياب فقط</option>
            </select>

            {/* Search by member */}
            <div className="relative">
              <input
                type="text"
                value={fineFilterMemberSearch}
                onChange={(e) => setFineFilterMemberSearch(e.target.value)}
                placeholder="بحث بعضو معين..."
                className="pl-3 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none"
              />
              <Search size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Fines Top Summary Trio */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block mb-1">
              إجمالي الغرامات المستحقة (المقررة)
            </span>
            <h4 className="text-2xl font-black text-amber-950 dark:text-amber-100">
              {formatCurrency(finesAnalytics.totalAssessedFines)}
            </h4>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
              المبالغ المقيدة في كشوف الحضور كديون للجنة
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
              إجمالي الغرامات المحصلة فعليًا
            </span>
            <h4 className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
              {formatCurrency(finesAnalytics.totalCollectedFines)}
            </h4>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
              المبالغ المستلمة نقدًا والمضافة لرصيد الخزينة المتاح{finesPayments.length > 0 ? ` (${finesPayments.length} إيصال تحصيل مسجل)` : ''}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
            <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block mb-1">
              إجمالي الغرامات غير المدفوعة (المتبقية)
            </span>
            <h4 className="text-2xl font-black text-rose-950 dark:text-rose-100">
              {formatCurrency(finesAnalytics.totalOutstandingFines)}
            </h4>
            <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1">
              مبالغ متبقية على الأعضاء لم تُدفع بعد
            </p>
          </div>
        </div>

        {/* Detailed Breakdown Table for the 5 Penalty Categories */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
            تفصيل الغرامات بحسب نوع المخالفة (المقرر، المحصل، المتبقي):
          </h4>
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">نوع الغرامة / المخالفة</th>
                  <th className="py-3 px-4 text-amber-600 font-extrabold">المبلغ المقرر (المستحق)</th>
                  <th className="py-3 px-4 text-emerald-600 font-extrabold">المحصل فعليًا</th>
                  <th className="py-3 px-4 text-rose-600 font-extrabold">المتبقي غير المدفوع</th>
                  <th className="py-3 px-4">نسبة التحصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {/* 1. Late arrival */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Clock size={15} className="text-amber-500" />
                    <span>{FINE_TYPES.LATE}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {formatCurrency(finesAnalytics.breakdown.late.assessed)}
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    {formatCurrency(finesAnalytics.breakdown.late.collected)}
                  </td>
                  <td className="py-3 px-4 font-bold text-rose-600">
                    {formatCurrency(finesAnalytics.breakdown.late.outstanding)}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {finesAnalytics.breakdown.late.assessed > 0
                      ? `${Math.round(
                          (finesAnalytics.breakdown.late.collected /
                            finesAnalytics.breakdown.late.assessed) *
                            100
                        )}%`
                      : '0%'}
                  </td>
                </tr>

                {/* 2. Missing Notebook */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <BookMarked size={15} className="text-blue-500" />
                    <span>{FINE_TYPES.NOTEBOOK}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {formatCurrency(finesAnalytics.breakdown.notebook.assessed)}
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    {formatCurrency(finesAnalytics.breakdown.notebook.collected)}
                  </td>
                  <td className="py-3 px-4 font-bold text-rose-600">
                    {formatCurrency(finesAnalytics.breakdown.notebook.outstanding)}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {finesAnalytics.breakdown.notebook.assessed > 0
                      ? `${Math.round(
                          (finesAnalytics.breakdown.notebook.collected /
                            finesAnalytics.breakdown.notebook.assessed) *
                            100
                        )}%`
                      : '0%'}
                  </td>
                </tr>

                {/* 3. Missing Bible */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <BookOpen size={15} className="text-purple-500" />
                    <span>{FINE_TYPES.BIBLE}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {formatCurrency(finesAnalytics.breakdown.bible.assessed)}
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    {formatCurrency(finesAnalytics.breakdown.bible.collected)}
                  </td>
                  <td className="py-3 px-4 font-bold text-rose-600">
                    {formatCurrency(finesAnalytics.breakdown.bible.outstanding)}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {finesAnalytics.breakdown.bible.assessed > 0
                      ? `${Math.round(
                          (finesAnalytics.breakdown.bible.collected /
                            finesAnalytics.breakdown.bible.assessed) *
                            100
                        )}%`
                      : '0%'}
                  </td>
                </tr>

                {/* 4. Homework */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileCheck2 size={15} className="text-pink-500" />
                    <span>{FINE_TYPES.HOMEWORK}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {formatCurrency(finesAnalytics.breakdown.homework.assessed)}
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    {formatCurrency(finesAnalytics.breakdown.homework.collected)}
                  </td>
                  <td className="py-3 px-4 font-bold text-rose-600">
                    {formatCurrency(finesAnalytics.breakdown.homework.outstanding)}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {finesAnalytics.breakdown.homework.assessed > 0
                      ? `${Math.round(
                          (finesAnalytics.breakdown.homework.collected /
                            finesAnalytics.breakdown.homework.assessed) *
                            100
                        )}%`
                      : '0%'}
                  </td>
                </tr>

                {/* 5. Absence */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-500" />
                    <span>{FINE_TYPES.ABSENCE}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {formatCurrency(finesAnalytics.breakdown.absence.assessed)}
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    {formatCurrency(finesAnalytics.breakdown.absence.collected)}
                  </td>
                  <td className="py-3 px-4 font-bold text-rose-600">
                    {formatCurrency(finesAnalytics.breakdown.absence.outstanding)}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {finesAnalytics.breakdown.absence.assessed > 0
                      ? `${Math.round(
                          (finesAnalytics.breakdown.absence.collected /
                            finesAnalytics.breakdown.absence.assessed) *
                            100
                        )}%`
                      : '0%'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Fines Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Chart 1: Assessed vs Collected Fines */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
              مقارنة الغرامات المقررة بالمحصلة حسب نوع المخالفة
            </h4>
            <p className="text-[11px] text-slate-400 mb-4">
              المبالغ المستحقة مقابل ما تم استلامه وتوريده للخزينة
            </p>

            <div className="h-60 w-full ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={finesAnalytics.finesByCategoryChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val) => [`${formatNumber(val)} ج.م`]}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '10px',
                      color: '#fff',
                      direction: 'rtl',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
                  <Bar dataKey="assessed" name="المقرر (المستحق)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collected" name="المحصل فعليًا" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Outstanding Fines Breakdown by Type */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                توزيع الغرامات المتبقية غير المدفوعة حسب المخالفة
              </h4>
              <p className="text-[11px] text-slate-400 mb-3">
                نسبة مساهمة كل مخالفة في رصيد الديون المتبقية
              </p>
            </div>

            {finesAnalytics.outstandingByFineType.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-emerald-600 font-bold gap-2">
                <CheckCircle2 size={18} />
                <span>لا توجد أي غرامات متبقية غير مسددة في هذه الفترة!</span>
              </div>
            ) : (
              <div className="h-52 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={finesAnalytics.outstandingByFineType}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {finesAnalytics.outstandingByFineType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [`${formatNumber(val)} ج.م`, 'المتبقي']}
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderRadius: '10px',
                        color: '#fff',
                        direction: 'rtl',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              {finesAnalytics.outstandingByFineType.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 text-[11px]">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{item.name}:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Global Charts Section (Income vs Expenses, Monthly Fines Trend) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income vs Expenses Bar Chart (Span 2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                حركة الإيرادات الشهرية مقابل المصروفات {selectedYear === 'all' ? '(كافة السنوات)' : `لسنة ${selectedYear}`}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                مقارنة شهرية بين إجمالي الوارد (اشتراكات + تبرعات + غرامات محصلة) والمنصرف
              </p>
            </div>
          </div>

          <div className="h-72 w-full ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="monthName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [`${formatNumber(value)} ج.م`]}
                  labelFormatter={(label) => `شهر ${label}`}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#fff',
                    border: 'none',
                    direction: 'rtl',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  formatter={(val) =>
                    val === 'income' ? 'إجمالي الوارد' : val === 'expenses' ? 'إجمالي المنصرف' : val
                  }
                />
                <Bar dataKey="income" name="إجمالي الوارد" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="إجمالي المنصرف" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pledges: Collected vs Outstanding Donut Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              نسبة تحصيل الاشتراكات
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              المحصل الفعلي مقارنة بالمتبقي المستحق
            </p>
          </div>

          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pledgeComparisonData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pledgeComparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${formatNumber(value)} ج.م`]}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '10px',
                    color: '#fff',
                    border: 'none',
                    direction: 'rtl',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {pledgeComparisonData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    {item.name}
                  </span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Fine Collections Trend Area Chart */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          حركة تحصيل الغرامات الشهرية {selectedYear === 'all' ? '(كافة السنوات)' : `لسنة ${selectedYear}`}
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          إجمالي الغرامات المحصلة فعليًا والموردة للخزينة في كل شهر
        </p>

        <div className="h-64 w-full ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fineColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="monthName" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [`${formatNumber(value)} ج.م`, 'غرامات محصلة']}
                labelFormatter={(label) => `شهر ${label}`}
                contentStyle={{
                  backgroundColor: '#1e293b',
                  borderRadius: '12px',
                  color: '#fff',
                  border: 'none',
                  direction: 'rtl',
                }}
              />
              <Area
                type="monotone"
                dataKey="fines"
                name="غرامات محصلة"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#fineColor)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock size={18} className="text-teal-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              آخر المعاملات والنشاطات المسجلة
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            أحدث {recentTransactions.length} حركات
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">نوع المعاملة</th>
                <th className="py-3 px-4">البيان / الوصف</th>
                <th className="py-3 px-4">الطرف المعني</th>
                <th className="py-3 px-4 text-left">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    لا توجد معاملات مسجلة حتى الآن.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => {
                  const isIncome = tx.direction === 'income';
                  return (
                    <tr
                      key={tx.id || tx.transactionId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isIncome
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-200">
                        {tx.description}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {tx.relatedPerson || '-'}
                      </td>
                      <td className="py-3 px-4 text-left whitespace-nowrap font-extrabold text-xs">
                        <span className={isIncome ? 'text-emerald-600' : 'text-rose-600'}>
                          {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
