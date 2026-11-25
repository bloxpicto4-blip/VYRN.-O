import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { ContentItem } from '../../types';
import { api } from '../../lib/api';
import { ContentCard } from '../content/ContentCard';

interface AdvancedSearchPageProps {
  initialQuery?: string;
  onSelect: (item: ContentItem) => void;
  onToggleFavorite?: (id: string) => void;
  favorites: string[];
}

export const AdvancedSearchPage: React.FC<AdvancedSearchPageProps> = ({
  initialQuery = '',
  onSelect,
  onToggleFavorite,
  favorites,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<string>('newest');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const contentTypes: { label: string; value: string }[] = [
    { label: 'كافة التصنيفات', value: 'all' },
    { label: 'الألعاب', value: 'game' },
    { label: 'التطبيقات', value: 'app' },
    { label: 'المشاريع', value: 'project' },
    { label: 'الكتب', value: 'book' },
    { label: 'البودكاست', value: 'podcast' },
  ];

  useEffect(() => {
    fetchResults();
  }, [query, selectedType, selectedSort]);

  const fetchResults = async () => {
    setIsLoading(true);
    try {
      const data = await api.getContent({
        search: query.trim() || undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        sort: selectedSort,
      });
      setItems(data);
    } catch (e) {
      console.error('Error fetching search results:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-in fade-in duration-200 text-right">
      {/* Header */}
      <div className="space-y-3">
        <span className="text-xs font-mono uppercase tracking-wider text-[#D7FF38]">
          استكشاف الدليل الرقمي
        </span>
        <h1 className="text-3xl font-extrabold text-[#F2EBDD] font-mono tracking-tight">
          البحث الشامل والاستكشاف
        </h1>
        <p className="text-sm text-[#F2EBDD]/70 max-w-2xl leading-relaxed">
          ابحث في مكتبة الألعاب ومحاكيات التفاعل، الأدوات البرمجية، المنشورات المعمارية، والتسجيلات الصوتية.
        </p>
      </div>

      {/* Main Search Input & Filter Strip */}
      <div className="bg-[#1C1E19] border border-[#2D3027] rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5A1F]" />
          <input
            type="text"
            value={query || ''}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="اكتب كلمات مفتاحية، تقنيات برمجية، وسوم، أو تصنيفات..."
            className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl pr-11 pl-4 py-3 text-sm text-[#F2EBDD] placeholder:text-[#F2EBDD]/40 focus:outline-none"
          />
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          {/* Type Segmented Controls */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#141512] rounded-xl border border-[#272922]">
            {contentTypes.map((t) => (
              <button
                key={t.value}
                onClick={() => setSelectedType(t.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  selectedType === t.value
                    ? 'bg-[#FF5A1F] text-white shadow-sm font-bold'
                    : 'text-[#F2EBDD]/70 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#F2EBDD]/50 font-mono">الترتيب:</span>
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="bg-[#141512] border border-[#2D3028] text-xs text-[#F2EBDD] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#FF5A1F] cursor-pointer"
            >
              <option value="newest">الأحدث نشراً</option>
              <option value="popular">الأكثر شعبية</option>
              <option value="downloads">الأكثر تحميلاً</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count & Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[#F2EBDD]/50 font-mono">
          <span>تم العثور على {items.length} عنصر</span>
          {query && <span>تصفية: "{query}"</span>}
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-xs text-[#F2EBDD]/40 font-mono">
            جاري استرجاع النتائج...
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 bg-[#181A15] border border-[#262822] rounded-2xl text-center space-y-3">
            <p className="text-sm text-[#F2EBDD]/70">لم يتم العثور على نتائج تطابق معايير البحث المحددة.</p>
            <button
              onClick={() => {
                setQuery('');
                setSelectedType('all');
              }}
              className="px-4 py-2 text-xs font-bold text-[#191A17] bg-[#D7FF38] rounded-lg cursor-pointer"
            >
              إعادة ضبط الفلاتر
            </button>
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
