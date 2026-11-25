import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, UserStats } from '../types';
import { api } from '../lib/api';
import {
  auth,
  db,
  signOutFirebase,
  isFirebaseAdminUser,
  sanitizeDocId,
} from '../lib/firebase';
import {
  resolveOrCreateUserProfile,
  setOnlineStatusInFirestore,
  seedDefaultAchievementsIfEmpty,
} from '../lib/firestoreService';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  userStats: UserStats | null;
  isAuthReady: boolean;
  isFirebaseAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  register: (data: { username: string; email: string; password: string; displayName?: string }) => Promise<UserProfile>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshUser: () => Promise<void>;
  mustChangePassword: boolean;
  setMustChangePassword: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('vyrn_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);

  const refreshUser = async () => {
    if (auth.currentUser) {
      try {
        const profile = await resolveOrCreateUserProfile(auth.currentUser);
        setCurrentUser(profile);
        setMustChangePassword(Boolean(profile.mustChangePassword));
      } catch (e) {
        console.warn('Firestore profile refresh warning:', e);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const storedToken = localStorage.getItem('vyrn_token');
    if (!storedToken) {
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const user = await api.getMe();
      setCurrentUser(user);
      if (user.mustChangePassword) {
        setMustChangePassword(true);
      }
    } catch {
      localStorage.removeItem('vyrn_token');
      setToken(null);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let statsUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (statsUnsubscribe) {
        statsUnsubscribe();
        statsUnsubscribe = null;
      }

      if (fbUser) {
        try {
          const profile = await resolveOrCreateUserProfile(fbUser);
          setCurrentUser(profile);
          setMustChangePassword(Boolean(profile.mustChangePassword));

          if (isFirebaseAdminUser(fbUser)) {
            seedDefaultAchievementsIfEmpty().catch(() => {});
          }

          // Mint backend session token for file upload & read-only local migration inspection
          if (!localStorage.getItem('vyrn_token')) {
            try {
              const idToken = await fbUser.getIdToken();
              const res = await api.loginWithFirebase(idToken);
              if (res.token) {
                localStorage.setItem('vyrn_token', res.token);
                setToken(res.token);
              }
            } catch {
              // Backend bridge optional for pure Firestore operations
            }
          }

          // Subscribe to live player stats & achievements
          const uid = sanitizeDocId(fbUser.uid);
          statsUnsubscribe = onSnapshot(
            doc(db, 'userStats', uid),
            (snap) => {
              if (snap.exists()) {
                const raw = snap.data();
                setUserStats({
                  userId: String(raw.userId || uid),
                  displayName: String(raw.displayName || profile.displayName),
                  avatarUrl: String(raw.avatarUrl || ''),
                  points: Number(raw.points || 0),
                  xp: Number(raw.xp || 0),
                  level: Math.max(1, Number(raw.level || 1)),
                  gamesPlayed: Number(raw.gamesPlayed || 0),
                  winsCount: Number(raw.winsCount || 0),
                  unlockedAchievements: Array.isArray(raw.unlockedAchievements) ? raw.unlockedAchievements : [],
                  isOnline: Boolean(raw.isOnline),
                  currentRoomId: raw.currentRoomId ? String(raw.currentRoomId) : undefined,
                  lastSeenAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            },
            () => {}
          );
        } catch (err) {
          console.warn('Firebase auth state sync warning:', err);
        } finally {
          setIsLoading(false);
          setIsAuthReady(true);
        }
      } else {
        setUserStats(null);
        await refreshUser();
        setIsAuthReady(true);
      }
    });

    const handleBeforeUnload = () => {
      if (auth.currentUser) {
        setOnlineStatusInFirestore(false).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      if (statsUnsubscribe) statsUnsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const login = async (identifier: string, password: string): Promise<UserProfile> => {
    const res = await api.login(identifier, password);
    if (res.token) {
      localStorage.setItem('vyrn_token', res.token);
      setToken(res.token);
    }
    setCurrentUser(res.user);
    if (res.user.mustChangePassword) {
      setMustChangePassword(true);
    }
    return res.user;
  };

  const loginWithGoogle = async (): Promise<UserProfile> => {
    const res = await api.loginWithGoogleAuth();
    if (res.token) {
      localStorage.setItem('vyrn_token', res.token);
      setToken(res.token);
    }
    setCurrentUser(res.user);
    setFirebaseUser(auth.currentUser);
    return res.user;
  };

  const register = async (data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }): Promise<UserProfile> => {
    const res = await api.register(data);
    if (res.token) {
      localStorage.setItem('vyrn_token', res.token);
      setToken(res.token);
    }
    setCurrentUser(res.user);
    setFirebaseUser(auth.currentUser);
    return res.user;
  };

  const resetPassword = async (email: string) => {
    await api.resetPassword(email);
  };

  const logout = async () => {
    try {
      await setOnlineStatusInFirestore(false, '');
    } catch {
      // Ignore
    }
    localStorage.removeItem('vyrn_token');
    setToken(null);
    setCurrentUser(null);
    setFirebaseUser(null);
    setUserStats(null);
    setMustChangePassword(false);
    try {
      await signOutFirebase();
    } catch (err) {
      console.warn('Firebase signOut note:', err);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await api.changePassword(currentPassword, newPassword);
    setCurrentUser(res.user);
    setMustChangePassword(false);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    const updated = await api.updateProfile(data);
    setCurrentUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        userStats,
        isAuthReady,
        isFirebaseAuthenticated: Boolean(firebaseUser),
        token,
        isLoading,
        login,
        loginWithGoogle,
        register,
        resetPassword,
        logout,
        changePassword,
        updateProfile,
        refreshUser,
        mustChangePassword,
        setMustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
