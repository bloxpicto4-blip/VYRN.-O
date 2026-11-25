import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import {
  db,
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
  isFirebaseAdminUser,
  isFirebaseVerifiedUser,
  sanitizeDocId,
} from './firebase';
import {
  AchievementDefinition,
  CommentItem,
  ContentItem,
  ContentType,
  GameCategory,
  GameRoom,
  LocalMigrationSnapshot,
  NotificationItem,
  PlatformAnalytics,
  PlatformSettings,
  RoomMessage,
  RoomPlayer,
  SectionConfig,
  UserProfile,
  UserRole,
  UserStats,
} from '../types';

export const DEFAULT_SETTINGS: PlatformSettings = {
  brandName: 'VYRN',
  brandTagline: 'عالم تصنعه بنفسك.',
  primaryAccent: '#FF5A1F',
  showIntroAnimation: true,
  allowGuestInteractions: true,
  commentModerationRequired: false,
  maintenanceMode: false,
};

export const DEFAULT_CATEGORIES: (GameCategory & { type: ContentType })[] = [
  { id: 'cat_g1', type: 'game', name: 'ألعاب الأكشن والسرعة', slug: 'action-games', description: 'ألعاب قتالية وسريعة' },
  { id: 'cat_g2', type: 'game', name: 'المحاكاة والتجارب التفاعلية', slug: 'simulation-games', description: 'محاكيات واقعية وتجارب فيزيائية' },
  { id: 'cat_g3', type: 'game', name: 'الخيال العلمي والمستقبل', slug: 'scifi-games', description: 'عوالم مستقبلية وفضاء سيبراني' },
  { id: 'cat_g4', type: 'game', name: 'الألغاز والتحدي الذهني', slug: 'puzzle-games', description: 'تحديات ذكاء واستراتيجية' },
  { id: 'cat_g5', type: 'game', name: 'ألعاب متصفح خفيفة', slug: 'web-arcade', description: 'تشغيل مباشر وخفيف' },
];

export const DEFAULT_SECTIONS: SectionConfig[] = [
  {
    id: 'sec_games_01',
    slug: 'games',
    name: 'الألعاب',
    description: 'مساحة ألعابك وتجارب المحاكاة التفاعلية.',
    accentColor: '#FF5A1F',
    layoutType: 'bento',
    filterType: 'category',
    categoryTarget: 'game',
    sortOrder: 1,
    isEnabled: true,
    isDraft: false,
    audience: 'public',
  },
  {
    id: 'sec_apps_02',
    slug: 'apps',
    name: 'التطبيقات',
    description: 'الأدوات البرمجية والتطبيقات الرقمية المبتكرة.',
    accentColor: '#D7FF38',
    layoutType: 'carousel',
    filterType: 'category',
    categoryTarget: 'app',
    sortOrder: 2,
    isEnabled: true,
    isDraft: false,
    audience: 'public',
  },
  {
    id: 'sec_projects_03',
    slug: 'projects',
    name: 'المشاريع',
    description: 'المشاريع الهندسية والبرمجية مفتوحة المصدر.',
    accentColor: '#FF5A1F',
    layoutType: 'grid',
    filterType: 'category',
    categoryTarget: 'project',
    sortOrder: 3,
    isEnabled: true,
    isDraft: false,
    audience: 'public',
  },
  {
    id: 'sec_books_04',
    slug: 'books',
    name: 'الكتب والمنشورات',
    description: 'المنشورات المعمارية والأبحاث والمقالات التصميمية.',
    accentColor: '#F2EBDD',
    layoutType: 'grid',
    filterType: 'category',
    categoryTarget: 'book',
    sortOrder: 4,
    isEnabled: true,
    isDraft: false,
    audience: 'public',
  },
  {
    id: 'sec_podcasts_05',
    slug: 'podcasts',
    name: 'البودكاست',
    description: 'الحلقات الصوتية والتسجيلات الإبداعية الاستكشافية.',
    accentColor: '#D7FF38',
    layoutType: 'media_showcase',
    filterType: 'category',
    categoryTarget: 'podcast',
    sortOrder: 5,
    isEnabled: true,
    isDraft: false,
    audience: 'public',
  },
];

export const DEFAULT_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'ach_first_play',
    title: 'أول انطلاقة',
    description: 'شغّل أول لعبة أو تجربة تفاعلية على منصة VYRN.',
    icon: 'Play',
    pointsReward: 50,
    category: 'play',
    requirementType: 'games_played',
    requirementTarget: 1,
    isActive: true,
  },
  {
    id: 'ach_arcade_veteran',
    title: 'محترف الساحة',
    description: 'خُض 5 جلسات لعب عبر المنصة.',
    icon: 'Gamepad2',
    pointsReward: 150,
    category: 'play',
    requirementType: 'games_played',
    requirementTarget: 5,
    isActive: true,
  },
  {
    id: 'ach_first_win',
    title: 'بطل المواجهة',
    description: 'حقق أول فوز لك داخل غرف اللعب الجماعي.',
    icon: 'Trophy',
    pointsReward: 200,
    category: 'multiplayer',
    requirementType: 'wins_count',
    requirementTarget: 1,
    isActive: true,
  },
  {
    id: 'ach_collector',
    title: 'حافظ المفضلة',
    description: 'أضف أول عمل إبداعي إلى خزينة المفضلة.',
    icon: 'Heart',
    pointsReward: 40,
    category: 'collector',
    requirementType: 'favorites_count',
    requirementTarget: 1,
    isActive: true,
  },
  {
    id: 'ach_community_voice',
    title: 'صوت المجتمع',
    description: 'شارك بأول تعليق تقني أو مراجعة في المنصة.',
    icon: 'MessageSquare',
    pointsReward: 40,
    category: 'social',
    requirementType: 'comments_count',
    requirementTarget: 1,
    isActive: true,
  },
  {
    id: 'ach_points_500',
    title: 'نجم النخبة',
    description: 'اجمع 500 نقطة خبرة في رصيدك على VYRN.',
    icon: 'Sparkles',
    pointsReward: 250,
    category: 'multiplayer',
    requirementType: 'points_total',
    requirementTarget: 500,
    isActive: true,
  },
];

function tsToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const anyVal = val as { toDate?: () => Date; seconds?: number };
    if (typeof anyVal.toDate === 'function') {
      return anyVal.toDate().toISOString();
    }
    if (typeof anyVal.seconds === 'number') {
      return new Date(anyVal.seconds * 1000).toISOString();
    }
  }
  return new Date().toISOString();
}

