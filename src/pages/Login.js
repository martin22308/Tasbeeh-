import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { isFirebaseConfigured } from '../firebase/config';
import { Lock, Mail, Shield, AlertCircle, ArrowLeft, Info } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showSetupHelp, setShowSetupHelp] = useState(false);

  const { login } = useAuth();
  const { notifySuccess } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !password) {
      setLocalError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    if (!isFirebaseConfigured) {
      setLocalError(
        'لم يتم ضبط متغيرات بيئة فايربيس (.env.local). يرجى تكوين ملف الإعدادات أولاً.'
      );
      setShowSetupHelp(true);
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      notifySuccess('تم تسجيل الدخول بنجاح! مرحبًا بك.');
      navigate(from, { replace: true });
    } catch (err) {
      setLocalError(err.message || 'فشل تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-600/30 border border-teal-500/40 text-teal-400 mx-auto flex items-center justify-center mb-4 shadow-xl shadow-teal-900/30">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mb-2">
            نظام إدارة لجنة فريق التسبيح
          </h1>
          <p className="text-slate-400 text-sm">
            بوابة تسجيل دخول مسؤولي اللجنة المعتمدين فقط
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-700/80">
          {localError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{localError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                البريد الإلكتروني للمسؤول
              </label>
              <div className="relative">
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@tasbeeh-committee.com"
                  disabled={loading}
                  className="w-full pl-4 pr-11 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors placeholder:text-slate-600 text-left"
                  required
                />
                <Mail
                  size={18}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full pl-4 pr-11 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors placeholder:text-slate-600 text-left"
                  required
                />
                <Lock
                  size={18}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>جاري التحقق والدخول...</span>
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <ArrowLeft size={18} />
                </>
              )}
            </button>
          </form>

          {/* Setup / Admin Help toggle */}
          <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
            <button
              type="button"
              onClick={() => setShowSetupHelp(!showSetupHelp)}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium inline-flex items-center gap-1.5"
            >
              <Info size={14} />
              <span>كيف يتم إنشاء أول حساب مسؤول في فايربيس؟</span>
            </button>
          </div>

          {showSetupHelp && (
            <div className="mt-4 p-4 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-slate-300 space-y-2 leading-relaxed text-right">
              <p className="font-bold text-teal-400">خطوات إضافة أول مسؤول للنظام:</p>
              <ol className="list-decimal list-inside space-y-1 pr-1 text-[11px] text-slate-300">
                <li>ادخل إلى <strong>Firebase Console</strong> ثم اختر <strong>Authentication</strong>.</li>
                <li>أضف مستخدمًا جديدًا (Add User) بالبريد وكلمة المرور وانسخ <strong>User UID</strong>.</li>
                <li>افتح <strong>Firestore Database</strong> وانتقل لمجموعة <code className="text-teal-300">administratorProfiles</code>.</li>
                <li>أنشئ مستندًا يحمل معرّف الـ UID وضع الحقول:
                  <ul className="list-disc list-inside pr-4 mt-1 space-y-0.5 text-slate-400">
                    <li><code>email</code>: بريد المسؤول</li>
                    <li><code>role</code>: "admin"</li>
                    <li><code>isActive</code>: true</li>
                    <li><code>displayName</code>: اسم المسؤول</li>
                  </ul>
                </li>
              </ol>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          النظام مخصص حصريًا لأعضاء إدارة لجنة فريق التسبيح المصرح لهم
        </div>
      </div>
    </div>
  );
}
