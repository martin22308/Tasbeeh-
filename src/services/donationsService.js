import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { TRANSACTION_TYPE } from '../constants';
import { recordLedgerTransaction, removeLedgerTransaction } from './financialLedgerService';
import { logAuditEvent } from './auditService';

const COLLECTION_NAME = 'donations';

export function subscribeDonations(callback, onError) {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
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
      console.error('Donations subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function getDonations() {
  if (!db) return [];
  const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addDonation(data, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('مبلغ التبرع يجب أن يكون رقمًا أكبر من صفر.');
  }

  const donorName = data.donorName?.trim() || 'فاعل خير (مجهول)';

  const payload = {
    donorName,
    amount,
    date: data.date || new Date().toISOString().split('T')[0],
    paymentMethod: data.paymentMethod || 'نقدي',
    notes: data.notes?.trim() || '',
    createdBy: adminUser?.email || adminUser?.uid || 'admin',
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);

  // Synchronize to Financial Ledger
  await recordLedgerTransaction({
    date: payload.date,
    type: TRANSACTION_TYPE.DONATION,
    direction: 'income',
    amount: payload.amount,
    description: `تبرع وارد من: ${donorName}`,
    relatedPerson: donorName,
    sourceRecordId: docRef.id,
    sourceCollection: COLLECTION_NAME,
    user: adminUser,
  });

  await logAuditEvent({
    action: 'ADD_DONATION',
    description: `تسجيل تبرع بقيمة ${payload.amount} ج.م من ${donorName}`,
    targetId: docRef.id,
    amount: payload.amount,
    user: adminUser,
  });

  return { id: docRef.id, ...payload };
}

export async function updateDonation(id, data, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('مبلغ التبرع يجب أن يكون رقمًا أكبر من صفر.');
  }

  const donorName = data.donorName?.trim() || 'فاعل خير (مجهول)';
  const docRef = doc(db, COLLECTION_NAME, id);

  const payload = {
    donorName,
    amount,
    date: data.date,
    paymentMethod: data.paymentMethod,
    notes: data.notes?.trim() || '',
    updatedBy: adminUser?.email || adminUser?.uid || 'admin',
    updatedAt: serverTimestamp(),
  };

  await updateDoc(docRef, payload);

  // Update in Ledger
  await recordLedgerTransaction({
    date: payload.date,
    type: TRANSACTION_TYPE.DONATION,
    direction: 'income',
    amount: payload.amount,
    description: `تعديل تبرع وارد من: ${donorName}`,
    relatedPerson: donorName,
    sourceRecordId: id,
    sourceCollection: COLLECTION_NAME,
    user: adminUser,
  });

  await logAuditEvent({
    action: 'UPDATE_DONATION',
    description: `تعديل بيانات تبرع ID: ${id} بقيمة ${payload.amount} ج.م`,
    targetId: id,
    amount: payload.amount,
    user: adminUser,
  });

  return { id, ...payload };
}

export async function deleteDonation(id, donation, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);

  // Remove from Financial Ledger
  await removeLedgerTransaction(COLLECTION_NAME, id);

  await logAuditEvent({
    action: 'DELETE_DONATION',
    description: `حذف تبرع بقيمة ${donation?.amount || 0} ج.م للمتبرع: ${donation?.donorName || id}`,
    targetId: id,
    amount: donation?.amount,
    user: adminUser,
  });
}
