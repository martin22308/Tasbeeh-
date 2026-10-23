import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'auditLogs';

/**
 * Log an administrative or financial audit action
 */
export async function logAuditEvent({ action, description, targetId = '', amount = null, user = null, metadata = {} }) {
  if (!db) return;
  try {
    const payload = {
      action,
      description,
      targetId: String(targetId),
      amount: amount !== null ? Number(amount) : null,
      performedBy: user?.email || user?.uid || 'نظام / مسؤول غير معروف',
      userUid: user?.uid || '',
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      metadata,
    };
    await addDoc(collection(db, COLLECTION_NAME), payload);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}