function stripUndefined<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (input && typeof input === 'object') {
    // Preserve Firestore FieldValue sentinels (like serverTimestamp / increment)
    const proto = Object.getPrototypeOf(input);
    if (proto !== Object.prototype && proto !== null) {
      return input;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return input;
}

function makeSlug(text: string, fallback: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  return (s || fallback).slice(0, 180);
}

function mapContentDoc(raw: Record<string, unknown>, id: string): ContentItem {
  return {
    ...(raw as unknown as ContentItem),
    id: String(raw.id || id),
    title: String(raw.title || ''),
    slug: String(raw.slug || id),
    description: String(raw.description || ''),
    summary: String(raw.summary || ''),
    coverImage: String(raw.coverImage || ''),
    galleryImages: Array.isArray(raw.galleryImages) ? raw.galleryImages : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    likesCount: Number(raw.likesCount || 0),
    viewsCount: Number(raw.viewsCount || 0),
    downloadsCount: Number(raw.downloadsCount || 0),
    commentsEnabled: raw.commentsEnabled !== false,
    isFeatured: Boolean(raw.isFeatured),
    isEditorsPick: Boolean(raw.isEditorsPick),
    createdAt: tsToIso(raw.createdAt),
    updatedAt: tsToIso(raw.updatedAt),
  };
}

function mapUserDoc(raw: Record<string, unknown>, id: string): UserProfile {
  return {
    id: String(raw.id || id),
    username: String(raw.username || ''),
    displayName: String(raw.displayName || raw.username || 'مستخدم VYRN'),
    email: String(raw.email || ''),
    role: (raw.role as UserRole) || 'member',
    avatarUrl: String(raw.avatarUrl || ''),
    bio: String(raw.bio || ''),
    isApproved: Boolean(raw.isApproved),
    mustChangePassword: Boolean(raw.mustChangePassword),
    createdAt: tsToIso(raw.createdAt),
    privacySettings: {
      showFavorites: (raw.privacySettings as any)?.showFavorites ?? true,
      showActivity: (raw.privacySettings as any)?.showActivity ?? true,
    },
  };
}

function mapUserStatsDoc(raw: Record<string, unknown>, id: string): UserStats {
  return {
    userId: String(raw.userId || id),
    displayName: String(raw.displayName || 'لاعب VYRN'),
    avatarUrl: String(raw.avatarUrl || ''),
    points: Number(raw.points || 0),
    xp: Number(raw.xp || 0),
    level: Math.max(1, Number(raw.level || 1)),
    gamesPlayed: Number(raw.gamesPlayed || 0),
    winsCount: Number(raw.winsCount || 0),
    unlockedAchievements: Array.isArray(raw.unlockedAchievements) ? raw.unlockedAchievements : [],
    isOnline: Boolean(raw.isOnline),
    currentRoomId: raw.currentRoomId ? String(raw.currentRoomId) : undefined,
    lastSeenAt: tsToIso(raw.lastSeenAt),
    updatedAt: tsToIso(raw.updatedAt),
  };
}

function mapRoomDoc(raw: Record<string, unknown>, id: string): GameRoom {
  return {
    id: String(raw.id || id),
    code: String(raw.code || ''),
    title: String(raw.title || ''),
    gameId: raw.gameId ? String(raw.gameId) : undefined,
    gameTitle: String(raw.gameTitle || 'ساحة VYRN الجماعية'),
    hostId: String(raw.hostId || ''),
    hostName: String(raw.hostName || 'المضيف'),
    status: (raw.status as GameRoom['status']) || 'waiting',
    maxPlayers: Number(raw.maxPlayers || 4),
    isPrivate: Boolean(raw.isPrivate),
    playerCount: Number(raw.playerCount || 0),
    winnerId: raw.winnerId ? String(raw.winnerId) : undefined,
    createdAt: tsToIso(raw.createdAt),
    updatedAt: tsToIso(raw.updatedAt),
  };
}

// =========================================================================
// Auth & User Profile in Cloud Firestore
// =========================================================================
export async function resolveOrCreateUserProfile(fbUser: FirebaseUser): Promise<UserProfile> {
  const uid = sanitizeDocId(fbUser.uid);
  const userRef = doc(db, 'users', uid);
  const path = `users/${uid}`;

  try {
    const [userSnap, adminSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(doc(db, 'admins', uid)).catch(() => null),
    ]);

    const isBootstrappedAdmin =
      Boolean(fbUser.emailVerified) &&
      fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
    const isAdminRecord = Boolean(adminSnap?.exists());
    const effectiveAdmin = isBootstrappedAdmin || isAdminRecord;

    if (!userSnap.exists()) {
      const baseUsername = (fbUser.email?.split('@')[0] || `user_${uid.slice(0, 6)}`)
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .slice(0, 50);
      const displayName = (fbUser.displayName || baseUsername || 'عضو VYRN').slice(0, 100);

      const newDoc = stripUndefined({
        id: uid,
        username: baseUsername,
        displayName,
        email: (fbUser.email || '').toLowerCase().slice(0, 200),
        role: effectiveAdmin ? 'admin' : 'member',
        isApproved: effectiveAdmin,
        avatarUrl: (fbUser.photoURL || '').slice(0, 1000),
        bio: '',
        mustChangePassword: false,
        privacySettings: {
          showFavorites: true,
          showActivity: true,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (isFirebaseVerifiedUser(fbUser)) {
        await setDoc(userRef, newDoc);
      }

      await ensureUserStats(fbUser, displayName, fbUser.photoURL || '').catch(() => {});

      return {
        id: uid,
        username: baseUsername,
        displayName,
        email: (fbUser.email || '').toLowerCase(),
        role: effectiveAdmin ? 'admin' : 'member',
        avatarUrl: fbUser.photoURL || '',
        bio: '',
        isApproved: effectiveAdmin,
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
        privacySettings: { showFavorites: true, showActivity: true },
      };
    }

    const existing = mapUserDoc(userSnap.data(), uid);
    if (effectiveAdmin && existing.role !== 'admin') {
      existing.role = 'admin';
      existing.isApproved = true;
      if (isBootstrappedAdmin) {
        await updateDoc(userRef, {
          role: 'admin',
          isApproved: true,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    }

    await ensureUserStats(fbUser, existing.displayName, existing.avatarUrl || '').catch(() => {});
    return existing;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateMyProfileInFirestore(patch: Partial<UserProfile>): Promise<UserProfile> {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error('يجب تسجيل الدخول لتحديث الملف الشخصي.');
  const uid = sanitizeDocId(fbUser.uid);
  const userRef = doc(db, 'users', uid);

  try {
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (typeof patch.displayName === 'string' && patch.displayName.trim()) {
      updatePayload.displayName = patch.displayName.trim().slice(0, 100);
    }
    if (typeof patch.bio === 'string') {
      updatePayload.bio = patch.bio.trim().slice(0, 1000);
    }
    if (typeof patch.avatarUrl === 'string') {
      updatePayload.avatarUrl = patch.avatarUrl.trim().slice(0, 1000);
    }
    if (patch.privacySettings) {
      updatePayload.privacySettings = {
        showFavorites: Boolean(patch.privacySettings.showFavorites),
        showActivity: Boolean(patch.privacySettings.showActivity),
      };
    }

    await updateDoc(userRef, updatePayload);

    // Mirror display name / avatar to non-PII public userStats
    const statsRef = doc(db, 'userStats', uid);
    const statsPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updatePayload.displayName) statsPatch.displayName = updatePayload.displayName;
    if (updatePayload.avatarUrl !== undefined) statsPatch.avatarUrl = updatePayload.avatarUrl;
    await updateDoc(statsRef, statsPatch).catch(() => {});

    const updatedSnap = await getDoc(userRef);
    return mapUserDoc(updatedSnap.data() || {}, uid);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function fetchAllUsersFromFirestore(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => mapUserDoc(d.data(), d.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

export async function updateUserRoleInFirestore(
  userId: string,
  role: UserRole,
  isApproved?: boolean
): Promise<UserProfile> {
  const uid = sanitizeDocId(userId);
  const userRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود في Firestore.');
    const data = snap.data();

    await updateDoc(userRef, {
      role,
      isApproved: isApproved !== undefined ? isApproved : role === 'admin' || role === 'approved',
      updatedAt: serverTimestamp(),
    });

    // Keep /admins allowlist synced when token admin promotes/demotes
    if (isFirebaseAdminUser()) {
      const adminDocRef = doc(db, 'admins', uid);
      if (role === 'admin') {
        await setDoc(adminDocRef, {
          uid,
          email: String(data.email || ''),
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      } else if (String(data.email || '').toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
        await deleteDoc(adminDocRef).catch(() => {});
      }
    }

    const updated = await getDoc(userRef);
    return mapUserDoc(updated.data() || {}, uid);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

// =========================================================================
// Settings, Categories, Sections
// =========================================================================
export async function getSettingsFromFirestore(): Promise<PlatformSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'global'));
    if (!snap.exists()) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<PlatformSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettingsInFirestore(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  try {
    const current = await getSettingsFromFirestore();
    const merged: PlatformSettings = {
      brandName: String(patch.brandName ?? current.brandName).trim().slice(0, 60) || 'VYRN',
      brandTagline: String(patch.brandTagline ?? current.brandTagline).trim().slice(0, 200),
      primaryAccent: String(patch.primaryAccent ?? current.primaryAccent).trim().slice(0, 30) || '#FF5A1F',
      showIntroAnimation: patch.showIntroAnimation ?? current.showIntroAnimation,
      allowGuestInteractions: patch.allowGuestInteractions ?? current.allowGuestInteractions,
      commentModerationRequired: patch.commentModerationRequired ?? current.commentModerationRequired,
      maintenanceMode: patch.maintenanceMode ?? current.maintenanceMode,
    };
    await setDoc(doc(db, 'settings', 'global'), merged);
    return merged;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/global');
  }
}

export async function getCategoriesFromFirestore(type?: string): Promise<GameCategory[]> {
  try {
    const q = type
      ? query(collection(db, 'categories'), where('type', '==', type))
      : query(collection(db, 'categories'), where('type', 'in', ['game', 'app', 'project', 'book', 'podcast']));
    const snap = await getDocs(q);
    if (snap.empty && (!type || type === 'game')) {
      return DEFAULT_CATEGORIES;
    }
    return snap.docs.map((d) => d.data() as GameCategory);
  } catch (error) {
    console.warn('Firestore categories read warning:', error);
    return type && type !== 'game' ? [] : DEFAULT_CATEGORIES;
  }
}

export async function createCategoryInFirestore(data: {
  name: string;
  type?: ContentType;
  description?: string;
}): Promise<GameCategory> {
  const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const name = data.name.trim().slice(0, 100);
  const cat: GameCategory & { type: ContentType } = {
    id,
    name,
    slug: makeSlug(name, id).slice(0, 100),
    type: data.type || 'game',
    description: (data.description || '').trim().slice(0, 500),
  };
  try {
    await setDoc(doc(db, 'categories', id), cat);
    return cat;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `categories/${id}`);
  }
}

export async function updateCategoryInFirestore(
  id: string,
  data: { name?: string; description?: string }
): Promise<GameCategory> {
  const safeId = sanitizeDocId(id);
  const ref = doc(db, 'categories', safeId);
  try {
    const patch: Record<string, unknown> = {};
    if (data.name?.trim()) {
      patch.name = data.name.trim().slice(0, 100);
      patch.slug = makeSlug(data.name.trim(), safeId).slice(0, 100);
    }
    if (data.description !== undefined) {
      patch.description = data.description.trim().slice(0, 500);
    }
    await updateDoc(ref, patch);
    const updated = await getDoc(ref);
    return updated.data() as GameCategory;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `categories/${safeId}`);
  }
}

export async function deleteCategoryInFirestoreStrict(id: string): Promise<void> {
  const safeId = sanitizeDocId(id);
  try {
    await deleteDoc(doc(db, 'categories', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${safeId}`);
  }
}

export async function getSectionsFromFirestore(): Promise<SectionConfig[]> {
  try {
    let q;
    let isApprovedMember = false;
    if (isFirebaseAdminUser()) {
      q = collection(db, 'sections');
    } else if (auth.currentUser) {
      const userSnap = await getDoc(doc(db, 'users', sanitizeDocId(auth.currentUser.uid))).catch(() => null);
      isApprovedMember = Boolean(userSnap?.exists() && userSnap.data().isApproved === true);
      q = query(
        collection(db, 'sections'),
        where('isEnabled', '==', true),
        where('isDraft', '==', false)
      );
    } else {
      q = query(
        collection(db, 'sections'),
        where('isEnabled', '==', true),
        where('isDraft', '==', false),
        where('audience', '==', 'public')
      );
    }
    const snap = await getDocs(q);
    if (snap.empty) return DEFAULT_SECTIONS;
    return snap.docs
      .map((d) => d.data() as SectionConfig)
      .filter((sec) => {
        if (isFirebaseAdminUser()) return true;
        if (!sec.isEnabled || sec.isDraft) return false;
        if (!auth.currentUser) return sec.audience === 'public' || !sec.audience;
        if (sec.audience === 'approved') return isApprovedMember;
        return true;
      })
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  } catch (error) {
    console.warn('Firestore sections read warning:', error);
    return DEFAULT_SECTIONS;
  }
}

export async function createSectionInFirestore(data: Partial<SectionConfig>): Promise<SectionConfig> {
  const id = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const existing = await getSectionsFromFirestore().catch(() => []);
  const name = (data.name || 'قسم جديد').trim().slice(0, 100);
  const newSec: SectionConfig = {
    id,
    slug: makeSlug(data.slug || name, id).slice(0, 100),
    name,
    description: (data.description || '').trim().slice(0, 500),
    icon: (data.icon || '').slice(0, 100),
    coverImage: (data.coverImage || '').slice(0, 2000),
    bannerImage: (data.bannerImage || '').slice(0, 2000),
    accentColor: (data.accentColor || '#FF5A1F').slice(0, 30),
    layoutType: data.layoutType || 'editorial',
    filterType: data.filterType || 'all',
    categoryTarget: (data.categoryTarget || '').slice(0, 100),
    customItemIds: Array.isArray(data.customItemIds) ? data.customItemIds.slice(0, 50) : [],
    sortOrder: data.sortOrder ?? existing.length + 1,
    isEnabled: data.isEnabled !== false,
    isDraft: Boolean(data.isDraft),
    audience: data.audience || 'public',
  };
  try {
    await setDoc(doc(db, 'sections', id), stripUndefined(newSec));
    return newSec;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `sections/${id}`);
  }
}

export async function updateSectionInFirestore(
  id: string,
  data: Partial<SectionConfig>
): Promise<SectionConfig> {
  const safeId = sanitizeDocId(id);
  const ref = doc(db, 'sections', safeId);
  try {
    const { id: _ignoreId, ...rest } = data;
    await updateDoc(ref, stripUndefined(rest));
    const snap = await getDoc(ref);
    return snap.data() as SectionConfig;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sections/${safeId}`);
  }
}

export async function deleteSectionInFirestoreStrict(id: string): Promise<void> {
  const safeId = sanitizeDocId(id);
  try {
    await deleteDoc(doc(db, 'sections', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `sections/${safeId}`);
  }
}

export async function reorderSectionsInFirestore(
  order: { id: string; sortOrder: number }[]
): Promise<SectionConfig[]> {
  try {
    const batch = writeBatch(db);
    order.forEach(({ id, sortOrder }) => {
      batch.update(doc(db, 'sections', sanitizeDocId(id)), { sortOrder });
    });
    await batch.commit();
    return getSectionsFromFirestore();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'sections');
  }
}

// =========================================================================
// Content Catalog (Games, Apps, Projects, Books, Podcasts)
// =========================================================================
export async function getContentFromFirestore(params?: {
  type?: string;
  category?: string;
  search?: string;
  status?: string;
  sort?: string;
}): Promise<ContentItem[]> {
  try {
    let items: ContentItem[] = [];

    if (isFirebaseAdminUser()) {
      const snap = await getDocs(collection(db, 'content'));
      items = snap.docs.map((d) => mapContentDoc(d.data(), d.id));
    } else if (auth.currentUser) {
      const uid = sanitizeDocId(auth.currentUser.uid);
      const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
      const isApprovedMember = Boolean(userSnap?.exists() && userSnap.data().isApproved === true);

      const audienceQueries = [
        getDocs(
          query(
            collection(db, 'content'),
            where('status', '==', 'published'),
            where('audience', '==', 'public')
          )
        ),
        getDocs(
          query(
            collection(db, 'content'),
            where('status', '==', 'published'),
            where('audience', '==', 'members')
          )
        ),
      ];
      if (isApprovedMember) {
        audienceQueries.push(
          getDocs(
            query(
              collection(db, 'content'),
              where('status', '==', 'published'),
              where('audience', '==', 'approved')
            )
          )
        );
      }
      const snaps = await Promise.all(audienceQueries);
      const seen = new Set<string>();
      snaps.forEach((snap) => {
        snap.docs.forEach((d) => {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            items.push(mapContentDoc(d.data(), d.id));
          }
        });
      });
    } else {
      const pubSnap = await getDocs(
        query(
          collection(db, 'content'),
          where('status', '==', 'published'),
          where('audience', '==', 'public')
        )
      );
      items = pubSnap.docs.map((d) => mapContentDoc(d.data(), d.id));
    }

    if (params?.status && params.status !== 'all') {
      items = items.filter((i) => i.status === params.status);
    } else if (!params?.status && !isFirebaseAdminUser()) {
      items = items.filter((i) => i.status === 'published');
    }

    if (params?.type && params.type !== 'all') {
      items = items.filter((i) => i.type === params.type);
    }
    if (params?.category) {
      const catQ = params.category.toLowerCase();
      items = items.filter((i) => i.category.toLowerCase().includes(catQ));
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (params?.sort === 'popular') {
      items.sort((a, b) => (b.likesCount || 0) + (b.viewsCount || 0) - ((a.likesCount || 0) + (a.viewsCount || 0)));
    } else if (params?.sort === 'downloads') {
      items.sort((a, b) => (b.downloadsCount || 0) - (a.downloadsCount || 0));
    } else {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'content');
  }
}

export async function getContentByIdFromFirestore(idOrSlug: string): Promise<ContentItem> {
  const safeId = sanitizeDocId(idOrSlug);
  const ref = doc(db, 'content', safeId);
  try {
    let snap = await getDoc(ref);
    if (!snap.exists()) {
      const bySlug = await getDocs(
        query(
          collection(db, 'content'),
          where('status', '==', 'published'),
          where('audience', '==', 'public'),
          where('slug', '==', idOrSlug)
        )
      );
      if (bySlug.empty) {
        throw new Error('المحتوى المطلوب غير موجود.');
      }
      snap = bySlug.docs[0];
    }
    const rawData = snap.data();
    if (!rawData) {
      throw new Error('المحتوى المطلوب غير موجود.');
    }
    const item = mapContentDoc(rawData, snap.id);

    if (isFirebaseVerifiedUser() && item.status === 'published') {
      updateDoc(doc(db, 'content', snap.id), { viewsCount: increment(1) }).catch(() => {});
    }
    return item;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `content/${safeId}`);
  }
}

export async function createContentInFirestore(data: Partial<ContentItem>): Promise<ContentItem> {
  if (!isFirebaseAdminUser()) {
    throw new Error('يجب تسجيل الدخول بحساب الإدارة المعتمد في Firebase لإضافة أو نشر المحتوى.');
  }
  const type: ContentType = data.type || 'game';
  const id = `item_${type}_${Date.now()}`;
  const title = (data.title || 'بدون عنوان').trim().slice(0, 200);
  const slug = makeSlug(data.slug || title, id);

  const docPayload = stripUndefined({
    id,
    title,
    slug,
    description: (data.description || '').slice(0, 5000),
    summary: (data.summary || data.description?.slice(0, 120) || '').slice(0, 500),
    type,
    category: (data.category || 'عام').trim().slice(0, 100),
    coverImage: (data.coverImage || '').slice(0, 2000),
    galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages.slice(0, 20) : [],
    bannerImage: (data.bannerImage || '').slice(0, 2000),
    status: data.status || 'published',
    audience: data.audience || 'public',
    creator: (data.creator || auth.currentUser?.displayName || 'مدير VYRN').slice(0, 100),
    isFeatured: Boolean(data.isFeatured),
    isEditorsPick: Boolean(data.isEditorsPick),
    likesCount: 0,
    viewsCount: 0,
    downloadsCount: 0,
    commentsEnabled: data.commentsEnabled !== false,
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 20) : [],
    newBadge: data.newBadge || { enabled: false, label: 'جديد' },
    customFields: data.customFields,
    gameConfig: data.gameConfig,
    appConfig: data.appConfig,
    projectConfig: data.projectConfig,
    bookConfig: data.bookConfig,
    podcastConfig: data.podcastConfig,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await setDoc(doc(db, 'content', id), docPayload);

    if (docPayload.status === 'published') {
      const notifId = `notif_${Date.now()}`;
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: 'all',
        title: `إصدار جديد: ${title}`,
        message: `تمت إضافة "${title}" في قسم ${docPayload.category}.`,
        linkUrl: `#item/${id}`,
        type: 'release',
        isRead: false,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }

    const created = await getDoc(doc(db, 'content', id));
    return mapContentDoc(created.data() || {}, id);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `content/${id}`);
  }
}

export async function updateContentInFirestore(
  id: string,
  data: Partial<ContentItem>
): Promise<ContentItem> {
  if (!isFirebaseAdminUser()) {
    throw new Error('يجب تسجيل الدخول بحساب الإدارة المعتمد في Firebase لتعديل المحتوى.');
  }
  const safeId = sanitizeDocId(id);
  const ref = doc(db, 'content', safeId);
  try {
    const {
      id: _ignoreId,
      createdAt: _ignoreCreatedAt,
      updatedAt: _ignoreUpdatedAt,
      ...rest
    } = data;

    await updateDoc(
      ref,
      stripUndefined({
        ...rest,
        updatedAt: serverTimestamp(),
      })
    );
    const updated = await getDoc(ref);
    return mapContentDoc(updated.data() || {}, safeId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `content/${safeId}`);
  }
}

export async function deleteContentFromFirestoreStrict(id: string): Promise<void> {
  if (!isFirebaseAdminUser()) {
    throw new Error('صلاحيات الإدارة مطلوبة لحذف المحتوى.');
  }
  const safeId = sanitizeDocId(id);
  try {
    const [favSnap, likeSnap, cmtSnap] = await Promise.all([
      getDocs(query(collection(db, 'favorites'), where('contentId', '==', safeId))).catch(() => null),
      getDocs(query(collection(db, 'likes'), where('contentId', '==', safeId))).catch(() => null),
      getDocs(query(collection(db, 'comments'), where('contentId', '==', safeId))).catch(() => null),
    ]);

    const refs = [
      doc(db, 'content', safeId),
      ...(favSnap ? favSnap.docs.map((d) => d.ref) : []),
      ...(likeSnap ? likeSnap.docs.map((d) => d.ref) : []),
      ...(cmtSnap ? cmtSnap.docs.map((d) => d.ref) : []),
    ];

    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(db);
      refs.slice(i, i + 450).forEach((r) => batch.delete(r));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `content/${safeId}`);
  }
}

export async function trackLaunchInFirestore(id: string): Promise<number> {
  const safeId = sanitizeDocId(id);
  const ref = doc(db, 'content', safeId);
  try {
    if (isFirebaseVerifiedUser()) {
      const awarded = await claimRewardAtomically({ claimType: 'game_launch', targetId: safeId }).catch(() => false);
      if (awarded) {
        await updateDoc(ref, { downloadsCount: increment(1) }).catch(() => {});
      }
    }
    const snap = await getDoc(ref);
    return snap.exists() ? Number(snap.data().downloadsCount || 0) : 0;
  } catch {
    return 0;
  }
}

// =========================================================================
// Likes, Favorites, Comments, Notifications
// =========================================================================
export async function toggleLikeInFirestore(contentId: string): Promise<{ liked: boolean; count: number }> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) {
    throw new Error('يرجى تسجيل الدخول بحساب Firebase للإعجاب بالمحتوى.');
  }
  const uid = sanitizeDocId(fbUser.uid);
  const safeContentId = sanitizeDocId(contentId);
  const likeId = `${safeContentId}_${uid}`;
  const likeRef = doc(db, 'likes', likeId);
  const contentRef = doc(db, 'content', safeContentId);

  try {
    const [likeSnap, contentSnap] = await Promise.all([getDoc(likeRef), getDoc(contentRef)]);
    if (!contentSnap.exists()) throw new Error('المحتوى غير موجود.');

    const currentLikes = Number(contentSnap.data().likesCount || 0);
    const batch = writeBatch(db);

    if (likeSnap.exists()) {
      batch.delete(likeRef);
      batch.update(contentRef, { likesCount: Math.max(0, currentLikes - 1) });
      await batch.commit();
      return { liked: false, count: Math.max(0, currentLikes - 1) };
    } else {
      batch.set(likeRef, {
        id: likeId,
        userId: uid,
        contentId: safeContentId,
        createdAt: serverTimestamp(),
      });
      batch.update(contentRef, { likesCount: currentLikes + 1 });
      await batch.commit();
      return { liked: true, count: currentLikes + 1 };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `likes/${likeId}`);
  }
}

export async function checkIsLikedInFirestore(contentId: string): Promise<boolean> {
  const fbUser = auth.currentUser;
  if (!fbUser) return false;
  const uid = sanitizeDocId(fbUser.uid);
  const safeContentId = sanitizeDocId(contentId);
  try {
    const snap = await getDoc(doc(db, 'likes', `${safeContentId}_${uid}`));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function getFavoritesFromFirestore(): Promise<ContentItem[]> {
  const fbUser = auth.currentUser;
  if (!fbUser) return [];
  const uid = sanitizeDocId(fbUser.uid);
  try {
    const favSnap = await getDocs(query(collection(db, 'favorites'), where('userId', '==', uid)));
    const contentIds = favSnap.docs.map((d) => String(d.data().contentId));
    if (contentIds.length === 0) return [];
    const items = await Promise.all(
      contentIds.map(async (cid) => {
        const snap = await getDoc(doc(db, 'content', cid)).catch(() => null);
        return snap && snap.exists() ? mapContentDoc(snap.data(), snap.id) : null;
      })
    );
    return items.filter((item): item is ContentItem => item !== null);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'favorites');
  }
}

export async function toggleFavoriteInFirestore(contentId: string): Promise<{ isFavorite: boolean }> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) {
    throw new Error('يرجى تسجيل الدخول بحساب Firebase لحفظ المفضلة.');
  }
  const uid = sanitizeDocId(fbUser.uid);
  const safeContentId = sanitizeDocId(contentId);
  const favId = `${uid}_${safeContentId}`;
  const ref = doc(db, 'favorites', favId);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      return { isFavorite: false };
    } else {
      await setDoc(ref, {
        id: favId,
        userId: uid,
        contentId: safeContentId,
        createdAt: serverTimestamp(),
      });
      const favCountSnap = await getDocs(query(collection(db, 'favorites'), where('userId', '==', uid))).catch(() => null);
      const favCount = favCountSnap ? favCountSnap.size : 1;
      await evaluateAchievementsForMetric('favorites_count', favCount).catch(() => {});
      return { isFavorite: true };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `favorites/${favId}`);
  }
}

export async function getCommentsFromFirestore(contentId: string): Promise<CommentItem[]> {
  const safeContentId = sanitizeDocId(contentId);
  try {
    const mapC = (raw: Record<string, unknown>, id: string): CommentItem => ({
      ...(raw as unknown as CommentItem),
      id,
      createdAt: tsToIso(raw.createdAt),
    });

    if (isFirebaseAdminUser()) {
      const snap = await getDocs(query(collection(db, 'comments'), where('contentId', '==', safeContentId)));
      return snap.docs
        .map((d) => mapC(d.data(), d.id))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    const approvedSnap = await getDocs(
      query(
        collection(db, 'comments'),
        where('contentId', '==', safeContentId),
        where('isApproved', '==', true)
      )
    );
    const list = approvedSnap.docs.map((d) => mapC(d.data(), d.id));

    if (auth.currentUser) {
      const ownSnap = await getDocs(
        query(
          collection(db, 'comments'),
          where('contentId', '==', safeContentId),
          where('userId', '==', sanitizeDocId(auth.currentUser.uid))
        )
      );
      const seen = new Set(list.map((c) => c.id));
      ownSnap.docs.forEach((d) => {
        if (!seen.has(d.id)) {
          list.push(mapC(d.data(), d.id));
        }
      });
    }

    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'comments');
  }
}

export async function postCommentInFirestore(data: {
  contentId: string;
  content: string;
  parentId?: string;
}): Promise<CommentItem> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) {
    throw new Error('يرجى تسجيل الدخول بحساب Firebase للمشاركة في التعليقات.');
  }

  const uid = sanitizeDocId(fbUser.uid);
  const safeContentId = sanitizeDocId(data.contentId);
  const commentId = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  try {
    const [settings, userSnap, contentSnap] = await Promise.all([
      getSettingsFromFirestore(),
      getDoc(doc(db, 'users', uid)).catch(() => null),
      getDoc(doc(db, 'content', safeContentId)),
    ]);

    if (!contentSnap.exists() || contentSnap.data().commentsEnabled === false) {
      throw new Error('التعليقات معطلة لهذا المحتوى.');
    }

    const userData = userSnap?.exists() ? userSnap.data() : null;
    const displayName = String(userData?.displayName || fbUser.displayName || 'عضو VYRN').slice(0, 100);
    const username = String(userData?.username || fbUser.email?.split('@')[0] || 'member').slice(0, 50);
    const avatar = String(userData?.avatarUrl || fbUser.photoURL || '').slice(0, 1000);
    const isApproved = isFirebaseAdminUser(fbUser) || !settings.commentModerationRequired;

    const payload = stripUndefined({
      id: commentId,
      contentId: safeContentId,
      userId: uid,
      username,
      userDisplayName: displayName,
      userAvatar: avatar,
      content: data.content.trim().slice(0, 1500),
      parentId: data.parentId ? sanitizeDocId(data.parentId) : null,
      isApproved,
      isReported: false,
      likesCount: 0,
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'comments', commentId), payload);

    // Trigger reply notification if applicable
    if (data.parentId) {
      const parentSnap = await getDoc(doc(db, 'comments', sanitizeDocId(data.parentId))).catch(() => null);
      const parentUserId = parentSnap?.exists() ? String(parentSnap.data().userId) : '';
      if (parentUserId && parentUserId !== uid && parentUserId !== 'all') {
        const notifId = `notif_${Date.now()}`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: parentUserId,
          title: 'رد جديد على تعليقك',
          message: `قام ${displayName} بالرد على تعليقك في "${String(contentSnap.data().title || 'إصدار')}".`,
          linkUrl: `#item/${safeContentId}`,
          type: 'reply',
          isRead: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    }

    await claimRewardAtomically({ claimType: 'comment_post', targetId: commentId }).catch(() => false);
    const commentCountSnap = await getDocs(query(collection(db, 'comments'), where('userId', '==', uid))).catch(() => null);
    const commentCount = commentCountSnap ? commentCountSnap.size : 1;
    await evaluateAchievementsForMetric('comments_count', commentCount).catch(() => {});

    return {
      id: commentId,
      contentId: safeContentId,
      userId: uid,
      username,
      userDisplayName: displayName,
      userAvatar: avatar,
      content: payload.content,
      parentId: payload.parentId || undefined,
      isApproved,
      isReported: false,
      likesCount: 0,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `comments/${commentId}`);
  }
}

export async function deleteCommentInFirestore(id: string): Promise<void> {
  const safeId = sanitizeDocId(id);
  try {
    await deleteDoc(doc(db, 'comments', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `comments/${safeId}`);
  }
}

export async function reportCommentInFirestore(id: string, reason: string): Promise<void> {
  const safeId = sanitizeDocId(id);
  try {
    await updateDoc(doc(db, 'comments', safeId), {
      isReported: true,
      reportReason: (reason || 'تم الإبلاغ بواسطة مستخدم للمراجعة.').trim().slice(0, 500),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `comments/${safeId}`);
  }
}

export async function getModerationQueueFromFirestore(): Promise<CommentItem[]> {
  try {
    const [reportedSnap, pendingSnap] = await Promise.all([
      getDocs(query(collection(db, 'comments'), where('isReported', '==', true))),
      getDocs(query(collection(db, 'comments'), where('isApproved', '==', false))),
    ]);
    const seen = new Set<string>();
    const result: CommentItem[] = [];
    [...reportedSnap.docs, ...pendingSnap.docs].forEach((d) => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        const raw = d.data();
        result.push({
          ...(raw as unknown as CommentItem),
          id: d.id,
          createdAt: tsToIso(raw.createdAt),
        });
      }
    });
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'comments');
  }
}

export async function approveCommentInFirestore(id: string): Promise<void> {
  const safeId = sanitizeDocId(id);
  try {
    await updateDoc(doc(db, 'comments', safeId), {
      isApproved: true,
      isReported: false,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `comments/${safeId}`);
  }
}

export async function getNotificationsFromFirestore(): Promise<NotificationItem[]> {
  try {
    const mapN = (raw: Record<string, unknown>, id: string, readSet: Set<string>): NotificationItem => ({
      ...(raw as unknown as NotificationItem),
      id,
      isRead: Boolean(raw.isRead) || readSet.has(id),
      createdAt: tsToIso(raw.createdAt),
    });

    const fbUser = auth.currentUser;
    const uid = fbUser ? sanitizeDocId(fbUser.uid) : null;

    const [allSnap, userSnap, readsSnap] = await Promise.all([
      getDocs(query(collection(db, 'notifications'), where('userId', '==', 'all'))),
      uid
        ? getDocs(query(collection(db, 'notifications'), where('userId', '==', uid))).catch(() => null)
        : Promise.resolve(null),
      uid
        ? getDocs(query(collection(db, 'notificationReads'), where('userId', '==', uid))).catch(() => null)
        : Promise.resolve(null),
    ]);

    const readSet = new Set<string>();
    if (readsSnap) {
      readsSnap.docs.forEach((d) => {
        const nid = d.data().notificationId;
        if (typeof nid === 'string' && nid) readSet.add(nid);
      });
    }

    const seen = new Set<string>();
    const list: NotificationItem[] = [];
    [allSnap, userSnap].forEach((s) => {
      if (!s) return;
      s.docs.forEach((d) => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          list.push(mapN(d.data(), d.id, readSet));
        }
      });
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function markNotificationReadInFirestore(id: string): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) return;
  const uid = sanitizeDocId(fbUser.uid);
  const safeId = sanitizeDocId(id);
  try {
    const notifRef = doc(db, 'notifications', safeId);
    const notifSnap = await getDoc(notifRef);
    if (!notifSnap.exists()) return;
    const data = notifSnap.data();

    if (data.userId === 'all') {
      const readId = `${safeId}_${uid}`;
      const readRef = doc(db, 'notificationReads', readId);
      const readSnap = await getDoc(readRef);
      if (!readSnap.exists()) {
        await setDoc(readRef, {
          id: readId,
          userId: uid,
          notificationId: safeId,
          readAt: serverTimestamp(),
        });
      }
      return;
    }

    if (data.userId === uid || isFirebaseAdminUser(fbUser)) {
      if (!data.isRead) {
        await updateDoc(notifRef, { isRead: true });
      }
    }
  } catch {
    // Graceful no-op if notification was removed
  }
}

export async function markAllNotificationsReadInFirestore(): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) return;
  const uid = sanitizeDocId(fbUser.uid);
  try {
    const [personalSnap, allSnap, readsSnap] = await Promise.all([
      getDocs(query(collection(db, 'notifications'), where('userId', '==', uid))).catch(() => null),
      getDocs(query(collection(db, 'notifications'), where('userId', '==', 'all'))).catch(() => null),
      getDocs(query(collection(db, 'notificationReads'), where('userId', '==', uid))).catch(() => null),
    ]);

    const alreadyReadIds = new Set<string>();
    if (readsSnap) {
      readsSnap.docs.forEach((d) => {
        const nid = d.data().notificationId;
        if (typeof nid === 'string') alreadyReadIds.add(nid);
      });
    }

    const batch = writeBatch(db);
    let opsCount = 0;

    if (personalSnap) {
      personalSnap.docs.forEach((d) => {
        if (!d.data().isRead && opsCount < 450) {
          batch.update(d.ref, { isRead: true });
          opsCount++;
        }
      });
    }

    if (allSnap) {
      allSnap.docs.forEach((d) => {
        if (!alreadyReadIds.has(d.id) && opsCount < 450) {
          const readId = `${d.id}_${uid}`;
          batch.set(doc(db, 'notificationReads', readId), {
            id: readId,
            userId: uid,
            notificationId: d.id,
            readAt: serverTimestamp(),
          });
          opsCount++;
        }
      });
    }

    if (opsCount > 0) {
      await batch.commit();
    }
  } catch {
    // Graceful fallback
  }
}

