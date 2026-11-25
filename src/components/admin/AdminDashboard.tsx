import React, { useState, useEffect } from 'react';
import {
  Shield,
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Users,
  Settings,
  BarChart3,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Lock,
  Save,
  Globe,
  Play,
  Download,
  BookOpen,
  Headphones,
  Check,
  Tag,
  Filter,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Archive,
  Search,
  X,
  Database,
  Cloud,
  Gamepad2,
  RefreshCw,
} from 'lucide-react';
import {
  ContentItem,
  SectionConfig,
  UserProfile,
  CommentItem,
  PlatformSettings,
  PlatformAnalytics,
  ContentType,
  GameCategory,
  PublicationStatus,
  GameRoom,
  LocalMigrationSnapshot,
} from '../../types';
import { api } from '../../lib/api';
import { isFirebaseAdminUser, BOOTSTRAPPED_ADMIN_EMAIL } from '../../lib/firebase';
import {
  subscribeRooms,
  deleteRoomInFirestore,
  MigrationReport,
} from '../../lib/firestoreService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { GameFormModal } from './GameFormModal';
import { GameLaunchModal } from '../game/GameLaunchModal';

interface AdminDashboardProps {
  initialCreateType?: ContentType;
  onContentUpdated?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialCreateType,
  onContentUpdated,
}) => {
  const { currentUser, firebaseUser, loginWithGoogle, changePassword, mustChangePassword } = useAuth();
  const { showToast, confirmAction } = useToast();
  const [activeTab, setActiveTab] = useState<
    | 'games'
    | 'content'
    | 'categories'
    | 'sections'
    | 'rooms'
    | 'analytics'
    | 'moderation'
    | 'users'
    | 'settings'
    | 'migration'
    | 'security'
  >(initialCreateType === 'game' ? 'games' : 'games');

  // Data states
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [moderationQueue, setModerationQueue] = useState<CommentItem[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [rooms, setRooms] = useState<GameRoom[]>([]);

  // Migration Panel State
  const [localSnapshot, setLocalSnapshot] = useState<LocalMigrationSnapshot | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [migrationError, setMigrationError] = useState('');
  const [isLoggingGoogle, setIsLoggingGoogle] = useState(false);

  // Dedicated Game Management State
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [gameToEdit, setGameToEdit] = useState<ContentItem | null>(null);
  const [testingGame, setTestingGame] = useState<ContentItem | null>(null);
  const [gameStatusFilter, setGameStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [gameCategoryFilter, setGameCategoryFilter] = useState<string>('all');
  const [gameSearchQuery, setGameSearchQuery] = useState<string>('');

  // Categories Management State
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<GameCategory | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Other Content form modal
  const [editingItem, setEditingItem] = useState<Partial<ContentItem> | null>(null);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);

  // Section form modal
  const [editingSection, setEditingSection] = useState<Partial<SectionConfig> | null>(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);

  // Password change form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMessage, setPwMessage] = useState('');

  // Status feedback
  const [notificationMsg, setNotificationMsg] = useState('');

  const isVerifiedFirebaseAdmin = isFirebaseAdminUser(firebaseUser);

  useEffect(() => {
    loadAllData();
    const unsubRooms = subscribeRooms(setRooms);
    return () => unsubRooms();
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (activeTab === 'migration' && !localSnapshot && !isLoadingSnapshot) {
      loadLocalSnapshot();
    }
  }, [activeTab]);

  useEffect(() => {
    if (initialCreateType === 'game') {
      setActiveTab('games');
      setGameToEdit(null);
      setIsGameModalOpen(true);
    } else if (initialCreateType) {
      setActiveTab('content');
      openCreateModal(initialCreateType);
    }
  }, [initialCreateType]);

  const loadAllData = async () => {
    try {
      const [analyticsData, contentData, sectionsData, settingsData, categoriesData] = await Promise.all([
        api.getAnalytics().catch(() => null),
        api.getContent({ status: 'all' }).catch(() => []),
        api.getSections().catch(() => []),
        api.getSettings().catch(() => null),
        api.getCategories('game').catch(() => []),
      ]);
      setAnalytics(analyticsData);
      setItems(contentData);
      setSections(sectionsData);
      setSettings(settingsData);
      setCategories(categoriesData);

      if (isFirebaseAdminUser(firebaseUser)) {
        const [usersData, modData] = await Promise.all([
          api.getUsers().catch(() => []),
          api.getModerationQueue().catch(() => []),
        ]);
        setUsers(usersData);
        setModerationQueue(modData);
      } else {
        setUsers([]);
        setModerationQueue([]);
      }
    } catch (e) {
      console.error('Error loading admin data:', e);
    }
  };

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(''), 3500);
  };

  const loadLocalSnapshot = async () => {
    setIsLoadingSnapshot(true);
    setMigrationError('');
    try {
      const snap = await api.getLocalMigrationSnapshot();
      setLocalSnapshot(snap);
    } catch (err: any) {
      setMigrationError(err.message || 'تعذر قراءة ملف التخزين المحلي.');
    } finally {
      setIsLoadingSnapshot(false);
    }
  };

  const handleMigrateToFirestore = async () => {
    if (isMigrating) return;
    setIsMigrating(true);
    setMigrationError('');
    try {
      const report = await api.migrateLocalToFirestore();
      setMigrationReport(report);
      showNotification('تم ترحيل البيانات بنجاح إلى Cloud Firestore مع الحفاظ على النسخة المحلية.');
      await loadAllData();
      onContentUpdated?.();
    } catch (err: any) {
      setMigrationError(err.message || 'فشل الترحيل إلى Firestore.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, title: string) => {
    const confirmed = await confirmAction({
      title: 'حذف غرفة اللعب',
      message: `هل أنت متأكد من إغلاق وحذف غرفة "${title}"؟`,
      confirmLabel: 'حذف الغرفة',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteRoomInFirestore(roomId);
      showNotification(`تم حذف الغرفة "${title}" بنجاح.`);
    } catch (err: any) {
      showToast(err.message || 'فشل حذف الغرفة.', 'error');
    }
  };

  const handleVerifyGoogleAdmin = async () => {
    setIsLoggingGoogle(true);
    try {
      await loginWithGoogle();
      showNotification('تم التحقق من جلسة الإدارة السحابية عبر Firebase.');
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'فشل تسجيل الدخول بحساب Google.', 'error');
    } finally {
      setIsLoggingGoogle(false);
    }
  };

  // Dedicated Game Management Handlers
  const openGameModal = (game?: ContentItem | null) => {
    setGameToEdit(game || null);
    setIsGameModalOpen(true);
  };

  const handleGameSaved = (savedGame: ContentItem, mode: 'published' | 'draft') => {
    showNotification(
      mode === 'published'
        ? `تم نشر اللعبة "${savedGame.title}" في Cloud Firestore بنجاح!`
        : `تم حفظ اللعبة "${savedGame.title}" كمسودة في Firestore.`
    );
    setIsGameModalOpen(false);
    setGameToEdit(null);
    loadAllData();
    onContentUpdated?.();
  };

  const handleUpdateItemStatus = async (item: ContentItem, newStatus: PublicationStatus) => {
    try {
      await api.updateContent(item.id, { status: newStatus });
      const statusArabic =
        newStatus === 'published' ? 'منشور' : newStatus === 'draft' ? 'مسودة' : 'مؤرشف';
      showNotification(`تم تغيير حالة "${item.title}" إلى ${statusArabic}.`);
      loadAllData();
      onContentUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'فشل تحديث الحالة.', 'error');
    }
  };

  const openCategoryModal = (cat?: GameCategory | null) => {
    if (cat) {
      setEditingCategory(cat);
      setNewCatName(cat.name);
      setNewCatDescription(cat.description || '');
    } else {
      setEditingCategory(null);
      setNewCatName('');
      setNewCatDescription('');
    }
    setIsCategoriesModalOpen(true);
  };

  const handleSaveCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCatName.trim()) return;
    setIsAddingCat(true);
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          name: newCatName.trim(),
          description: newCatDescription.trim(),
        });
        showNotification(`تم تعديل تصنيف "${newCatName.trim()}" بنجاح.`);
      } else {
        await api.createCategory({
          name: newCatName.trim(),
          type: 'game',
          description: newCatDescription.trim(),
        });
        showNotification(`تمت إضافة تصنيف "${newCatName.trim()}" إلى Firestore بنجاح.`);
      }
      setNewCatName('');
      setNewCatDescription('');
      setEditingCategory(null);
      setIsCategoriesModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'فشل حفظ التصنيف.', 'error');
    } finally {
      setIsAddingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const confirmed = await confirmAction({
      title: 'حذف التصنيف',
      message: `هل أنت متأكد من حذف تصنيف "${name}"؟`,
      confirmLabel: 'حذف التصنيف',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await api.deleteCategory(id);
      showNotification(`تم حذف التصنيف بنجاح.`);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'فشل حذف التصنيف.', 'error');
    }
  };

  const openCreateModal = (type: ContentType = 'game') => {
    if (type === 'game') {
      openGameModal(null);
      return;
    }

    const defaultCategories: Record<ContentType, string> = {
      game: 'ألعاب الأكشن والسرعة',
      app: 'أدوات برمجية وهندسية',
      project: 'مشاريع WebGPU ورسوميات',
      book: 'دراسات معمارية وتصميمية',
      podcast: 'تسجيلات وحوارات إبداعية',
    };

    setEditingItem({
      title: '',
      type,
      category: defaultCategories[type] || 'عام',
      status: 'published',
      audience: 'public',
      tags: [],
      commentsEnabled: true,
      isFeatured: false,
      newBadge: { enabled: true, label: 'جديد' },
      appConfig: type === 'app' ? { version: '1.0.0', supportedOS: 'Web / macOS / Windows' } : undefined,
      projectConfig: type === 'project' ? { techStack: ['TypeScript', 'WebGL', 'Vite'] } : undefined,
      bookConfig: type === 'book' ? { pageCount: 100, language: 'العربية' } : undefined,
      podcastConfig: type === 'podcast' ? { episodeNumber: 1, duration: '45:00' } : undefined,
    });
    setIsContentModalOpen(true);
  };

  const handleEditContentItem = (item: ContentItem) => {
    if (item.type === 'game') {
      openGameModal(item);
    } else {
      setEditingItem(item);
      setIsContentModalOpen(true);
    }
  };

  // Content Handlers
  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.title || !editingItem?.type || !editingItem?.category) {
      showToast('يرجى ملء الحقول المطلوبة: العنوان، النوع، والتصنيف.', 'warning');
      return;
    }

    try {
      if (editingItem.id) {
        await api.updateContent(editingItem.id, editingItem);
        showNotification('تم تحديث المحتوى في Cloud Firestore بنجاح.');
      } else {
        await api.createContent(editingItem);
        showNotification('تم نشر الإصدار الإبداعي الجديد في Firestore بنجاح.');
      }
      setIsContentModalOpen(false);
      setEditingItem(null);
      loadAllData();
      onContentUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء حفظ المحتوى.', 'error');
    }
  };

  const handleDeleteContent = async (id: string) => {
    const confirmed = await confirmAction({
      title: 'حذف المحتوى نهائياً',
      message: 'هل أنت متأكد من رغبتك في حذف هذا العنصر نهائياً من قاعدة البيانات السحابية؟',
      confirmLabel: 'حذف نهائي',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await api.deleteContent(id);
      showNotification('تم حذف العنصر من Firestore بنجاح.');
      loadAllData();
      onContentUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'فشل حذف العنصر.', 'error');
    }
  };

  // Section Builder Handlers
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection?.name) {
      showToast('اسم القسم حقل مطلوب.', 'warning');
      return;
    }

    try {
      if (editingSection.id) {
        await api.updateSection(editingSection.id, editingSection);
        showNotification('تم تحديث إعدادات القسم في Firestore.');
      } else {
        await api.createSection(editingSection);
        showNotification('تم إنشاء القسم التفاعلي في Firestore بنجاح.');
      }
      setIsSectionModalOpen(false);
      setEditingSection(null);
      loadAllData();
      onContentUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء حفظ القسم.', 'error');
    }
  };

  const handleDeleteSection = async (id: string) => {
    const confirmed = await confirmAction({
      title: 'إزالة القسم',
      message: 'هل أنت متأكد من رغبتك في إزالة هذا القسم؟',
      confirmLabel: 'إزالة القسم',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await api.deleteSection(id);
      showNotification('تمت إزالة القسم بنجاح.');
      loadAllData();
      onContentUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'فشلت إزالة القسم.', 'error');
    }
  };

  const handleMoveSection = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const newSections = [...sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;

    const orderPayload = newSections.map((s, idx) => ({ id: s.id, sortOrder: idx + 1 }));
    setSections(newSections);

    try {
      await api.reorderSections(orderPayload);
      showNotification('تم تحديث ترتيب الأقسام بنجاح.');
    } catch (err: any) {
      showToast(err.message || 'فشل حفظ الترتيب الجديد.', 'error');
      loadAllData();
    }
  };

  // Moderation Handlers
  const handleApproveComment = async (id: string) => {
    try {
      await api.approveComment(id);
      showNotification('تمت الموافقة على التعليق.');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'فشلت الموافقة.', 'error');
    }
  };

  const handleDeleteComment = async (id: string) => {
    try {
      await api.deleteComment(id);
      showNotification('تم حذف التعليق.');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'فشل حذف التعليق.', 'error');
    }
  };

  // User Role Handlers
  const handleUserRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.updateUserRole(userId, newRole);
      showNotification('تم تحديث رتبة المستخدم.');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'فشل تحديث الرتبة.', 'error');
    }
  };

  // Settings Handlers
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await api.updateSettings(settings);
      showNotification('تم حفظ إعدادات المنصة في Cloud Firestore بنجاح.');
      onContentUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'فشل حفظ الإعدادات.', 'error');
    }
  };

  // Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await changePassword(currentPw, newPw);
      setPwMessage('تم تغيير كلمة المرور بنجاح.');
      setCurrentPw('');
      setNewPw('');
    } catch (err: any) {
      setPwMessage(`خطأ: ${err.message || 'فشل تغيير كلمة المرور.'}`);
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-[#1F211C] border border-[#2D3028] rounded-2xl text-center space-y-4 text-right">
        <Shield className="w-10 h-10 text-[#FF5A1F] mx-auto" />
        <h2 className="text-xl font-bold font-mono text-[#F2EBDD]">منطقة مقيدة الصلاحيات</h2>
        <p className="text-xs text-[#F2EBDD]/70 leading-relaxed">
          يتطلب هذا القسم صلاحيات إدارة النظام. يرجى تسجيل الدخول بحساب مدير المنصة للمتابعة.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-in fade-in duration-200 text-right">
      {/* Top Banner Alert if temporary password is still active */}
      {mustChangePassword && (
        <div className="p-4 bg-[#FF5A1F]/15 border border-[#FF5A1F] rounded-xl flex items-center justify-between gap-4 text-xs text-[#F2EBDD]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#FF5A1F] shrink-0" />
            <span>
              <strong>تنبيه أمني للإدارة:</strong> أنت تستخدم حالياً كلمة مرور الإدارة المعتمدة (<code className="text-[#D7FF38] font-mono">abdo</code>). يمكنك تحديثها لحسابك من خلال تبويب "الأمان وكلمة المرور".
            </span>
          </div>
          <button
            onClick={() => setActiveTab('security')}
            className="px-3 py-1.5 bg-[#FF5A1F] text-white font-bold rounded text-xs shrink-0 cursor-pointer"
          >
            تغيير كلمة المرور
          </button>
        </div>
      )}

      {/* Firebase Cloud Admin Session Banner */}
      {!isVerifiedFirebaseAdmin ? (
        <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#F2EBDD]">
          <div className="flex items-start sm:items-center gap-2.5">
            <Cloud className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <strong className="text-amber-300">توثيق Firebase Cloud Firestore مطلوب للكتابة:</strong>{' '}
              أنت متصل حالياً بالجلسة المحلية فقط، بينما تحمي قواعد <code className="font-mono text-[#D7FF38]">firestore.rules</code> عمليات النشر والتعديل والترحيل. سجّل الدخول بحساب الإدارة الموثق (<code className="font-mono text-[#D7FF38]" dir="ltr">{BOOTSTRAPPED_ADMIN_EMAIL}</code>) لتنفيذ التعديلات السحابية.
            </div>
          </div>
          <button
            onClick={handleVerifyGoogleAdmin}
            disabled={isLoggingGoogle}
            className="px-4 py-2 bg-[#D7FF38] hover:bg-[#c8f028] text-[#191A17] font-bold rounded-lg text-xs shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isLoggingGoogle ? 'جاري التوثيق...' : 'تسجيل الدخول بحساب Google الموثق'}
          </button>
        </div>
      ) : (
        <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              متصل مباشرة بـ <strong>Cloud Firestore</strong> كمدير موثق ({firebaseUser?.email})
            </span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
            FIRESTORE LIVE
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#292C25] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#FF5A1F] uppercase tracking-wider mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span>لوحة تحكم وإدارة منصة VYRN السحابية</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F2EBDD] font-mono">
            إدارة المحتوى والعمليات الإبداعية
          </h1>
        </div>

        {notificationMsg && (
          <div className="px-4 py-2 bg-[#D7FF38]/15 border border-[#D7FF38] text-[#D7FF38] text-xs font-semibold rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notificationMsg}</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs (Functional button controls) */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#1A1C17] border border-[#272A22] rounded-xl">
        {[
          { id: 'games', label: `لوحة الألعاب (${items.filter((i) => i.type === 'game').length})`, icon: Play },
          { id: 'content', label: `كافة المحتويات (${items.length})`, icon: Layers },
          { id: 'categories', label: `تصنيفات الألعاب (${categories.length})`, icon: Tag },
          { id: 'sections', label: `الأقسام (${sections.length})`, icon: Globe },
          { id: 'rooms', label: `غرف اللعب (${rooms.length})`, icon: Gamepad2 },
          { id: 'analytics', label: 'الإحصائيات الحقيقية', icon: BarChart3 },
          { id: 'moderation', label: `المراجعة والبلاغات (${moderationQueue.length})`, icon: MessageSquare },
          { id: 'users', label: 'المستخدمون والاعتماد', icon: Users },
          { id: 'settings', label: 'إعدادات المنصة', icon: Settings },
          { id: 'migration', label: 'الترحيل السحابي', icon: Database },
          { id: 'security', label: 'الأمان وكلمة المرور', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : 'text-[#F2EBDD]/70 hover:text-white hover:bg-[#252821]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 0: Dedicated Games Management (Requirement 1, 2, 3, 4) */}
      {activeTab === 'games' && (
        <div className="space-y-6">
          {/* Top Metric Strip for Games */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-[#1C1E19] border border-[#2D3027] rounded-xl">
              <span className="text-[11px] font-mono uppercase text-[#F2EBDD]/50 block">إجمالي الألعاب</span>
              <p className="text-2xl font-bold font-mono text-[#F2EBDD] mt-1 tabular-nums">
                {items.filter((i) => i.type === 'game').length}
              </p>
            </div>
            <div className="p-4 bg-[#1C1E19] border border-[#2D3027] rounded-xl">
              <span className="text-[11px] font-mono uppercase text-emerald-400/70 block">الألعاب المنشورة</span>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                {items.filter((i) => i.type === 'game' && i.status === 'published').length}
              </p>
            </div>
            <div className="p-4 bg-[#1C1E19] border border-[#2D3027] rounded-xl">
              <span className="text-[11px] font-mono uppercase text-amber-400/70 block">المسودات</span>
              <p className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">
                {items.filter((i) => i.type === 'game' && i.status === 'draft').length}
              </p>
            </div>
            <div className="p-4 bg-[#1C1E19] border border-[#2D3027] rounded-xl">
              <span className="text-[11px] font-mono uppercase text-[#D7FF38]/70 block">المميزة على الرئيسية</span>
              <p className="text-2xl font-bold font-mono text-[#D7FF38] mt-1 tabular-nums">
                {items.filter((i) => i.type === 'game' && i.isFeatured).length}
              </p>
            </div>
          </div>

          {/* Action Bar & Quick Filters */}
          <div className="p-4 bg-[#1C1E19] border border-[#2D3027] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => openGameModal(null)}
                className="px-4 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-[#FF5A1F]/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة لعبة جديدة</span>
              </button>

              <button
                onClick={() => setIsCategoriesModalOpen(true)}
                className="px-4 py-2.5 bg-[#252822] hover:bg-[#2E3129] border border-[#383C32] text-[#F2EBDD] text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Tag className="w-4 h-4 text-[#D7FF38]" />
                <span>إدارة التصنيفات ({categories.length})</span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search in games */}
              <div className="relative min-w-[180px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#F2EBDD]/40 pointer-events-none" />
                <input
                  type="text"
                  value={gameSearchQuery || ''}
                  onChange={(e) => setGameSearchQuery(e.target.value)}
                  placeholder="بحث في الألعاب..."
                  className="w-full bg-[#141512] border border-[#2B2D26] focus:border-[#FF5A1F] rounded-lg pr-9 pl-3 py-1.5 text-xs text-[#F2EBDD] focus:outline-none"
                />
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5 p-1 bg-[#141512] border border-[#272922] rounded-lg text-xs font-mono">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'published', label: 'منشورة' },
                  { id: 'draft', label: 'مسودات' },
                  { id: 'archived', label: 'مؤرشفة' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setGameStatusFilter(st.id as any)}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      gameStatusFilter === st.id
                        ? 'bg-[#FF5A1F] text-white font-bold'
                        : 'text-[#F2EBDD]/60 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Category filter */}
              <select
                value={gameCategoryFilter || 'all'}
                onChange={(e) => setGameCategoryFilter(e.target.value)}
                className="bg-[#141512] border border-[#2B2D26] text-xs text-[#F2EBDD] rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="all">كافة التصنيفات</option>
                {categories.map((c) => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Games Listing Table or Empty State */}
          {(() => {
            const filteredGames = items.filter((i) => {
              if (i.type !== 'game') return false;
              if (gameStatusFilter !== 'all' && i.status !== gameStatusFilter) return false;
              if (gameCategoryFilter !== 'all' && i.category !== gameCategoryFilter) return false;
              if (gameSearchQuery.trim()) {
                const q = gameSearchQuery.toLowerCase();
                return (
                  i.title.toLowerCase().includes(q) ||
                  i.category.toLowerCase().includes(q) ||
                  i.summary?.toLowerCase().includes(q) ||
                  i.tags?.some((t) => t.toLowerCase().includes(q))
                );
              }
              return true;
            });

            if (filteredGames.length === 0) {
              return (
                <div className="p-16 bg-[#181A15] border border-[#272A22] rounded-2xl text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#20231D] border border-[#2E3128] flex items-center justify-center text-[#FF5A1F] mx-auto">
                    <Play className="w-7 h-7 fill-current ml-1" />
                  </div>
                  <h3 className="text-lg font-bold text-[#F2EBDD] font-mono">
                    مساحة ألعابك جاهزة
                  </h3>
                  <p className="text-xs text-[#F2EBDD]/60 max-w-md mx-auto leading-relaxed">
                    لم يتم العثور على ألعاب مسجلة وفق التصفية الحالية. يمكنك البدء بإضافة أول لعبة حقيقية للمنصة الآن وتحديد طريقة تشغيلها.
                  </p>
                  <button
                    onClick={() => openGameModal(null)}
                    className="px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FF5A1F]/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة أول لعبة الآن</span>
                  </button>
                </div>
              );
            }

            return (
              <div className="bg-[#1C1E19] border border-[#2D3027] rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs text-[#F2EBDD]/80">
                    <thead className="bg-[#161713] text-[#F2EBDD]/50 border-b border-[#292C25] font-mono uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5">اللعبة</th>
                        <th className="p-3.5">التصنيف والنوع</th>
                        <th className="p-3.5">طريقة التشغيل</th>
                        <th className="p-3.5">الحالة</th>
                        <th className="p-3.5">الإصدار</th>
                        <th className="p-3.5">التفاعل الفعلي</th>
                        <th className="p-3.5 text-left">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262822]">
                      {filteredGames.map((game) => {
                        const mode = game.gameConfig?.launchMode || 'internal_embed';
                        return (
                          <tr key={game.id} className="hover:bg-[#22241F] transition-colors">
                            {/* Game Media + Title */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg bg-[#141512] border border-[#2D3027] overflow-hidden shrink-0">
                                  {game.coverImage ? (
                                    <img src={game.coverImage} alt={game.title} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[#F2EBDD]/30 font-mono text-[10px]">
                                      لا غلاف
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-[#F2EBDD] font-mono">{game.title}</span>
                                    {game.isFeatured && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-[#FF5A1F] rounded">
                                        مميز
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[#F2EBDD]/50 line-clamp-1 max-w-xs mt-0.5">
                                    {game.summary}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Category & Genre */}
                            <td className="p-3.5">
                              <span className="font-semibold text-[#F2EBDD] block">{game.category}</span>
                              <span className="text-[11px] text-[#D7FF38] font-mono">
                                {game.gameConfig?.genre || 'أكشن ومحاكاة'}
                              </span>
                            </td>

                            {/* Launch Mode Badge */}
                            <td className="p-3.5">
                              {mode === 'internal_embed' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-[#FF5A1F]/15 text-[#FF5A1F] border border-[#FF5A1F]/30">
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>مشغل مدمج</span>
                                </span>
                              )}
                              {mode === 'internal_page' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-[#D7FF38]/15 text-[#D7FF38] border border-[#D7FF38]/30">
                                  <Layers className="w-3 h-3" />
                                  <span>صفحة مستقلة</span>
                                </span>
                              )}
                              {mode === 'external_url' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-sky-500/15 text-sky-400 border border-sky-500/30">
                                  <ExternalLink className="w-3 h-3 rtl-flip" />
                                  <span>رابط خارجي</span>
                                </span>
                              )}
                              {mode === 'apk_download' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <Download className="w-3 h-3" />
                                  <span>حزمة APK</span>
                                </span>
                              )}
                            </td>

                            {/* Status Selector Dropdown */}
                            <td className="p-3.5">
                              <select
                                value={game.status || 'published'}
                                onChange={(e) => handleUpdateItemStatus(game, e.target.value as PublicationStatus)}
                                className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border bg-[#141512] cursor-pointer focus:outline-none ${
                                  game.status === 'published'
                                    ? 'border-emerald-500/40 text-emerald-400'
                                    : game.status === 'draft'
                                    ? 'border-amber-500/40 text-amber-400'
                                    : 'border-slate-500/40 text-slate-400'
                                }`}
                              >
                                <option value="published">منشور للعامة</option>
                                <option value="draft">مسودة (Draft)</option>
                                <option value="archived">مؤرشف</option>
                              </select>
                            </td>

                            {/* Version */}
                            <td className="p-3.5 font-mono text-[#F2EBDD]/70 text-[11px]">
                              v{game.gameConfig?.version || '1.0.0'}
                            </td>

                            {/* Real Activity Metrics */}
                            <td className="p-3.5 font-mono text-[11px] tabular-nums text-[#F2EBDD]/60">
                              <span>{game.viewsCount || 0} زيارة</span> · <span>{game.downloadsCount || 0} تشغيل/تحميل</span>
                            </td>

                            {/* Action Buttons */}
                            <td className="p-3.5 text-left space-x-1.5 space-x-reverse">
                              {/* Test Launch Button */}
                              <button
                                onClick={() => setTestingGame(game)}
                                className="p-1.5 hover:text-[#D7FF38] text-[#F2EBDD]/70 bg-[#252822] rounded-lg transition-colors cursor-pointer"
                                title="تجربة تشغيل اللعبة"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>

                              {/* Edit Button */}
                              <button
                                onClick={() => openGameModal(game)}
                                className="p-1.5 hover:text-[#FF5A1F] text-[#F2EBDD]/70 bg-[#252822] rounded-lg transition-colors cursor-pointer"
                                title="تعديل بيانات اللعبة"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteContent(game.id)}
                                className="p-1.5 hover:text-red-400 text-[#F2EBDD]/70 bg-[#252822] rounded-lg transition-colors cursor-pointer"
                                title="حذف اللعبة نهائياً"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB: Game Categories Manager */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold font-mono text-[#F2EBDD]">إدارة وتنسيق تصنيفات الألعاب</h2>
              <p className="text-xs text-[#F2EBDD]/60 mt-0.5">
                يمكنك إضافة تصنيفات مخصصة أو حذف التصنيفات غير المستخدمة بسهولة.
              </p>
            </div>
            <button
              onClick={() => openCategoryModal(null)}
              className="px-4 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة تصنيف جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const gameCount = items.filter((i) => i.type === 'game' && i.category === cat.name).length;
              return (
                <div
                  key={cat.id || cat.name}
                  className="p-5 bg-[#1C1E19] border border-[#2D3027] hover:border-[#383C32] rounded-xl flex flex-col justify-between space-y-3 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#F2EBDD] font-mono">{cat.name}</h4>
                      {cat.description && (
                        <p className="text-xs text-[#F2EBDD]/60 mt-1">{cat.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-[#D7FF38] bg-[#D7FF38]/10 px-2 py-0.5 rounded">
                      {gameCount} لعبة
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[#272922] flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono text-[#F2EBDD]/40">معرف: {cat.slug || cat.id}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openCategoryModal(cat)}
                        className="px-2.5 py-1 text-xs text-[#F2EBDD]/70 hover:text-white bg-[#252822] hover:bg-[#2F322B] border border-[#34382F] rounded-lg cursor-pointer transition-colors"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg cursor-pointer transition-colors"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: Content Items Management with Clear Specific Action Buttons */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {/* Action Strip: Direct Add Buttons for Each Content Domain */}
          <div className="p-4 bg-[#1C1E19] border border-[#2D3027] rounded-xl flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-mono uppercase text-[#D7FF38] tracking-wider font-bold">
              إضافة محتوى حقيقي:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => openCreateModal('game')}
                className="px-3.5 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current ml-1" />
                <span>إضافة لعبة</span>
              </button>
              <button
                onClick={() => openCreateModal('app')}
                className="px-3.5 py-2 bg-[#262822] hover:bg-[#2E3129] border border-[#383C32] text-[#F2EBDD] text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 ml-1" />
                <span>إضافة تطبيق</span>
              </button>
              <button
                onClick={() => openCreateModal('project')}
                className="px-3.5 py-2 bg-[#262822] hover:bg-[#2E3129] border border-[#383C32] text-[#F2EBDD] text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 ml-1" />
                <span>إضافة مشروع</span>
              </button>
              <button
                onClick={() => openCreateModal('book')}
                className="px-3.5 py-2 bg-[#262822] hover:bg-[#2E3129] border border-[#383C32] text-[#F2EBDD] text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 ml-1" />
                <span>إضافة كتاب</span>
              </button>
              <button
                onClick={() => openCreateModal('podcast')}
                className="px-3.5 py-2 bg-[#262822] hover:bg-[#2E3129] border border-[#383C32] text-[#F2EBDD] text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Headphones className="w-3.5 h-3.5 ml-1" />
                <span>إضافة حلقة بودكاست</span>
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-16 bg-[#181A15] border border-[#272A22] rounded-2xl text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#20231D] border border-[#2E3128] flex items-center justify-center text-[#FF5A1F] mx-auto">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-[#F2EBDD] font-mono">
                قاعدة بيانات المحتوى فارغة وجاهزة
              </h3>
              <p className="text-xs text-[#F2EBDD]/60 max-w-md mx-auto leading-relaxed">
                لم يتم إدخال أي ألعاب أو تطبيقات أو كتب أو حلقات بعد. استخدم الأزرار أعلاه لإضافة ونشر أول إصدار حقيقي على المنصة.
              </p>
            </div>
          ) : (
            <div className="bg-[#1C1E19] border border-[#2D3027] rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs text-[#F2EBDD]/80">
                  <thead className="bg-[#161713] text-[#F2EBDD]/50 border-b border-[#292C25] font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">العنوان</th>
                      <th className="p-3.5">النوع</th>
                      <th className="p-3.5">التصنيف</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5">الجمهور</th>
                      <th className="p-3.5">التفاعل</th>
                      <th className="p-3.5 text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262822]">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#22241F]">
                        <td className="p-3.5 font-bold text-[#F2EBDD]">{item.title}</td>
                        <td className="p-3.5 font-mono text-[#D7FF38] uppercase">{item.type}</td>
                        <td className="p-3.5">{item.category}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              item.status === 'published'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {item.status === 'published' ? 'منشور' : 'مسودة'}
                          </span>
                        </td>
                        <td className="p-3.5 text-[#F2EBDD]/60">
                          {item.audience === 'public' ? 'عام' : item.audience === 'members' ? 'للأعضاء' : 'معتمد'}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] tabular-nums">
                          {item.viewsCount || 0}v · {item.likesCount || 0}l · {item.downloadsCount || 0}d
                        </td>
                        <td className="p-3.5 text-left space-x-2 space-x-reverse">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setIsContentModalOpen(true);
                            }}
                            className="p-1 hover:text-[#FF5A1F] cursor-pointer"
                            title="تعديل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContent(item.id)}
                            className="p-1 hover:text-red-400 cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Dynamic Section Management */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold font-mono text-[#F2EBDD]">إدارة وتنسيق أقسام الصفحة الرئيسية</h2>
              <p className="text-xs text-[#F2EBDD]/60">
                أضف أو رتب أو أعد تسمية الأقسام التفاعلية في الصفحة الرئيسية دون أي تعديل في الكود المصدري.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSection({
                  name: '',
                  description: '',
                  accentColor: '#FF5A1F',
                  layoutType: 'editorial',
                  filterType: 'all',
                  isEnabled: true,
                  isDraft: false,
                  audience: 'public',
                });
                setIsSectionModalOpen(true);
              }}
              className="px-4 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إنشاء قسم جديد</span>
            </button>
          </div>

          <div className="space-y-3">
            {sections.map((sec, idx) => (
              <div
                key={sec.id}
                className="bg-[#1C1E19] border border-[#2D3027] p-4 rounded-xl flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveSection(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-[#F2EBDD]/50 hover:text-white disabled:opacity-20 cursor-pointer"
                      title="تحريك لأعلى"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveSection(idx, 'down')}
                      disabled={idx === sections.length - 1}
                      className="p-1 text-[#F2EBDD]/50 hover:text-white disabled:opacity-20 cursor-pointer"
                      title="تحريك لأسفل"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[#F2EBDD] font-mono">{sec.name}</h4>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: sec.accentColor }}
                      />
                      {sec.isDraft && (
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          مسودة
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#F2EBDD]/60 mt-0.5">{sec.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono text-[#D7FF38]">
                      <span>التنسيق: {sec.layoutType}</span>
                      <span>·</span>
                      <span>الفلتر: {sec.filterType} {sec.categoryTarget ? `(${sec.categoryTarget})` : ''}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingSection(sec);
                      setIsSectionModalOpen(true);
                    }}
                    className="p-2 hover:text-[#FF5A1F] bg-[#242720] rounded-lg cursor-pointer"
                    title="تعديل القسم"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSection(sec.id)}
                    className="p-2 hover:text-red-400 bg-[#242720] rounded-lg cursor-pointer"
                    title="حذف القسم"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Honest Analytics (Zero fake metrics) */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 bg-[#1F211C] border border-[#2D3027] rounded-xl space-y-1">
              <span className="text-[11px] font-mono uppercase text-[#F2EBDD]/50">إجمالي الإصدارات</span>
              <p className="text-2xl font-mono font-bold text-[#F2EBDD] tabular-nums">{analytics?.totalItems || 0}</p>
            </div>
            <div className="p-5 bg-[#1F211C] border border-[#2D3027] rounded-xl space-y-1">
              <span className="text-[11px] font-mono uppercase text-[#F2EBDD]/50">الأعضاء المسجلين</span>
              <p className="text-2xl font-mono font-bold text-[#D7FF38] tabular-nums">{analytics?.totalUsers || 1}</p>
            </div>
            <div className="p-5 bg-[#1F211C] border border-[#2D3027] rounded-xl space-y-1">
              <span className="text-[11px] font-mono uppercase text-[#F2EBDD]/50">المشاهدات الفعلية</span>
              <p className="text-2xl font-mono font-bold text-[#FF5A1F] tabular-nums">{analytics?.totalViews || 0}</p>
            </div>
            <div className="p-5 bg-[#1F211C] border border-[#2D3027] rounded-xl space-y-1">
              <span className="text-[11px] font-mono uppercase text-[#F2EBDD]/50">التحميلات والتشغيل</span>
              <p className="text-2xl font-mono font-bold text-[#F2EBDD] tabular-nums">{analytics?.totalDownloads || 0}</p>
            </div>
          </div>

          {/* Honest status explanation if no activity recorded */}
          {(!analytics || analytics.totalViews === 0) && (
            <div className="p-6 bg-[#171914] border border-[#272A22] rounded-xl text-center space-y-2">
              <BarChart3 className="w-6 h-6 text-[#D7FF38] mx-auto opacity-70" />
              <p className="text-xs text-[#F2EBDD]/70 font-medium">
                لا توجد إحصائيات مسجلة بعد. ستظهر الأرقام والمؤشرات البيانية تلقائيًا وبشفافية فور بدء النشاط الفعلي والزيارات للمنصة.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Comment & Report Moderation */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold font-mono text-[#F2EBDD]">
            قائمة المراجعة والبلاغات ({moderationQueue.length})
          </h2>

          {moderationQueue.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#F2EBDD]/50 bg-[#1C1E19] border border-[#2D3027] rounded-xl">
              تمت مراجعة جميع التعليقات والبلاغات. لا توجد أي عناصر معلقة حالياً.
            </div>
          ) : (
            <div className="space-y-3">
              {moderationQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-[#1C1E19] border border-[#2D3027] rounded-xl flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-[#F2EBDD]">{item.userDisplayName}</span>
                      <span className="text-[#F2EBDD]/40 font-mono text-[10px]">
                        {new Date(item.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                      {item.isReported && (
                        <span className="px-2 py-0.5 text-[10px] font-mono text-red-400 bg-red-400/10 rounded">
                          بلاغ: {item.reportReason || 'محتوى مخالف'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#F2EBDD]/80">{item.content}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveComment(item.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded cursor-pointer"
                    >
                      موافقة
                    </button>
                    <button
                      onClick={() => handleDeleteComment(item.id)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded cursor-pointer"
                    >
                      إزالة
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Users & Access Control */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold font-mono text-[#F2EBDD]">الحسابات والصلاحيات ({users.length})</h2>
          <div className="bg-[#1C1E19] border border-[#2D3027] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-[#F2EBDD]/80">
                <thead className="bg-[#161713] text-[#F2EBDD]/50 border-b border-[#292C25] font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">اسم المستخدم</th>
                    <th className="p-3.5">الاسم المعروض</th>
                    <th className="p-3.5">البريد الإلكتروني</th>
                    <th className="p-3.5">الرتبة</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-left">تعديل الصلاحية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262822]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#22241F]">
                      <td className="p-3.5 font-mono text-[#D7FF38]">{u.username}</td>
                      <td className="p-3.5 font-semibold text-[#F2EBDD]">{u.displayName}</td>
                      <td className="p-3.5 font-mono text-[#F2EBDD]/50">{u.email}</td>
                      <td className="p-3.5 font-mono font-bold uppercase">{u.role}</td>
                      <td className="p-3.5">
                        <span className="text-emerald-400">نشط</span>
                      </td>
                      <td className="p-3.5 text-left">
                        <select
                          value={u.role || 'member'}
                          onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
                          disabled={u.id === currentUser?.id}
                          className="bg-[#141512] border border-[#2D3028] text-xs text-[#F2EBDD] rounded p-1.5 disabled:opacity-30 cursor-pointer"
                        >
                          <option value="member">عضو عادي (Member)</option>
                          <option value="approved">معتمد (Approved)</option>
                          <option value="admin">مدير (Admin)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Platform Settings */}
      {activeTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="max-w-2xl bg-[#1C1E19] border border-[#2D3027] rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-bold font-mono text-[#F2EBDD]">الإعدادات العامة للمنصة</h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[#F2EBDD]/60 mb-1 font-mono">اسم المنصة</label>
              <input
                type="text"
                value={settings.brandName || ''}
                onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
                className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
              />
            </div>

            <div>
              <label className="block text-[#F2EBDD]/60 mb-1 font-mono">الشعار اللفظي للمنصة (Tagline)</label>
              <input
                type="text"
                value={settings.brandTagline || ''}
                onChange={(e) => setSettings({ ...settings, brandTagline: e.target.value })}
                className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#F2EBDD]/60 mb-1 font-mono">اللون التمييزي الأساسي</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.primaryAccent || '#FF5A1F'}
                    onChange={(e) => setSettings({ ...settings, primaryAccent: e.target.value })}
                    className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.primaryAccent || ''}
                    onChange={(e) => setSettings({ ...settings, primaryAccent: e.target.value })}
                    className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2 font-mono text-[#F2EBDD]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!settings.showIntroAnimation}
                  onChange={(e) => setSettings({ ...settings, showIntroAnimation: e.target.checked })}
                  className="rounded border-[#2D3028] accent-[#FF5A1F]"
                />
                <span>تفعيل المقدمة السينمائية عند زيارة الموقع</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!settings.allowGuestInteractions}
                  onChange={(e) => setSettings({ ...settings, allowGuestInteractions: e.target.checked })}
                  className="rounded border-[#2D3028] accent-[#FF5A1F]"
                />
                <span>السماح للزوار غير المسجلين بنشر التعليقات</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!settings.commentModerationRequired}
                  onChange={(e) => setSettings({ ...settings, commentModerationRequired: e.target.checked })}
                  className="rounded border-[#2D3028] accent-[#FF5A1F]"
                />
                <span>اشتراط موافقة الإدارة قبل نشر التعليقات للعامة</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-2"
          >
            <Save className="w-4 h-4 ml-1" />
            <span>حفظ الإعدادات</span>
          </button>
        </form>
      )}

      {/* TAB: Multiplayer Rooms Management */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold font-mono text-[#F2EBDD] flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-[#FF5A1F]" />
                <span>إدارة غرف اللعب الجماعي ({rooms.length})</span>
              </h2>
              <p className="text-xs text-[#F2EBDD]/60 mt-1">
                متابعة الغرف النشطة والمنتهية في Cloud Firestore مع صلاحية إغلاق وحذف الغرف المخالفة أو المهجورة.
              </p>
            </div>
          </div>

          {rooms.length === 0 ? (
            <div className="p-12 bg-[#1C1E19] border border-[#2D3027] rounded-xl text-center space-y-2">
              <Gamepad2 className="w-8 h-8 text-[#F2EBDD]/30 mx-auto" />
              <p className="text-xs text-[#F2EBDD]/60">لا توجد غرف لعب جماعي مسجلة حالياً في Firestore.</p>
            </div>
          ) : (
            <div className="bg-[#1C1E19] border border-[#2D3027] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs text-[#F2EBDD]/80">
                  <thead className="bg-[#161713] text-[#F2EBDD]/50 border-b border-[#292C25] font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">اسم الغرفة</th>
                      <th className="p-3.5">الرمز</th>
                      <th className="p-3.5">اللعبة</th>
                      <th className="p-3.5">المضيف</th>
                      <th className="p-3.5">اللاعبون</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5 text-left">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262822]">
                    {rooms.map((room) => (
                      <tr key={room.id} className="hover:bg-[#22241F]">
                        <td className="p-3.5 font-bold text-[#F2EBDD]">{room.title}</td>
                        <td className="p-3.5 font-mono text-[#D7FF38]">{room.code}</td>
                        <td className="p-3.5">{room.gameTitle}</td>
                        <td className="p-3.5 text-[#F2EBDD]/70">{room.hostName}</td>
                        <td className="p-3.5 font-mono tabular-nums">
                          {room.playerCount} / {room.maxPlayers}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              room.status === 'waiting'
                                ? 'bg-amber-500/15 text-amber-300'
                                : room.status === 'playing'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-slate-500/15 text-slate-300'
                            }`}
                          >
                            {room.status === 'waiting'
                              ? 'في الانتظار'
                              : room.status === 'playing'
                              ? 'قيد اللعب'
                              : 'منتهية'}
                          </span>
                        </td>
                        <td className="p-3.5 text-left">
                          <button
                            onClick={() => handleDeleteRoom(room.id, room.title)}
                            className="p-1.5 hover:text-red-400 bg-[#242720] rounded-lg cursor-pointer"
                            title="حذف الغرفة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Safe Local-to-Cloud Firestore Migration */}
      {activeTab === 'migration' && (
        <div className="space-y-6">
          <div className="p-5 bg-[#1C1E19] border border-[#2D3027] rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold font-mono text-[#F2EBDD] flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#D7FF38]" />
                  <span>ترحيل البيانات الآمن إلى Cloud Firestore</span>
                </h2>
                <p className="text-xs text-[#F2EBDD]/60 mt-1 leading-relaxed">
                  مقارنة شاملة بين ملف التخزين المحلي (<code className="font-mono text-[#D7FF38]">data/vyrn_store.json</code>) وقاعدة البيانات السحابية. تبقى النسخة المحلية محفوظة بالكامل دون حذف أثناء الترحيل وبعده.
                </p>
              </div>
              <button
                onClick={loadLocalSnapshot}
                disabled={isLoadingSnapshot}
                className="px-4 py-2 bg-[#252822] hover:bg-[#2F322B] border border-[#383C32] text-xs font-bold text-[#F2EBDD] rounded-xl flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSnapshot ? 'animate-spin' : ''}`} />
                <span>تحديث القراءة المحلية</span>
              </button>
            </div>

            {migrationError && (
              <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-xs text-red-300">
                {migrationError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local Store Summary */}
              <div className="p-4 bg-[#141512] border border-[#2A2D25] rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#242720] pb-2">
                  <span className="text-xs font-bold font-mono text-[#F2EBDD]">النسخة المحلية (vyrn_store.json)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#252822] text-[#F2EBDD]/60">
                    محفوظة بأمان
                  </span>
                </div>
                {localSnapshot ? (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 bg-[#1B1D18] rounded-lg">
                      <span className="text-[#F2EBDD]/50 block text-[10px]">العناصر والألعاب</span>
                      <span className="text-base font-bold text-[#F2EBDD]">{localSnapshot.items.length}</span>
                    </div>
                    <div className="p-2.5 bg-[#1B1D18] rounded-lg">
                      <span className="text-[#F2EBDD]/50 block text-[10px]">التصنيفات</span>
                      <span className="text-base font-bold text-[#F2EBDD]">{localSnapshot.categories.length}</span>
                    </div>
                    <div className="p-2.5 bg-[#1B1D18] rounded-lg">
                      <span className="text-[#F2EBDD]/50 block text-[10px]">الأقسام</span>
                      <span className="text-base font-bold text-[#F2EBDD]">{localSnapshot.sections.length}</span>
                    </div>
                    <div className="p-2.5 bg-[#1B1D18] rounded-lg">
                      <span className="text-[#F2EBDD]/50 block text-[10px]">الإعدادات المحلية</span>
                      <span className="text-base font-bold text-emerald-400">
                        {localSnapshot.settings ? 'متوفرة' : 'غير متوفرة'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#F2EBDD]/50 py-4 text-center">
                    {isLoadingSnapshot ? 'جاري فحص النسخة المحلية...' : 'اضغط "تحديث القراءة المحلية" لمعاينة البيانات.'}
                  </p>
                )}
              </div>

              {/* Cloud Firestore Summary */}
              <div className="p-4 bg-[#141512] border border-[#FF5A1F]/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#242720] pb-2">
                  <span className="text-xs font-bold font-mono text-[#FF5A1F]">قاعدة البيانات السحابية (Firestore)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#D7FF38]/15 text-[#D7FF38]">
                    القاعدة الأساسية
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 bg-[#1B1D18] rounded-lg">
                    <span className="text-[#F2EBDD]/50 block text-[10px]">العناصر والألعاب</span>
                    <span className="text-base font-bold text-[#D7FF38]">{items.length}</span>
                  </div>
                  <div className="p-2.5 bg-[#1B1D18] rounded-lg">
                    <span className="text-[#F2EBDD]/50 block text-[10px]">التصنيفات</span>
                    <span className="text-base font-bold text-[#D7FF38]">{categories.length}</span>
                  </div>
                  <div className="p-2.5 bg-[#1B1D18] rounded-lg">
                    <span className="text-[#F2EBDD]/50 block text-[10px]">الأقسام</span>
                    <span className="text-base font-bold text-[#D7FF38]">{sections.length}</span>
                  </div>
                  <div className="p-2.5 bg-[#1B1D18] rounded-lg">
                    <span className="text-[#F2EBDD]/50 block text-[10px]">غرف اللعب</span>
                    <span className="text-base font-bold text-[#D7FF38]">{rooms.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {migrationReport && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تمت عملية الترحيل السحابي بنجاح:</span>
                </div>
                <p className="font-mono text-[11px]">
                  الإعدادات: {migrationReport.settingsMigrated ? 'تم التحديث' : '—'} | التصنيفات: {migrationReport.categoriesMigrated} | الأقسام: {migrationReport.sectionsMigrated} | المحتوى: {migrationReport.contentMigrated} | الإنجازات: {migrationReport.achievementsSeeded}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#262822]">
              <p className="text-[11px] text-[#F2EBDD]/50">
                الترحيل يستخدم <code className="font-mono text-[#D7FF38]">writeBatch</code> لضمان عدم فقدان أي سجل أو تكرار المحتوى الموجود سحابياً.
              </p>
              <button
                onClick={handleMigrateToFirestore}
                disabled={isMigrating || !isVerifiedFirebaseAdmin}
                className="px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] disabled:opacity-50 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-2 shadow-lg shadow-[#FF5A1F]/20"
              >
                <Cloud className="w-4 h-4" />
                <span>{isMigrating ? 'جاري الترحيل إلى Firestore...' : 'ترحيل البيانات الآن إلى Cloud Firestore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Security & Admin Credentials */}
      {activeTab === 'security' && (
        <div className="max-w-xl bg-[#1C1E19] border border-[#2D3027] rounded-xl p-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold font-mono text-[#F2EBDD] flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#FF5A1F]" />
              <span>أمان حساب الإدارة وتغيير كلمة المرور</span>
            </h2>
            <p className="text-xs text-[#F2EBDD]/60 leading-relaxed">
              لحماية المنصة، يمكنك في أي وقت استبدال كلمة المرور (<code className="text-[#D7FF38] font-mono">abdo</code>) بكلمة مرور جديدة خاصة بك.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-[#F2EBDD]/60 mb-1 font-mono">كلمة المرور الحالية</label>
              <input
                type="password"
                value={currentPw || ''}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="كلمة المرور الحالية..."
                className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
              />
            </div>

            <div>
              <label className="block text-[#F2EBDD]/60 mb-1 font-mono">كلمة المرور الجديدة</label>
              <input
                type="password"
                value={newPw || ''}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="كلمة المرور الجديدة (6 أحرف كحد أدنى)..."
                className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
              />
            </div>

            {pwMessage && (
              <p className={`text-xs font-mono ${pwMessage.startsWith('خطأ') ? 'text-red-400' : 'text-[#D7FF38]'}`}>
                {pwMessage}
              </p>
            )}

            <button
              type="submit"
              className="px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-lg text-xs cursor-pointer"
            >
              تحديث كلمة المرور
            </button>
          </form>
        </div>
      )}

      {/* Content Create/Edit Modal with Form Validation */}
      {isContentModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#1C1E19] border border-[#2D3027] rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-right">
            <h3 className="text-lg font-bold font-mono text-[#F2EBDD]">
              {editingItem.id ? 'تعديل العمل الإبداعي' : `نشر عمل جديد: ${editingItem.type?.toUpperCase()}`}
            </h3>

            <form onSubmit={handleSaveContent} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#F2EBDD]/60 mb-1 font-mono">العنوان *</label>
                  <input
                    type="text"
                    required
                    value={editingItem.title || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                    className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                    placeholder="عنوان العمل أو التطبيق..."
                  />
                </div>

                <div>
                  <label className="block text-[#F2EBDD]/60 mb-1 font-mono">النوع *</label>
                  <select
                    value={editingItem.type || 'game'}
                    onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value as ContentType })}
                    className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                  >
                    <option value="game">لعبة / محاكاة (Game)</option>
                    <option value="app">تطبيق برمجي (App)</option>
                    <option value="project">مشروع هندسي (Project)</option>
                    <option value="book">كتاب / منشور (Book)</option>
                    <option value="podcast">حلقة بودكاست (Podcast)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#F2EBDD]/60 mb-1 font-mono">التصنيف *</label>
                <input
                  type="text"
                  required
                  value={editingItem.category || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  placeholder="مثال: أكشن ومحاكاة، برمجيات توليفية، معمار ورقميات"
                  className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                />
              </div>

              <div>
                <label className="block text-[#F2EBDD]/60 mb-1 font-mono">ملخص قصير</label>
                <input
                  type="text"
                  value={editingItem.summary || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, summary: e.target.value })}
                  placeholder="سطر تعريفي موجز..."
                  className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                />
              </div>

              <div>
                <label className="block text-[#F2EBDD]/60 mb-1 font-mono">الوصف والشرح المفصل</label>
                <textarea
                  rows={4}
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  placeholder="الوصف الكامل والملاحظات التقنية والتصميمية..."
                  className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD] resize-none"
                />
              </div>

              <div>
                <label className="block text-[#F2EBDD]/60 mb-1 font-mono">رابط صورة الغلاف أو اللقطة الرئيسية</label>
                <input
                  type="text"
                  value={editingItem.coverImage || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, coverImage: e.target.value })}
                  placeholder="https://... أو مسار الصورة"
                  className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                />
              </div>

              {/* Game Specific Launch Config */}
              {editingItem.type === 'game' && (
                <div className="p-4 bg-[#141512] border border-[#2D3028] rounded-xl space-y-3">
                  <h4 className="font-mono text-[#D7FF38] uppercase text-[11px]">إعدادات تشغيل اللعبة</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#F2EBDD]/60 mb-1">نمط التشغيل</label>
                      <select
                        value={editingItem.gameConfig?.launchMode || 'internal_embed'}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            gameConfig: { ...editingItem.gameConfig, launchMode: e.target.value as any } as any,
                          })
                        }
                        className="w-full bg-[#1C1E19] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                      >
                        <option value="internal_embed">تضمين المتصفح (Iframe / WebGL)</option>
                        <option value="apk_download">تحميل حزمة أندرويد (APK)</option>
                        <option value="external_url">موقع خارجي مستقل</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#F2EBDD]/60 mb-1">رابط ملف APK أو صفحة اللعبة</label>
                      <input
                        type="text"
                        value={editingItem.gameConfig?.apkUrl || editingItem.gameConfig?.webGameUrl || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            gameConfig: {
                              ...editingItem.gameConfig,
                              apkUrl: e.target.value,
                              webGameUrl: e.target.value,
                            } as any,
                          })
                        }
                        placeholder="https://.../game.apk"
                        className="w-full bg-[#1C1E19] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Podcast Audio URL */}
              {editingItem.type === 'podcast' && (
                <div className="p-4 bg-[#141512] border border-[#2D3028] rounded-xl space-y-3">
                  <h4 className="font-mono text-[#D7FF38] uppercase text-[11px]">إعدادات البودكاست</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#F2EBDD]/60 mb-1">رابط الملف الصوتي (MP3 / Stream)</label>
                      <input
                        type="text"
                        value={editingItem.podcastConfig?.audioUrl || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            podcastConfig: { ...editingItem.podcastConfig, audioUrl: e.target.value } as any,
                          })
                        }
                        placeholder="https://.../episode.mp3"
                        className="w-full bg-[#1C1E19] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#F2EBDD]/60 mb-1">رقم الحلقة</label>
                      <input
                        type="number"
                        value={editingItem.podcastConfig?.episodeNumber ?? 1}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          setEditingItem({
                            ...editingItem,
                            podcastConfig: {
                              ...editingItem.podcastConfig,
                              episodeNumber: isNaN(parsed) ? 1 : parsed,
                            } as any,
                          });
                        }}
                        className="w-full bg-[#1C1E19] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions & Audience */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#F2EBDD]/60 mb-1 font-mono">صلاحية الوصول</label>
                  <select
                    value={editingItem.audience || 'public'}
                    onChange={(e) => setEditingItem({ ...editingItem, audience: e.target.value as any })}
                    className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                  >
                    <option value="public">عام (متاح للجميع)</option>
                    <option value="members">للأعضاء المسجلين فقط</option>
                    <option value="approved">للحسابات المعتمدة فقط</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#F2EBDD]/60 mb-1 font-mono">حالة النشر</label>
                  <select
                    value={editingItem.status || 'published'}
                    onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as any })}
                    className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                  >
                    <option value="published">منشور (ظاهر في الموقع)</option>
                    <option value="draft">مسودة (Draft)</option>
                    <option value="archived">مؤرشف</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsContentModalOpen(false)}
                  className="px-4 py-2 text-[#F2EBDD]/60 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-lg cursor-pointer"
                >
                  حفظ ونشر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Section Modal */}
      {isSectionModalOpen && editingSection && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#1C1E19] border border-[#2D3027] rounded-2xl p-6 max-w-lg w-full space-y-5 text-right">
            <h3 className="text-lg font-bold font-mono text-[#F2EBDD]">
              {editingSection.id ? 'تعديل القسم' : 'إنشاء قسم جديد في الرئيسية'}
            </h3>

            <form onSubmit={handleSaveSection} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#F2EBDD]/60 mb-1 font-mono">اسم القسم *</label>
                <input
                  type="text"
                  required
                  value={editingSection.name || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                  placeholder="مثال: ألعاب المستقبل، أدوات برمجية..."
                  className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                />
              </div>

              <div>
                <label className="block text-[#F2EBDD]/60 mb-1 font-mono">الوصف</label>
                <input
                  type="text"
                  value={editingSection.description || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                  placeholder="شرح موجز لمحتويات هذا القسم..."
                  className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#F2EBDD]/60 mb-1 font-mono">نمط التنسيق (Layout)</label>
                  <select
                    value={editingSection.layoutType || 'editorial'}
                    onChange={(e) => setEditingSection({ ...editingSection, layoutType: e.target.value as any })}
                    className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                  >
                    <option value="editorial">بطاقات تحريرية (Editorial)</option>
                    <option value="bento">شبكة بينتو (Bento Grid)</option>
                    <option value="carousel">شريط أفقي متحرك (Carousel)</option>
                    <option value="grid">شبكة مربعات قياسية (Grid)</option>
                    <option value="media_showcase">عرض وسائط مميز (Media)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#F2EBDD]/60 mb-1 font-mono">قاعدة الفلترة</label>
                  <select
                    value={editingSection.filterType || 'all'}
                    onChange={(e) => setEditingSection({ ...editingSection, filterType: e.target.value as any })}
                    className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                  >
                    <option value="all">كافة الأعمال</option>
                    <option value="featured">الأعمال المميزة</option>
                    <option value="fresh_drops">أحدث الإضافات</option>
                    <option value="category">حسب التصنيف المحدد</option>
                  </select>
                </div>
              </div>

              {editingSection.filterType === 'category' && (
                <div>
                  <label className="block text-[#F2EBDD]/60 mb-1 font-mono">النوع المستهدف</label>
                  <select
                    value={editingSection.categoryTarget || 'game'}
                    onChange={(e) => setEditingSection({ ...editingSection, categoryTarget: e.target.value })}
                    className="w-full bg-[#141512] border border-[#2D3028] rounded p-2 text-[#F2EBDD]"
                  >
                    <option value="game">الألعاب (Games)</option>
                    <option value="app">التطبيقات (Apps)</option>
                    <option value="project">المشاريع (Projects)</option>
                    <option value="book">الكتب (Books)</option>
                    <option value="podcast">البودكاست (Podcasts)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSection.isEnabled !== false}
                    onChange={(e) => setEditingSection({ ...editingSection, isEnabled: e.target.checked })}
                    className="accent-[#FF5A1F]"
                  />
                  <span>مفعّل وظاهر في الرئيسية</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingSection.isDraft}
                    onChange={(e) => setEditingSection({ ...editingSection, isDraft: e.target.checked })}
                    className="accent-[#FF5A1F]"
                  />
                  <span>وضع المسودة (مخفي عن الزوار)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSectionModalOpen(false)}
                  className="px-4 py-2 text-[#F2EBDD]/60 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-lg cursor-pointer"
                >
                  حفظ القسم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Professional Game Form Modal */}
      {isGameModalOpen && (
        <GameFormModal
          key={gameToEdit?.id || 'new-game'}
          gameToEdit={gameToEdit}
          onClose={() => {
            setIsGameModalOpen(false);
            setGameToEdit(null);
          }}
          onSuccess={handleGameSaved}
        />
      )}

      {/* Game Test Launch Modal */}
      {testingGame && (
        <GameLaunchModal
          game={testingGame}
          onClose={() => setTestingGame(null)}
        />
      )}

      {/* Categories Management Modal */}
      {isCategoriesModalOpen && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1C1E19] border border-[#2D3027] rounded-2xl max-w-md w-full p-6 space-y-5 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#2A2D25] pb-3">
              <h3 className="text-base font-bold font-mono text-[#F2EBDD]">
                {editingCategory ? 'تعديل بيانات التصنيف' : 'إضافة تصنيف ألعاب جديد'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCategoriesModalOpen(false);
                  setEditingCategory(null);
                  setNewCatName('');
                  setNewCatDescription('');
                }}
                className="text-[#F2EBDD]/60 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#F2EBDD]/80 mb-1.5 font-mono font-bold">
                  اسم التصنيف <span className="text-[#FF5A1F]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCatName || ''}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="مثال: ألعاب البقاء والخيال، المحاكاة الفضائية..."
                  className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl px-3.5 py-2.5 text-xs text-[#F2EBDD] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#F2EBDD]/80 mb-1.5 font-mono">
                  وصف التصنيف (اختياري)
                </label>
                <textarea
                  rows={3}
                  value={newCatDescription || ''}
                  onChange={(e) => setNewCatDescription(e.target.value)}
                  placeholder="شرح موجز لنوعية الألعاب التي تنتمي لهذا التصنيف..."
                  className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl p-3 text-xs text-[#F2EBDD] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoriesModalOpen(false);
                    setEditingCategory(null);
                    setNewCatName('');
                    setNewCatDescription('');
                  }}
                  className="px-4 py-2.5 text-xs text-[#F2EBDD]/60 hover:text-white cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingCat || !newCatName.trim()}
                  className="px-5 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 transition-colors shadow-md shadow-[#FF5A1F]/20"
                >
                  {isAddingCat ? 'جاري الحفظ...' : editingCategory ? 'تحديث التصنيف' : 'حفظ التصنيف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
