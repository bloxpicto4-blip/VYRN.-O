import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile as updateFirebaseAuthProfile,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { ContentItem, GameCategory, PlatformSettings, SectionConfig, UserProfile } from '../types';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const BOOTSTRAPPED_ADMIN_EMAIL = 'bidamohammed412@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ConnectionCheckResult {
  connected: boolean;
  databaseId: string;
  projectId: string;
  latencyMs: number;
  error?: string;
}

export async function testConnection(): Promise<ConnectionCheckResult> {
  const startedAt = Date.now();
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return {
      connected: true,
      databaseId: firebaseConfig.firestoreDatabaseId,
      projectId: firebaseConfig.projectId,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return {
      connected: false,
      databaseId: firebaseConfig.firestoreDatabaseId,
      projectId: firebaseConfig.projectId,
      latencyMs: Date.now() - startedAt,
      error: message,
    };
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}

export function translateFirebaseAuthError(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل بعد في Firebase Console (Authentication -> Sign-in method -> Email/Password). يمكنك تسجيل الدخول الآن بحساب Google مباشرة.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مسجل بالفعل في Firebase Authentication.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة جداً؛ يجب أن تكون 6 أحرف على الأقل.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صالحة.';
    case 'auth/too-many-requests':
      return 'تم تجاوز عدد المحاولات المسموح به. يرجى الانتظار قليلاً ثم المحاولة مجدداً.';
    case 'auth/popup-closed-by-user':
      return 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
    default:
      return error?.message || 'تعذرت عملية المصادقة عبر Firebase.';
  }
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    throw new Error(translateFirebaseAuthError(err));
  }
}

export async function signInWithFirebaseEmail(email: string, password: string): Promise<FirebaseUser> {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    return result.user;
  } catch (err) {
    throw new Error(translateFirebaseAuthError(err));
  }
}

export async function registerWithFirebaseEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<FirebaseUser> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName?.trim()) {
      await updateFirebaseAuthProfile(result.user, { displayName: displayName.trim() }).catch(() => {});
    }
    await sendEmailVerification(result.user).catch(() => {});
    return result.user;
  } catch (err) {
    throw new Error(translateFirebaseAuthError(err));
  }
}

export async function resetFirebasePassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    throw new Error(translateFirebaseAuthError(err));
  }
}

export async function updateFirebaseUserPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('يجب تسجيل الدخول عبر Firebase لتحديث كلمة المرور.');
  }
  try {
    if (currentPassword) {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
    }
    await updatePassword(user, newPassword);
  } catch (err) {
    throw new Error(translateFirebaseAuthError(err));
  }
}

export async function signOutFirebase(): Promise<void> {
  if (auth.currentUser) {
    await signOut(auth);
  }
}

export function isFirebaseAdminUser(user: FirebaseUser | null = auth.currentUser): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  );
}

export function isFirebaseVerifiedUser(user: FirebaseUser | null = auth.currentUser): boolean {
  if (!user) return false;
  const hasPasswordProvider = user.providerData?.some((p) => p.providerId === 'password');
  return Boolean(user.emailVerified || hasPasswordProvider);
}

function clampStr(val: unknown, maxLen: number): string {
  return typeof val === 'string' ? val.trim().slice(0, maxLen) : '';
}

function clampList(val: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, maxItemLen));
}

export function sanitizeDocId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
}