export async function getAnalyticsFromFirestore(): Promise<PlatformAnalytics> {
  const [items, users, comments] = await Promise.all([
    getContentFromFirestore({ status: 'all' }).catch(() => []),
    isFirebaseAdminUser() ? fetchAllUsersFromFirestore().catch(() => []) : Promise.resolve([]),
    isFirebaseAdminUser()
      ? getDocs(collection(db, 'comments')).then((s) => s.docs).catch(() => [])
      : Promise.resolve([]),
  ]);

  const itemsByType: Record<ContentType, number> = {
    game: 0,
    app: 0,
    project: 0,
    book: 0,
    podcast: 0,
  };
  let totalLikes = 0;
  let totalViews = 0;
  let totalDownloads = 0;

  items.forEach((item) => {
    if (itemsByType[item.type] !== undefined) itemsByType[item.type]++;
    totalLikes += item.likesCount || 0;
    totalViews += item.viewsCount || 0;
    totalDownloads += item.downloadsCount || 0;
  });

  const pendingModerationCount = comments.filter((d) => d.data().isApproved === false).length;
  const reportedCommentsCount = comments.filter((d) => d.data().isReported === true).length;

  return {
    totalItems: items.length,
    itemsByType,
    totalUsers: Math.max(users.length, 1),
    totalComments: comments.length,
    totalLikes,
    totalViews,
    totalDownloads,
    pendingModerationCount,
    reportedCommentsCount,
  };
}

