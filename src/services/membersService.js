import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { MEMBER_STATUS } from '../constants';
import { logAuditEvent } from './auditService';

const COLLECTION_NAME = 'members';

/**
 * Subscribe to real-time updates for members
 */
export function subscribeMembers(callback, onError) {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, COLLECTION_NAME), orderBy('fullName', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const members = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(members);
    },
    (err) => {
      console.error('Members subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Get all members once
 */
export async function getMembers() {
  if (!db) return [];
  const q = query(collection(db, COLLECTION_NAME), orderBy('fullName', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Add a new member
 */
export async function addMember(memberData, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  // Validate
  if (!memberData.fullName || !memberData.fullName.trim()) {
    throw new Error('اسم العضو مطلوب ولا يمكن تركه فارغًا.');
  }
  if (!memberData.phone || !memberData.phone.trim()) {
    throw new Error('رقم الهاتف مطلوب.');
  }
  const monthlyPledge = Number(memberData.monthlyPledge);
  if (isNaN(monthlyPledge) || monthlyPledge < 0) {
    throw new Error('قيمة الاشتراك الشهري يجب أن تكون رقمًا صحيحًا وموجبًا.');
  }

  const payload = {
    fullName: memberData.fullName.trim(),
    phone: memberData.phone.trim(),
    monthlyPledge: monthlyPledge,
    startDate: memberData.startDate || new Date().toISOString().split('T')[0],
    status: memberData.status || MEMBER_STATUS.ACTIVE,
    notes: memberData.notes ? memberData.notes.trim() : '',
    createdAt: serverTimestamp(),
    createdBy: adminUser?.email || adminUser?.uid || 'admin',
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);

  await logAuditEvent({
    action: 'ADD_MEMBER',
    description: `إضافة العضو الجديد: ${payload.fullName} بقيمة اشتراك ${payload.monthlyPledge} ج.م`,
    targetId: docRef.id,
    user: adminUser,
  });

  return { id: docRef.id, ...payload };
}

/**
 * Update member details
 */
export async function updateMember(id, updateData, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const docRef = doc(db, COLLECTION_NAME, id);
  const payload = {
    ...updateData,
    updatedAt: serverTimestamp(),
    updatedBy: adminUser?.email || adminUser?.uid || 'admin',
  };

  if (payload.monthlyPledge !== undefined) {
    const pledge = Number(payload.monthlyPledge);
    if (isNaN(pledge) || pledge < 0) {
      throw new Error('قيمة الاشتراك الشهري غير صالحة.');
    }
    payload.monthlyPledge = pledge;
  }

  await updateDoc(docRef, payload);

  await logAuditEvent({
    action: 'UPDATE_MEMBER',
    description: `تعديل بيانات العضو ID: ${id}`,
    targetId: id,
    user: adminUser,
  });

  return { id, ...payload };
}

/**
 * Archive member (soft delete preserving all history)
 */
export async function archiveMember(id, memberName, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    status: MEMBER_STATUS.ARCHIVED,
    archivedAt: serverTimestamp(),
    archivedBy: adminUser?.email || adminUser?.uid || 'admin',
  });

  await logAuditEvent({
    action: 'ARCHIVE_MEMBER',
    description: `أرشفة العضو: ${memberName || id}`,
    targetId: id,
    user: adminUser,
  });
}

/**
 * Restore archived member
 */
export async function activateMember(id, memberName, adminUser) {
  if (!db) throw new Error('قاعدة بيانات فايربيس غير متصلة.');

  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    status: MEMBER_STATUS.ACTIVE,
    updatedAt: serverTimestamp(),
    updatedBy: adminUser?.email || adminUser?.uid || 'admin',
  });

  await logAuditEvent({
    action: 'ACTIVATE_MEMBER',
    description: `إلغاء أرشفة وتنشيط العضو: ${memberName || id}`,
    targetId: id,
    user: adminUser,
  });
}
