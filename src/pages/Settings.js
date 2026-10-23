import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/settingsService';
import { getMembers } from '../services/membersService';
import { getLedgerTransactions } from '../services/financialLedgerService';
import { getDonations } from '../services/donationsService';
import { getExpenses } from '../services/expensesService';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { DEFAULT_SETTINGS } from '../constants';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  Clock,
  Wallet,
  Save,
  Plus,
  Trash2,
  Download,
  Database,
  CloudUpload,
} from 'lucide-react';

export default function Settings() {
  const { currentUser } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('fees'); // 'fees' | 'financial' | 'committee' | 'backup'

  // Settings State
  const [formData, setFormData] = useState(DEFAULT_SETTINGS);
  const [newCategory, setNewCategory] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  // Backup Export State
  const [exportingBackup, setExportingBackup] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const s = await getSettings();
        setFormData(s);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(formData, currentUser);
      notifySuccess('تم حفظ وتطبيق الإعدادات بنجاح في قاعدة البيانات');
    } catch (err) {
      notifyError(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    if (formData.expenseCategories?.includes(newCategory.trim())) {
      notifyError('هذا التصنيف موجود مسبقًا');
      return;
    }
    setFormData({
      ...formData,
      expenseCategories: [...(formData.expenseCategories || []), newCategory.trim()],
    });
    setNewCategory('');
  };

  const handleRemoveCategory = (catToRemove) => {
    setFormData({
      ...formData,
      expenseCategories: formData.expenseCategories.filter((c) => c !== catToRemove),
    });
  };

  const handleAddPaymentMethod = () => {
    if (!newPaymentMethod.trim()) return;
    if (formData.paymentMethods?.includes(newPaymentMethod.trim())) {
      notifyError('طريقة الدفع هذه موجودة مسبقًا');
      return;
    }
    setFormData({
      ...formData,
      paymentMethods: [...(formData.paymentMethods || []), newPaymentMethod.trim()],
    });
    setNewPaymentMethod('');
  };

  const handleRemovePaymentMethod = (pmToRemove) => {
    setFormData({
      ...formData,
      paymentMethods: formData.paymentMethods.filter((pm) => pm !== pmToRemove),
    });
  };

  // Full Database JSON Backup Export
  const handleFullDatabaseExport = async () => {
    setExportingBackup(true);
    try {
      const [members, ledger, donations, expenses] = await Promise.all([
        getMembers(),
        getLedgerTransactions(),
        getDonations(),
        getExpenses(),
      ]);

      const backupPackage = {
        appName: 'نظام إدارة لجنة فريق التسبيح',
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser?.email || 'admin',
        version: '1.0',
        settings: formData,
        data: {
          members,
          financialLedger: ledger,
          donations,
          expenses,
        },
      };

      const jsonStr = JSON.stringify(backupPackage, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `نسخة_احتياطية_كاملة_فريق_التسبيح_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notifySuccess('تم تصدير ملف النسخة الاحتياطية الشاملة بنجاح');
    } catch (err) {
      notifyError('حدث خطأ أثناء تصدير النسخة الاحتياطية');
    } finally {
      setExportingBackup(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="جاري تحميل إعدادات النظام..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            الإعدادات وقواعد الغرامات
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            تخصيص قواعد التأخير، الرصيد الافتتاحي للخزينة، وتصنيفات المصروفات
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-900/20 transition-all disabled:opacity-50"
        >
          <Save size={18} />
          <span>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs max-w-2xl">
        <button
          onClick={() => setActiveTab('fees')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'fees'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          قواعد الغرامات والتأخير
        </button>
        <button
          onClick={() => setActiveTab('financial')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'financial'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          الإعدادات المالية والتصنيفات
        </button>
        <button
          onClick={() => setActiveTab('committee')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'committee'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          بيانات اللجنة
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'backup'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          النسخ الاحتياطي والأمان
        </button>
      </div>

      {/* Tab 1: Late Fee Rules */}
      {activeTab === 'fees' && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-2xl">
              <Clock size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                معادلة حساب غرامة التأخير الافتراضية
              </h3>
              <p className="text-xs text-slate-500">
                المعادلة: الغرامة = ceil((دقائق التأخير - فترة السماح) / فترة الاحتساب) × قيمة الغرامة
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                فترة السماح (بالدقائق) *
              </label>
              <input
                type="number"
                min="0"
                value={formData.gracePeriodMinutes ?? 5}
                onChange={(e) =>
                  setFormData({ ...formData, gracePeriodMinutes: Number(e.target.value) })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                الافتراضي: 5 دقائق (لا يتم احتساب أي غرامة خلالها).
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                فترة احتساب الغرامة (بالدقائق) *
              </label>
              <input
                type="number"
                min="1"
                value={formData.feeIntervalMinutes ?? 5}
                onChange={(e) =>
                  setFormData({ ...formData, feeIntervalMinutes: Number(e.target.value) })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                الافتراضي: 5 دقائق لكل شريحة تأخير.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                قيمة الغرامة لكل فترة (ج.م) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.feePerInterval ?? 10}
                onChange={(e) =>
                  setFormData({ ...formData, feePerInterval: Number(e.target.value) })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                الافتراضي: 10 جنيهات لكل 5 دقائق تأخير.
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                غرامة الغياب الافتراضية (ج.م)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.defaultAbsenceFine ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, defaultAbsenceFine: Number(e.target.value) })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                غرامة افتراضية تقيد على العضو الغائب (0 = بدون غرامة غياب).
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                غرامة عدم إحضار النوتة الافتراضية (ج.م)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.defaultNotebookFine ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, defaultNotebookFine: Number(e.target.value) })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                القيمة الافتراضية لغرامة نسيان النوتة.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                غرامة عدم إحضار الكتاب المقدس الافتراضية (ج.م)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.defaultBibleFine ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, defaultBibleFine: Number(e.target.value) })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                القيمة الافتراضية لغرامة عدم إحضار الإنجيل.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                غرامة عدم عمل الواجب الافتراضية (ج.م)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.defaultHomeworkFine ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, defaultHomeworkFine: Number(e.target.value) })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                القيمة الافتراضية لغرامة عدم أداء الواجب.
              </span>
            </div>

            <div className="flex items-center gap-3 pt-6 sm:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoCalculateFee !== false}
                  onChange={(e) =>
                    setFormData({ ...formData, autoCalculateFee: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  تفعيل الحساب التلقائي لغرامات التأخير في شاشة الحضور
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Financial & Categories */}
      {activeTab === 'financial' && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-8">
          {/* Opening Balance */}
          <div>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl">
                <Wallet size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  الرصيد الافتتاحي للخزينة
                </h3>
                <p className="text-xs text-slate-500">
                  المبلغ المالي الذي بدأت به الخزينة قبل بدء تسجيل العمليات (يتم توثيق أي تعديل في سجل التدقيق المالي).
                </p>
              </div>
            </div>

            <div className="max-w-xs">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                قيمة الرصيد الافتتاحي (ج.م) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.openingBalance ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, openingBalance: Number(e.target.value) })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base font-black focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Expense Categories */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              تصنيفات المصروفات المعتمدة
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              يمكنك إضافة أو حذف تصنيفات النفقات بما يتناسب مع احتياجات لجنة فريق التسبيح.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {(formData.expenseCategories || []).map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-slate-400 hover:text-rose-500"
                    title="حذف التصنيف"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="اسم تصنيف جديد..."
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shrink-0"
              >
                <Plus size={14} />
                <span>إضافة</span>
              </button>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              طرق الدفع والتحصيل المعتمدة
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              إدارة وسائل الدفع المتاحة في تسجيل الاشتراكات والتبرعات والمصروفات.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {(formData.paymentMethods || []).map((pm) => (
                <div
                  key={pm}
                  className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <span>{pm}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePaymentMethod(pm)}
                    className="text-slate-400 hover:text-rose-500"
                    title="حذف طريقة الدفع"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={newPaymentMethod}
                onChange={(e) => setNewPaymentMethod(e.target.value)}
                placeholder="طريقة دفع جديدة..."
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddPaymentMethod}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shrink-0"
              >
                <Plus size={14} />
                <span>إضافة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Committee Info */}
      {activeTab === 'committee' && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
            البيانات العامة للجنة
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              اسم اللجنة الرسمي *
            </label>
            <input
              type="text"
              value={formData.committeeName || ''}
              onChange={(e) => setFormData({ ...formData, committeeName: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              الموعد الافتراضي للاجتماعات الأسبوعية *
            </label>
            <input
              type="time"
              value={formData.defaultMeetingTime || '19:00'}
              onChange={(e) => setFormData({ ...formData, defaultMeetingTime: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono font-bold focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
      )}

      {/* Tab 4: Backup & Security Instructions */}
      {activeTab === 'backup' && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-2xl">
              <Database size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                استراتيجية النسخ الاحتياطي وحماية البيانات
              </h3>
              <p className="text-xs text-slate-500">
                تصدير نسخة احتياطية محلية مشفرة ومعلومات إعداد النسخ المجدول في Google Cloud
              </p>
            </div>
          </div>

          {/* Instant Admin Export */}
          <div className="p-5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-teal-950 dark:text-teal-200 text-sm mb-1">
                تصدير نسخة احتياطية فورية شاملة (JSON)
              </h4>
              <p className="text-xs text-teal-800 dark:text-teal-300 max-w-xl leading-relaxed">
                يقوم بتجميع وتحميل كافة سجلات الأعضاء، دفتر الخزينة، التبرعات، المصروفات، والاشتراكات في ملف JSON محلي آمن يمكن الاحتفاظ به على جهازك الشخصي.
              </p>
            </div>

            <button
              onClick={handleFullDatabaseExport}
              disabled={exportingBackup}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shrink-0 flex items-center gap-2"
            >
              <Download size={15} />
              <span>{exportingBackup ? 'جاري استخراج البيانات...' : 'تحميل النسخة الآن'}</span>
            </button>
          </div>

          {/* Cloud Firestore Scheduled Backups Guide */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-3 leading-relaxed">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <CloudUpload size={18} className="text-teal-600" />
              <span>النسخ الاحتياطي السحابي المجدول عبر Google Cloud Platform (GCP)</span>
            </div>

            <p className="text-slate-600 dark:text-slate-300">
              تتيح خدمة Cloud Firestore ميزة <strong>Point-in-Time Recovery (PITR)</strong> و <strong>Scheduled Firestore Backups</strong>، وتتطلب الآتي:
            </p>

            <ul className="list-disc list-inside space-y-1.5 pr-2 text-slate-600 dark:text-slate-300">
              <li>
                <strong>خطة الدفع (Billing):</strong> تتطلب ترقية مشروع Firebase من خطة Spark المجانية إلى خطة <strong>Blaze (Pay-as-you-go)</strong>.
              </li>
              <li>
                <strong>تفعيل PITR:</strong> يسمح باستعادة قاعدة البيانات لأي لحظة زمنية سابقة حتى 7 أيام عبر الأمر:
                <code className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-mono mr-2">
                  gcloud firestore databases update --enable-pitr
                </code>
              </li>
              <li>
                <strong>جدولة النسخ اليومي أو الأسبوعي:</strong> يمكن إنشاء جدولة تلقائية عبر Cloud Firestore Backups أو Cloud Scheduler مع Cloud Storage Bucket.
              </li>
              <li>
                <strong>فترة الاحتفاظ (Retention):</strong> تدعم Cloud Firestore فترات احتفاظ مرنة من 7 أيام حتى 14 أسبوعًا.
              </li>
              <li>
                <strong>إجراءات الاستعادة (Recovery Procedure):</strong> تتم استعادة البيانات من لوحة تحكم GCP أو عبر أمر <code>gcloud firestore databases restore</code> إلى قاعدة بيانات بديلة أو نفس قاعدة البيانات.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