// =========================================================================
// Points, Levels, Achievements & Online Presence (/userStats & /achievements)
// =========================================================================
export async function ensureUserStats(
  fbUser: FirebaseUser,
  displayName?: string,
  avatarUrl?: string
): Promise<UserStats | null> {
  if (!isFirebaseVerifiedUser(fbUser)) return null;
  const uid = sanitizeDocId(fbUser.uid);
  const ref = doc(db, 'userStats', uid);

  try {
    const snap = await getDoc(ref);
    const resolvedName = (displayName || fbUser.displayName || fbUser.email?.split('@')[0] || 'لاعب VYRN').slice(0, 100);
    const resolvedAvatar = (avatarUrl ?? fbUser.photoURL ?? '').slice(0, 1000);

    if (!snap.exists()) {
      const initStats = stripUndefined({
        userId: uid,
        displayName: resolvedName,
        avatarUrl: resolvedAvatar,
        points: 0,
        xp: 0,
        level: 1,
        gamesPlayed: 0,
        winsCount: 0,
        unlockedAchievements: [],
        isOnline: true,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(ref, initStats);
      return {
        userId: uid,
        displayName: resolvedName,
        avatarUrl: resolvedAvatar,
        points: 0,
        xp: 0,
        level: 1,
        gamesPlayed: 0,
        winsCount: 0,
        unlockedAchievements: [],
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      await updateDoc(ref, {
        displayName: resolvedName,
        avatarUrl: resolvedAvatar,
        isOnline: true,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      return mapUserStatsDoc(snap.data(), uid);
    }
  } catch (error) {
    console.warn('ensureUserStats warning:', error);
    return null;
  }
}

export async function setOnlineStatusInFirestore(isOnline: boolean, currentRoomId?: string): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) return;
  const uid = sanitizeDocId(fbUser.uid);
  const ref = doc(db, 'userStats', uid);
  try {
    const patch: Record<string, unknown> = {
      isOnline,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (currentRoomId !== undefined) {
      patch.currentRoomId = currentRoomId;
    }
    await updateDoc(ref, patch);
  } catch {
    // Ignore presence update failure on unload
  }
}

export async function getAchievementsFromFirestore(): Promise<AchievementDefinition[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'achievements'), where('isActive', '==', true))
    );
    if (snap.empty) return DEFAULT_ACHIEVEMENTS;
    return snap.docs.map((d) => d.data() as AchievementDefinition);
  } catch {
    return DEFAULT_ACHIEVEMENTS;
  }
}

