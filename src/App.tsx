import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { CinematicIntro } from './components/intro/CinematicIntro';
import { HeroBanner } from './components/home/HeroBanner';
import { DynamicSection } from './components/home/DynamicSection';
import { ContentPreviewModal } from './components/content/ContentPreviewModal';
import { ContentDetailPage } from './components/content/ContentDetailPage';
import { GameLaunchModal } from './components/game/GameLaunchModal';
import { CategoryView } from './components/content/CategoryView';
import { AdvancedSearchPage } from './components/search/AdvancedSearchPage';
import { UniversalSearchModal } from './components/search/UniversalSearchModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { FavoritesPage } from './components/favorites/FavoritesPage';
import { MultiplayerRoomsPage } from './components/multiplayer/MultiplayerRoomsPage';
import { AchievementsPage } from './components/achievements/AchievementsPage';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { AuthModal } from './components/auth/AuthModal';
import { ProfileModal } from './components/profile/ProfileModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ContentItem, SectionConfig, PlatformSettings, NotificationItem, ContentType } from './types';
import { api } from './lib/api';

const MainApp: React.FC = () => {
  const { currentUser, isAuthReady, isFirebaseAuthenticated } = useAuth();
  const { showToast } = useToast();

  // Navigation & View State
  const [currentView, setCurrentView] = useState<
    'home' | 'category' | 'discover' | 'favorites' | 'rooms' | 'achievements' | 'admin' | 'detail'
  >('home');
  const [currentCategory, setCurrentCategory] = useState<ContentType>('game');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [adminCreateType, setAdminCreateType] = useState<ContentType | undefined>(undefined);

  // Selected item modal states
  const [activeDetailItem, setActiveDetailItem] = useState<ContentItem | null>(null);
  const [activePreviewItem, setActivePreviewItem] = useState<ContentItem | null>(null);
  const [activeLaunchGame, setActiveLaunchGame] = useState<ContentItem | null>(null);

  // Overlays
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showCinematicIntro, setShowCinematicIntro] = useState(true);

  // Platform and Data state
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  const canAccessItem = useCallback(
    (item: ContentItem | null) => {
      if (!item) return false;
      if (currentUser?.role === 'admin') return true;
      if (item.status !== 'published') return false;
      if (item.audience === 'public') return true;
      if (item.audience === 'members') return Boolean(currentUser);
      if (item.audience === 'approved') return Boolean(currentUser?.isApproved);
      return false;
    },
    [currentUser]
  );

  const loadPlatformData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [settingsData, itemsData, sectionsData, notifsData, favsData] = await Promise.all([
        api.getSettings().catch(() => null),
        api.getContent().catch(() => []),
        api.getSections().catch(() => []),
        api.getNotifications().catch(() => []),
        currentUser ? api.getFavorites().catch(() => []) : Promise.resolve([]),
      ]);
      setSettings(settingsData);
      setItems(itemsData);
      setSections(sectionsData);
      setNotifications(notifsData);
      setFavoriteIds(favsData.map((f) => f.id));
    } catch (e) {
      console.error('Failed to load initial platform data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Wait for Firebase Auth restoration before fetching content & deep links; reload on auth state change
  useEffect(() => {
    if (!isAuthReady) return;
    loadPlatformData();

    if (!currentUser) {
      setFavoriteIds([]);
      setActiveDetailItem((prev) => (prev && (prev.audience !== 'public' || prev.status !== 'published') ? null : prev));
      setActivePreviewItem((prev) => (prev && (prev.audience !== 'public' || prev.status !== 'published') ? null : prev));
      setActiveLaunchGame((prev) => (prev && (prev.audience !== 'public' || prev.status !== 'published') ? null : prev));
      setCurrentView((prevView) => {
        if (prevView === 'admin' || prevView === 'favorites') {
          if (window.location.hash === '#admin' || window.location.hash === '#favorites') {
            window.location.hash = '';
          }
          return 'home';
        }
        return prevView;
      });
    } else {
      setActiveDetailItem((prev) => (prev && !canAccessItem(prev) ? null : prev));
      setActivePreviewItem((prev) => (prev && !canAccessItem(prev) ? null : prev));
    }
  }, [isAuthReady, currentUser?.id, currentUser?.role, currentUser?.isApproved, isFirebaseAuthenticated, loadPlatformData, canAccessItem]);

  // Deep-link router synchronized with auth readiness
  useEffect(() => {
    if (!isAuthReady) return;

    const handleHash = async () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('item/')) {
        const itemId = hash.replace('item/', '').trim();
        if (!itemId) return;
        try {
          const item = await api.getContentById(itemId);
          if (item && canAccessItem(item)) {
            setActiveDetailItem(item);
            setCurrentView('detail');
          } else {
            setActiveDetailItem(null);
            setCurrentView('home');
            window.location.hash = '';
            showToast('هذا المحتوى مخصص لأعضاء محددين فقط.', 'warning');
          }
        } catch {
          setActiveDetailItem(null);
          setCurrentView('home');
          if (!currentUser) {
            showToast('يرجى تسجيل الدخول للوصول إلى هذا المحتوى.', 'warning');
            setIsAuthOpen(true);
          } else {
            showToast('تعذر العثور على المحتوى المطلوب أو لا تملك صلاحية عرضه.', 'error');
            window.location.hash = '';
          }
        }
      } else if (hash.startsWith('category/')) {
        const cat = hash.replace('category/', '') as ContentType;
        setCurrentCategory(cat);
        (window as any)._vyrnCurrentCategory = cat;
        setCurrentView('category');
      } else if (hash === 'admin') {
        if (!currentUser) {
          setCurrentView('home');
          setIsAuthOpen(true);
          showToast('يرجى تسجيل الدخول بحساب الإدارة للوصول إلى لوحة التحكم.', 'warning');
        } else {
          setCurrentView('admin');
        }
      } else if (hash === 'discover') {
        setCurrentView('discover');
      } else if (hash === 'favorites') {
        if (!currentUser) {
          setCurrentView('home');
          setIsAuthOpen(true);
          showToast('يرجى تسجيل الدخول لعرض خزينة المفضلة.', 'warning');
        } else {
          setCurrentView('favorites');
        }
      } else if (hash === 'rooms') {
        setCurrentView('rooms');
      } else if (hash === 'achievements') {
        setCurrentView('achievements');
      } else if (hash === '') {
        setActiveDetailItem(null);
        setCurrentView('home');
      }
    };

    window.addEventListener('hashchange', handleHash);
    handleHash();

    return () => window.removeEventListener('hashchange', handleHash);
  }, [isAuthReady, currentUser?.id, currentUser?.role, currentUser?.isApproved, canAccessItem, showToast]);

  const handleNavigate = (view: string, filter?: string) => {
    if (view === 'category' && filter) {
      setCurrentCategory(filter as ContentType);
      (window as any)._vyrnCurrentCategory = filter;
      setCurrentView('category');
      window.location.hash = `category/${filter}`;
    } else if (view === 'discover') {
      setCurrentView('discover');
      window.location.hash = 'discover';
    } else if (view === 'favorites') {
      setCurrentView('favorites');
      window.location.hash = 'favorites';
    } else if (view === 'rooms') {
      setCurrentView('rooms');
      window.location.hash = 'rooms';
    } else if (view === 'achievements') {
      setCurrentView('achievements');
      window.location.hash = 'achievements';
    } else if (view === 'admin') {
      setAdminCreateType(undefined);
      setCurrentView('admin');
      window.location.hash = 'admin';
    } else {
      setCurrentView('home');
      window.location.hash = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminAddClick = (categoryTarget?: string) => {
    setAdminCreateType((categoryTarget as ContentType) || 'game');
    setCurrentView('admin');
    window.location.hash = 'admin';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectItem = (item: ContentItem) => {
    setActivePreviewItem(item);
  };

  const handleOpenDetail = (item: ContentItem) => {
    setActivePreviewItem(null);
    setActiveDetailItem(item);
    setCurrentView('detail');
    window.location.hash = `item/${item.id}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleFavorite = async (id: string) => {
    if (!currentUser || !isFirebaseAuthenticated) {
      showToast('يرجى تسجيل الدخول بحساب Firebase لحفظ المفضلة.', 'info');
      setIsAuthOpen(true);
      return;
    }
    try {
      const res = await api.toggleFavorite(id);
      if (res.isFavorite) {
        setFavoriteIds((prev) => Array.from(new Set([...prev, id])));
        showToast('تمت الإضافة إلى المفضلة.', 'success');
      } else {
        setFavoriteIds((prev) => prev.filter((fid) => fid !== id));
        showToast('تمت الإزالة من المفضلة.', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'فشل حفظ المفضلة', 'error');
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to filter items for dynamic sections
  const getItemsForSection = (section: SectionConfig): ContentItem[] => {
    let result = [...items];
    if (section.filterType === 'featured') {
      result = result.filter((i) => i.isFeatured);
    } else if (section.filterType === 'editors_picks') {
      result = result.filter((i) => i.isEditorsPick);
    } else if (section.filterType === 'fresh_drops') {
      result = result.slice(0, 4);
    } else if (section.filterType === 'category' && section.categoryTarget) {
      result = result.filter((i) => i.type === section.categoryTarget);
    }
    return result;
  };

  const featuredFlagship = items.find((i) => i.isFeatured) || items[0];

  return (
    <div
      dir="rtl"
      className={`min-h-screen bg-[#191A17] text-[#F2EBDD] flex flex-col font-sans ${
        reducedMotion ? 'motion-reduce' : ''
      }`}
    >
      {/* Cinematic Brand Intro (Arabic-first, skippable) */}
      {showCinematicIntro && (
        <CinematicIntro
          onComplete={() => setShowCinematicIntro(false)}
          brandTagline={settings?.brandTagline || 'عالم تصنعه بنفسك.'}
        />
      )}

      {/* Top Bar Navigation (RTL aligned, Arabic) */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        notifications={notifications}
        favoritesCount={favoriteIds.length}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {/* VIEW 1: Full Detail Page */}
        {currentView === 'detail' && activeDetailItem && (
          <ContentDetailPage
            item={activeDetailItem}
            onBack={() => {
              setActiveDetailItem(null);
              setCurrentView('home');
              window.location.hash = '';
            }}
            onLaunchGame={(item) => setActiveLaunchGame(item)}
            onToggleFavorite={handleToggleFavorite}
            isFavorite={favoriteIds.includes(activeDetailItem.id)}
            onRequireAuth={() => setIsAuthOpen(true)}
          />
        )}

        {/* VIEW 2: Category Library View */}
        {currentView === 'category' && (
          <CategoryView
            categoryType={currentCategory}
            onSelect={handleSelectItem}
            onToggleFavorite={handleToggleFavorite}
            favorites={favoriteIds}
            onAdminAdd={(type) => handleAdminAddClick(type)}
          />
        )}

        {/* VIEW 3: Universal Search / Advanced Results */}
        {currentView === 'discover' && (
          <AdvancedSearchPage
            initialQuery={searchQuery}
            onSelect={handleSelectItem}
            onToggleFavorite={handleToggleFavorite}
            favorites={favoriteIds}
          />
        )}

        {/* VIEW 4: Saved Favorites Vault */}
        {currentView === 'favorites' && (
          <FavoritesPage
            onSelect={handleSelectItem}
            onExplore={() => handleNavigate('home')}
          />
        )}

        {/* VIEW 4B: Multiplayer Game Rooms */}
        {currentView === 'rooms' && (
          <MultiplayerRoomsPage
            onRequireAuth={() => setIsAuthOpen(true)}
            onLaunchGame={(item) => setActiveLaunchGame(item)}
          />
        )}

        {/* VIEW 4C: Points, Achievements & Leaderboard */}
        {currentView === 'achievements' && (
          <AchievementsPage onRequireAuth={() => setIsAuthOpen(true)} />
        )}

        {/* VIEW 5: Administrative Dashboard */}
        {currentView === 'admin' && (
          <AdminDashboard
            initialCreateType={adminCreateType}
            onContentUpdated={() => loadPlatformData()}
          />
        )}

        {/* VIEW 6: Dynamic Public Homepage */}
        {currentView === 'home' && (
          <div className="space-y-4">
            {/* Split Screen Hero Banner */}
            <HeroBanner
              featuredItem={featuredFlagship}
              brandTagline={settings?.brandTagline || 'عالم تصنعه بنفسك.'}
              onLaunchFeatured={(item) => setActiveLaunchGame(item)}
              onExploreAll={() => handleNavigate('discover')}
              onAdminAdd={() => handleAdminAddClick()}
            />

            {/* Dynamic Content Sections Configured by Admin */}
            {sections
              .filter((s) => s.isEnabled && !s.isDraft)
              .map((section) => (
                <DynamicSection
                  key={section.id}
                  section={section}
                  items={getItemsForSection(section)}
                  onSelect={handleSelectItem}
                  onToggleFavorite={handleToggleFavorite}
                  favorites={favoriteIds}
                  onViewCategory={(cat) => handleNavigate('category', cat)}
                  onAdminAdd={(cat) => handleAdminAddClick(cat)}
                />
              ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer
        onNavigate={handleNavigate}
        brandTagline={settings?.brandTagline}
        onReplayIntro={() => setShowCinematicIntro(true)}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={() => setReducedMotion(!reducedMotion)}
      />

      {/* Content Quick Preview Modal */}
      {activePreviewItem && (
        <ContentPreviewModal
          item={activePreviewItem}
          onClose={() => setActivePreviewItem(null)}
          onOpenDetail={handleOpenDetail}
          onLaunchGame={(item) => setActiveLaunchGame(item)}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={favoriteIds.includes(activePreviewItem.id)}
        />
      )}

      {/* Game Dedicated Launcher Modal */}
      {activeLaunchGame && (
        <GameLaunchModal
          game={activeLaunchGame}
          onClose={() => setActiveLaunchGame(null)}
        />
      )}

      {/* Universal Search Modal */}
      {isSearchOpen && (
        <UniversalSearchModal
          onClose={() => setIsSearchOpen(false)}
          onSelect={handleSelectItem}
          onOpenAdvancedSearch={(q) => {
            setSearchQuery(q);
            setIsSearchOpen(false);
            setCurrentView('discover');
          }}
        />
      )}

      {/* In-app Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onNavigateToItem={(link) => {
          if (link.startsWith('#item/')) {
            const itemId = link.replace('#item/', '').trim();
            api
              .getContentById(itemId)
              .then((item) => {
                setActiveDetailItem(item);
                setCurrentView('detail');
                window.location.hash = `item/${item.id}`;
              })
              .catch(() => {
                showToast('تعذر فتح المحتوى المرتبط بالإشعار حالياً.', 'warning');
              });
          }
        }}
      />

      {/* Authentication Modal */}
      {isAuthOpen && (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
          onSuccess={() => {
            setIsAuthOpen(false);
            loadPlatformData();
          }}
        />
      )}

      {/* Profile & Privacy Modal */}
      {isProfileOpen && (
        <ProfileModal
          onClose={() => setIsProfileOpen(false)}
          onOpenAdmin={() => {
            setIsProfileOpen(false);
            setCurrentView('admin');
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <MainApp />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
