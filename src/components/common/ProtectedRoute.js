import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { currentUser, isAdmin, loading, logout, isConfigured } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner message="جاري التحقق من صلاحيات المسؤول..." />;
  }

  // If Firebase is not configured, we allow preview with clear banner
  if (!isConfigured) {
    return children;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="bg-white dark:bg-slate-900 max-w-md w-full p-8 rounded-3xl shadow-xl border border-rose-200 dark:border-rose-900/50">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 mx-auto flex items-center justify-center mb-5">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            صلاحية وصول غير مصرح بها
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
            تم تسجيل الدخول بنجاح، لكن حسابك ({currentUser.email}) ليس مدرجاً ضمن قائمة مسؤولي لجنة فريق التسبيح المعتمدين في مجموعة <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">administratorProfiles</code>.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-colors"
            >
              <LogOut size={16} />
              <span>تسجيل الخروج والتبديل لحساب آخر</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
