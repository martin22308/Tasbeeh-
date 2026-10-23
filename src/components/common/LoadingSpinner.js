import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'جاري التحميل...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] w-full p-8 text-center">
      <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-3" />
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {message}
      </span>
    </div>
  );
}
