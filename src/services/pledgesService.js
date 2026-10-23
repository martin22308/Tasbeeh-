import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { PLEDGE_STATUS, TRANSACTION_TYPE } from '../constants';
import { recordLedgerTransaction } from './financialLedgerService';
import { logAuditEvent } from './auditService';

const OBLIGATIONS_COLLECTION = 'pledgeObligations';
const PAYMENTS_COLLECTION = 'pledgePayments';

/**
 * Deterministic obligation ID: `pledge_{memberId}_{year}_{month}`
 */
export function getObligationId(memberId, year, month) {
  return `pledge_${memberId}_${year}_${month}`;
}

/**
 * Check if a member joined on or before a given year and month
 */
export function isMemberApplicableForMonth(memberStartDate, year, month) {
  if (!memberStartDate) return true;
  const start = new Date(memberStartDate);
  if (isNaN(start.getTime())) return true;

  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1; // 1-12

  if (startYear < year) return true;
  if (startYear === year && startMonth <= month) return true;
  return false;
}

/**
 * Generate monthly obligations for active members for a given year and month
 */
export async function generateMonthlyObligations(members, year, month, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const created = [];
  const skipped = [];

  for (const member of members) {
    // Only active members (or members who were active then)
    if (member.status === 'مؤرشف') continue;

    // Do not generate if before membership start date
    if (!isMemberApplicableForMonth(member.startDate, year, month)) {
      skipped.push({ member, reason: 'تاريخ بدء العضوية لاحق لهذا الشهر' });
      continue;
    }

    const obligationId = getObligationId(member.id, year, month);
    const docRef = doc(db, OBLIGATIONS_COLLECTION, obligationId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      // Never overwrite or duplicate existing obligations
      skipped.push({ member, reason: 'موجود مسبقًا' });
      continue;
    }

    const expectedAmount = Number(member.monthlyPledge || 0);

    const payload = {
      obligationId,
      memberId: member.id,
      memberName: member.fullName,
      memberPhone: member.phone || '',
      year: Number(year),
      month: Number(month),
      expectedAmount,
      totalPaid: 0,
      remainingAmount: expectedAmount,
      status: PLEDGE_STATUS.UNPAID,
      createdAt: serverTimestamp(),
      createdBy: adminUser?.email || adminUser?.uid || 'admin',
    };

    await setDoc(docRef, payload);
    created.push(payload);
  }

  await logAuditEvent({
    action: 'GENERATE_OBLIGATIONS',
    description: `توليد اشتراكات شهر ${month}/${year} لعدد ${created.length} عضو`,
    metadata: { year, month, count: created.length },
    user: adminUser,
  });

  return { created, skipped };
}

/**
 * Subscribe to obligations for a specific year and month (or all)
 */
export function subscribeObligations(callback, onError, year = null, month = null) {
  if (!db) {
    callback([]);
    return () => {};
  }

  let q = collection(db, OBLIGATIONS_COLLECTION);
  const constraints = [];

  if (year) {
    constraints.push(where('year', '==', Number(year)));
  }
  if (month) {
    constraints.push(where('month', '==', Number(month)));
  }

  const queryRef = query(q, ...constraints);

  return onSnapshot(
    queryRef,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(items);
    },
    (err) => {
      console.error('Obligations subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Record a pledge payment (supports partial payments)
 */
export async function recordPledgePayment({
  memberId,
  memberName,
  year,
  month,
  amount,
  paymentDate,
  paymentMethod = 'نقدي',
  notes = '',
  adminUser,
}) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const paymentAmount = Number(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new Error('قيمة الدفعة يجب أن تكون رقمًا صحيحًا وموجبًا.');
  }

  const obligationId = getObligationId(memberId, year, month);
  const obligationRef = doc(db, OBLIGATIONS_COLLECTION, obligationId);
  const obligationSnap = await getDoc(obligationRef);

  let currentPaid = 0;
  let expectedAmount = 0;

  if (obligationSnap.exists()) {
    const obData = obligationSnap.data();
    currentPaid = Number(obData.totalPaid || 0);
    expectedAmount = Number(obData.expectedAmount || 0);
  } else {
    // If obligation hasn't been pre-generated, create it on-the-fly
    expectedAmount = paymentAmount;
  }

  const newTotalPaid = currentPaid + paymentAmount;
  const remaining = Math.max(0, expectedAmount - newTotalPaid);

  let status = PLEDGE_STATUS.PARTIALLY_PAID;
  if (newTotalPaid >= expectedAmount) {
    status = PLEDGE_STATUS.FULLY_PAID;
  }

  // Update or set obligation
  await setDoc(
    obligationRef,
    {
      obligationId,
      memberId,
      memberName,
      year: Number(year),
      month: Number(month),
      expectedAmount,
      totalPaid: newTotalPaid,
      remainingAmount: remaining,
      status,
      lastPaymentDate: paymentDate || new Date().toISOString().split('T')[0],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Record payment in pledgePayments collection
  const paymentDocId = `payment_${obligationId}_${Date.now()}`;
  const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentDocId);

  const paymentPayload = {
    paymentId: paymentDocId,
    obligationId,
    memberId,
    memberName,
    year: Number(year),
    month: Number(month),
    amount: paymentAmount,
    paymentDate: paymentDate || new Date().toISOString().split('T')[0],
    paymentMethod,
    notes: notes || '',
    createdBy: adminUser?.email || adminUser?.uid || 'admin',
    createdAt: serverTimestamp(),
  };

  await setDoc(paymentRef, paymentPayload);

  // Synchronize to Central Financial Ledger (Only actual collected payment counts)
  await recordLedgerTransaction({
    transactionId: paymentDocId,
    date: paymentPayload.paymentDate,
    type: TRANSACTION_TYPE.PLEDGE_PAYMENT,
    direction: 'income',
    amount: paymentAmount,
    description: `سداد اشتراك شهري (${month}/${year}) للعضو: ${memberName}`,
    relatedPerson: memberName,
    sourceRecordId: paymentDocId,
    sourceCollection: PAYMENTS_COLLECTION,
    user: adminUser,
  });

  await logAuditEvent({
    action: 'RECORD_PLEDGE_PAYMENT',
    description: `تسجيل سداد اشتراك بقيمة ${paymentAmount} ج.م للعضو ${memberName} عن شهر ${month}/${year}`,
    targetId: paymentDocId,
    amount: paymentAmount,
    user: adminUser,
  });

  return { newTotalPaid, remaining, status };
}

/**
 * Subscribe to all pledge payments
 */
export function subscribePledgePayments(callback, onError) {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, PAYMENTS_COLLECTION), orderBy('paymentDate', 'desc'));
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
      console.error('Pledge payments subscription error:', err);
      if (onError) onError(err);
    }
  );
}
