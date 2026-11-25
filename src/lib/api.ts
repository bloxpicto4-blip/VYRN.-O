import {
  ContentItem,
  SectionConfig,
  UserProfile,
  UserRole,
  CommentItem,
  NotificationItem,
  PlatformSettings,
  PlatformAnalytics,
  GameCategory,
  LocalMigrationSnapshot,
} from '../types';
import {
  auth,
  isFirebaseAdminUser,
  uploadImageToImageKit,
  signInWithGoogle,
  signInWithFirebaseEmail,
  registerWithFirebaseEmail,
  resetFirebasePassword,
  updateFirebaseUserPassword,
} from './firebase';
import {
  resolveOrCreateUserProfile,
  updateMyProfileInFirestore,
  fetchAllUsersFromFirestore,
  updateUserRoleInFirestore,
  getSettingsFromFirestore,
  updateSettingsInFirestore,
  getCategoriesFromFirestore,
  createCategoryInFirestore,
  updateCategoryInFirestore,
  deleteCategoryInFirestoreStrict,
  getSectionsFromFirestore,
  createSectionInFirestore,
  updateSectionInFirestore,
  deleteSectionInFirestoreStrict,
  reorderSectionsInFirestore,
  getContentFromFirestore,
  getContentByIdFromFirestore,
  createContentInFirestore,
  updateContentInFirestore,
  deleteContentFromFirestoreStrict,
  trackLaunchInFirestore,
  getCommentsFromFirestore,
  postCommentInFirestore,
  deleteCommentInFirestore,
  reportCommentInFirestore,
  toggleLikeInFirestore,
  checkIsLikedInFirestore,
  getFavoritesFromFirestore,
  toggleFavoriteInFirestore,
  getNotificationsFromFirestore,
  markNotificationReadInFirestore,
  markAllNotificationsReadInFirestore,
  getModerationQueueFromFirestore,
  approveCommentInFirestore,
  getAnalyticsFromFirestore,
  migrateLocalSnapshotToFirestore,
  MigrationReport,
} from './firestoreService';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('vyrn_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // ======================= SETTINGS (Cloud Firestore) =======================
  async getSettings(): Promise<PlatformSettings> {
    return getSettingsFromFirestore();
  },

  async updateSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings> {
    return updateSettingsInFirestore(settings);
  },

  // ======================= AUTH (Firebase Authentication + Firestore) =======================
  async login(identifier: string, password: string): Promise<{ token: string; user: UserProfile }> {
    const cleanId = identifier.trim();
    if (cleanId.includes('@')) {
      const fbUser = await signInWithFirebaseEmail(cleanId, password);
      const user = await resolveOrCreateUserProfile(fbUser);
      const idToken = await fbUser.getIdToken();
      let backendToken = '';
      try {
        const res = await this.loginWithFirebase(idToken);
        backendToken = res.token;
      } catch {
        backendToken = '';
      }
      return { token: backendToken, user };
    }

    if (!import.meta.env.DEV) {
      throw new Error('يرجى تسجيل الدخول باستخدام البريد الإلكتروني المسجل في Firebase أو عبر Google.');
    }

    // Legacy local username login bridge (development only)
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل تسجيل الدخول. استخدم البريد الإلكتروني عبر Firebase أو حساب Google.');
    }
    return res.json();
  },

  async loginWithGoogleAuth(): Promise<{ token: string; user: UserProfile }> {
    const fbUser = await signInWithGoogle();
    const user = await resolveOrCreateUserProfile(fbUser);
    const idToken = await fbUser.getIdToken();
    let backendToken = '';
    try {
      const res = await this.loginWithFirebase(idToken);
      backendToken = res.token;
    } catch {
      backendToken = '';
    }
    return { token: backendToken, user };
  },

  async loginWithFirebase(idToken: string): Promise<{ token: string; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/auth/firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل ربط الجلسة مع الخادم.');
    }
    return res.json();
  },

  async register(data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }): Promise<{ token: string; user: UserProfile }> {
    const fbUser = await registerWithFirebaseEmail(
      data.email,
      data.password,
      data.displayName || data.username
    );
    const user = await resolveOrCreateUserProfile(fbUser);
    const idToken = await fbUser.getIdToken();
    let backendToken = '';
    try {
      const res = await this.loginWithFirebase(idToken);
      backendToken = res.token;
    } catch {
      backendToken = '';
    }
    return { token: backendToken, user };
  },

  async resetPassword(email: string): Promise<void> {
    await resetFirebasePassword(email);
  },

  async getMe(): Promise<UserProfile> {
    if (auth.currentUser) {
      return resolveOrCreateUserProfile(auth.currentUser);
    }
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Session invalid');
    return res.json();
  },

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string; user: UserProfile }> {
    if (auth.currentUser && auth.currentUser.providerData?.some((p) => p.providerId === 'password')) {
      await updateFirebaseUserPassword(currentPassword, newPassword);
      const user = await resolveOrCreateUserProfile(auth.currentUser);
      return { message: 'تم تحديث كلمة المرور في Firebase Authentication بنجاح.', user };
    }
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل تحديث كلمة المرور.');
    }
    return res.json();
  },

  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    if (auth.currentUser) {
      return updateMyProfileInFirestore(data);
    }
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل تحديث الملف الشخصي.');
    }
    return res.json();
  },

  async getUsers(): Promise<UserProfile[]> {
    return fetchAllUsersFromFirestore();
  },

  async updateUserRole(id: string, role: string, isApproved?: boolean): Promise<UserProfile> {
    return updateUserRoleInFirestore(id, role as UserRole, isApproved);
  },

  // ======================= CONTENT (Cloud Firestore) =======================
  async getContent(params?: {
    type?: string;
    category?: string;
    search?: string;
    status?: string;
    sort?: string;
  }): Promise<ContentItem[]> {
    return getContentFromFirestore(params);
  },

  async getContentById(id: string): Promise<ContentItem> {
    return getContentByIdFromFirestore(id);
  },

  async createContent(data: Partial<ContentItem>): Promise<ContentItem> {
    return createContentInFirestore(data);
  },

  async updateContent(id: string, data: Partial<ContentItem>): Promise<ContentItem> {
    return updateContentInFirestore(id, data);
  },

  async deleteContent(id: string): Promise<void> {
    return deleteContentFromFirestoreStrict(id);
  },

  async trackLaunch(id: string): Promise<number> {
    return trackLaunchInFirestore(id);
  },

  // ======================= DYNAMIC SECTIONS (Cloud Firestore) =======================
  async getSections(): Promise<SectionConfig[]> {
    return getSectionsFromFirestore();
  },

  async createSection(data: Partial<SectionConfig>): Promise<SectionConfig> {
    return createSectionInFirestore(data);
  },

  async updateSection(id: string, data: Partial<SectionConfig>): Promise<SectionConfig> {
    return updateSectionInFirestore(id, data);
  },

  async deleteSection(id: string): Promise<void> {
    return deleteSectionInFirestoreStrict(id);
  },

  async reorderSections(order: { id: string; sortOrder: number }[]): Promise<SectionConfig[]> {
    return reorderSectionsInFirestore(order);
  },

  // ======================= INTERACTIONS (Cloud Firestore) =======================
  async getComments(contentId: string): Promise<CommentItem[]> {
    return getCommentsFromFirestore(contentId);
  },

  async postComment(data: { contentId: string; content: string; parentId?: string }): Promise<CommentItem> {
    return postCommentInFirestore(data);
  },

  async deleteComment(id: string): Promise<void> {
    return deleteCommentInFirestore(id);
  },

  async reportComment(id: string, reason: string): Promise<void> {
    return reportCommentInFirestore(id, reason);
  },

  async toggleLike(contentId: string): Promise<{ liked: boolean; count: number }> {
    return toggleLikeInFirestore(contentId);
  },

  async checkIsLiked(contentId: string): Promise<boolean> {
    return checkIsLikedInFirestore(contentId);
  },

  // ======================= FAVORITES (Cloud Firestore) =======================
  async getFavorites(): Promise<ContentItem[]> {
    return getFavoritesFromFirestore();
  },

  async toggleFavorite(contentId: string): Promise<{ isFavorite: boolean }> {
    return toggleFavoriteInFirestore(contentId);
  },

  // ======================= NOTIFICATIONS (Cloud Firestore) =======================
  async getNotifications(): Promise<NotificationItem[]> {
    return getNotificationsFromFirestore();
  },

  async markNotificationRead(id: string): Promise<void> {
    return markNotificationReadInFirestore(id);
  },

  async markAllNotificationsRead(): Promise<void> {
    return markAllNotificationsReadInFirestore();
  },

  // ======================= MODERATION & ANALYTICS (Cloud Firestore) =======================
  async getModerationQueue(): Promise<CommentItem[]> {
    return getModerationQueueFromFirestore();
  },

  async approveComment(id: string): Promise<void> {
    return approveCommentInFirestore(id);
  },

  async getAnalytics(): Promise<PlatformAnalytics> {
    return getAnalyticsFromFirestore();
  },

  // ======================= CATEGORIES (Cloud Firestore) =======================
  async getCategories(type?: string): Promise<GameCategory[]> {
    return getCategoriesFromFirestore(type);
  },

  async createCategory(data: {
    name: string;
    type?: 'game' | 'app' | 'project' | 'book' | 'podcast';
    description?: string;
  }): Promise<GameCategory> {
    return createCategoryInFirestore(data);
  },

  async updateCategory(id: string, data: { name?: string; description?: string }): Promise<GameCategory> {
    return updateCategoryInFirestore(id, data);
  },

  async deleteCategory(id: string): Promise<void> {
    return deleteCategoryInFirestoreStrict(id);
  },

  // ======================= FILE UPLOAD & SAFE LOCAL MIGRATION =======================
  async uploadFile(
    dataUrlOrFile: string | File,
    filename?: string,
    folder: 'covers' | 'gallery' = 'covers'
  ): Promise<{ url: string }> {
    if (isFirebaseAdminUser()) {
      const uploaded = await uploadImageToImageKit(dataUrlOrFile, folder, filename);
      return { url: uploaded.url };
    }

    if (!import.meta.env.DEV) {
      throw new Error('يجب تسجيل الدخول بحساب الإدارة المعتمد في Google / Firebase لرفع الصور.');
    }

    if (typeof dataUrlOrFile !== 'string') {
      throw new Error('في وضع التطوير المحلي يلزم تمرير Data URL.');
    }

    const headers = getAuthHeader();
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ dataUrl: dataUrlOrFile, filename }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل رفع الملف');
    }
    return res.json();
  },

  async getLocalMigrationSnapshot(): Promise<LocalMigrationSnapshot> {
    let headers = getAuthHeader();
    if (!headers.Authorization && auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken();
      const session = await this.loginWithFirebase(idToken);
      if (session.token) {
        localStorage.setItem('vyrn_token', session.token);
        headers = { Authorization: `Bearer ${session.token}` };
      }
    }
    const res = await fetch(`${API_BASE}/migration/export`, {
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'تعذر قراءة بيانات النسخة المحلية للترحيل.');
    }
    return res.json();
  },

  async migrateLocalToFirestore(): Promise<MigrationReport> {
    const snapshot = await this.getLocalMigrationSnapshot();
    return migrateLocalSnapshotToFirestore(snapshot);
  },
};
