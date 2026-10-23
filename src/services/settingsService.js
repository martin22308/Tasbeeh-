import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { DEFAULT_SETTINGS } from '../constants';
import { logAuditEvent } from './auditService';
import { recordOpeningBalanceTransaction } from './financialLedgerService';

const SETTINGS_DOC_PATH = ['settings', 'general'];

/**
 * Get system settings with fallback to defaults
 */
export async function getSettings() {
  if (!db) return DEFAULT_SETTINGS;
  try {
    const docRef = doc(db, ...SETTINGS_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...DEFAULT_SETTINGS, ...snap.data() };
    }
    // Initialize if not present
    await setDoc(docRef, { ...DEFAULT_SETTINGS, createdAt: serverTimestamp() });
    return DEFAULT_SETTINGS;
  } catch (err) {
    console.error('Error fetching settings:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update system settings
 */
export async function updateSettings(newSettings, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const docRef = doc(db, ...SETTINGS_DOC_PATH);
  const oldSettingsSnap = await getDoc(docRef);
  const oldSettings = oldSettingsSnap.exists() ? oldSettingsSnap.data() : DEFAULT_SETTINGS;

  const payload = {
    ...oldSettings,
    ...newSettings,
    updatedAt: serverTimestamp(),
    updatedBy: adminUser?.email || adminUser?.uid || 'admin',
  };

  await setDoc(docRef, payload, { merge: true });

  // If opening balance changed, record a financial adjustment in ledger
  if (
    newSettings.openingBalance !== undefined &&
    Number(newSettings.openingBalance) !== Number(oldSettings.openingBalance || 0)
  ) {
    const diff = Number(newSettings.openingBalance) - Number(oldSettings.openingBalance || 0);
    await recordOpeningBalanceTransaction({
      newBalance: Number(newSettings.openingBalance),
      difference: diff,
      user: adminUser,
    });
  }

  await logAuditEvent({
    action: 'UPDATE_SETTINGS',
    description: 'تحديث إعدادات النظام وقواعد الغرامات والإعدادات المالية',
    user: adminUser,
  });

  return payload;
}
