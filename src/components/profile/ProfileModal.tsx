import React, { useState, useEffect } from 'react';
import { X, LogOut, Check, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface ProfileModalProps {
  onClose: () => void;
  onOpenAdmin?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, onOpenAdmin }) => {
  const { currentUser, updateProfile, logout } = useAuth();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [showFavorites, setShowFavorites] = useState(
    currentUser?.privacySettings?.showFavorites ?? true
  );
  const [showActivity, setShowActivity] = useState(
    currentUser?.privacySettings?.showActivity ?? true
  );
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setBio(currentUser.bio || '');
      setShowFavorites(currentUser.privacySettings?.showFavorites ?? true);
      setShowActivity(currentUser.privacySettings?.showActivity ?? true);
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        privacySettings: {
          showFavorites,
          showActivity,
        },
      });
      setIsSaved(true);
      showToast('تم حفظ تعديلات الملف الشخصي.', 'success');
      setTimeout(() => setIsSaved(false), 2000);
    } catch (e: any) {
      showToast(e.message || 'فشل تحديث الملف الشخصي.', 'error');
    }
  };

  return (
    <div
      onClick={onClose}
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#1C1E19] border border-[#2E3129] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative text-right"
      >
        <button
          onClick={onClose}
          className="absolute top-5 left-5 text-[#F2EBDD]/60 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FF5A1F]/20 text-[#FF5A1F] flex items-center justify-center text-lg font-mono font-bold">
            {currentUser.displayName ? currentUser.displayName.charAt(0) : 'U'}
          </div>
          <div>
            <h3 className="text-base font-bold text-[#F2EBDD] font-mono">{currentUser.displayName || 'مستخدم'}</h3>
            <p className="text-xs text-[#F2EBDD]/50 font-mono">
              @{currentUser.username} · {currentUser.role === 'admin' ? 'مدير المنصة' : 'عضو مسجل'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#F2EBDD]/60 mb-1 font-mono">الاسم المعروض (Display Name)</label>
            <input
              type="text"
              value={displayName || ''}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#141512] border border-[#2B2D26] rounded-lg p-2.5 text-[#F2EBDD]"
            />
          </div>

          <div>
            <label className="block text-[#F2EBDD]/60 mb-1 font-mono">النبذة التعريفية (Bio)</label>
            <textarea
              rows={3}
              value={bio || ''}
              onChange={(e) => setBio(e.target.value)}
              placeholder="اكتب نبذة عن اهتماماتك الإبداعية، أدواتك، أو مشاريعك..."
              className="w-full bg-[#141512] border border-[#2B2D26] rounded-lg p-2.5 text-[#F2EBDD] resize-none"
            />
          </div>

          <div className="p-3.5 bg-[#141512] border border-[#272922] rounded-xl space-y-2">
            <span className="text-[11px] font-mono uppercase text-[#D7FF38] block tracking-wider">
              خيارات الخصوصية والظهور
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFavorites}
                onChange={(e) => setShowFavorites(e.target.checked)}
                className="rounded accent-[#FF5A1F]"
              />
              <span className="text-[#F2EBDD]/80">إظهار المفضلة المحفوظة في ملفي الشخصي العام</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActivity}
                onChange={(e) => setShowActivity(e.target.checked)}
                className="rounded accent-[#FF5A1F]"
              />
              <span className="text-[#F2EBDD]/80">مشاركة نشاط التفاعل والتعليقات في المجتمع</span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="px-5 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{isSaved ? 'تم الحفظ' : 'حفظ التعديلات'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
                onClose();
              }}
              className="px-3 py-2 text-red-400 hover:text-red-300 flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5 ml-1 rtl-flip" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </form>

        {currentUser.role === 'admin' && onOpenAdmin && (
          <div className="pt-3 border-t border-[#272922]">
            <button
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
              className="w-full py-2 bg-[#FF5A1F]/15 hover:bg-[#FF5A1F]/25 text-[#FF5A1F] text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer border border-[#FF5A1F]/30"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>فتح لوحة تحكم الإدارة</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
