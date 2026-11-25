import React, { useRef } from 'react';
import { ChevronRight, ChevronLeft, ArrowLeft, Plus, Play, Download, Layers, BookOpen, Headphones, Sparkles } from 'lucide-react';
import { SectionConfig, ContentItem } from '../../types';
import { ContentCard } from '../content/ContentCard';
import { useAuth } from '../../context/AuthContext';

interface DynamicSectionProps {
  section: SectionConfig;
  items: ContentItem[];
  onSelect: (item: ContentItem) => void;
  onToggleFavorite?: (id: string) => void;
  favorites: string[];
  onViewCategory?: (cat: string) => void;
  onAdminAdd?: (categoryTarget?: string) => void;
}

export const DynamicSection: React.FC<DynamicSectionProps> = ({
  section,
  items,
  onSelect,
  onToggleFavorite,
  favorites,
  onViewCategory,
  onAdminAdd,
}) => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const offset = direction === 'left' ? -360 : 360;
    carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const getEmptyStateDetails = () => {
    switch (section.categoryTarget) {
      case 'game':
        return {
          title: 'مساحة ألعابك جاهزة',
          subtitle: 'لم تُنشر ألعاب بعد. ستظهر هنا تجارب المحاكاة والتفاعل فور نشرها.',
          actionLabel: 'إضافة لعبة',
          icon: Play,
        };
      case 'app':
        return {
          title: 'أضف تطبيقك الأول وابدأ',
          subtitle: 'فضاء الأدوات البرمجية جاهز لاستقبال أدواتك وتطبيقاتك الرقمية.',
          actionLabel: 'إضافة تطبيق',
          icon: Download,
        };
      case 'project':
        return {
          title: 'هنا ستظهر مشاريعك',
          subtitle: 'المشاريع الهندسية ومفتوحة المصدر ستعرض هنا بكافة تفاصيلها التقنية.',
          actionLabel: 'إضافة مشروع',
          icon: Layers,
        };
      case 'book':
        return {
          title: 'مكتبتك تبدأ بكتابك الأول',
          subtitle: 'المنشورات والأبحاث والكتب المعمارية والتصميمية قيد التحضير للنشر.',
          actionLabel: 'إضافة كتاب',
          icon: BookOpen,
        };
      case 'podcast':
        return {
          title: 'حان وقت إضافة أول حلقة',
          subtitle: 'استوديو التسجيلات الصوتية بانتظار إطلاق أول حلقة بودكاست واستكشاف صوتي.',
          actionLabel: 'إضافة حلقة بودكاست',
          icon: Headphones,
        };
      default:
        return {
          title: 'عالمك الإبداعي يبدأ من هنا',
          subtitle: 'القسم مهيأ لاستقبال الأعمال والإصدارات المختارة.',
          actionLabel: 'إضافة عمل إبداعي',
          icon: Sparkles,
        };
    }
  };

  const emptyInfo = getEmptyStateDetails();
  const EmptyIcon = emptyInfo.icon;

  return (
    <section className="py-10 border-b border-[#252821]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1 text-right">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: section.accentColor || '#FF5A1F' }}
              />
              <span className="text-xs font-mono uppercase tracking-wider text-[#D7FF38]">
                {section.name}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F2EBDD] font-mono tracking-tight">
              {section.name}
            </h2>
            {section.description && (
              <p className="text-xs sm:text-sm text-[#F2EBDD]/70 max-w-xl">
                {section.description}
              </p>
            )}
          </div>

          {/* Section Actions */}
          <div className="flex items-center gap-2">
            {items.length > 0 && section.layoutType === 'carousel' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => scrollCarousel('right')}
                  className="p-2 bg-[#22241F] hover:bg-[#2C2F28] border border-[#34382F] rounded-lg text-[#F2EBDD]/70 hover:text-white transition-colors cursor-pointer"
                  title="تمرير لليمين"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollCarousel('left')}
                  className="p-2 bg-[#22241F] hover:bg-[#2C2F28] border border-[#34382F] rounded-lg text-[#F2EBDD]/70 hover:text-white transition-colors cursor-pointer"
                  title="تمرير لليسار"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            {section.categoryTarget && onViewCategory && items.length > 0 && (
              <button
                onClick={() => onViewCategory(section.categoryTarget!)}
                className="flex items-center gap-1 text-xs font-semibold text-[#F2EBDD]/70 hover:text-[#FF5A1F] transition-colors cursor-pointer mr-2"
              >
                <span>عرض الكل</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* When items exist */}
        {items.length > 0 ? (
          <>
            {/* Bento Grid */}
            {section.layoutType === 'bento' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={idx === 0 ? 'md:col-span-2' : 'md:col-span-1'}
                  >
                    <ContentCard
                      item={item}
                      onSelect={onSelect}
                      onToggleFavorite={onToggleFavorite}
                      isFavorite={favorites.includes(item.id)}
                      accentColor={section.accentColor}
                      layout="bento"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Horizontal Carousel */}
            {section.layoutType === 'carousel' && (
              <div
                ref={carouselRef}
                className="flex items-stretch gap-6 overflow-x-auto pb-4 scrollbar-none snap-x"
                style={{ scrollbarWidth: 'none' }}
              >
                {items.map((item) => (
                  <div key={item.id} className="min-w-[300px] sm:min-w-[340px] snap-start shrink-0">
                    <ContentCard
                      item={item}
                      onSelect={onSelect}
                      onToggleFavorite={onToggleFavorite}
                      isFavorite={favorites.includes(item.id)}
                      accentColor={section.accentColor}
                      layout="carousel"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Grid & Editorial & Media Showcase */}
            {(section.layoutType === 'grid' || section.layoutType === 'editorial' || section.layoutType === 'media_showcase') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    onSelect={onSelect}
                    onToggleFavorite={onToggleFavorite}
                    isFavorite={favorites.includes(item.id)}
                    accentColor={section.accentColor}
                    layout="grid"
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Beautiful, Intentional Empty State */
          <div className="relative overflow-hidden rounded-2xl bg-[#171914] border border-[#272A22] p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4">
            {/* Background geometric accents */}
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#FF5A1F_1px,transparent_1px)] [background-size:24px_24px]" />

            <div className="relative w-14 h-14 rounded-2xl bg-[#20231D] border border-[#2E3128] flex items-center justify-center text-[#FF5A1F] shadow-inner">
              <EmptyIcon className="w-6 h-6" />
            </div>

            <div className="space-y-1.5 max-w-md relative z-10">
              <h3 className="text-lg font-bold text-[#F2EBDD] font-mono">
                {emptyInfo.title}
              </h3>
              <p className="text-xs text-[#F2EBDD]/60 leading-relaxed">
                {emptyInfo.subtitle}
              </p>
            </div>

            {/* Contextual CTA for Administrator ONLY */}
            {isAdmin && onAdminAdd && (
              <div className="pt-2 relative z-10">
                <button
                  onClick={() => onAdminAdd(section.categoryTarget)}
                  className="px-5 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-[#FF5A1F]/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>{emptyInfo.actionLabel}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
