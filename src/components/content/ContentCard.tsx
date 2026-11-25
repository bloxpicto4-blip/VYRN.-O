import React, { useState } from 'react';
import { Heart, Play, Download, ExternalLink, Headphones, BookOpen, Layers, ArrowLeft } from 'lucide-react';
import { ContentItem } from '../../types';

interface ContentCardProps {
  item: ContentItem;
  onSelect: (item: ContentItem) => void;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
  layout?: 'editorial' | 'bento' | 'grid' | 'carousel';
  accentColor?: string;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  item,
  onSelect,
  onToggleFavorite,
  isFavorite = false,
  layout = 'grid',
  accentColor = '#FF5A1F',
}) => {
  const [imageError, setImageError] = useState(false);

  // Check if NEW badge should display based on dates
  const isNewBadgeActive = () => {
    if (!item.newBadge?.enabled) return false;
    const now = new Date();
    if (item.newBadge.activeDate && new Date(item.newBadge.activeDate) > now) return false;
    if (item.newBadge.expireDate && new Date(item.newBadge.expireDate) < now) return false;
    return true;
  };

  const getActionIcon = () => {
    switch (item.type) {
      case 'game':
        return <Play className="w-3.5 h-3.5 fill-current" />;
      case 'podcast':
        return <Headphones className="w-3.5 h-3.5" />;
      case 'book':
        return <BookOpen className="w-3.5 h-3.5" />;
      case 'app':
        return <Download className="w-3.5 h-3.5" />;
      default:
        return <Layers className="w-3.5 h-3.5" />;
    }
  };

  const getTypeLabel = () => {
    switch (item.type) {
      case 'game':
        return 'لعبة / محاكاة';
      case 'app':
        return 'تطبيق برمجي';
      case 'project':
        return 'مشروع هندسي';
      case 'book':
        return 'كتاب / منشور';
      case 'podcast':
        return 'تسجيل بودكاست';
      default:
        return item.type;
    }
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative flex flex-col bg-[#1F211C] border border-[#2D302A] hover:border-[#FF5A1F]/50 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer text-right"
    >
      {/* Cover Media Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#161714]">
        {!imageError && item.coverImage ? (
          <img
            src={item.coverImage}
            alt={item.title}
            onError={() => setImageError(true)}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#242621] to-[#161714] text-[#F2EBDD]/40 p-4 text-center">
            {getActionIcon()}
            <span className="text-xs font-mono mt-2 tracking-wide text-[#F2EBDD]/60">{item.title}</span>
          </div>
        )}

        {/* Ambient Dark Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1F211C] via-transparent to-black/20" />

        {/* NEW Badge (Configurable scheduling) */}
        {isNewBadgeActive() && (
          <div className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-[#191A17] bg-[#D7FF38] rounded shadow-sm">
            {item.newBadge?.label || 'جديد'}
          </div>
        )}

        {/* Favorite Button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className={`absolute top-3 left-3 p-2 rounded-lg backdrop-blur-md transition-colors cursor-pointer ${
              isFavorite
                ? 'bg-[#FF5A1F] text-white shadow-md'
                : 'bg-[#191A17]/60 text-[#F2EBDD]/70 hover:text-[#FF5A1F] hover:bg-[#191A17]/90'
            }`}
            title={isFavorite ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-white' : ''}`} />
          </button>
        )}

        {/* Audience Indicator if restricted */}
        {item.audience !== 'public' && (
          <div className="absolute bottom-3 right-3 text-[10px] text-[#F2EBDD]/70 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded">
            {item.audience === 'members' ? 'للأعضاء فقط' : 'يتطلب اعتماد'}
          </div>
        )}
      </div>

      {/* Card Info Content */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          {/* Clean Unboxed Metadata Discipline */}
          <div className="flex items-center gap-2 text-xs text-[#F2EBDD]/50 mb-1.5 font-medium">
            <span className="text-[#D7FF38]/90">{getTypeLabel()}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{item.category}</span>
          </div>

          {/* Primary Title */}
          <h3 className="font-bold text-base text-[#F2EBDD] group-hover:text-[#FF5A1F] transition-colors line-clamp-1">
            {item.title}
          </h3>

          {/* Summary / Lead */}
          <p className="mt-1 text-xs text-[#F2EBDD]/70 line-clamp-2 leading-relaxed">
            {item.summary || item.description}
          </p>
        </div>

        {/* Bottom Metrics & Action Kicker */}
        <div className="mt-4 pt-3 border-t border-[#2B2D27] flex items-center justify-between text-xs text-[#F2EBDD]/50">
          <div className="flex items-center gap-2 tabular-nums text-[11px]">
            <span>{item.likesCount || 0} إعجاب</span>
            <span>·</span>
            <span>{item.viewsCount || 0} مشاهدة</span>
          </div>

          <div
            className="flex items-center gap-1 text-xs font-semibold group-hover:-translate-x-0.5 transition-transform"
            style={{ color: accentColor }}
          >
            {getActionIcon()}
            <span className="mr-1">استكشاف</span>
          </div>
        </div>
      </div>
    </div>
  );
};
