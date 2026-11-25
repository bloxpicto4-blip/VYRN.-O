import React from 'react';
import { Play, ArrowLeft, Plus, Shield, Sparkles } from 'lucide-react';
import { ContentItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import heroBannerImg from '../../assets/images/vyrn_hero_banner_1791925647448.jpg';

interface HeroBannerProps {
  featuredItem?: ContentItem;
  brandTagline: string;
  onLaunchFeatured: (item: ContentItem) => void;
  onExploreAll: () => void;
  onAdminAdd?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  featuredItem,
  brandTagline,
  onLaunchFeatured,
  onExploreAll,
  onAdminAdd,
}) => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <section className="relative overflow-hidden pt-8 pb-12 border-b border-[#262822]">
      {/* Subtle ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FF5A1F]/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-[#D7FF38]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Split Screen 2-Column Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Right Column (in RTL): Typographic Hierarchy */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6 text-right">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-[#D7FF38]">
                منصة الإبداع المستقل
              </span>
              <span className="text-[#F2EBDD]/30" aria-hidden="true">·</span>
              <span className="text-xs text-[#F2EBDD]/60 font-semibold font-mono">2026</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#F2EBDD] leading-[1.18] text-balance">
              ألعاب. برمجيات. مشاريع. بودكاست.
            </h1>

            <p className="text-base sm:text-lg text-[#F2EBDD]/80 max-w-xl font-normal leading-relaxed">
              {brandTagline || 'عالمك الإبداعي يبدأ من هنا.'} وجهة موحدة تجمع محاكيات الألعاب، البرمجيات التوليدية، المشاريع الهندسية، والمنشورات المعمارية في فضاء رقمي مميز.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              {featuredItem ? (
                <button
                  onClick={() => onLaunchFeatured(featuredItem)}
                  className="px-6 py-3.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-xl flex items-center gap-2.5 text-sm transition-all shadow-lg shadow-[#FF5A1F]/25 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current ml-1" />
                  <span>تشغيل {featuredItem.title}</span>
                </button>
              ) : isAdmin ? (
                <button
                  onClick={onAdminAdd}
                  className="px-6 py-3.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-xl flex items-center gap-2.5 text-sm transition-all shadow-lg shadow-[#FF5A1F]/25 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة أول عمل إبداعي</span>
                </button>
              ) : (
                <button
                  onClick={onExploreAll}
                  className="px-6 py-3.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-xl flex items-center gap-2 text-sm transition-colors cursor-pointer"
                >
                  <span>استكشاف الأقسام</span>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                </button>
              )}

              <button
                onClick={onExploreAll}
                className="px-6 py-3.5 bg-[#22241F] hover:bg-[#2A2E26] border border-[#363A31] text-[#F2EBDD] font-semibold rounded-xl flex items-center gap-2 text-sm transition-colors cursor-pointer"
              >
                <span>البحث في الدليل</span>
              </button>
            </div>
          </div>

          {/* Left Column (in RTL): Visual Showcase / Atmospheric Composition */}
          <div className="lg:col-span-5 relative flex items-center">
            <div className="relative w-full aspect-[4/3] lg:aspect-auto lg:h-[420px] rounded-2xl overflow-hidden border border-[#2D3027] shadow-2xl bg-[#141512] group">
              <img
                src={heroBannerImg}
                alt="VYRN Nexus"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#141512] via-transparent to-black/30" />

              {/* In-Frame Status Kicker */}
              <div className="absolute bottom-4 left-4 right-4 p-4 bg-[#191A17]/90 backdrop-blur-md rounded-xl border border-[#2F322A] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#D7FF38] uppercase tracking-wider block">
                    {featuredItem ? 'الإصدار المميز' : 'الفضاء الإبداعي'}
                  </span>
                  <span className="text-xs font-bold text-[#F2EBDD]">
                    {featuredItem ? featuredItem.title : 'عالمك الإبداعي يبدأ من هنا'}
                  </span>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5A1F] animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* 4-Column Proof / Domain Highlights Strip below the Split */}
        <div className="mt-14 pt-8 border-t border-[#262822] grid grid-cols-2 md:grid-cols-4 gap-6 text-xs text-[#F2EBDD]/70 font-mono text-right">
          <div className="space-y-1">
            <span className="text-[#D7FF38] block font-bold text-sm">01. الألعاب والمحاكاة</span>
            <span className="text-[#F2EBDD]/50 text-[11px]">تشغيل مباشر عبر المتصفح وحزم أندرويد APK</span>
          </div>
          <div className="space-y-1">
            <span className="text-[#FF5A1F] block font-bold text-sm">02. البرمجيات والأدوات</span>
            <span className="text-[#F2EBDD]/50 text-[11px]">تطبيقات صوتية وهندسية متقدمة</span>
          </div>
          <div className="space-y-1">
            <span className="text-[#F2EBDD] block font-bold text-sm">03. الكتب والمنشورات</span>
            <span className="text-[#F2EBDD]/50 text-[11px]">دراسات معمارية وفلسفية للقراءة والتحميل</span>
          </div>
          <div className="space-y-1">
            <span className="text-[#D7FF38] block font-bold text-sm">04. البودكاست الصوتي</span>
            <span className="text-[#F2EBDD]/50 text-[11px]">حلقات حوارية متخصصة مع مشغل مدمج</span>
          </div>
        </div>
      </div>
    </section>
  );
};
