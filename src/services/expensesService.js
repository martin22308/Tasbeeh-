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

const COLLECTION_NAME = 'expenses';

export function subscribeExpenses(callback, onError) {
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
      console.error('Expenses subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function getExpenses() {
  if (!db) return [];
  const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addExpense(data, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('مبلغ المصروف يجب أن يكون رقمًا أكبر من صفر.');
  }
  if (!data.description || !data.description.trim()) {
    throw new Error('وصف المصروف مطلوب.');
  }

  const payload = {
    description: data.description.trim(),
    category: data.category || 'نفقات إدارية',
    amount,
    recipient: data.recipient?.trim() || '',
    date: data.date || new Date().toISOString().split('T')[0],
    paymentMethod: data.paymentMethod || 'نقدي',
    notes: data.notes?.trim() || '',
    createdBy: adminUser?.email || adminUser?.uid || 'admin',
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);

  // Synchronize with Central Financial Ledger (Expense direction)
  await recordLedgerTransaction({
    date: payload.date,
    type: TRANSACTION_TYPE.EXPENSE,
    direction: 'expense',
    amount: payload.amount,
    description: `مصروف: ${payload.description} (${payload.category})`,
    relatedPerson: payload.recipient || 'غير محدد',
    sourceRecordId: docRef.id,
    sourceCollection: COLLECTION_NAME,
    user: adminUser,
  });

  await logAuditEvent({
    action: 'ADD_EXPENSE',
    description: `تسجيل مصروف بقيمة ${payload.amount} ج.م - ${payload.description}`,
    targetId: docRef.id,
    amount: payload.amount,
    user: adminUser,
  });

  return { id: docRef.id, ...payload };
}

export async function updateExpense(id, data, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('مبلغ المصروف يجب أن يكون رقمًا أكبر من صفر.');
  }
  if (!data.description || !data.description.trim()) {
    throw new Error('وصف المصروف مطلوب.');
  }

  const docRef = doc(db, COLLECTION_NAME, id);
  const payload = {
    description: data.description.trim(),
    category: data.category,
    amount,
    recipient: data.recipient?.trim() || '',
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
    type: TRANSACTION_TYPE.EXPENSE,
    direction: 'expense',
    amount: payload.amount,
    description: `تعديل مصروف: ${payload.description} (${payload.category})`,
    relatedPerson: payload.recipient || 'غير محدد',
    sourceRecordId: id,
    sourceCollection: COLLECTION_NAME,
    user: adminUser,
  });

  await logAuditEvent({
    action: 'UPDATE_EXPENSE',
    description: `تعديل مصروف ID: ${id} بقيمة ${payload.amount} ج.م`,
    targetId: id,
    amount: payload.amount,
    user: adminUser,
  });

  return { id, ...payload };
}

export async function deleteExpense(id, expense, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);

  // Remove from Financial Ledger
  await removeLedgerTransaction(COLLECTION_NAME, id);

  await logAuditEvent({
    action: 'DELETE_EXPENSE',
    description: `حذف مصروف بقيمة ${expense?.amount || 0} ج.م - ${expense?.description || id}`,
    targetId: id,
    amount: expense?.amount,
    user: adminUser,
  });
}