export async function syncUserProfileToFirestore(
  firebaseUser: FirebaseUser,
  profile: UserProfile
): Promise<void> {
  if (!isFirebaseVerifiedUser(firebaseUser)) return;
  const uid = sanitizeDocId(firebaseUser.uid);
  const path = `users/${uid}`;
  const docRef = doc(db, 'users', uid);

  try {
    const existingSnap = await getDoc(docRef);
    const isAdmin = isFirebaseAdminUser(firebaseUser);
    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        id: uid,
        username: clampStr(profile.username || firebaseUser.email?.split('@')[0] || uid, 50),
        displayName: clampStr(profile.displayName || firebaseUser.displayName || 'مستخدم VYRN', 100),
        email: clampStr(firebaseUser.email || profile.email, 200),
        role: isAdmin ? 'admin' : 'member',
        isApproved: isAdmin,
        avatarUrl: clampStr(profile.avatarUrl || firebaseUser.photoURL || '', 1000),
        bio: clampStr(profile.bio || '', 1000),
        mustChangePassword: false,
        privacySettings: {
          showFavorites: profile.privacySettings?.showFavorites ?? true,
          showActivity: profile.privacySettings?.showActivity ?? true,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      await setDoc(
        docRef,
        {
          id: existingData.id || uid,
          username: existingData.username || clampStr(profile.username, 50),
          displayName: clampStr(profile.displayName || existingData.displayName, 100),
          email: existingData.email || clampStr(firebaseUser.email, 200),
          role: existingData.role || (isAdmin ? 'admin' : 'member'),
          isApproved: existingData.isApproved ?? isAdmin,
          avatarUrl: clampStr(profile.avatarUrl ?? existingData.avatarUrl ?? '', 1000),
          bio: clampStr(profile.bio ?? existingData.bio ?? '', 1000),
          privacySettings: {
            showFavorites:
              profile.privacySettings?.showFavorites ?? existingData.privacySettings?.showFavorites ?? true,
            showActivity:
              profile.privacySettings?.showActivity ?? existingData.privacySettings?.showActivity ?? true,
          },
          createdAt: existingData.createdAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncContentToFirestore(item: ContentItem): Promise<void> {
  if (!isFirebaseAdminUser()) return;
  const id = sanitizeDocId(item.id);
  const path = `content/${id}`;
  const docRef = doc(db, 'content', id);

  try {
    const existingSnap = await getDoc(docRef);
    const payload: Record<string, unknown> = {
      id,
      title: clampStr(item.title, 200) || 'Untitled',
      slug: clampStr(item.slug || id, 200),
      description: clampStr(item.description, 5000),
      summary: clampStr(item.summary, 500),
      type: item.type,
      category: clampStr(item.category, 100) || 'عام',
      coverImage: clampStr(item.coverImage, 2000),
      galleryImages: clampList(item.galleryImages, 20, 2000),
      bannerImage: clampStr(item.bannerImage || '', 2000),
      status: item.status || 'published',
      audience: item.audience || 'public',
      creator: clampStr(item.creator || '', 100),
      isFeatured: Boolean(item.isFeatured),
      isEditorsPick: Boolean(item.isEditorsPick),
      likesCount: Math.max(0, Number(item.likesCount) || 0),
      viewsCount: Math.max(0, Number(item.viewsCount) || 0),
      downloadsCount: Math.max(0, Number(item.downloadsCount) || 0),
      commentsEnabled: item.commentsEnabled !== false,
      tags: clampList(item.tags, 20, 50),
      createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (item.newBadge) payload.newBadge = item.newBadge;
    if (item.customFields) payload.customFields = item.customFields;
    if (item.gameConfig) payload.gameConfig = item.gameConfig;
    if (item.appConfig) payload.appConfig = item.appConfig;
    if (item.projectConfig) payload.projectConfig = item.projectConfig;
    if (item.bookConfig) payload.bookConfig = item.bookConfig;
    if (item.podcastConfig) payload.podcastConfig = item.podcastConfig;

    await setDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteContentFromFirestore(itemId: string): Promise<void> {
  if (!isFirebaseAdminUser()) return;
  const id = sanitizeDocId(itemId);
  const path = `content/${id}`;
  try {
    await deleteDoc(doc(db, 'content', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncCategoryToFirestore(category: GameCategory & { type?: string }): Promise<void> {
  if (!isFirebaseAdminUser()) return;
  const id = sanitizeDocId(category.id);
  const path = `categories/${id}`;
  try {
    await setDoc(doc(db, 'categories', id), {
      id,
      name: clampStr(category.name, 100),
      slug: clampStr(category.slug || id, 100),
      type: category.type || 'game',
      description: clampStr(category.description || '', 500),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCategoryFromFirestore(catId: string): Promise<void> {
  if (!isFirebaseAdminUser()) return;
  const id = sanitizeDocId(catId);
  const path = `categories/${id}`;
  try {
    await deleteDoc(doc(db, 'categories', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncSectionToFirestore(section: SectionConfig): Promise<void> {
  if (!isFirebaseAdminUser()) return;
  const id = sanitizeDocId(section.id);
  const path = `sections/${id}`;
  try {
    await setDoc(doc(db, 'sections', id), {
      id,
      name: clampStr(section.name, 100),
      slug: clampStr(section.slug || id, 100),
      description: clampStr(section.description || '', 500),
      icon: clampStr(section.icon || '', 100),
      coverImage: clampStr(section.coverImage || '', 2000),
      bannerImage: clampStr(section.bannerImage || '', 2000),
      accentColor: clampStr(section.accentColor || '#FF5A1F', 30),
      layoutType: section.layoutType || 'editorial',
      filterType: section.filterType || 'all',
      categoryTarget: clampStr(section.categoryTarget || '', 100),
      customItemIds: clampList(section.customItemIds, 50, 128),
      sortOrder: Number(section.sortOrder) || 1,
      isEnabled: section.isEnabled !== false,
      isDraft: Boolean(section.isDraft),
      audience: section.audience || 'public',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSectionFromFirestore(sectionId: string): Promise<void> {
  if (!isFirebaseAdminUser()) return;
  const id = sanitizeDocId(sectionId);
  const path = `sections/${id}`;
  try {
    await deleteDoc(doc(db, 'sections', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncSettingsToFirestore(settings: PlatformSettings): Promise<void> {
  if (!isFirebaseAdminUser()) return;
  const path = 'settings/global';
  try {
    await setDoc(doc(db, 'settings', 'global'), {
      brandName: clampStr(settings.brandName || 'VYRN', 60),
      brandTagline: clampStr(settings.brandTagline || '', 200),
      primaryAccent: clampStr(settings.primaryAccent || '#FF5A1F', 30),
      showIntroAnimation: Boolean(settings.showIntroAnimation),
      allowGuestInteractions: Boolean(settings.allowGuestInteractions),
      commentModerationRequired: Boolean(settings.commentModerationRequired),
      maintenanceMode: Boolean(settings.maintenanceMode),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchPublishedContentFromFirestore(): Promise<ContentItem[]> {
  const path = 'content';
  try {
    const q = query(
      collection(db, path),
      where('status', '==', 'published'),
      where('audience', '==', 'public')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ContentItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function uploadImageToImageKit(
  input: File | string,
  folder: 'covers' | 'gallery' = 'covers',
  filename?: string
): Promise<{ url: string; path: string }> {
  if (!isFirebaseAdminUser()) {
    throw new Error('صلاحيات الإدارة الموثقة عبر Google / Firebase مطلوبة لرفع الصور.');
  }

  let dataUrl: string;
  let resolvedFilename = filename || 'image';
  if (typeof input === 'string') {
    dataUrl = input;
  } else {
    const mime = (input.type || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES[mime]) {
      throw new Error('صيغة الصورة غير مدعومة. الصيغ المسموحة: PNG, JPG, WebP, GIF.');
    }
    if (input.size <= 0 || input.size > 5 * 1024 * 1024) {
      throw new Error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت.');
    }
    const bytes = new Uint8Array(await input.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    dataUrl = `data:${mime === 'image/jpg' ? 'image/jpeg' : mime};base64,${btoa(binary)}`;
    resolvedFilename = filename || input.name || 'image';
  }

  const token = localStorage.getItem('vyrn_token');
  if (!token) {
    throw new Error('انتهت جلسة الإدارة. سجّل الدخول مرة أخرى ثم أعد رفع الصورة.');
  }

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ dataUrl, filename: resolvedFilename, folder }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'فشل رفع الصورة إلى ImageKit.');
  }
  return { url: result.url, path: result.path || result.fileId || '' };
}

