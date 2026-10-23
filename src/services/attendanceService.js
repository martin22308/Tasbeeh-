import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ATTENDANCE_STATUS, FINE_STATUS, TRANSACTION_TYPE } from '../constants';
import { calculateLateFee } from '../utils/lateFeeCalculator';
import { calculateDelayMinutes } from '../utils/lateFeeCalculator';
import { recordLedgerTransaction } from './financialLedgerService';
import { logAuditEvent } from './auditService';

const MEETINGS_COLLECTION = 'meetings';
const ATTENDANCE_COLLECTION = 'attendanceRecords';
const FINES_COLLECTION = 'fines';

// --- MEETINGS ---

export function subscribeMeetings(callback, onError) {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, MEETINGS_COLLECTION), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(items);
    },
    (err) => {
      console.error('Meetings subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function createMeeting({ title, date, scheduledTime, notes }, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');
  if (!title || !title.trim()) throw new Error('اسم الاجتماع مطلوب.');
  if (!date) throw new Error('تاريخ الاجتماع مطلوب.');
  if (!scheduledTime) throw new Error('وقت الاجتماع مطلوب.');

  const payload = {
    title: title.trim(),
    date,
    scheduledTime,
    notes: notes?.trim() || '',
    createdBy: adminUser?.email || adminUser?.uid || 'admin',
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, MEETINGS_COLLECTION), payload);

  await logAuditEvent({
    action: 'CREATE_MEETING',
    description: `إنشاء اجتماع جديد: ${payload.title} بتاريخ ${payload.date}`,
    targetId: docRef.id,
    user: adminUser,
  });

  return { id: docRef.id, ...payload };
}

// --- ATTENDANCE RECORDS ---

/**
 * Subscribe to attendance records for a specific meeting
 */
