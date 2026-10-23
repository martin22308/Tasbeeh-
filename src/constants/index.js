export const APP_NAME = 'نظام إدارة لجنة فريق التسبيح';
export const CURRENCY = 'ج.م';

export const MEMBER_STATUS = {
  ACTIVE: 'نشط',
  ARCHIVED: 'مؤرشف',
};

export const ATTENDANCE_STATUS = {
  PRESENT: 'حاضر',
  ABSENT: 'غائب',
  NOT_RECORDED: 'لم يتم التسجيل',
};

export const PLEDGE_STATUS = {
  UNPAID: 'غير مدفوع',
  PARTIALLY_PAID: 'مدفوع جزئيًا',
  FULLY_PAID: 'مدفوع بالكامل',
};

export const FINE_STATUS = {
  UNPAID: 'غير مسدد',
  PARTIALLY_PAID: 'مسدد جزئيًا',
  FULLY_PAID: 'مسدد بالكامل',
  WAIVED: 'معفى / مسقط',
};

export const FINE_TYPES = {
  LATE: 'غرامة التأخير',
  ABSENCE: 'غرامة الغياب',
  NOTEBOOK: 'غرامة عدم إحضار النوتة',
  BIBLE: 'غرامة عدم إحضار الكتاب المقدس',
  HOMEWORK: 'غرامة عدم عمل الواجب',
};

export const TRANSACTION_TYPE = {
  PLEDGE_PAYMENT: 'اشتراك شهري',
  DONATION: 'تبرع',
  FINE_PAYMENT: 'تحصيل غرامة',
  EXPENSE: 'مصروفات',
  OPENING_BALANCE: 'تسوية رصيد افتتاحي',
};

export const DEFAULT_EXPENSE_CATEGORIES = [
  'انتقالات ومواصلات',
  'مأكولات ومشروبات وضيافة',
  'نفقات ومستلزمات اجتماعات',
  'أجهزة وصوتيات ومعدات',
  'نفقات ومطبوعات إدارية',
  'أخرى',
];

export const PAYMENT_METHODS = [
  'نقدي',
  'فودافون كاش / محفظة إلكترونية',
  'تحويل بنكي / إنستاباي (InstaPay)',
  'شيك',
  'أخرى',
];

export const DEFAULT_SETTINGS = {
  committeeName: 'لجنة فريق التسبيح',
  defaultMeetingTime: '19:00',
  gracePeriodMinutes: 5,
  feeIntervalMinutes: 5,
  feePerInterval: 10,
  autoCalculateFee: true,
  defaultAbsenceFine: 0,
  defaultNotebookFine: 0,
  defaultBibleFine: 0,
  defaultHomeworkFine: 0,
  openingBalance: 0,
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  paymentMethods: PAYMENT_METHODS,
};

export const ARABIC_MONTHS = [
  { value: 1, label: 'يناير' },
  { value: 2, label: 'فبراير' },
  { value: 3, label: 'مارس' },
  { value: 4, label: 'أبريل' },
  { value: 5, label: 'مايو' },
  { value: 6, label: 'يونيو' },
  { value: 7, label: 'يوليو' },
  { value: 8, label: 'أغسطس' },
  { value: 9, label: 'سبتمبر' },
  { value: 10, label: 'أكتوبر' },
  { value: 11, label: 'نوفمبر' },
  { value: 12, label: 'ديسمبر' },
];
