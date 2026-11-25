import React, { useState, useEffect } from 'react';
import { Heart, ArrowLeft } from 'lucide-react';
import { ContentItem } from '../../types';
import { api } from '../../lib/api';
import { ContentCard } from '../content/ContentCard';
import { useAuth } from '../../context/AuthContext';

interface FavoritesPageProps {
  onSelect: (item: ContentItem) => void;
  onExplore: () => void;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({ onSelect, onExplore }) => {
  const { currentUser } = useAuth();
  const [favorites, setFavorites] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, [currentUser]);

  const loadFavorites = async () => {
    setIsLoading(true);
    try {
      const data = await api.getFavorites();
      setFavorites(data);
    } catch (e) {
      console.error('Error fetching favorites:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      await api.toggleFavorite(id);
      loadFavorites();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-in fade-in duration-200 text-right">
      <div className="border-b border-[#292C25] pb-6 space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#FF5A1F]">
          <Heart className="w-3.5 h-3.5 fill-current" />
          <span>الخزينة الشخصية</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#F2EBDD] font-mono tracking-tight">
          المفضلة المحفوظة ({favorites.length})
        </h1>
        <p className="text-xs sm:text-sm text-[#F2EBDD]/70 max-w-xl">
          الوصول السريع إلى الألعاب والتطبيقات والكتب والبودكاست التي قمت بتمييزها وحفظها.
        </p>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-xs text-[#F2EBDD]/40 font-mono">
          جاري استرجاع عناصر الخزينة...
        </div>
      ) : favorites.length === 0 ? (
        <div className="p-16 bg-[#1A1C17] border border-[#272922] rounded-2xl text-center space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F] flex items-center justify-center mx-auto">
            <Heart className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-[#F2EBDD] font-mono">الخزينة فارغة حالياً</h3>
          <p className="text-xs text-[#F2EBDD]/60 leading-relaxed">
            لم تقم بحفظ أي أعمال في المفضلة بعد. انقر على أيقونة القلب على أي عمل إبداعي لحفظه هنا والوصول إليه بسرعة.
          </p>
          <button
            onClick={onExplore}
            className="px-5 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>استكشاف الدليل</span>
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onSelect={onSelect}
              onToggleFavorite={handleToggleFavorite}
              isFavorite={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};
