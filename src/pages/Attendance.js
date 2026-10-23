import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeMeetings,
  createMeeting,
  subscribeMeetingAttendance,
  saveAttendanceRecord,
  collectFinePayment,
} from '../services/attendanceService';
import { subscribeMembers } from '../services/membersService';
import { getSettings } from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatNumber,
} from '../utils/formatters';
import { calculateLateFee, calculateDelayMinutes } from '../utils/lateFeeCalculator';
import { exportToCsv } from '../utils/exportCsv';
import {
  ATTENDANCE_STATUS,
  FINE_STATUS,
  FINE_TYPES,
  MEMBER_STATUS,
  PAYMENT_METHODS,
} from '../constants';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  CalendarCheck2,
  CalendarPlus,
  Clock,
  Search,
  Download,
  CreditCard,
  RotateCcw,
  X,
  Phone,
} from 'lucide-react';

export default function Attendance() {
  const { currentUser } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [meetings, setMeetings] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [newMeetingData, setNewMeetingData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    scheduledTime: '19:00',
    notes: '',
  });
  const [submittingMeeting, setSubmittingMeeting] = useState(false);

  // Fine Payment Modal
  const [showCollectFineModal, setShowCollectFineModal] = useState(false);
  const [fineTarget, setFineTarget] = useState(null);
  const [finePaymentData, setFinePaymentData] = useState({
    fineType: 'سداد مجمع لكافة الغرامات',
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'نقدي',
    notes: '',
  });
  const [submittingFine, setSubmittingFine] = useState(false);

  // Filters
  const [searchMember, setSearchMember] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fineStatusFilter, setFineStatusFilter] = useState('ALL');
  const [penaltyTypeFilter, setPenaltyTypeFilter] = useState('ALL');

  useEffect(() => {
    let unsubs = [];
    async function init() {
      const currentSettings = await getSettings();
      setSettings(currentSettings);
      setNewMeetingData((prev) => ({
        ...prev,
        scheduledTime: currentSettings.defaultMeetingTime || '19:00',
      }));

      unsubs.push(
        subscribeMeetings((data) => {
          setMeetings(data);
          setSelectedMeetingId((prev) => (prev ? prev : data.length > 0 ? data[0].id : ''));
          setLoading(false);
        })
      );

      unsubs.push(
        subscribeMembers((data) => {
          setMembers(data);
        })
      );
    }
    init();

    return () => {
      unsubs.forEach((u) => {
        if (typeof u === 'function') u();
      });
    };
  }, []);

  // Subscribe to selected meeting attendance
  useEffect(() => {
    if (!selectedMeetingId) return;
    const unsub = subscribeMeetingAttendance(selectedMeetingId, (data) => {
      setAttendanceRecords(data);
    });
    return () => unsub();
  }, [selectedMeetingId]);

  const selectedMeeting = useMemo(() => {
    return meetings.find((m) => m.id === selectedMeetingId) || null;
  }, [meetings, selectedMeetingId]);

  // Combine Active Members with Attendance Records & 5 Fine Types
  const meetingMembersList = useMemo(() => {
    const activeMembers = members.filter((m) => m.status !== MEMBER_STATUS.ARCHIVED);

    return activeMembers.map((member) => {
      const record = attendanceRecords.find((r) => r.memberId === member.id);

      const status = record?.status || ATTENDANCE_STATUS.NOT_RECORDED;
      const arrivalTime = record?.arrivalTime || '';
      const scheduledTime = selectedMeeting?.scheduledTime || '19:00';

      const delayMinutes =
        record?.delayMinutes !== undefined
          ? record.delayMinutes
          : status === ATTENDANCE_STATUS.PRESENT && arrivalTime
          ? calculateDelayMinutes(scheduledTime, arrivalTime)
          : 0;

      // Late fee: if manual or saved in record, use it. Otherwise calculate if present.
      const lateFee =
        record?.lateFee !== undefined
          ? Number(record.lateFee)
          : status === ATTENDANCE_STATUS.PRESENT
          ? calculateLateFee(delayMinutes, settings)
          : 0;

      // All 5 fine types
      const absenceFine =
        record?.absenceFine !== undefined
          ? Number(record.absenceFine)
          : status === ATTENDANCE_STATUS.ABSENT
          ? Number(settings.defaultAbsenceFine || 0)
          : 0;

      const notebookFine = Number(record?.notebookFine ?? (settings.defaultNotebookFine || 0));
      const bibleFine = Number(record?.bibleFine ?? (settings.defaultBibleFine || 0));
      const homeworkFine = Number(record?.homeworkFine ?? (settings.defaultHomeworkFine || 0));

      // Total assessed fine across all 5 penalties
      const totalAssessedFine =
        lateFee + absenceFine + notebookFine + bibleFine + homeworkFine;

      const fineAmountPaid = Number(record?.fineAmountPaid || 0);
      const fineRemainingAmount = Math.max(0, totalAssessedFine - fineAmountPaid);

      let finePaymentStatus = FINE_STATUS.UNPAID;
      if (totalAssessedFine > 0) {
        if (fineAmountPaid >= totalAssessedFine) {
          finePaymentStatus = FINE_STATUS.FULLY_PAID;
        } else if (fineAmountPaid > 0) {
          finePaymentStatus = FINE_STATUS.PARTIALLY_PAID;
        }
      }

      return {
        memberId: member.id,
        memberName: member.fullName,
        memberPhone: member.phone,
        status,
        scheduledTime,
        arrivalTime,
        delayMinutes,
        isManualDelay: record?.isManualDelay || false,
        lateFee,
        isManualFee: record?.isManualFee || false,
        absenceFine,
        notebookFine,
        bibleFine,
        homeworkFine,
        totalAssessedFine,
        fineAmountPaid,
        fineRemainingAmount,
        finePaymentStatus,
        absenceReason: record?.absenceReason || '',
        notes: record?.notes || '',
        recordExists: Boolean(record),
      };
    });
  }, [members, attendanceRecords, selectedMeeting, settings]);

  // Apply filters
  const filteredList = useMemo(() => {
    return meetingMembersList.filter((item) => {
      const matchesSearch =
        item.memberName.toLowerCase().includes(searchMember.toLowerCase()) ||
        item.memberPhone?.includes(searchMember);

      let matchesStatus = true;
      if (statusFilter !== 'ALL') {
        matchesStatus = item.status === statusFilter;
      }

      let matchesFine = true;
      if (fineStatusFilter === 'UNPAID') {
        matchesFine = item.totalAssessedFine > 0 && item.fineRemainingAmount > 0;
      } else if (fineStatusFilter === 'PAID') {
        matchesFine = item.totalAssessedFine > 0 && item.fineRemainingAmount === 0;
      }

      let matchesPenaltyType = true;
      if (penaltyTypeFilter === 'LATE') {
        matchesPenaltyType = item.lateFee > 0;
      } else if (penaltyTypeFilter === 'ABSENCE') {
        matchesPenaltyType = item.absenceFine > 0;
      } else if (penaltyTypeFilter === 'NOTEBOOK') {
        matchesPenaltyType = item.notebookFine > 0;
      } else if (penaltyTypeFilter === 'BIBLE') {
        matchesPenaltyType = item.bibleFine > 0;
      } else if (penaltyTypeFilter === 'HOMEWORK') {
        matchesPenaltyType = item.homeworkFine > 0;
      }

      return matchesSearch && matchesStatus && matchesFine && matchesPenaltyType;
    });
  }, [meetingMembersList, searchMember, statusFilter, fineStatusFilter, penaltyTypeFilter]);

  // Meeting Meeting Fine Totals
  const meetingTotals = useMemo(() => {
    let assessed = 0;
    let paid = 0;
    let late = 0;
    let absence = 0;
    let notebook = 0;
    let bible = 0;
    let homework = 0;

    meetingMembersList.forEach((item) => {
      assessed += item.totalAssessedFine;
      paid += item.fineAmountPaid;
      late += item.lateFee;
      absence += item.absenceFine;
      notebook += item.notebookFine;
      bible += item.bibleFine;
      homework += item.homeworkFine;
    });

    return {
      assessed,
      paid,
      remaining: Math.max(0, assessed - paid),
      late,
      absence,
      notebook,
      bible,
      homework,
    };
  }, [meetingMembersList]);

  // Handle Mark Status
  const handleSetStatus = async (item, newStatus) => {
    if (!selectedMeetingId) return;

    const scheduledTime = selectedMeeting?.scheduledTime || '19:00';
    let arrivalTime = item.arrivalTime;

    if (newStatus === ATTENDANCE_STATUS.PRESENT && !arrivalTime) {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      arrivalTime = `${h}:${m}`;
    }

    try {
      await saveAttendanceRecord({
        meetingId: selectedMeetingId,
        memberId: item.memberId,
        memberName: item.memberName,
        memberPhone: item.memberPhone,
        meetingDate: selectedMeeting?.date || '',
        scheduledTime,
        arrivalTime,
        delayMinutes: item.delayMinutes,
        isManualDelay: item.isManualDelay,
        status: newStatus,
        lateFee: item.lateFee,
        isManualFee: item.isManualFee,
        absenceFine: newStatus === ATTENDANCE_STATUS.ABSENT ? settings.defaultAbsenceFine || 0 : 0,
        notebookFine: item.notebookFine,
        bibleFine: item.bibleFine,
        homeworkFine: item.homeworkFine,
        absenceReason: item.absenceReason,
        notes: item.notes,
        settings,
        adminUser: currentUser,
      });
      notifySuccess(`تم تحديث حالة العضو ${item.memberName}`);
    } catch (err) {
      notifyError('حدث خطأ أثناء تحديث حالة الحضور');
    }
  };

  // Handle Arrival Time Change
  const handleArrivalTimeChange = async (item, timeValue) => {
    if (!selectedMeetingId) return;

    const scheduledTime = selectedMeeting?.scheduledTime || '19:00';
    const delay = calculateDelayMinutes(scheduledTime, timeValue);
    const fee = calculateLateFee(delay, settings);

    try {
      await saveAttendanceRecord({
        meetingId: selectedMeetingId,
        memberId: item.memberId,
        memberName: item.memberName,
        memberPhone: item.memberPhone,
        meetingDate: selectedMeeting?.date || '',
        scheduledTime,
        arrivalTime: timeValue,
        delayMinutes: delay,
        isManualDelay: false,
        status: ATTENDANCE_STATUS.PRESENT,
        lateFee: fee,
        isManualFee: false,
        absenceFine: 0,
        notebookFine: item.notebookFine,
        bibleFine: item.bibleFine,
        homeworkFine: item.homeworkFine,
        settings,
        adminUser: currentUser,
      });
    } catch (err) {
      notifyError('فشل حفظ وقت الحضور');
    }
  };

  // Generic handler for individual manual penalty updates
  const handleUpdateFineField = async (item, fieldName, value) => {
    if (!selectedMeetingId) return;
    const numValue = Math.max(0, Number(value || 0));

    try {
      await saveAttendanceRecord({
        meetingId: selectedMeetingId,
        memberId: item.memberId,
        memberName: item.memberName,
        memberPhone: item.memberPhone,
        meetingDate: selectedMeeting?.date || '',
        scheduledTime: item.scheduledTime,
        arrivalTime: item.arrivalTime,
        delayMinutes: item.delayMinutes,
        isManualDelay: item.isManualDelay,
        status: item.status,
        lateFee: fieldName === 'lateFee' ? numValue : item.lateFee,
        isManualFee: fieldName === 'lateFee' ? true : item.isManualFee,
        absenceFine: fieldName === 'absenceFine' ? numValue : item.absenceFine,
        notebookFine: fieldName === 'notebookFine' ? numValue : item.notebookFine,
        bibleFine: fieldName === 'bibleFine' ? numValue : item.bibleFine,
        homeworkFine: fieldName === 'homeworkFine' ? numValue : item.homeworkFine,
        absenceReason: item.absenceReason,
        notes: item.notes,
        settings,
        adminUser: currentUser,
      });
      notifySuccess(`تم تحديث غرامة (${item.memberName}) إلى ${numValue} ج.م`);
    } catch (err) {
      notifyError('فشل حفظ الغرامة');
    }
  };

  // Reset Late Fee to Auto Calculation
  const handleResetToAuto = async (item) => {
    if (!selectedMeetingId) return;
    const scheduledTime = selectedMeeting?.scheduledTime || '19:00';
    const delay = calculateDelayMinutes(scheduledTime, item.arrivalTime);
    const fee = calculateLateFee(delay, settings);

    try {
      await saveAttendanceRecord({
        meetingId: selectedMeetingId,
        memberId: item.memberId,
        memberName: item.memberName,
        memberPhone: item.memberPhone,
        meetingDate: selectedMeeting?.date || '',
        scheduledTime: item.scheduledTime,
        arrivalTime: item.arrivalTime,
        delayMinutes: delay,
        isManualDelay: false,
        status: item.status,
        lateFee: fee,
        isManualFee: false,
        absenceFine: item.absenceFine,
        notebookFine: item.notebookFine,
        bibleFine: item.bibleFine,
        homeworkFine: item.homeworkFine,
        settings,
        adminUser: currentUser,
      });
      notifySuccess(`تم استرجاع الحساب التلقائي للغرامة (${fee} ج.م)`);
    } catch (err) {
      notifyError('فشل استرجاع الحساب التلقائي');
    }
  };

  // Open Collect Fine Modal
  const handleOpenCollectFine = (item) => {
    setFineTarget(item);
    setFinePaymentData({
      fineType: 'سداد مجمع لكافة الغرامات',
      amount: item.fineRemainingAmount || item.totalAssessedFine,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'نقدي',
      notes: '',
    });
    setShowCollectFineModal(true);
  };

  // Submit Collect Fine
  const handleSubmitCollectFine = async (e) => {
    e.preventDefault();
    if (!fineTarget || !selectedMeetingId) return;

    setSubmittingFine(true);
    try {
      await collectFinePayment({
        meetingId: selectedMeetingId,
        memberId: fineTarget.memberId,
        memberName: fineTarget.memberName,
        fineType: finePaymentData.fineType,
        amount: finePaymentData.amount,
        paymentDate: finePaymentData.paymentDate,
        paymentMethod: finePaymentData.paymentMethod,
        notes: finePaymentData.notes,
        adminUser: currentUser,
      });
      notifySuccess(
        `تم تحصيل ${finePaymentData.amount} ج.م (${finePaymentData.fineType}) من ${fineTarget.memberName} بنجاح`
      );
      setShowCollectFineModal(false);
    } catch (err) {
      notifyError(err.message || 'فشل تسجيل تحصيل الغرامة');
    } finally {
      setSubmittingFine(false);
    }
  };

  // Create New Meeting
  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    setSubmittingMeeting(true);
    try {
      const created = await createMeeting(newMeetingData, currentUser);
      notifySuccess(`تم إنشاء الاجتماع: ${created.title} بنجاح`);
      setSelectedMeetingId(created.id);
      setShowNewMeetingModal(false);
      setNewMeetingData({
        title: '',
        date: new Date().toISOString().split('T')[0],
        scheduledTime: settings.defaultMeetingTime || '19:00',
        notes: '',
      });
    } catch (err) {
      notifyError(err.message || 'حدث خطأ أثناء إنشاء الاجتماع');
    } finally {
      setSubmittingMeeting(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const columns = [
      { key: 'memberName', label: 'اسم العضو' },
      { key: 'memberPhone', label: 'رقم الهاتف' },
      { key: 'status', label: 'حالة الحضور' },
      { key: 'delayMinutes', label: 'دقائق التأخير' },
      { key: 'lateFee', label: 'غرامة التأخير (ج.م)' },
      { key: 'absenceFine', label: 'غرامة الغياب (ج.م)' },
      { key: 'notebookFine', label: 'غرامة النوتة (ج.م)' },
      { key: 'bibleFine', label: 'غرامة الإنجيل (ج.م)' },
      { key: 'homeworkFine', label: 'غرامة الواجب (ج.م)' },
      { key: 'totalAssessedFine', label: 'إجمالي الغرامات المقررة (ج.م)' },
      { key: 'fineAmountPaid', label: 'المحصل فعليًا (ج.م)' },
      { key: 'fineRemainingAmount', label: 'المتبقي غير المدفوع (ج.م)' },
      { key: 'finePaymentStatus', label: 'حالة السداد' },
    ];
    exportToCsv(
      filteredList,
      columns,
      `حضور_وغرامات_${selectedMeeting?.title || 'اجتماع_التسبيح'}`
    );
  };

  if (loading) {
    return <LoadingSpinner message="جاري تجهيز سجل الحضور والغياب والغرامات..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            الحضور والغياب والغرامات
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            تسجيل حضور الاجتماعات وحساب غرامات التأخير، النوتة، الإنجيل، الواجب، والغياب وتحصيلها آليًا
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={!selectedMeetingId || filteredList.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            <span>تصدير كشف CSV</span>
          </button>

          <button
            onClick={() => setShowNewMeetingModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-900/20 transition-all"
          >
            <CalendarPlus size={18} />
            <span>إنشاء اجتماع جديد</span>
          </button>
        </div>
      </div>

      {/* Meeting Selector Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 shrink-0">
            <CalendarCheck2 size={20} />
          </div>
          <div className="w-full">
            <label className="text-[11px] font-bold text-slate-500 block mb-1">
              اختر الاجتماع المستهدف
            </label>
            <select
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              className="w-full md:w-80 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
            >
              {meetings.length === 0 ? (
                <option value="">لا توجد اجتماعات بعد - أنشئ اجتماعًا</option>
              ) : (
                meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} - {formatDate(m.date)} ({formatTime(m.scheduledTime)})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {selectedMeeting && (
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0">
            <div className="flex items-center gap-1.5">
              <Clock size={15} className="text-teal-600" />
              <span>الموعد المحدد: {formatTime(selectedMeeting.scheduledTime)}</span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <div>
              <span>الأعضاء المسجلون: {formatNumber(meetingMembersList.length)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Meeting Fines Metrics Card */}
      {selectedMeeting && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-sm border border-slate-700 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
          <div className="p-2.5 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block mb-1">إجمالي المستحق</span>
            <span className="text-sm font-extrabold text-amber-400">
              {formatCurrency(meetingTotals.assessed)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block mb-1">المحصل فعليًا</span>
            <span className="text-sm font-extrabold text-emerald-400">
              {formatCurrency(meetingTotals.paid)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block mb-1">المتبقي غير المسدد</span>
            <span className="text-sm font-extrabold text-rose-400">
              {formatCurrency(meetingTotals.remaining)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block mb-1">التأخير</span>
            <span className="text-xs font-bold text-white">
              {formatCurrency(meetingTotals.late)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block mb-1">الغياب</span>
            <span className="text-xs font-bold text-white">
              {formatCurrency(meetingTotals.absence)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block mb-1">النوتة</span>
            <span className="text-xs font-bold text-white">
              {formatCurrency(meetingTotals.notebook)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/80 rounded-2xl border border-slate-700 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 block mb-1">الإنجيل والواجب</span>
            <span className="text-xs font-bold text-white">
              {formatCurrency(meetingTotals.bible + meetingTotals.homework)}
            </span>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchMember}
            onChange={(e) => setSearchMember(e.target.value)}
            placeholder="بحث عن عضو..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
          />
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
          >
            <option value="ALL">جميع الحالات</option>
            <option value={ATTENDANCE_STATUS.PRESENT}>حاضر فقط</option>
            <option value={ATTENDANCE_STATUS.ABSENT}>غائب فقط</option>
            <option value={ATTENDANCE_STATUS.NOT_RECORDED}>لم يسجل بعد</option>
          </select>

          {/* Fine Status Filter */}
          <select
            value={fineStatusFilter}
            onChange={(e) => setFineStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
          >
            <option value="ALL">كل حالات الغرامة</option>
            <option value="UNPAID">غرامات غير مسددة</option>
            <option value="PAID">غرامات مسددة بالكامل</option>
          </select>

          {/* Penalty Type Filter */}
          <select
            value={penaltyTypeFilter}
            onChange={(e) => setPenaltyTypeFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
          >
            <option value="ALL">كافة المخالفات</option>
            <option value="LATE">غرامة التأخير</option>
            <option value="ABSENCE">غرامة الغياب</option>
            <option value="NOTEBOOK">عدم إحضار النوتة</option>
            <option value="BIBLE">عدم إحضار الإنجيل</option>
            <option value="HOMEWORK">عدم عمل الواجب</option>
          </select>
        </div>
      </div>

      {/* Attendance & Penalties Table */}
      {!selectedMeeting ? (
        <EmptyState
          title="لم يتم تحديد أي اجتماع"
          description="يرجى اختيار اجتماع من القائمة أو إنشاء اجتماع جديد لبدء رصد الحضور."
        />
      ) : filteredList.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات حضور مطابقة"
          description="تأكد من وجود أعضاء نشطين في النظام، أو جرب تغيير الفلاتر الحالية."
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3 min-w-[130px]">العضو</th>
                  <th className="py-3 px-3">تسجيل الحالة</th>
                  <th className="py-3 px-3">وقت الحضور</th>
                  <th className="py-3 px-3 text-center">غرامة التأخير</th>
                  <th className="py-3 px-3 text-center">غرامة الغياب</th>
                  <th className="py-3 px-3 text-center">النوتة</th>
                  <th className="py-3 px-3 text-center">الكتاب المقدس</th>
                  <th className="py-3 px-3 text-center">الواجب</th>
                  <th className="py-3 px-3 text-center">إجمالي المستحق</th>
                  <th className="py-3 px-3 text-center">حالة السداد</th>
                  <th className="py-3 px-3 text-center">تحصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredList.map((item) => {
                  const isPresent = item.status === ATTENDANCE_STATUS.PRESENT;
                  const isAbsent = item.status === ATTENDANCE_STATUS.ABSENT;
                  const isNotRecorded = item.status === ATTENDANCE_STATUS.NOT_RECORDED;

                  return (
                    <tr
                      key={item.memberId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Member Info */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {item.memberName}
                        </div>
                        {item.memberPhone && (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            <span>{item.memberPhone}</span>
                          </div>
                        )}
                      </td>

                      {/* Status Buttons */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl w-max">
                          <button
                            onClick={() => handleSetStatus(item, ATTENDANCE_STATUS.PRESENT)}
                            className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-all ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                            }`}
                          >
                            حاضر
                          </button>
                          <button
                            onClick={() => handleSetStatus(item, ATTENDANCE_STATUS.ABSENT)}
                            className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-all ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
                            }`}
                          >
                            غائب
                          </button>
                          <button
                            onClick={() => handleSetStatus(item, ATTENDANCE_STATUS.NOT_RECORDED)}
                            className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-all ${
                              isNotRecorded
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
                            }`}
                          >
                            لم يسجل
                          </button>
                        </div>
                      </td>

                      {/* Arrival Time */}
                      <td className="py-3 px-3">
                        {isPresent ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              value={item.arrivalTime || ''}
                              onChange={(e) => handleArrivalTimeChange(item, e.target.value)}
                              className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white"
                            />
                            {item.delayMinutes > 0 && (
                              <span className="text-[10px] text-amber-600 font-bold">
                                (+{item.delayMinutes}د)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 1. Late Arrival Fine */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.lateFee}
                            onChange={(e) =>
                              handleUpdateFineField(item, 'lateFee', e.target.value)
                            }
                            className="w-14 px-1 py-0.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                          />
                          {item.isManualFee && (
                            <button
                              onClick={() => handleResetToAuto(item)}
                              title="استعادة الحساب التلقائي"
                              className="p-0.5 text-teal-600 hover:bg-teal-50 rounded"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 2. Absence Fine */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.absenceFine}
                          onChange={(e) =>
                            handleUpdateFineField(item, 'absenceFine', e.target.value)
                          }
                          className="w-14 px-1 py-0.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </td>

                      {/* 3. Missing Notebook Fine */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.notebookFine}
                          onChange={(e) =>
                            handleUpdateFineField(item, 'notebookFine', e.target.value)
                          }
                          className="w-14 px-1 py-0.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </td>

                      {/* 4. Missing Holy Bible Fine */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.bibleFine}
                          onChange={(e) =>
                            handleUpdateFineField(item, 'bibleFine', e.target.value)
                          }
                          className="w-14 px-1 py-0.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </td>

                      {/* 5. Incomplete Homework Fine */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.homeworkFine}
                          onChange={(e) =>
                            handleUpdateFineField(item, 'homeworkFine', e.target.value)
                          }
                          className="w-14 px-1 py-0.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </td>

                      {/* Total Assessed Fine */}
                      <td className="py-3 px-3 text-center font-black">
                        {item.totalAssessedFine > 0 ? (
                          <span className="text-rose-600 font-extrabold text-xs">
                            {formatCurrency(item.totalAssessedFine)}
                          </span>
                        ) : (
                          <span className="text-slate-400">0 ج.م</span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3 text-center">
                        {item.totalAssessedFine > 0 ? (
                          <div>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.fineRemainingAmount === 0
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : item.fineAmountPaid > 0
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {item.fineRemainingAmount === 0
                                ? 'مسدد بالكامل'
                                : item.fineAmountPaid > 0
                                ? `مسدد: ${item.fineAmountPaid} ج.م`
                                : 'غير مسدد'}
                            </span>
                            {item.fineRemainingAmount > 0 && item.fineAmountPaid > 0 && (
                              <div className="text-[10px] text-rose-500 font-bold mt-0.5">
                                متبقي: {item.fineRemainingAmount} ج.م
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Collect Action */}
                      <td className="py-3 px-3 text-center">
                        {item.totalAssessedFine > 0 && item.fineRemainingAmount > 0 ? (
                          <button
                            onClick={() => handleOpenCollectFine(item)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow-xs inline-flex items-center gap-1 transition-colors"
                          >
                            <CreditCard size={12} />
                            <span>تحصيل</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">-</span>
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

      {/* Create Meeting Modal */}
      {showNewMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                إنشاء اجتماع جديد
              </h3>
              <button
                onClick={() => setShowNewMeetingModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  اسم أو عنوان الاجتماع *
                </label>
                <input
                  type="text"
                  required
                  value={newMeetingData.title}
                  onChange={(e) =>
                    setNewMeetingData({ ...newMeetingData, title: e.target.value })
                  }
                  placeholder="مثال: اجتماع الأسبوع الأول من الشهر"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    تاريخ الاجتماع *
                  </label>
                  <input
                    type="date"
                    required
                    value={newMeetingData.date}
                    onChange={(e) =>
                      setNewMeetingData({ ...newMeetingData, date: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    موعد الاجتماع المحدد *
                  </label>
                  <input
                    type="time"
                    required
                    value={newMeetingData.scheduledTime}
                    onChange={(e) =>
                      setNewMeetingData({ ...newMeetingData, scheduledTime: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ملاحظات أو جدول الأعمال (اختياري)
                </label>
                <textarea
                  rows="3"
                  value={newMeetingData.notes}
                  onChange={(e) =>
                    setNewMeetingData({ ...newMeetingData, notes: e.target.value })
                  }
                  placeholder="أي تفاصيل خاصة بالاجتماع..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewMeetingModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingMeeting}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  {submittingMeeting ? 'جاري الإنشاء...' : 'إنشاء الاجتماع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Fine Payment Modal */}
      {showCollectFineModal && fineTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  تحصيل غرامة من العضو
                </h3>
                <span className="text-xs text-teal-600 font-bold">
                  {fineTarget.memberName}
                </span>
              </div>
              <button
                onClick={() => setShowCollectFineModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitCollectFine} className="space-y-4">
              {/* Fine Breakdown Info Box */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                  <span>إجمالي الغرامات المقررة:</span>
                  <span className="text-rose-600 font-black">
                    {formatCurrency(fineTarget.totalAssessedFine)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>المسدد سابقًا:</span>
                  <span className="text-emerald-600 font-bold">
                    {formatCurrency(fineTarget.fineAmountPaid)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300 font-bold border-t border-slate-200 dark:border-slate-700 pt-1">
                  <span>المتبقي غير المدفوع:</span>
                  <span className="text-amber-600 font-black">
                    {formatCurrency(fineTarget.fineRemainingAmount)}
                  </span>
                </div>
              </div>

              {/* Fine Category Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نوع أو تصنيف الغرامة المحصلة *
                </label>
                <select
                  value={finePaymentData.fineType}
                  onChange={(e) =>
                    setFinePaymentData({ ...finePaymentData, fineType: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-teal-500"
                >
                  <option value="سداد مجمع لكافة الغرامات">سداد مجمع لكافة الغرامات</option>
                  <option value={FINE_TYPES.NOTEBOOK}>{FINE_TYPES.NOTEBOOK}</option>
                  <option value={FINE_TYPES.BIBLE}>{FINE_TYPES.BIBLE}</option>
                  <option value={FINE_TYPES.HOMEWORK}>{FINE_TYPES.HOMEWORK}</option>
                  <option value={FINE_TYPES.LATE}>{FINE_TYPES.LATE}</option>
                  <option value={FINE_TYPES.ABSENCE}>{FINE_TYPES.ABSENCE}</option>
                </select>
              </div>

              {/* Amount to Collect */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  المبلغ المحصل الآن (ج.م) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={finePaymentData.amount}
                  onChange={(e) =>
                    setFinePaymentData({
                      ...finePaymentData,
                      amount: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base font-extrabold focus:outline-none focus:border-teal-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  يمكن التحصيل جزئيًا أو كليًا (الحد الأقصى المتبقي: {fineTarget.fineRemainingAmount} ج.م)
                </span>
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  تاريخ التحصيل *
                </label>
                <input
                  type="date"
                  required
                  value={finePaymentData.paymentDate}
                  onChange={(e) =>
                    setFinePaymentData({ ...finePaymentData, paymentDate: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  طريقة الدفع
                </label>
                <select
                  value={finePaymentData.paymentMethod}
                  onChange={(e) =>
                    setFinePaymentData({ ...finePaymentData, paymentMethod: e.target.value })
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

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ملاحظات التحصيل (اختياري)
                </label>
                <input
                  type="text"
                  value={finePaymentData.notes}
                  onChange={(e) =>
                    setFinePaymentData({ ...finePaymentData, notes: e.target.value })
                  }
                  placeholder="ملاحظات حول التحصيل..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCollectFineModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingFine}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  {submittingFine ? 'جاري التحصيل...' : 'تأكيد استلام المبلغ وإضافته للخزينة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
