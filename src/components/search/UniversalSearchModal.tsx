import React, { useState, useEffect } from 'react';
import { Search, X, Play, Download, Headphones, BookOpen, Layers, ArrowLeft } from 'lucide-react';
import { ContentItem } from '../../types';
import { api } from '../../lib/api';

interface UniversalSearchModalProps {
  onClose: () => void;
  onSelect: (item: ContentItem) => void;
  onOpenAdvancedSearch: (query: string) => void;
}

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({
  onClose,
  onSelect,
  onOpenAdvancedSearch,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const handler = setTimeout(() => {
      api
        .getContent({ search: query.trim() })
        .then((items) => {
          setResults(items.slice(0, 6));
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }, 250);

    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && query.trim()) {
        onOpenAdvancedSearch(query.trim());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, query, onOpenAdvancedSearch]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'game':
        return <Play className="w-3.5 h-3.5 text-[#FF5A1F]" />;
      case 'app':
        return <Download className="w-3.5 h-3.5 text-[#D7FF38]" />;
      case 'podcast':
        return <Headphones className="w-3.5 h-3.5 text-[#FF5A1F]" />;
      case 'book':
        return <BookOpen className="w-3.5 h-3.5 text-[#F2EBDD]" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-[#D7FF38]" />;
    }
  };

  return (
    <div
      onClick={onClose}
      dir="rtl"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#191B16] border border-[#2D3028] rounded-2xl overflow-hidden shadow-2xl flex flex-col text-right"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#2D3028] bg-[#1F211C]">
          <Search className="w-4 h-4 text-[#FF5A1F] shrink-0 ml-3" />
          <input
            type="text"
            autoFocus
            value={query || ''}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن ألعاب، تطبيقات، منشورات، حلقات بودكاست..."
            className="w-full bg-transparent text-sm text-[#F2EBDD] placeholder:text-[#F2EBDD]/40 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#F2EBDD]/50 hover:text-white ml-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline px-2 py-0.5 text-[10px] font-mono bg-[#141512] text-[#F2EBDD]/40 border border-[#2D3028] rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isLoading && (
            <div className="p-8 text-center text-xs text-[#F2EBDD]/50 font-mono">
              جاري البحث في قاعدة البيانات...
            </div>
          )}

          {!isLoading && query.trim() && results.length === 0 && (
            <div className="p-8 text-center text-xs text-[#F2EBDD]/50 space-y-2">
              <p>لم يتم العثور على أعمال مطابقة لـ "{query}".</p>
              <button
                onClick={() => onOpenAdvancedSearch(query)}
                className="text-[#FF5A1F] hover:underline cursor-pointer"
              >
                الانتقال لصفحة البحث المتقدم والفلاتر
              </button>
            </div>
          )}

          {!isLoading && !query.trim() && (
            <div className="p-6 text-xs text-[#F2EBDD]/50 space-y-3">
              <span className="font-mono uppercase tracking-wider text-[10px] text-[#F2EBDD]/40 block">
                اقتراحات البحث
              </span>
              <div className="flex flex-wrap gap-2">
                {['ألعاب', 'تطبيقات', 'صوتيات', 'محاكاة', 'كتب معمارية', 'WebGPU'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="px-2.5 py-1 bg-[#22251F] hover:bg-[#2A2E26] border border-[#32362C] text-[#F2EBDD]/80 rounded text-xs transition-colors cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="space-y-1">
              {results.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="flex items-center gap-3 p-3 hover:bg-[#22241F] rounded-xl transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-lg bg-[#141512] overflow-hidden shrink-0 border border-[#2C3027]">
                    <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(item.type)}
                      <span className="font-bold text-xs text-[#F2EBDD] group-hover:text-[#FF5A1F] transition-colors truncate">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#F2EBDD]/60 truncate mt-0.5">{item.summary}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#D7FF38] uppercase tracking-wider shrink-0">
                    {item.category}
                  </span>
                </div>
              ))}

              <div className="p-2 border-t border-[#292C25] mt-2">
                <button
                  onClick={() => onOpenAdvancedSearch(query)}
                  className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#FF5A1F] hover:bg-[#FF5A1F]/10 rounded-lg transition-colors cursor-pointer"
                >
                  <span>عرض جميع النتائج لـ "{query}"</span>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
