import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase/config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // Firebase not yet configured with environment variables
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setCurrentUser(user);
        try {
          // Check administrator role in administratorProfiles collection
          if (db) {
            const adminDocRef = doc(db, 'administratorProfiles', user.uid);
            const adminDoc = await getDoc(adminDocRef);

            if (
              adminDoc.exists() &&
              adminDoc.data().isActive === true &&
              (adminDoc.data().role === 'admin' || adminDoc.data().role === 'SUPER_ADMIN')
            ) {
              setAdminProfile(adminDoc.data());
              setIsAdmin(true);
            } else {
              // User is authenticated but not in admin allowlist
              setAdminProfile(null);
              setIsAdmin(false);
            }
          } else {
            setIsAdmin(true);
          }
        } catch (err) {
          console.error('Error fetching admin profile:', err);
          setIsAdmin(false);
        }
      } else {
        setCurrentUser(null);
        setAdminProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    setAuthError(null);
    if (!isFirebaseConfigured || !auth) {
      throw new Error('يرجى ضبط بيانات مشروع فايربيس في ملف .env.local أولاً.');
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Verify administrator permissions
      if (db) {
        const adminDocRef = doc(db, 'administratorProfiles', user.uid);
        const adminDoc = await getDoc(adminDocRef);

        if (
          !adminDoc.exists() ||
          adminDoc.data().isActive !== true ||
          (adminDoc.data().role !== 'admin' && adminDoc.data().role !== 'SUPER_ADMIN')
        ) {
          // Not authorized
          await signOut(auth);
          throw new Error('هذا الحساب غير مصرح له كمسؤول في لجنة فريق التسبيح.');
        }

        setAdminProfile(adminDoc.data());
        setIsAdmin(true);
      }
      return user;
    } catch (error) {
      let arabicMessage = 'حدث خطأ أثناء تسجيل الدخول.';
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password'
      ) {
        arabicMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (error.code === 'auth/invalid-email') {
        arabicMessage = 'صيغة البريد الإلكتروني غير صالحة.';
      } else if (error.code === 'auth/user-disabled') {
        arabicMessage = 'تم تعطيل هذا الحساب من قِبل إدارة النظام.';
      } else if (error.code === 'auth/too-many-requests') {
        arabicMessage = 'محاولات دخول كثيرة خاطئة. يرجى المحاولة بعد قليل.';
      } else if (error.message) {
        arabicMessage = error.message;
      }
      setAuthError(arabicMessage);
      throw new Error(arabicMessage);
    }
  };

  const logout = async () => {
    if (auth) {
      await signOut(auth);
    }
    setCurrentUser(null);
    setAdminProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        adminProfile,
        isAdmin,
        loading,
        authError,
        login,
        logout,
        isConfigured: isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
