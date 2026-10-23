import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeDonations,
  addDonation,
  updateDonation,
  deleteDonation,
} from '../services/donationsService';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { PAYMENT_METHODS } from '../constants';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmModal from '../components/common/ConfirmModal';
import {
  HeartHandshake,
  Search,
  Download,
  Plus,
  Edit2,
  Trash2,
  X,
  User,
} from 'lucide-react';

export default function Donations() {
  const { currentUser } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingDonation, setEditingDonation] = useState(null);
  const [formData, setFormData] = useState({
    donorName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'نقدي',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Confirm Modal
  const [confirmModalData, setConfirmModalData] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    const unsub = subscribeDonations((data) => {
      setDonations(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filtered Donations
  const filteredDonations = useMemo(() => {
    return donations.filter((item) => {
      const matchesSearch =
        item.donorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesMethod = true;
      if (paymentMethodFilter !== 'ALL') {
        matchesMethod = item.paymentMethod === paymentMethodFilter;
      }

      let matchesDate = true;
      if (startDateFilter && item.date < startDateFilter) matchesDate = false;
      if (endDateFilter && item.date > endDateFilter) matchesDate = false;

      return matchesSearch && matchesMethod && matchesDate;
    });
  }, [donations, searchQuery, paymentMethodFilter, startDateFilter, endDateFilter]);

  // Total amount of filtered donations
  const totalFilteredAmount = useMemo(() => {
    return filteredDonations.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  }, [filteredDonations]);

  const handleOpenAdd = () => {
    setEditingDonation(null);
    setFormData({
      donorName: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'نقدي',
      notes: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (donation) => {
    setEditingDonation(donation);
    setFormData({
      donorName: donation.donorName || '',
      amount: donation.amount || '',
      date: donation.date || new Date().toISOString().split('T')[0],
      paymentMethod: donation.paymentMethod || 'نقدي',
      notes: donation.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingDonation) {
        await updateDonation(editingDonation.id, formData, currentUser);
        notifySuccess('تم تحديث بيانات التبرع بنجاح');
      } else {
        await addDonation(formData, currentUser);
        notifySuccess('تم تسجيل التبرع الوارد وإضافته للخزينة بنجاح');
      }
      setShowModal(false);
    } catch (err) {
      notifyError(err.message || 'حدث خطأ أثناء حفظ التبرع');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (donation) => {
    setConfirmModalData({
      isOpen: true,
      title: 'حذف التبرع المسجل',
      message: `هل أنت متأكد من حذف تبرع بقيمة ${formatCurrency(donation.amount)} للمتبرع "${donation.donorName}"؟ سيتم خصم هذا المبلغ من إجمالي الخزينة والمعاملات المالية تلقائيًا.`,
      onConfirm: async () => {
        try {
          await deleteDonation(donation.id, donation, currentUser);
          notifySuccess('تم حذف التبرع وتسوية الخزينة بنجاح');
        } catch (err) {
          notifyError('فشل حذف التبرع');
        }
        setConfirmModalData((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleExportCsv = () => {
    const columns = [
      { key: 'donorName', label: 'اسم المتبرع' },
      { key: 'date', label: 'تاريخ التبرع' },
      { key: 'amount', label: 'المبلغ (ج.م)' },
      { key: 'paymentMethod', label: 'طريقة الدفع' },
      { key: 'notes', label: 'ملاحظات' },
    ];
    exportToCsv(filteredDonations, columns, 'تقرير_التبرعات_الواردة');
  };

  if (loading) {
    return <LoadingSpinner message="جاري تحميل سجل التبرعات..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            التبرعات الواردة
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            سجل التبرعات والمساهمات المالية ودعم أنشطة فريق التسبيح
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={filteredDonations.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            <span>تصدير CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-900/20 transition-all"
          >
            <Plus size={18} />
            <span>تسجيل تبرع جديد</span>
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-5 rounded-3xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl">
            <HeartHandshake size={22} />
          </div>
          <div>
            <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold block">
              إجمالي التبرعات حسب التصفية الحالية
            </span>
            <span className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
              {formatCurrency(totalFilteredAmount)}
            </span>
          </div>
        </div>
        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
          عدد المساهمات: {filteredDonations.length}
        </span>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالمتبرع أو الملاحظات..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
          />
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
          >
            <option value="ALL">جميع طرق الدفع</option>
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm} value={pm}>
                {pm}
              </option>
            ))}
          </select>

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

      {/* Donations Table */}
      {filteredDonations.length === 0 ? (
        <EmptyState
          title="لا توجد تبرعات مسجلة"
          description="لم يتم العثور على تبرعات مطابقة لمعايير البحث الحالية."
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">اسم المتبرع</th>
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4">المبلغ</th>
                  <th className="py-3.5 px-4">طريقة الدفع</th>
                  <th className="py-3.5 px-4">ملاحظات</th>
                  <th className="py-3.5 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDonations.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white text-sm">
                      <div className="flex items-center gap-2">
                        <User size={15} className="text-teal-600" />
                        <span>{d.donorName}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {formatDate(d.date)}
                    </td>

                    <td className="py-3.5 px-4 font-extrabold text-emerald-600 text-sm">
                      {formatCurrency(d.amount)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {d.paymentMethod}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {d.notes || '-'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(d)}
                          title="تعديل التبرع"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(d)}
                          title="حذف التبرع"
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingDonation ? 'تعديل بيانات التبرع' : 'تسجيل تبرع وارد جديد'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  اسم المتبرع (اتركه فارغًا لفاعل خير / مجهول)
                </label>
                <input
                  type="text"
                  value={formData.donorName}
                  onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
                  placeholder="مثال: فاعل خير، أو الاسم الكامل"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  مبلغ التبرع (ج.م) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base font-extrabold focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    تاريخ التبرع *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    طريقة الدفع
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ملاحظات أو الغرض من التبرع
                </label>
                <textarea
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ملاحظات حول التبرع..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  {submitting ? 'جاري الحفظ...' : editingDonation ? 'تحديث التبرع' : 'إضافة التبرع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalData.isOpen}
        title={confirmModalData.title}
        message={confirmModalData.message}
        confirmText="حذف التبرع"
        isDanger={true}
        onConfirm={confirmModalData.onConfirm}
        onCancel={() => setConfirmModalData((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
