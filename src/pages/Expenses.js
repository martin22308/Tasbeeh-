import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
} from '../services/expensesService';
import { getSettings } from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { DEFAULT_EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../constants';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmModal from '../components/common/ConfirmModal';
import {
  TrendingDown,
  Search,
  Download,
  Plus,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';

export default function Expenses() {
  const { currentUser } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_EXPENSE_CATEGORIES);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    category: DEFAULT_EXPENSE_CATEGORIES[0],
    amount: '',
    recipient: '',
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
    let unsub = () => {};
    async function init() {
      const settings = await getSettings();
      if (settings.expenseCategories && settings.expenseCategories.length > 0) {
        setCategories(settings.expenseCategories);
      }
      unsub = subscribeExpenses((data) => {
        setExpenses(data);
        setLoading(false);
      });
    }
    init();
    return () => unsub();
  }, []);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const matchesSearch =
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.recipient?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesCategory = true;
      if (categoryFilter !== 'ALL') {
        matchesCategory = item.category === categoryFilter;
      }

      let matchesDate = true;
      if (startDateFilter && item.date < startDateFilter) matchesDate = false;
      if (endDateFilter && item.date > endDateFilter) matchesDate = false;

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [expenses, searchQuery, categoryFilter, startDateFilter, endDateFilter]);

  const totalFilteredExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData({
      description: '',
      category: categories[0] || 'نفقات إدارية',
      amount: '',
      recipient: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'نقدي',
      notes: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description || '',
      category: expense.category || categories[0],
      amount: expense.amount || '',
      recipient: expense.recipient || '',
      date: expense.date || new Date().toISOString().split('T')[0],
      paymentMethod: expense.paymentMethod || 'نقدي',
      notes: expense.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, formData, currentUser);
        notifySuccess('تم تحديث بيانات المصروف بنجاح');
      } else {
        await addExpense(formData, currentUser);
        notifySuccess('تم تسجيل المصروف وخصمه من الخزينة بنجاح');
      }
      setShowModal(false);
    } catch (err) {
      notifyError(err.message || 'حدث خطأ أثناء حفظ المصروف');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (expense) => {
    setConfirmModalData({
      isOpen: true,
      title: 'حذف المصروف المسجل',
      message: `هل أنت متأكد من حذف هذا المصروف بقيمة ${formatCurrency(expense.amount)}؟ سيتم رد هذا المبلغ إلى رصيد الخزينة تلقائيًا.`,
      onConfirm: async () => {
        try {
          await deleteExpense(expense.id, expense, currentUser);
          notifySuccess('تم حذف المصروف وتسوية رصيد الخزينة بنجاح');
        } catch (err) {
          notifyError('فشل حذف المصروف');
        }
        setConfirmModalData((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleExportCsv = () => {
    const columns = [
      { key: 'description', label: 'بيان المصروف' },
      { key: 'category', label: 'التصنيف' },
      { key: 'amount', label: 'المبلغ (ج.م)' },
      { key: 'recipient', label: 'المستلم / الجهة' },
      { key: 'date', label: 'تاريخ الصرف' },
      { key: 'paymentMethod', label: 'طريقة الدفع' },
      { key: 'notes', label: 'ملاحظات' },
    ];
    exportToCsv(filteredExpenses, columns, 'تقرير_المصروفات_والنفقات');
  };

  if (loading) {
    return <LoadingSpinner message="جاري تحميل سجل المصروفات..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            المصروفات والنفقات
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            تسجيل وتوثيق نفقات اجتماعات وأنشطة لجنة فريق التسبيح
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={filteredExpenses.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            <span>تصدير CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-900/20 transition-all"
          >
            <Plus size={18} />
            <span>تسجيل مصروف جديد</span>
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="bg-rose-50 dark:bg-rose-950/40 p-5 rounded-3xl border border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-600 text-white rounded-2xl">
            <TrendingDown size={22} />
          </div>
          <div>
            <span className="text-xs text-rose-800 dark:text-rose-300 font-semibold block">
              إجمالي المصروفات حسب التصفية الحالية
            </span>
            <span className="text-2xl font-black text-rose-950 dark:text-rose-100">
              {formatCurrency(totalFilteredExpenses)}
            </span>
          </div>
        </div>
        <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
          عدد بنود الصرف: {filteredExpenses.length}
        </span>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالوصف أو المستلم..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
          />
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
          >
            <option value="ALL">جميع التصنيفات</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
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

      {/* Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <EmptyState
          title="لا توجد مصروفات مسجلة"
          description="لم يتم العثور على أي مصروفات مطابقة للبحث أو التصفية."
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">بيان المصروف</th>
                  <th className="py-3.5 px-4">التصنيف</th>
                  <th className="py-3.5 px-4">المبلغ المنصرف</th>
                  <th className="py-3.5 px-4">المستلم / الجهة</th>
                  <th className="py-3.5 px-4">تاريخ الصرف</th>
                  <th className="py-3.5 px-4">طريقة الدفع</th>
                  <th className="py-3.5 px-4">ملاحظات</th>
                  <th className="py-3.5 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white text-sm">
                      {exp.description}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                        {exp.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-extrabold text-rose-600 text-sm">
                      {formatCurrency(exp.amount)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {exp.recipient || '-'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {formatDate(exp.date)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {exp.paymentMethod}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {exp.notes || '-'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(exp)}
                          title="تعديل المصروف"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(exp)}
                          title="حذف المصروف"
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
                {editingExpense ? 'تعديل بيانات المصروف' : 'تسجيل مصروف جديد'}
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
                  بيان أو وصف المصروف *
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="مثال: شراء كراسي أو مستلزمات ضيافة"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    المبلغ المنصرف (ج.م) *
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    التصنيف
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    المستلم أو الجهة
                  </label>
                  <input
                    type="text"
                    value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                    placeholder="اسم الشخص أو المحل"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    تاريخ الصرف *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ملاحظات إضافية
                </label>
                <textarea
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ملاحظات أو رقم الفاتورة إن وجد..."
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
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  {submitting ? 'جاري الحفظ...' : editingExpense ? 'تحديث المصروف' : 'إضافة المصروف'}
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
        confirmText="حذف المصروف"
        isDanger={true}
        onConfirm={confirmModalData.onConfirm}
        onCancel={() => setConfirmModalData((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
