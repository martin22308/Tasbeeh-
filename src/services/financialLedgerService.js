import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { TRANSACTION_TYPE } from '../constants';

const COLLECTION_NAME = 'financialTransactions';

/**
 * Record a transaction into the central ledger idempotently
 */
export async function recordLedgerTransaction({
  transactionId, // deterministic ID based on source record
  date,
  type,
  direction, // 'income' | 'expense'
  amount,
  description,
  relatedPerson = '',
  sourceRecordId,
  sourceCollection,
  user,
}) {
  if (!db) return;

  const docId = transactionId || `${sourceCollection}_${sourceRecordId}`;
  const docRef = doc(db, COLLECTION_NAME, docId);

  const payload = {
    transactionId: docId,
    date: date || new Date().toISOString().split('T')[0],
    type,
    direction,
    amount: Math.abs(Number(amount || 0)),
    description: description || '',
    relatedPerson: relatedPerson || '',
    sourceRecordId: String(sourceRecordId || ''),
    sourceCollection: sourceCollection || '',
    createdBy: user?.email || user?.uid || 'admin',
    createdAt: serverTimestamp(),
  };

  await setDoc(docRef, payload, { merge: true });
  return payload;
}

/**
 * Remove a transaction from the ledger when its source record is deleted
 */
export async function removeLedgerTransaction(sourceCollection, sourceRecordId) {
  if (!db) return;
  const docId = `${sourceCollection}_${sourceRecordId}`;
  const docRef = doc(db, COLLECTION_NAME, docId);
  await deleteDoc(docRef);
}

/**
 * Record opening balance adjustment
 */
export async function recordOpeningBalanceTransaction({ newBalance, difference, user }) {
  if (!db) return;
  const docId = `opening_balance_${Date.now()}`;
  const docRef = doc(db, COLLECTION_NAME, docId);

  await setDoc(docRef, {
    transactionId: docId,
    date: new Date().toISOString().split('T')[0],
    type: TRANSACTION_TYPE.OPENING_BALANCE,
    direction: difference >= 0 ? 'income' : 'expense',
    amount: Math.abs(difference),
    description: `تعديل الرصيد الافتتاحي إلى ${newBalance} ج.م (فارق: ${difference} ج.م)`,
    relatedPerson: 'النظام / الخزينة',
    sourceRecordId: 'settings_general',
    sourceCollection: 'settings',
    createdBy: user?.email || user?.uid || 'admin',
    createdAt: serverTimestamp(),
  });
}

/**
 * Subscribe to real-time transactions
 */
export function subscribeLedger(callback, onError) {
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
      console.error('Ledger subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Get all ledger transactions once
 */
export async function getLedgerTransactions() {
  if (!db) return [];
  const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/**
 * Calculate totals and current balance from transactions & opening balance
 * Formula: Current Balance = Opening Balance + Collected Pledges + Received Donations + Collected Fines - Recorded Expenses
 */
export function calculateFinancialTotals(transactions = [], openingBalance = 0) {
  let totalPledges = 0;
  let totalDonations = 0;
  let totalFines = 0;
  let totalExpenses = 0;
  let balanceAdjustments = 0;

  for (const tx of transactions) {
    const amt = Number(tx.amount || 0);
    if (isNaN(amt)) continue;

    switch (tx.type) {
      case TRANSACTION_TYPE.PLEDGE_PAYMENT:
        totalPledges += amt;
        break;
      case TRANSACTION_TYPE.DONATION:
        totalDonations += amt;
        break;
      case TRANSACTION_TYPE.FINE_PAYMENT:
        totalFines += amt;
        break;
      case TRANSACTION_TYPE.EXPENSE:
        totalExpenses += amt;
        break;
      case TRANSACTION_TYPE.OPENING_BALANCE:
        if (tx.direction === 'income') {
          balanceAdjustments += amt;
        } else {
          balanceAdjustments -= amt;
        }
        break;
      default:
        if (tx.direction === 'income') {
          totalDonations += amt;
        } else if (tx.direction === 'expense') {
          totalExpenses += amt;
        }
        break;
    }
  }

  const currentBalance =
    Number(openingBalance || 0) +
    totalPledges +
    totalDonations +
    totalFines -
    totalExpenses +
    balanceAdjustments;

  return {
    openingBalance: Number(openingBalance || 0),
    totalPledges,
    totalDonations,
    totalFines,
    totalExpenses,
    totalIncome: totalPledges + totalDonations + totalFines,
    currentBalance,
  };
}
