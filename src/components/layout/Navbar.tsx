import React, { useState } from 'react';
import { Search, Bell, Heart, Shield, LogIn, Menu, X, Trophy } from 'lucide-react';
import { Logo } from '../brand/Logo';
import { useAuth } from '../../context/AuthContext';
import { NotificationItem } from '../../types';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, filter?: string) => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  notifications: NotificationItem[];
  favoritesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenSearch,
  onOpenNotifications,
  onOpenAuth,
  onOpenProfile,
  notifications,
  favoritesCount,
}) => {
  const { currentUser, userStats } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navLinks = [
    { label: 'الرئيسية', view: 'home' },
    { label: 'استكشاف', view: 'discover' },
    { label: 'الألعاب', view: 'category', filter: 'game' },
    { label: 'غرف اللعب', view: 'rooms' },
    { label: 'الإنجازات', view: 'achievements' },
    { label: 'التطبيقات', view: 'category', filter: 'app' },
    { label: 'المشاريع', view: 'category', filter: 'project' },
    { label: 'الكتب', view: 'category', filter: 'book' },
    { label: 'البودكاست', view: 'category', filter: 'podcast' },
  ];

  const handleLinkClick = (view: string, filter?: string) => {
    onNavigate(view, filter);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#191A17]/90 backdrop-blur-md border-b border-[#2D302A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark & Emblem */}
        <button
          onClick={() => handleLinkClick('home')}
          className="flex items-center gap-2 text-right cursor-pointer shrink-0 focus-visible:outline-[#FF5A1F]"
        >
          <Logo size="md" showWordmark={true} />
        </button>

        {/* Zone 2: Navigation Links in Arabic */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-[#F2EBDD]/70">
          {navLinks.map((link) => {
            const isActive =
              currentView === link.view &&
              (link.filter ? (window as any)._vyrnCurrentCategory === link.filter : true);
            return (
              <button
                key={link.label}
                onClick={() => handleLinkClick(link.view, link.filter)}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 relative hover:text-[#F2EBDD] cursor-pointer ${
                  isActive ? 'text-[#FF5A1F] font-bold' : ''
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5A1F] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Functional Affordances (Search, Favorites, Notifications, User) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Quick Search Trigger */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#F2EBDD]/60 hover:text-[#F2EBDD] bg-[#22241F] hover:bg-[#2A2C26] border border-[#343831] rounded-lg transition-colors cursor-pointer"
            title="بحث في المنصة (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">بحث...</span>
            <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] font-mono bg-[#191A17] text-[#F2EBDD]/50 border border-[#343831] rounded">
              /
            </kbd>
          </button>

          {/* Favorites */}
          {currentUser && (
            <button
              onClick={() => onNavigate('favorites')}
              className={`relative p-2 rounded-lg border transition-colors cursor-pointer ${
                currentView === 'favorites'
                  ? 'bg-[#FF5A1F]/15 border-[#FF5A1F] text-[#FF5A1F]'
                  : 'bg-[#22241F] border-[#343831] text-[#F2EBDD]/70 hover:text-[#F2EBDD]'
              }`}
              title="المفضلة المحفوظة"
            >
              <Heart className="w-4 h-4" />
              {favoritesCount > 0 && (
                <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-[#FF5A1F] text-white text-[10px] font-bold flex items-center justify-center">
                  {favoritesCount}
                </span>
              )}
            </button>
          )}

          {/* Notifications */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-lg bg-[#22241F] border border-[#343831] text-[#F2EBDD]/70 hover:text-[#F2EBDD] transition-colors cursor-pointer"
            title="التنبيهات"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-[#D7FF38] text-[#191A17] text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Admin Dashboard Quick Access */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-[#FF5A1F] text-white'
                  : 'bg-[#FF5A1F]/15 text-[#FF5A1F] hover:bg-[#FF5A1F]/25 border border-[#FF5A1F]/30'
              }`}
              title="لوحة تحكم الإدارة"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">لوحة الإدارة</span>
            </button>
          )}

          {/* Profile or Sign In */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              {userStats && (
                <button
                  onClick={() => onNavigate('achievements')}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D7FF38]/10 border border-[#D7FF38]/30 text-[#D7FF38] text-[11px] font-mono font-bold cursor-pointer hover:bg-[#D7FF38]/20 transition-colors"
                  title="النقاط والإنجازات"
                >
                  <Trophy className="w-3 h-3" />
                  <span className="tabular-nums">{userStats.points}</span>
                </button>
              )}
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-2 pr-2 pl-3 py-1 rounded-lg bg-[#22241F] border border-[#343831] hover:border-[#FF5A1F]/50 transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-[#FF5A1F]/20 text-[#FF5A1F] flex items-center justify-center text-xs font-mono font-bold">
                  {currentUser.displayName.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-[#F2EBDD] max-w-[100px] truncate hidden md:inline">
                  {currentUser.displayName}
                </span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#191A17] bg-[#F2EBDD] hover:bg-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5 ml-1 rtl-flip" />
              <span>تسجيل الدخول</span>
            </button>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 lg:hidden text-[#F2EBDD]/70 hover:text-[#F2EBDD] bg-[#22241F] border border-[#343831] rounded-lg cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#1E201B] border-b border-[#2D302A] px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleLinkClick(link.view, link.filter)}
              className="block w-full text-right px-3 py-2 text-sm font-medium text-[#F2EBDD]/80 hover:text-[#FF5A1F] hover:bg-[#252822] rounded-lg transition-colors"
            >
              {link.label}
            </button>
          ))}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => handleLinkClick('admin')}
              className="block w-full text-right px-3 py-2 text-sm font-bold text-[#FF5A1F] bg-[#FF5A1F]/10 rounded-lg"
            >
              لوحة تحكم الإدارة
            </button>
          )}
        </div>
      )}
    </header>
  );
};
