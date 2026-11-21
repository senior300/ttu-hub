import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { api, extractErrorMessage } from '../services/api';
import type { UserProfile } from '../types';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  dbUser: UserProfile | null;
  canClaimSuperAdmin: boolean;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<UserProfile | null>(null);
  const [canClaimSuperAdmin, setCanClaimSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncProfile = useCallback(async (user: FirebaseUser | null) => {
    if (!user) {
      setDbUser(null);
      setCanClaimSuperAdmin(false);
      return;
    }
    try {
      const res = await api.get<{
        user: UserProfile;
        canClaimSuperAdmin: boolean;
      }>('/auth/profile');
      setDbUser(res.data.user);
      setCanClaimSuperAdmin(res.data.canClaimSuperAdmin);
      setAuthError(null);
    } catch (err) {
      setAuthError(extractErrorMessage(err, 'Failed to sync user profile.'));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      await syncProfile(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [syncProfile]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await syncProfile(cred.user);
    } catch (err) {
      setAuthError(extractErrorMessage(err, 'Google Sign-In did not complete.'));
    }
  }, [syncProfile]);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    setDbUser(null);
    setCanClaimSuperAdmin(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    await syncProfile(auth.currentUser);
  }, [syncProfile]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        canClaimSuperAdmin,
        loading,
        authError,
        signInWithGoogle,
        signOutUser,
        refreshProfile,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
