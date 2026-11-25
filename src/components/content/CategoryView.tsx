import React, { useState, useEffect } from 'react';
import { Play, Download, Headphones, BookOpen, Layers, Plus } from 'lucide-react';
import { ContentItem, ContentType } from '../../types';
import { api } from '../../lib/api';
import { ContentCard } from './ContentCard';
import { useAuth } from '../../context/AuthContext';

interface CategoryViewProps {
  categoryType: ContentType;
  onSelect: (item: ContentItem) => void;
  onToggleFavorite?: (id: string) => void;
  favorites: string[];
  onAdminAdd?: (type: ContentType) => void;
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  categoryType,
  onSelect,
  onToggleFavorite,
  favorites,
  onAdminAdd,
}) => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [items, setItems] = useState<ContentItem[]>([]);
  const [sort, setSort] = useState<string>('newest');
  const [isLoading, setIsLoading] = useState(false);

  const getMetadata = () => {
    switch (categoryType) {
      case 'game':
        return {
          title: 'الألعاب ومحاكيات التفاعل',
          description: 'محركات ألعاب عالية السرعة، تجارب WebGL مباشرة، وحزم أندرويد APK أصلية.',
          emptyTitle: 'مساحة ألعابك جاهزة',
          emptySubtitle: 'لم تُنشر ألعاب بعد. ستظهر تجارب المحاكاة والتفاعل هنا فور إضافتها.',
          actionLabel: 'إضافة لعبة',
          accent: '#FF5A1F',
          icon: Play,
        };
      case 'app':
        return {
          title: 'البرمجيات والأدوات الإبداعية',
          description: 'أدوات رقمية مبتكرة، محطات توليف صوتية، وبرمجيات تصميمية للمبدعين.',
          emptyTitle: 'أضف تطبيقك الأول وابدأ',
          emptySubtitle: 'فضاء الأدوات البرمجية جاهز لاستقبال أدواتك وتطبيقاتك الرقمية.',
          actionLabel: 'إضافة تطبيق',
          accent: '#D7FF38',
          icon: Download,
        };
      case 'project':
        return {
          title: 'المشاريع الهندسية ومفتوحة المصدر',
          description: 'أنظمة رسومية ومحركات WebGPU وأكواد برمجية مفتوحة وموثقة بالكامل.',
          emptyTitle: 'هنا ستظهر مشاريعك',
          emptySubtitle: 'المشاريع الهندسية ومفتوحة المصدر ستعرض هنا مع روابط المستودعات والشروح التقنية.',
          actionLabel: 'إضافة مشروع',
          accent: '#D7FF38',
          icon: Layers,
        };
      case 'book':
        return {
          title: 'الكتب والمنشورات المعمارية',
          description: 'دراسات معمارية، مقالات فلسفية في التصميم، وأبحاث رقمية للقراءة والتحميل.',
          emptyTitle: 'مكتبتك تبدأ بكتابك الأول',
          emptySubtitle: 'مكتبة المنشورات والأبحاث والكتب قيد التحضير والتنسيق.',
          actionLabel: 'إضافة كتاب',
          accent: '#F2EBDD',
          icon: BookOpen,
        };
      case 'podcast':
        return {
          title: 'البودكاست والتسجيلات الصوتية',
          description: 'حوارات فكرية عميقة، أبحاث صوتية وتجارب استكشافية من الاستوديو.',
          emptyTitle: 'حان وقت إضافة أول حلقة',
          emptySubtitle: 'استوديو التسجيلات الصوتية بانتظار إطلاق أول حلقة بودكاست واستكشاف صوتي.',
          actionLabel: 'إضافة حلقة بودكاست',
          accent: '#FF5A1F',
          icon: Headphones,
        };
      default:
        return {
          title: 'الأعمال الإبداعية',
          description: 'إصدارات ومشاريع من استوديو VYRN.',
          emptyTitle: 'عالمك الإبداعي يبدأ من هنا',
          emptySubtitle: 'لم تُضف عناصر بعد في هذا التصنيف.',
          actionLabel: 'إضافة محتوى',
          accent: '#FF5A1F',
          icon: Layers,
        };
    }
  };

  const meta = getMetadata();
  const Icon = meta.icon;

  useEffect(() => {
    fetchItems();
  }, [categoryType, sort]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const data = await api.getContent({ type: categoryType, sort });
      setItems(data);
    } catch (e) {
      console.error('Error fetching category items:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-in fade-in duration-200 text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#292C25] pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D7FF38]">
            <Icon className="w-3.5 h-3.5" />
            <span>التصنيف الإبداعي</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F2EBDD] font-mono tracking-tight">
            {meta.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#F2EBDD]/70 max-w-2xl leading-relaxed">
            {meta.description}
          </p>
        </div>

        {/* Sort & Admin Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {items.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-[#F2EBDD]/60">
              <span className="font-mono">الترتيب:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-[#1C1E19] border border-[#2D3028] text-xs text-[#F2EBDD] rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="newest">الأحدث نشراً</option>
                <option value="popular">الأكثر شعبية</option>
                <option value="downloads">الأكثر تحميلاً</option>
              </select>
            </div>
          )}

          {isAdmin && onAdminAdd && (
            <button
              onClick={() => onAdminAdd(categoryType)}
              className="px-4 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{meta.actionLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid or Beautiful Custom Empty State */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-[#F2EBDD]/40 font-mono">
          جاري استرجاع البيانات...
        </div>
      ) : items.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl bg-[#171914] border border-[#272A22] p-12 sm:p-16 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#20231D] border border-[#2E3128] flex items-center justify-center text-[#FF5A1F] shadow-inner">
            <Icon className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h3 className="text-xl font-bold text-[#F2EBDD] font-mono">
              {meta.emptyTitle}
            </h3>
            <p className="text-xs text-[#F2EBDD]/60 leading-relaxed">
              {meta.emptySubtitle}
            </p>
          </div>

          {/* Contextual CTA for Administrator ONLY */}
          {isAdmin && onAdminAdd && (
            <div className="pt-3">
              <button
                onClick={() => onAdminAdd(categoryType)}
                className="px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-[#FF5A1F]/20"
              >
                <Plus className="w-4 h-4" />
                <span>{meta.actionLabel}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
              isFavorite={favorites.includes(item.id)}
              accentColor={meta.accent}
            />
          ))}
        </div>
      )}
    </div>
  );
};
