import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeMembers,
  addMember,
  updateMember,
  archiveMember,
  activateMember,
} from '../services/membersService';
import { subscribeObligations } from '../services/pledgesService';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { MEMBER_STATUS } from '../constants';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmModal from '../components/common/ConfirmModal';
import {
  UserPlus,
  Search,
  Filter,
  Download,
  Edit2,
  Archive,
  CheckCircle,
  X,
  Phone,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';

export default function Members() {
  const { currentUser } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [members, setMembers] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal States
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Confirm Modal
  const [confirmModalData, setConfirmModalData] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDanger: false,
  });

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    monthlyPledge: 100,
    startDate: new Date().toISOString().split('T')[0],
    status: MEMBER_STATUS.ACTIVE,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubMembers = subscribeMembers((data) => {
      setMembers(data);
      setLoading(false);
    });
    const unsubObligations = subscribeObligations((data) => {
      setObligations(data);
    });

    return () => {
      unsubMembers();
      unsubObligations();
    };
  }, []);

  // Compute total paid and outstanding per member
  const membersWithFinancials = useMemo(() => {
    return members.map((m) => {
      const memberObs = obligations.filter((o) => o.memberId === m.id);
      const totalPaid = memberObs.reduce((sum, o) => sum + Number(o.totalPaid || 0), 0);
      const totalOutstanding = memberObs.reduce(
        (sum, o) => sum + Number(o.remainingAmount || 0),
        0
      );

      return {
        ...m,
        totalPaid,
        totalOutstanding,
      };
    });
  }, [members, obligations]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return membersWithFinancials.filter((m) => {
      const matchesSearch =
        m.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone?.includes(searchQuery);

      let matchesStatus = true;
      if (statusFilter === 'ACTIVE') {
        matchesStatus = m.status !== MEMBER_STATUS.ARCHIVED;
      } else if (statusFilter === 'ARCHIVED') {
        matchesStatus = m.status === MEMBER_STATUS.ARCHIVED;
      }

      return matchesSearch && matchesStatus;
    });
  }, [membersWithFinancials, searchQuery, statusFilter]);

  const handleOpenAdd = () => {
    setEditingMember(null);
    setFormData({
      fullName: '',
      phone: '',
      monthlyPledge: 100,
      startDate: new Date().toISOString().split('T')[0],
      status: MEMBER_STATUS.ACTIVE,
      notes: '',
    });
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (m) => {
    setEditingMember(m);
    setFormData({
      fullName: m.fullName || '',
      phone: m.phone || '',
      monthlyPledge: m.monthlyPledge ?? 100,
      startDate: m.startDate || new Date().toISOString().split('T')[0],
      status: m.status || MEMBER_STATUS.ACTIVE,
      notes: m.notes || '',
    });
    setShowAddEditModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingMember) {
        await updateMember(editingMember.id, formData, currentUser);
        notifySuccess('تم تحديث بيانات العضو بنجاح');
      } else {
        await addMember(formData, currentUser);
        notifySuccess('تمت إضافة العضو الجديد بنجاح');
      }
      setShowAddEditModal(false);
    } catch (err) {
      notifyError(err.message || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = (member) => {
    setConfirmModalData({
      isOpen: true,
      title: 'أرشفة العضو',
      message: `هل أنت متأكد من أرشفة العضو "${member.fullName}"؟ لن يظهر في جلسات الحضور الجديدة أو الاشتراكات المستقبلية مع الحفاظ على كامل سجلاته السابقة.`,
      confirmText: 'أرشفة',
      isDanger: true,
      onConfirm: async () => {
        try {
          await archiveMember(member.id, member.fullName, currentUser);
          notifySuccess(`تمت أرشفة العضو ${member.fullName}`);
        } catch (err) {
          notifyError('فشلت أرشفة العضو');
        }
        setConfirmModalData((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleActivate = (member) => {
    setConfirmModalData({
      isOpen: true,
      title: 'إلغاء الأرشفة وتنشيط العضو',
      message: `هل تريد إعادة تنشيط العضو "${member.fullName}" ليكون متاحًا في الاجتماعات والاشتراكات الجديدة؟`,
      confirmText: 'تنشيط',
      isDanger: false,
      onConfirm: async () => {
        try {
          await activateMember(member.id, member.fullName, currentUser);
          notifySuccess(`تم تنشيط العضو ${member.fullName}`);
        } catch (err) {
          notifyError('فشل تنشيط العضو');
        }
        setConfirmModalData((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleExportCsv = () => {
    const columns = [
      { key: 'fullName', label: 'اسم العضو' },
      { key: 'phone', label: 'رقم الهاتف' },
      { key: 'monthlyPledge', label: 'قيمة الاشتراك الشهري (ج.م)' },
      { key: 'status', label: 'حالة العضوية' },
      { key: 'startDate', label: 'تاريخ الانضمام' },
      { key: 'totalPaid', label: 'إجمالي المسدد (ج.م)' },
      { key: 'totalOutstanding', label: 'المتبقي المستحق (ج.م)' },
      { key: 'notes', label: 'ملاحظات' },
    ];
    exportToCsv(filteredMembers, columns, 'تقرير_أعضاء_لجنة_التسبيح');
  };

  if (loading) {
    return <LoadingSpinner message="جاري تحميل سجل الأعضاء..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            إدارة الأعضاء
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            سجل أعضاء فريق التسبيح ومتابعة اشتراكاتهم وحالة عضويتهم
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors"
          >
            <Download size={16} />
            <span>تصدير CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-900/20 transition-all"
          >
            <UserPlus size={18} />
            <span>إضافة عضو جديد</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search Input */}
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو رقم الهاتف..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
          />
          <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-slate-400 hidden sm:inline" />
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold w-full md:w-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              الكل ({members.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              النشطون ({members.filter((m) => m.status !== MEMBER_STATUS.ARCHIVED).length})
            </button>
            <button
              onClick={() => setStatusFilter('ARCHIVED')}
              className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'ARCHIVED'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              المؤرشفون ({members.filter((m) => m.status === MEMBER_STATUS.ARCHIVED).length})
            </button>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {filteredMembers.length === 0 ? (
          <EmptyState
            title="لم يتم العثور على أعضاء"
            description="جرب البحث بكلمات أخرى أو أضف أول عضو إلى قائمة الفريق."
            action={
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold"
              >
                إضافة عضو الآن
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">اسم العضو</th>
                  <th className="py-3.5 px-4">رقم الهاتف</th>
                  <th className="py-3.5 px-4">الاشتراك الشهري</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4">تاريخ الانضمام</th>
                  <th className="py-3.5 px-4">المسدد فعليًا</th>
                  <th className="py-3.5 px-4">المتبقي المستحق</th>
                  <th className="py-3.5 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMembers.map((m) => {
                  const isArchived = m.status === MEMBER_STATUS.ARCHIVED;
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {m.fullName.charAt(0)}
                          </div>
                          <span>{m.fullName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                        {m.phone ? (
                          <a
                            href={`tel:${m.phone}`}
                            className="hover:underline flex items-center gap-1.5"
                          >
                            <Phone size={13} className="text-slate-400" />
                            <span>{m.phone}</span>
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(m.monthlyPledge)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isArchived
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                          }`}
                        >
                          {m.status || MEMBER_STATUS.ACTIVE}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-xs">
                        {formatDate(m.startDate)}
                      </td>

                      <td className="py-3.5 px-4 text-emerald-600 font-extrabold text-xs">
                        {formatCurrency(m.totalPaid)}
                      </td>

                      <td className="py-3.5 px-4 font-extrabold text-xs">
                        {m.totalOutstanding > 0 ? (
                          <span className="text-rose-600">{formatCurrency(m.totalOutstanding)}</span>
                        ) : (
                          <span className="text-slate-400">0 ج.م</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedMember(m);
                              setShowDetailsModal(true);
                            }}
                            title="عرض التفاصيل والسجل المالي"
                            className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(m)}
                            title="تعديل بيانات العضو"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit2 size={16} />
                          </button>

                          {isArchived ? (
                            <button
                              onClick={() => handleActivate(m)}
                              title="إلغاء الأرشفة وتنشيط العضو"
                              className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <CheckCircle size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchive(m)}
                              title="أرشفة العضو"
                              className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Archive size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Member Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingMember ? 'تعديل بيانات العضو' : 'إضافة عضو جديد'}
              </h3>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  الاسم الرباعي للعضو *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="مثال: يوسف ماهر كامل"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  رقم الهاتف المحمول *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    الاشتراك الشهري (ج.م) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formData.monthlyPledge}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthlyPledge: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    تاريخ بدء العضوية *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  حالة العضوية
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                >
                  <option value={MEMBER_STATUS.ACTIVE}>نشط</option>
                  <option value={MEMBER_STATUS.ARCHIVED}>مؤرشف</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ملاحظات إضافية (اختياري)
                </label>
                <textarea
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="أي ملاحظات تخص العضو..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  {submitting ? 'جاري الحفظ...' : editingMember ? 'تحديث العضو' : 'إضافة العضو'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Details & Financial Summary Modal */}
      {showDetailsModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  الملف الشامل للعضو: {selectedMember.fullName}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  معرّف العضو: {selectedMember.id}
                </span>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-400 block mb-1">الاشتراك الشهري</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {formatCurrency(selectedMember.monthlyPledge)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-400 block mb-1">تاريخ الانضمام</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {formatDate(selectedMember.startDate)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mb-1">
                  إجمالي المسدد
                </span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatCurrency(selectedMember.totalPaid)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 block mb-1">
                  المتبقي المستحق
                </span>
                <span className="font-extrabold text-rose-700 dark:text-rose-300 text-sm">
                  {formatCurrency(selectedMember.totalOutstanding)}
                </span>
              </div>
            </div>

            {/* Obligations history */}
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-teal-600" />
                <span>سجل الاشتراكات الشهرية المسجلة للعضو</span>
              </h4>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">الشهر / السنة</th>
                      <th className="py-2.5 px-3">المستحق</th>
                      <th className="py-2.5 px-3">المسدد</th>
                      <th className="py-2.5 px-3">المتبقي</th>
                      <th className="py-2.5 px-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {obligations.filter((o) => o.memberId === selectedMember.id).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          لا توجد اشتراكات مسجلة بعد لهذا العضو.
                        </td>
                      </tr>
                    ) : (
                      obligations
                        .filter((o) => o.memberId === selectedMember.id)
                        .map((ob) => (
                          <tr key={ob.id}>
                            <td className="py-2.5 px-3 font-semibold">
                              {ob.month}/{ob.year}
                            </td>
                            <td className="py-2.5 px-3">{formatCurrency(ob.expectedAmount)}</td>
                            <td className="py-2.5 px-3 text-emerald-600 font-bold">
                              {formatCurrency(ob.totalPaid)}
                            </td>
                            <td className="py-2.5 px-3 text-rose-600 font-bold">
                              {formatCurrency(ob.remainingAmount)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {ob.status}
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalData.isOpen}
        title={confirmModalData.title}
        message={confirmModalData.message}
        confirmText={confirmModalData.confirmText}
        isDanger={confirmModalData.isDanger}
        onConfirm={confirmModalData.onConfirm}
        onCancel={() => setConfirmModalData((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