export async function seedDefaultAchievementsIfEmpty(): Promise<void> {
  if (!isFirebaseAdminUser()) return;
  try {
    const snap = await getDocs(
      query(collection(db, 'achievements'), where('isActive', 'in', [true, false]))
    );
    if (snap.empty) {
      const batch = writeBatch(db);
      DEFAULT_ACHIEVEMENTS.forEach((ach) => {
        batch.set(doc(db, 'achievements', ach.id), ach);
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Seed achievements note:', err);
  }
}

async function requestServerRewardCommit(params: {
  fbUser: FirebaseUser;
  claimType: 'game_launch' | 'comment_post' | 'match_finish' | 'achievement';
  targetId: string;
}): Promise<{
  alreadyClaimed: boolean;
  committed?: boolean;
  rateLimited?: boolean;
  insufficientPlayers?: boolean;
  claimId: string;
  pointsDelta: number;
  xpDelta: number;
  gamesPlayedDelta: number;
  winsDelta: number;
  serverReceipt?: string;
} | null> {
  try {
    const idToken = await params.fbUser.getIdToken();
    const res = await fetch('/api/rewards/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        claimType: params.claimType,
        targetId: params.targetId,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function confirmServerRewardReceipt(
  fbUser: FirebaseUser,
  claimId: string,
  serverReceipt: string
): Promise<void> {
  try {
    const idToken = await fbUser.getIdToken();
    await fetch('/api/rewards/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ claimId, serverReceipt }),
    });
  } catch {
    // Non-fatal: Firestore immutable claimId + v2 receipt already persisted atomically
  }
}

export async function claimRewardAtomically(params: {
  claimType: 'game_launch' | 'comment_post' | 'match_finish' | 'achievement';
  targetId: string;
}): Promise<boolean> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) return false;
  const uid = sanitizeDocId(fbUser.uid);
  const safeTargetId = sanitizeDocId(params.targetId);
  if (!safeTargetId) return false;

  // Ensure player stats document exists before server atomic commit
  const statsRef = doc(db, 'userStats', uid);
  const preSnap = await getDoc(statsRef).catch(() => null);
  if (!preSnap || !preSnap.exists()) {
    await ensureUserStats(fbUser);
  }

  // Execute authoritative validation, HMAC v2 minting, and atomic Firestore commit on server
  const serverResult = await requestServerRewardCommit({
    fbUser,
    claimType: params.claimType,
    targetId: safeTargetId,
  });

  if (!serverResult || serverResult.alreadyClaimed || serverResult.rateLimited || !serverResult.committed) {
    return false;
  }

  if (serverResult.serverReceipt) {
    await confirmServerRewardReceipt(fbUser, serverResult.claimId, serverResult.serverReceipt);
  }

  if (params.claimType !== 'achievement') {
    await evaluateStatsBasedAchievements(fbUser).catch(() => {});
  }

  return true;
}

async function evaluateStatsBasedAchievements(fbUser: FirebaseUser): Promise<void> {
  const uid = sanitizeDocId(fbUser.uid);
  const [snap, achievements] = await Promise.all([
    getDoc(doc(db, 'userStats', uid)),
    getAchievementsFromFirestore(),
  ]);
  if (!snap.exists()) return;
  const stats = mapUserStatsDoc(snap.data(), uid);
  const unlocked = new Set(stats.unlockedAchievements || []);

  for (const ach of achievements) {
    if (!ach.isActive || unlocked.has(ach.id)) continue;
    let reached = false;
    if (ach.requirementType === 'games_played' && stats.gamesPlayed >= ach.requirementTarget) reached = true;
    if (ach.requirementType === 'wins_count' && stats.winsCount >= ach.requirementTarget) reached = true;
    if (ach.requirementType === 'points_total' && stats.points >= ach.requirementTarget) reached = true;
    if (reached) {
      await claimRewardAtomically({ claimType: 'achievement', targetId: ach.id }).catch(() => false);
    }
  }
}

async function evaluateAchievementsForMetric(
  metric: AchievementDefinition['requirementType'],
  currentCount: number
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) return;
  const uid = sanitizeDocId(fbUser.uid);
  const achievements = await getAchievementsFromFirestore();
  const ref = doc(db, 'userStats', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const stats = mapUserStatsDoc(snap.data(), uid);
  const unlocked = new Set(stats.unlockedAchievements || []);

  for (const ach of achievements) {
    if (ach.isActive && ach.requirementType === metric && currentCount >= ach.requirementTarget && !unlocked.has(ach.id)) {
      await claimRewardAtomically({ claimType: 'achievement', targetId: ach.id }).catch(() => false);
    }
  }
}

export function subscribeOnlinePlayers(cb: (players: UserStats[]) => void): Unsubscribe {
  const q = query(collection(db, 'userStats'), where('isOnline', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => mapUserStatsDoc(d.data(), d.id));
      cb(list);
    },
    (err) => console.warn('subscribeOnlinePlayers warning:', err)
  );
}

export function subscribeLeaderboard(cb: (players: UserStats[]) => void): Unsubscribe {
  const q = query(collection(db, 'userStats'), where('isOnline', 'in', [true, false]));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapUserStatsDoc(d.data(), d.id))
        .sort((a, b) => b.points - a.points);
      cb(list);
    },
    (err) => console.warn('subscribeLeaderboard warning:', err)
  );
}