export function subscribeMeetingAttendance(meetingId, callback, onError) {
  if (!db || !meetingId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, ATTENDANCE_COLLECTION), where('meetingId', '==', meetingId));
  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(records);
    },
    (err) => {
      console.error('Attendance subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe to ALL attendance records across all meetings (for dashboard aggregation)
 */
export function subscribeAllAttendanceRecords(callback, onError) {
  if (!db) {
    callback([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, ATTENDANCE_COLLECTION),
    (snapshot) => {
      const records = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(records);
    },
    (err) => {
      console.error('All attendance subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function getAllAttendanceRecords() {
  if (!db) return [];
  const snap = await getDocs(collection(db, ATTENDANCE_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMeetingAttendance(meetingId) {
  if (!db || !meetingId) return [];
  const q = query(collection(db, ATTENDANCE_COLLECTION), where('meetingId', '==', meetingId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Record or update attendance for a member in a meeting with all 5 fine types:
 * - lateFee (غرامة التأخير)
 * - absenceFine (غرامة الغياب)
 * - notebookFine (غرامة عدم إحضار النوتة)
 * - bibleFine (غرامة عدم إحضار الكتاب المقدس)
 * - homeworkFine (غرامة عدم عمل الواجب)
 */
export async function saveAttendanceRecord({
  meetingId,
  memberId,
  memberName,
  memberPhone,
  meetingDate = '',
  scheduledTime,
  arrivalTime,
  delayMinutes,
  isManualDelay = false,
  status, // 'حاضر' | 'غائب' | 'لم يتم التسجيل'
  lateFee = 0,
  isManualFee = false,
  absenceFine = 0,
  notebookFine = 0,
  bibleFine = 0,
  homeworkFine = 0,
  absenceReason = '',
  notes = '',
  settings = {},
  adminUser,
}) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const recordId = `${meetingId}_${memberId}`;
  const docRef = doc(db, ATTENDANCE_COLLECTION, recordId);

  // Compute delay if not manual
  let calculatedDelay = Number(delayMinutes || 0);
  if (!isManualDelay && status === ATTENDANCE_STATUS.PRESENT && arrivalTime && scheduledTime) {
    calculatedDelay = calculateDelayMinutes(scheduledTime, arrivalTime);
  } else if (status !== ATTENDANCE_STATUS.PRESENT) {
    calculatedDelay = 0;
  }

  // Compute late fee if not manual
  let calculatedLateFee = Number(lateFee || 0);
  if (!isManualFee && status === ATTENDANCE_STATUS.PRESENT) {
    calculatedLateFee = calculateLateFee(calculatedDelay, settings);
  } else if (status !== ATTENDANCE_STATUS.PRESENT) {
    calculatedLateFee = Number(lateFee || 0);
  }

  // Individual fine amounts (ensure non-negative numbers)
  const assessedLateFee = Math.max(0, calculatedLateFee);
  const assessedAbsenceFine = Math.max(0, Number(absenceFine || 0));
  const assessedNotebookFine = Math.max(0, Number(notebookFine || 0));
  const assessedBibleFine = Math.max(0, Number(bibleFine || 0));
  const assessedHomeworkFine = Math.max(0, Number(homeworkFine || 0));

  // Total assessed fine across all 5 categories
  const totalAssessedFine =
    assessedLateFee +
    assessedAbsenceFine +
    assessedNotebookFine +
    assessedBibleFine +
    assessedHomeworkFine;

  // Retrieve existing record to preserve fine payments
  const existingSnap = await getDoc(docRef);
  const existingData = existingSnap.exists() ? existingSnap.data() : null;
  const amountPaid = existingData ? Number(existingData.fineAmountPaid || 0) : 0;
  const remaining = Math.max(0, totalAssessedFine - amountPaid);

  let finePaymentStatus = FINE_STATUS.UNPAID;
  if (totalAssessedFine > 0) {
    if (amountPaid >= totalAssessedFine) {
      finePaymentStatus = FINE_STATUS.FULLY_PAID;
    } else if (amountPaid > 0) {
      finePaymentStatus = FINE_STATUS.PARTIALLY_PAID;
    }
  }

  const payload = {
    recordId,
    meetingId,
    memberId,
    memberName,
    memberPhone: memberPhone || '',
    meetingDate: meetingDate || existingData?.meetingDate || '',
    scheduledTime,
    arrivalTime: status === ATTENDANCE_STATUS.PRESENT ? arrivalTime || '' : '',
    delayMinutes: calculatedDelay,
    isManualDelay,
    status,
    lateFee: assessedLateFee,
    isManualFee,
    absenceFine: assessedAbsenceFine,
    notebookFine: assessedNotebookFine,
    bibleFine: assessedBibleFine,
    homeworkFine: assessedHomeworkFine,
    totalAssessedFine,
    fineAmountPaid: amountPaid,
    fineRemainingAmount: remaining,
    finePaymentStatus,
    absenceReason: status === ATTENDANCE_STATUS.ABSENT ? absenceReason : '',
    notes: notes || '',
    updatedAt: serverTimestamp(),
    updatedBy: adminUser?.email || adminUser?.uid || 'admin',
  };

  await setDoc(docRef, payload, { merge: true });

  await logAuditEvent({
    action: 'SAVE_ATTENDANCE',
    description: `تسجيل حضور العضو ${memberName}: الحالة (${status}) - إجمالي الغرامات المقررة (${totalAssessedFine} ج.م)`,
    targetId: recordId,
    amount: totalAssessedFine,
    user: adminUser,
  });

  return payload;
}

// --- FINES COLLECTION & PAYMENTS ---

export function subscribeFines(callback, onError) {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, FINES_COLLECTION), orderBy('paymentDate', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(records);
    },
    (err) => {
      console.error('Fines subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Collect fine payment (full or partial) with fine category attribution
 */
export async function collectFinePayment({
  meetingId,
  memberId,
  memberName,
  fineType = 'كافة الغرامات المستحقة',
  amount,
  paymentDate,
  paymentMethod = 'نقدي',
  notes = '',
  adminUser,
}) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const paymentAmount = Number(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new Error('مبلغ السداد يجب أن يكون أكبر من صفر.');
  }

  const recordId = `${meetingId}_${memberId}`;
  const docRef = doc(db, ATTENDANCE_COLLECTION, recordId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('سجل الحضور غير موجود لتسجيل سداد الغرامة.');
  }

  const data = snap.data();
  const currentPaid = Number(data.fineAmountPaid || 0);
  const totalFine = Number(data.totalAssessedFine || 0);
  const remainingBeforePayment = Math.max(0, totalFine - currentPaid);

  if (remainingBeforePayment <= 0) {
    throw new Error('تم سداد كافة الغرامات المستحقة لهذا السجل بالكامل بالفعل.');
  }

  if (paymentAmount > remainingBeforePayment) {
    throw new Error(
      `مبلغ السداد (${paymentAmount} ج.م) يتجاوز المبلغ المتبقي المستحق (${remainingBeforePayment} ج.م).`
    );
  }

  const newTotalPaid = currentPaid + paymentAmount;
  const remaining = Math.max(0, totalFine - newTotalPaid);

  let fineStatus = FINE_STATUS.PARTIALLY_PAID;
  if (newTotalPaid >= totalFine) {
    fineStatus = FINE_STATUS.FULLY_PAID;
  }

  // Update attendance record fine balance
  await updateDoc(docRef, {
    fineAmountPaid: newTotalPaid,
    fineRemainingAmount: remaining,
    finePaymentStatus: fineStatus,
    lastFinePaymentDate: paymentDate || new Date().toISOString().split('T')[0],
    updatedAt: serverTimestamp(),
  });

  // Record individual fine payment subdocument for audit and category analytics
  const finePaymentDocId = `fine_${meetingId}_${memberId}_${Date.now()}`;
  const finePaymentRef = doc(db, FINES_COLLECTION, finePaymentDocId);
  await setDoc(finePaymentRef, {
    finePaymentId: finePaymentDocId,
    meetingId,
    memberId,
    memberName,
    fineType,
    amount: paymentAmount,
    paymentDate: paymentDate || new Date().toISOString().split('T')[0],
    paymentMethod,
    notes,
    createdBy: adminUser?.email || adminUser?.uid || 'admin',
    createdAt: serverTimestamp(),
  });

  // Synchronize with Central Financial Ledger (Only actual collected amount counts)
  await recordLedgerTransaction({
    transactionId: finePaymentDocId,
    date: paymentDate || new Date().toISOString().split('T')[0],
    type: TRANSACTION_TYPE.FINE_PAYMENT,
    direction: 'income',
    amount: paymentAmount,
    description: `تحصيل ${fineType} من العضو: ${memberName}`,
    relatedPerson: memberName,
    sourceRecordId: finePaymentDocId,
    sourceCollection: FINES_COLLECTION,
    user: adminUser,
  });

  await logAuditEvent({
    action: 'COLLECT_FINE',
    description: `تحصيل غرامة بقيمة ${paymentAmount} ج.م (${fineType}) من العضو ${memberName}`,
    targetId: finePaymentDocId,
    amount: paymentAmount,
    user: adminUser,
  });

  return { newTotalPaid, remaining, fineStatus };
}

/**
 * Waive fine according to committee administrative discretion
 */
export async function waiveFine({ meetingId, memberId, memberName, reason = '', adminUser }) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');
  const recordId = `${meetingId}_${memberId}`;
  const docRef = doc(db, ATTENDANCE_COLLECTION, recordId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('سجل الحضور غير موجود لإسقاط الغرامة.');

  const data = snap.data();
  const currentPaid = Number(data.fineAmountPaid || 0);

  await updateDoc(docRef, {
    totalAssessedFine: currentPaid,
    fineRemainingAmount: 0,
    finePaymentStatus: FINE_STATUS.WAIVED,
    waivedReason: reason,
    waivedBy: adminUser?.email || adminUser?.uid || 'admin',
    waivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    action: 'WAIVE_FINE',
    description: `إعفاء العضو ${memberName} من باقي الغرامات المستحقة. السبب: ${reason || 'إعفاء بقرار إداري'}`,
    targetId: recordId,
    user: adminUser,
  });

  return { success: true };
}
