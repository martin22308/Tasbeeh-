import React, { useState } from 'react';
import { isFirebaseConfigured } from '../../firebase/config';
import { AlertTriangle, Key, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

export default function FirebaseWarningBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isFirebaseConfigured) return null;

  const sampleEnv = `VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tasbeeh-committee-management.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tasbeeh-committee-management
VITE_FIREBASE_STORAGE_BUCKET=tasbeeh-committee-management.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEF`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sampleEnv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 p-4 text-amber-900 dark:text-amber-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-200 dark:bg-amber-800 rounded-xl text-amber-900 dark:text-amber-100 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4 className="font-bold text-sm">
              تنبيه تهيئة فايربيس (Firebase Setup Required)
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              لم يتم تزويد متغيرات بيئة فايربيس في ملف <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">.env.local</code>. يعمل النظام حاليًا في وضع المعاينة.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 transition-colors"
        >
          <Key size={14} />
          <span>{isOpen ? 'إخفاء التعليمات' : 'عرض خطوات الربط'}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-900 text-xs space-y-3 max-w-4xl">
          <p className="font-semibold">
            لربط تطبيقك بمشروع Firebase الحقيقي، اتبع الخطوات التالية:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 pr-2">
            <li>ادخل إلى <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="underline font-bold">Firebase Console</a> وافتح مشروعك <strong>Tasbeeh Committee Management</strong>.</li>
            <li>اضغط على أيقونة الإعدادات (⚙️ Project Settings) &gt; عام (General).</li>
            <li>في قسم <em>Your apps</em>، إذا لم تسجل تطبيق ويب بعد، اضغط على أيقونة الويب <code>&lt;/&gt;</code> وسجل تطبيقًا باسم <em>Tasbeeh Web</em>.</li>
            <li>انسخ كائن الإعدادات <code>firebaseConfig</code>.</li>
            <li>أنشئ ملفاً باسم <code className="font-bold">.env.local</code> في جذر المشروع وضع بداخله القيم التالية مع ملء بياناتك:</li>
          </ol>

          <div className="relative bg-slate-900 text-emerald-300 p-3 rounded-xl font-mono text-[11px] overflow-x-auto text-left ltr">
            <button
              onClick={copyToClipboard}
              className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 transition-colors"
              title="نسخ"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
            <pre>{sampleEnv}</pre>
          </div>
          <p className="text-amber-800 dark:text-amber-300">
            * بعد حفظ ملف <code>.env.local</code>، أعد تشغيل السيرفر المحلي <code>npm start</code> لتفعيل الاتصال الفعلي بقاعدة البيانات.
          </p>
        </div>
      )}
    </div>
  );
}