// =========================================================================
// Multiplayer Rooms, Players & Room Chat (/rooms/{roomId})
// =========================================================================
export function subscribeRooms(cb: (rooms: GameRoom[]) => void): Unsubscribe {
  const q = query(collection(db, 'rooms'), where('status', 'in', ['waiting', 'playing', 'finished']));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapRoomDoc(d.data(), d.id))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      cb(list);
    },
    (err) => console.warn('subscribeRooms warning:', err)
  );
}

export function subscribeRoomPlayers(roomId: string, cb: (players: RoomPlayer[]) => void): Unsubscribe {
  const safeId = sanitizeDocId(roomId);
  const q = query(collection(db, 'rooms', safeId, 'players'), where('roomId', '==', safeId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: String(raw.id || d.id),
          roomId: String(raw.roomId || safeId),
          displayName: String(raw.displayName || 'لاعب'),
          avatarUrl: String(raw.avatarUrl || ''),
          isReady: Boolean(raw.isReady),
          score: Number(raw.score || 0),
          joinedAt: tsToIso(raw.joinedAt),
          lastPingAt: tsToIso(raw.lastPingAt),
        } as RoomPlayer;
      });
      cb(list.sort((a, b) => b.score - a.score));
    },
    (err) => console.warn('subscribeRoomPlayers warning:', err)
  );
}

