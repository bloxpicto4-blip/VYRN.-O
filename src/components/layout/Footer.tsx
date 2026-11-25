import React from 'react';
import { Logo } from '../brand/Logo';
import { Sparkles, Shield, EyeOff, RotateCcw } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string, filter?: string) => void;
  brandTagline?: string;
  onReplayIntro: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  brandTagline = 'عالم تصنعه بنفسك.',
  onReplayIntro,
  reducedMotion,
  onToggleReducedMotion,
}) => {
  return (
    <footer className="w-full bg-[#141512] border-t border-[#252822] mt-24 text-[#F2EBDD]/70 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Col */}
          <div className="space-y-3 md:col-span-1">
            <Logo size="md" showWordmark={true} />
            <p className="text-xs text-[#F2EBDD]/60 leading-relaxed">
              {brandTagline}
            </p>
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={onReplayIntro}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-[#F2EBDD]/60 hover:text-[#D7FF38] border border-[#2D302A] hover:border-[#D7FF38]/40 rounded transition-colors cursor-pointer"
                title="إعادة تشغيل العرض السينمائي للمنصة"
              >
                <RotateCcw className="w-3 h-3 rtl-flip" />
                <span>إعادة المقدمة</span>
              </button>

              <button
                onClick={onToggleReducedMotion}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] border rounded transition-colors cursor-pointer ${
                  reducedMotion
                    ? 'text-[#D7FF38] border-[#D7FF38]/50 bg-[#D7FF38]/10'
                    : 'text-[#F2EBDD]/60 border-[#2D302A] hover:border-[#F2EBDD]/40'
                }`}
                title="تفعيل أو تقليل المؤثرات الحركية"
              >
                <EyeOff className="w-3 h-3" />
                <span>{reducedMotion ? 'الحركة: مقللة' : 'الحركة: مفعّلة'}</span>
              </button>
            </div>
          </div>

          {/* Catalog Col */}
          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[#F2EBDD] mb-3">الأقسام الإبداعية</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('category', 'game')}
                  className="hover:text-[#FF5A1F] transition-colors cursor-pointer"
                >
                  الألعاب ومحاكيات التفاعل
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('category', 'app')}
                  className="hover:text-[#FF5A1F] transition-colors cursor-pointer"
                >
                  البرمجيات والأدوات الإبداعية
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('category', 'project')}
                  className="hover:text-[#FF5A1F] transition-colors cursor-pointer"
                >
                  المشاريع الهندسية ومفتوحة المصدر
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('category', 'book')}
                  className="hover:text-[#FF5A1F] transition-colors cursor-pointer"
                >
                  الكتب والمنشورات المعمارية
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('category', 'podcast')}
                  className="hover:text-[#FF5A1F] transition-colors cursor-pointer"
                >
                  البودكاست والتسجيلات الصوتية
                </button>
              </li>
            </ul>
          </div>

          {/* Discovery Col */}
          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[#F2EBDD] mb-3">الاستكشاف</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('discover')}
                  className="hover:text-[#D7FF38] transition-colors cursor-pointer"
                >
                  محرك البحث والاستكشاف الشامل
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="hover:text-[#D7FF38] transition-colors cursor-pointer"
                >
                  الرئيسية والأقسام المخصصة
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('favorites')}
                  className="hover:text-[#D7FF38] transition-colors cursor-pointer"
                >
                  الخزينة والمفضلة الشخصية
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('rooms')}
                  className="hover:text-[#D7FF38] transition-colors cursor-pointer"
                >
                  غرف اللعب الجماعي المتزامنة
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('achievements')}
                  className="hover:text-[#D7FF38] transition-colors cursor-pointer"
                >
                  النقاط والإنجازات ولوحة المتصدرين
                </button>
              </li>
            </ul>
          </div>

          {/* System & Architecture Col */}
          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[#F2EBDD] mb-3">الإدارة والأمان</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('admin')}
                  className="flex items-center gap-1.5 text-[#FF5A1F] hover:underline cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>لوحة تحكم الإدارة</span>
                </button>
              </li>
              <li className="text-[11px] text-[#F2EBDD]/50 pt-1 leading-relaxed">
                نظام حماية يعتمد على التحكم بالصلاحيات حسب السمات (ABAC).
              </li>
              <li className="text-[11px] text-[#F2EBDD]/50 font-mono">
                حساب الإدارة: <span className="text-[#D7FF38]">boda</span> / <span className="text-[#D7FF38]">abdo</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#20221C] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#F2EBDD]/50">
          <p>© {new Date().getFullYear()} منصة VYRN الإبداعية. جميع الحقوق محفوظة.</p>
          <p className="flex items-center gap-1">
            <span>صُممت بدقة واحترافية للمبدعين</span>
            <Sparkles className="w-3 h-3 text-[#FF5A1F]" />
          </p>
        </div>
      </div>
    </footer>
  );
};
