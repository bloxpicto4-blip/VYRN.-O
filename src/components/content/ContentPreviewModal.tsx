import React, { useEffect, useState } from 'react';
import { X, Heart, Play, Download, Headphones, BookOpen, Layers, ArrowLeft } from 'lucide-react';
import { ContentItem } from '../../types';

interface ContentPreviewModalProps {
  item: ContentItem;
  onClose: () => void;
  onOpenDetail: (item: ContentItem) => void;
  onLaunchGame: (item: ContentItem) => void;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
}

export const ContentPreviewModal: React.FC<ContentPreviewModalProps> = ({
  item,
  onClose,
  onOpenDetail,
  onLaunchGame,
  onToggleFavorite,
  isFavorite = false,
}) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrimaryAction = () => {
    if (item.type === 'game') {
      onLaunchGame(item);
    } else {
      onOpenDetail(item);
    }
  };

  const isNewBadgeActive = () => {
    if (!item.newBadge?.enabled) return false;
    const now = new Date();
    if (item.newBadge.activeDate && new Date(item.newBadge.activeDate) > now) return false;
    if (item.newBadge.expireDate && new Date(item.newBadge.expireDate) < now) return false;
    return true;
  };

  return (
    <div
      onClick={onClose}
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#1C1E19] border border-[#2F332C] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-right"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/60 text-[#F2EBDD]/70 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
          title="إغلاق المعاينة (ESC)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Media Preview Banner */}
        <div className="relative aspect-[16/9] w-full bg-[#141512] overflow-hidden">
          {!imageError && item.coverImage ? (
            <img
              src={item.coverImage}
              alt={item.title}
              onError={() => setImageError(true)}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#262822] to-[#141512] text-[#F2EBDD]/40">
              <span className="font-mono text-sm">{item.title}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1E19] via-transparent to-black/30" />

          {/* Badges */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {isNewBadgeActive() && (
              <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-[#191A17] bg-[#D7FF38] rounded">
                {item.newBadge?.label || 'جديد'}
              </span>
            )}
            {item.isFeatured && (
              <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-white bg-[#FF5A1F] rounded">
                مميز
              </span>
            )}
          </div>
        </div>

        {/* Details & Actions Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#D7FF38] font-mono uppercase tracking-wider mb-1">
              <span>{item.type}</span>
              <span className="text-[#F2EBDD]/30">/</span>
              <span className="text-[#F2EBDD]/60">{item.category}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#F2EBDD] font-mono tracking-tight">
              {item.title}
            </h2>
          </div>

          <p className="text-sm text-[#F2EBDD]/80 leading-relaxed">
            {item.description}
          </p>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#F2EBDD]/60">
              {item.tags.map((tag, idx) => (
                <span key={tag} className="inline-flex items-center">
                  <span>#{tag}</span>
                  {idx < item.tags.length - 1 && <span className="mr-2 text-[#F2EBDD]/30">·</span>}
                </span>
              ))}
            </div>
          )}

          {/* Metrics Strip */}
          <div className="pt-3 border-t border-[#292C25] flex items-center justify-between text-xs text-[#F2EBDD]/50 font-mono tabular-nums">
            <div className="flex items-center gap-3">
              <span>{item.likesCount || 0} إعجاب</span>
              <span>·</span>
              <span>{item.viewsCount || 0} مشاهدة</span>
              {(item.downloadsCount || 0) > 0 && (
                <>
                  <span>·</span>
                  <span>{item.downloadsCount} تحميل</span>
                </>
              )}
            </div>
            <span>الناشر: {item.creator}</span>
          </div>

          {/* Actions Bar */}
          <div className="pt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {onToggleFavorite && (
                <button
                  onClick={() => onToggleFavorite(item.id)}
                  className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    isFavorite
                      ? 'bg-[#FF5A1F]/20 border-[#FF5A1F] text-[#FF5A1F]'
                      : 'bg-[#252822] border-[#343831] text-[#F2EBDD]/70 hover:text-white'
                  }`}
                  title={isFavorite ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#FF5A1F]' : ''}`} />
                </button>
              )}

              <button
                onClick={() => onOpenDetail(item)}
                className="px-4 py-2.5 text-xs font-bold text-[#F2EBDD]/80 hover:text-white bg-[#252822] hover:bg-[#2F322B] border border-[#343831] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>التفاصيل الكاملة</span>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              </button>
            </div>

            <button
              onClick={handlePrimaryAction}
              className="px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-[#FF5A1F]/20 cursor-pointer"
            >
              {item.type === 'game' ? (
                <>
                  <Play className="w-4 h-4 fill-current ml-1" />
                  <span>تشغيل / فتح اللعبة</span>
                </>
              ) : item.type === 'podcast' ? (
                <>
                  <Headphones className="w-4 h-4 ml-1" />
                  <span>الاستماع للحلقة</span>
                </>
              ) : item.type === 'book' ? (
                <>
                  <BookOpen className="w-4 h-4 ml-1" />
                  <span>قراءة المنشور</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 ml-1" />
                  <span>معاينة المشروع</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