export function subscribeRoomMessages(roomId: string, cb: (msgs: RoomMessage[]) => void): Unsubscribe {
  const safeId = sanitizeDocId(roomId);
  const q = query(collection(db, 'rooms', safeId, 'messages'), where('roomId', '==', safeId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const raw = d.data();
          return {
            id: String(raw.id || d.id),
            roomId: String(raw.roomId || safeId),
            userId: String(raw.userId || ''),
            displayName: String(raw.displayName || 'لاعب'),
            content: String(raw.content || ''),
            createdAt: tsToIso(raw.createdAt),
          } as RoomMessage;
        })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      cb(list);
    },
    (err) => console.warn('subscribeRoomMessages warning:', err)
  );
}

export async function createRoomInFirestore(input: {
  title: string;
  gameId?: string;
  gameTitle: string;
  maxPlayers?: number;
  isPrivate?: boolean;
}): Promise<GameRoom> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) {
    throw new Error('يجب تسجيل الدخول بحساب Firebase لإنشاء غرفة لعب جماعية.');
  }
  const uid = sanitizeDocId(fbUser.uid);
  const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const maxPlayers = Math.min(16, Math.max(2, Number(input.maxPlayers || 4)));

  try {
    const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
    const hostName = String(
      (userSnap?.exists() ? userSnap.data().displayName : null) ||
        fbUser.displayName ||
        fbUser.email?.split('@')[0] ||
        'المضيف'
    ).slice(0, 100);
    const avatarUrl = String((userSnap?.exists() ? userSnap.data().avatarUrl : null) || fbUser.photoURL || '').slice(0, 1000);

    const batch = writeBatch(db);
    const roomPayload = stripUndefined({
      id: roomId,
      code,
      title: input.title.trim().slice(0, 120),
      gameId: input.gameId ? sanitizeDocId(input.gameId) : undefined,
      gameTitle: input.gameTitle.trim().slice(0, 160),
      hostId: uid,
      hostName,
      status: 'waiting' as const,
      maxPlayers,
      isPrivate: Boolean(input.isPrivate),
      playerCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'rooms', roomId), roomPayload);
    batch.set(doc(db, 'rooms', roomId, 'players', uid), {
      id: uid,
      roomId,
      displayName: hostName,
      avatarUrl,
      isReady: true,
      score: 0,
      joinedAt: serverTimestamp(),
      lastPingAt: serverTimestamp(),
    });
    await batch.commit();

    await setOnlineStatusInFirestore(true, roomId);
    const snap = await getDoc(doc(db, 'rooms', roomId));
    return mapRoomDoc(snap.data() || {}, roomId);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}`);
  }
}

export async function joinRoomInFirestore(roomId: string): Promise<GameRoom> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) {
    throw new Error('يجب تسجيل الدخول بحساب Firebase للانضمام إلى الغرفة.');
  }
  const uid = sanitizeDocId(fbUser.uid);
  const safeRoomId = sanitizeDocId(roomId);
  const roomRef = doc(db, 'rooms', safeRoomId);
  const playerRef = doc(db, 'rooms', safeRoomId, 'players', uid);

  try {
    const [roomSnap, playerSnap, userSnap] = await Promise.all([
      getDoc(roomRef),
      getDoc(playerRef),
      getDoc(doc(db, 'users', uid)).catch(() => null),
    ]);
    if (!roomSnap.exists()) throw new Error('الغرفة غير موجودة.');
    const room = mapRoomDoc(roomSnap.data(), safeRoomId);
    if (room.status === 'finished') throw new Error('هذه المواجهة قد انتهت بالفعل.');

    if (!playerSnap.exists()) {
      if (room.playerCount >= room.maxPlayers) {
        throw new Error('الغرفة ممتلئة باللاعبين حالياً.');
      }
      const displayName = String(
        (userSnap?.exists() ? userSnap.data().displayName : null) ||
          fbUser.displayName ||
          fbUser.email?.split('@')[0] ||
          'لاعب VYRN'
      ).slice(0, 100);
      const avatarUrl = String((userSnap?.exists() ? userSnap.data().avatarUrl : null) || fbUser.photoURL || '').slice(0, 1000);

      const batch = writeBatch(db);
      batch.set(playerRef, {
        id: uid,
        roomId: safeRoomId,
        displayName,
        avatarUrl,
        isReady: false,
        score: 0,
        joinedAt: serverTimestamp(),
        lastPingAt: serverTimestamp(),
      });
      batch.update(roomRef, {
        playerCount: Math.min(room.maxPlayers, room.playerCount + 1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    }

    await setOnlineStatusInFirestore(true, safeRoomId);
    const updated = await getDoc(roomRef);
    return mapRoomDoc(updated.data() || {}, safeRoomId);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${safeRoomId}/players/${uid}`);
  }
}

export async function leaveRoomInFirestore(roomId: string): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) return;
  const uid = sanitizeDocId(fbUser.uid);
  const safeRoomId = sanitizeDocId(roomId);
  const roomRef = doc(db, 'rooms', safeRoomId);
  const playerRef = doc(db, 'rooms', safeRoomId, 'players', uid);

  try {
    const [roomSnap, playerSnap] = await Promise.all([getDoc(roomRef), getDoc(playerRef)]);
    if (playerSnap.exists()) {
      const batch = writeBatch(db);
      batch.delete(playerRef);
      if (roomSnap.exists()) {
        const currentCount = Number(roomSnap.data().playerCount || 1);
        batch.update(roomRef, {
          playerCount: Math.max(0, currentCount - 1),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    await setOnlineStatusInFirestore(true, '');
  } catch (error) {
    console.warn('leaveRoomInFirestore warning:', error);
  }
}

export async function toggleRoomReadyInFirestore(roomId: string, isReady: boolean): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser) return;
  const uid = sanitizeDocId(fbUser.uid);
  const safeRoomId = sanitizeDocId(roomId);
  try {
    await updateDoc(doc(db, 'rooms', safeRoomId, 'players', uid), {
      isReady,
      lastPingAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${safeRoomId}/players/${uid}`);
  }
}

export async function startRoomMatchInFirestore(roomId: string): Promise<void> {
  const safeRoomId = sanitizeDocId(roomId);
  try {
    await updateDoc(doc(db, 'rooms', safeRoomId), {
      status: 'playing',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${safeRoomId}`);
  }
}

export async function updateMyRoomScoreInFirestore(roomId: string, newScore: number): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser) return;
  const uid = sanitizeDocId(fbUser.uid);
  const safeRoomId = sanitizeDocId(roomId);
  try {
    await updateDoc(doc(db, 'rooms', safeRoomId, 'players', uid), {
      score: Math.max(0, Math.min(1000000, Math.round(newScore))),
      lastPingAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${safeRoomId}/players/${uid}`);
  }
}

export async function claimMatchRewardForRoom(roomId: string): Promise<boolean> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) return false;
  const uid = sanitizeDocId(fbUser.uid);
  const safeRoomId = sanitizeDocId(roomId);
  try {
    const [roomSnap, playerSnap] = await Promise.all([
      getDoc(doc(db, 'rooms', safeRoomId)),
      getDoc(doc(db, 'rooms', safeRoomId, 'players', uid)),
    ]);
    if (!roomSnap.exists() || !playerSnap.exists()) return false;
    const roomData = roomSnap.data();
    if (roomData.status !== 'finished' || Number(roomData.playerCount || 0) < 2) return false;
    return await claimRewardAtomically({
      claimType: 'match_finish',
      targetId: safeRoomId,
    });
  } catch {
    return false;
  }
}

export async function finishRoomMatchInFirestore(roomId: string, winnerId?: string): Promise<void> {
  const safeRoomId = sanitizeDocId(roomId);
  try {
    await updateDoc(doc(db, 'rooms', safeRoomId), {
      status: 'finished',
      winnerId: winnerId ? sanitizeDocId(winnerId) : '',
      updatedAt: serverTimestamp(),
    });
    await claimMatchRewardForRoom(safeRoomId).catch(() => false);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${safeRoomId}`);
  }
}

export async function deleteRoomInFirestore(roomId: string): Promise<void> {
  const safeRoomId = sanitizeDocId(roomId);
  try {
    await deleteDoc(doc(db, 'rooms', safeRoomId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `rooms/${safeRoomId}`);
  }
}

export async function sendRoomMessageInFirestore(
  roomId: string,
  content: string,
  customMsgId?: string
): Promise<RoomMessage> {
  const fbUser = auth.currentUser;
  if (!fbUser || !isFirebaseVerifiedUser(fbUser)) {
    throw new Error('يجب تسجيل الدخول لإرسال رسائل في الغرفة.');
  }
  const uid = sanitizeDocId(fbUser.uid);
  const safeRoomId = sanitizeDocId(roomId);
  const msgId = customMsgId
    ? sanitizeDocId(customMsgId)
    : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanContent = content.trim().slice(0, 500);

  try {
    const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
    const displayName = String(
      (userSnap?.exists() ? userSnap.data().displayName : null) ||
        fbUser.displayName ||
        fbUser.email?.split('@')[0] ||
        'لاعب'
    ).slice(0, 100);

    await setDoc(doc(db, 'rooms', safeRoomId, 'messages', msgId), {
      id: msgId,
      roomId: safeRoomId,
      userId: uid,
      displayName,
      content: cleanContent,
      createdAt: serverTimestamp(),
    });

    return {
      id: msgId,
      roomId: safeRoomId,
      userId: uid,
      displayName,
      content: cleanContent,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rooms/${safeRoomId}/messages/${msgId}`);
  }
}

// =========================================================================
// Safe Local-to-Cloud Firestore Migration (Without Deleting vyrn_store.json)
// =========================================================================
export interface MigrationReport {
  settingsMigrated: boolean;
  categoriesMigrated: number;
  sectionsMigrated: number;
  contentMigrated: number;
  achievementsSeeded: number;
}

export async function migrateLocalSnapshotToFirestore(
  snapshot: LocalMigrationSnapshot
): Promise<MigrationReport> {
  if (!isFirebaseAdminUser()) {
    throw new Error(
      `يجب تسجيل الدخول بحساب المالك الموثق في Firebase (${BOOTSTRAPPED_ADMIN_EMAIL}) لتنفيذ الترحيل السحابي إلى Firestore.`
    );
  }

  let settingsMigrated = false;
  let categoriesMigrated = 0;
  let sectionsMigrated = 0;
  let contentMigrated = 0;
  let achievementsSeeded = 0;

  if (snapshot.settings) {
    await updateSettingsInFirestore(snapshot.settings);
    settingsMigrated = true;
  }

  const batch = writeBatch(db);

  for (const cat of snapshot.categories || []) {
    const id = sanitizeDocId(cat.id);
    batch.set(doc(db, 'categories', id), {
      id,
      name: String(cat.name || '').slice(0, 100),
      slug: String(cat.slug || id).slice(0, 100),
      type: cat.type || 'game',
      description: String(cat.description || '').slice(0, 500),
    });
    categoriesMigrated++;
  }

  for (const sec of snapshot.sections || []) {
    const id = sanitizeDocId(sec.id);
    batch.set(
      doc(db, 'sections', id),
      stripUndefined({
        id,
        name: String(sec.name || '').slice(0, 100),
        slug: String(sec.slug || id).slice(0, 100),
        description: String(sec.description || '').slice(0, 500),
        icon: String(sec.icon || '').slice(0, 100),
        coverImage: String(sec.coverImage || '').slice(0, 2000),
        bannerImage: String(sec.bannerImage || '').slice(0, 2000),
        accentColor: String(sec.accentColor || '#FF5A1F').slice(0, 30),
        layoutType: sec.layoutType || 'editorial',
        filterType: sec.filterType || 'all',
        categoryTarget: String(sec.categoryTarget || '').slice(0, 100),
        customItemIds: Array.isArray(sec.customItemIds) ? sec.customItemIds : [],
        sortOrder: Number(sec.sortOrder || 1),
        isEnabled: sec.isEnabled !== false,
        isDraft: Boolean(sec.isDraft),
        audience: sec.audience || 'public',
      })
    );
    sectionsMigrated++;
  }

  for (const item of snapshot.items || []) {
    const id = sanitizeDocId(item.id);
    const existingSnap = await getDoc(doc(db, 'content', id));
    batch.set(
      doc(db, 'content', id),
      stripUndefined({
        ...item,
        id,
        createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    contentMigrated++;
  }

  for (const ach of DEFAULT_ACHIEVEMENTS) {
    batch.set(doc(db, 'achievements', ach.id), ach);
    achievementsSeeded++;
  }

  await batch.commit();

  return {
    settingsMigrated,
    categoriesMigrated,
    sectionsMigrated,
    contentMigrated,
    achievementsSeeded,
  };
}
