import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Download,
  ExternalLink,
  Play,
  ShieldAlert,
  CheckCircle2,
  Layers,
  RotateCcw,
  Volume2,
  VolumeX,
  Calendar,
  Monitor,
  Info,
} from 'lucide-react';
import { ContentItem } from '../../types';
import { api } from '../../lib/api';

interface GameLaunchModalProps {
  game: ContentItem;
  onClose: () => void;
}

export const GameLaunchModal: React.FC<GameLaunchModalProps> = ({ game, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const trackedGameIdRef = useRef<string | null>(null);

  const config = game.gameConfig || {
    deliveryType: 'web_game',
    launchMode: 'internal_embed',
    webGameUrl: '',
    apkUrl: '',
    externalUrl: '',
    downloadUrl: '',
    fileSize: '45 MB',
    version: '1.0.0',
    platform: 'WebGL / متصفح الويب',
    genre: 'أكشن ومحاكاة',
    releaseDate: '',
  };

  const handleLaunchTrack = () => {
    api.trackLaunch(game.id).catch(() => {});
  };

  useEffect(() => {
    if (
      (config.launchMode === 'internal_embed' || config.launchMode === 'internal_page') &&
      trackedGameIdRef.current !== game.id
    ) {
      trackedGameIdRef.current = game.id;
      handleLaunchTrack();
    }
  }, [game.id, config.launchMode]);

  const handleRestart = () => {
    setReloadKey((prev) => prev + 1);
    setIframeError(false);
  };

  const handleDownloadFile = () => {
    handleLaunchTrack();
    setDownloadStarted(true);
    const link = document.createElement('a');
    const targetUrl = config.downloadUrl || config.apkUrl || '#';
    link.href = targetUrl;
    link.download = targetUrl.endsWith('.apk') ? `${game.slug}.apk` : `${game.slug}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
    >
      <div
        className={`bg-[#191A17] border border-[#2D302A] rounded-2xl flex flex-col overflow-hidden transition-all duration-300 w-full text-right ${
          isFullscreen ? 'fixed inset-0 rounded-none z-50' : 'max-w-4xl max-h-[90vh]'
        }`}
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-[#1F211C] border-b border-[#2D302A] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A1F] animate-pulse" />
            <div>
              <h3 className="font-bold text-sm text-[#F2EBDD] font-mono tracking-wide">{game.title}</h3>
              <p className="text-[11px] text-[#F2EBDD]/50 font-mono">
                {config.genre} · v{config.version || '1.0.0'} · {config.platform || 'متعدد المنصات'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(config.launchMode === 'internal_embed' || config.launchMode === 'internal_page') && (
              <>
                {/* Restart / Reload Button */}
                <button
                  onClick={handleRestart}
                  className="p-1.5 text-[#F2EBDD]/70 hover:text-[#D7FF38] bg-[#282B24] border border-[#343831] rounded-lg transition-colors cursor-pointer"
                  title="إعادة تشغيل اللعبة"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Mute Hint / Toggle */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-1.5 border rounded-lg transition-colors cursor-pointer ${
                    isMuted
                      ? 'bg-[#FF5A1F]/20 border-[#FF5A1F] text-[#FF5A1F]'
                      : 'bg-[#282B24] border-[#343831] text-[#F2EBDD]/70 hover:text-white'
                  }`}
                  title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Fullscreen Button */}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 text-[#F2EBDD]/70 hover:text-white bg-[#282B24] border border-[#343831] rounded-lg transition-colors cursor-pointer"
                  title={isFullscreen ? 'الخروج من وضع ملء الشاشة' : 'وضع ملء الشاشة'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-[#F2EBDD]/70 hover:text-white bg-[#282B24] border border-[#343831] rounded-lg transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area Based on Launch Configuration */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col justify-center">
          {/* 1. Web Game: Embedded Iframe / Interactive WebGL Canvas */}
          {config.launchMode === 'internal_embed' && (
            <div className="flex flex-col items-center justify-center flex-1">
              {!iframeError && config.webGameUrl ? (
                <div className="relative w-full aspect-[16/9] max-h-[72vh] bg-black rounded-xl overflow-hidden border border-[#2D302A] shadow-2xl">
                  <iframe
                    key={reloadKey}
                    src={config.webGameUrl}
                    title={game.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; gamepad"
                    allowFullScreen
                    onError={() => setIframeError(true)}
                    className="w-full h-full border-0"
                  />
                  {isMuted && (
                    <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] text-amber-300 font-mono border border-amber-500/30">
                      تم تفعيل وضع كتم الصوت للمشغل
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full max-w-2xl bg-[#141512] border border-[#2D302A] rounded-xl p-8 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-[#FF5A1F]/20 text-[#FF5A1F] flex items-center justify-center mb-4">
                    <Play className="w-8 h-8 fill-current ml-1" />
                  </div>
                  <h4 className="text-lg font-bold text-[#F2EBDD] font-mono">بيئة المحاكاة التفاعلية جاهزة</h4>
                  <p className="mt-2 text-xs text-[#F2EBDD]/70 max-w-md leading-relaxed">
                    محرك اللعبة مهيأ للتشغيل المباشر عبر المتصفح. يمكنك أيضاً فتحها في نافذة مستقلة للاستمتاع بأقصى أداء ممكن.
                  </p>

                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => {
                        handleLaunchTrack();
                        window.open(config.externalUrl || config.webGameUrl || '#', '_blank');
                      }}
                      className="px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current ml-1" />
                      <span>فتح اللعبة في نافذة مخصصة</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 1.2 Dedicated Internal Page in VYRN */}
          {config.launchMode === 'internal_page' && (
            <div className="flex flex-col items-center justify-center flex-1">
              {!iframeError && (config.webGameUrl || config.externalUrl) ? (
                <div className="relative w-full aspect-[16/9] max-h-[76vh] bg-black rounded-xl overflow-hidden border border-[#2D302A] shadow-2xl">
                  <iframe
                    key={reloadKey}
                    src={config.webGameUrl || config.externalUrl}
                    title={game.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; gamepad"
                    allowFullScreen
                    onError={() => setIframeError(true)}
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                <div className="w-full max-w-xl bg-[#141512] border border-[#2D302A] rounded-xl p-8 flex flex-col items-center text-center">
                  <Layers className="w-12 h-12 text-[#FF5A1F] mb-3" />
                  <h4 className="text-base font-bold text-[#F2EBDD] font-mono">تشغيل في صفحة مستقلة داخل VYRN</h4>
                  <p className="mt-2 text-xs text-[#F2EBDD]/70 max-w-md leading-relaxed">
                    يمكنك تشغيل اللعبة بملء الشاشة مع أدوات التحكم المعززة. إذا منع الخادم التضمين، افتح اللعبة عبر الرابط المباشر.
                  </p>
                  <button
                    onClick={() => {
                      handleLaunchTrack();
                      window.open(config.externalUrl || config.webGameUrl || '#', '_blank');
                    }}
                    className="mt-5 px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 ml-1 rtl-flip" />
                    <span>فتح صفحة اللعبة الكاملة</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. Download Mode (APK / ZIP / Files) */}
          {config.launchMode === 'apk_download' && (
            <div className="max-w-xl mx-auto w-full bg-[#1F211C] border border-[#2E312B] rounded-xl p-6 sm:p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#D7FF38]/20 text-[#D7FF38] flex items-center justify-center shrink-0">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-[#F2EBDD]">تنزيل حزمة تثبيت اللعبة</h4>
                  <p className="text-xs text-[#F2EBDD]/60 mt-1">
                    حزمة تثبيت مباشرة متوافقة ومجهزة للتحميل الآمن والسريع.
                  </p>
                </div>
              </div>

              {/* Package Specs Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-[#161714] rounded-lg border border-[#252822] text-xs font-mono">
                <div>
                  <span className="text-[#F2EBDD]/40 block text-[10px]">حجم الملف</span>
                  <span className="text-[#F2EBDD] font-semibold">{config.fileSize || '45 MB'}</span>
                </div>
                <div>
                  <span className="text-[#F2EBDD]/40 block text-[10px]">الإصدار</span>
                  <span className="text-[#F2EBDD] font-semibold">{config.version || '1.0.0'}</span>
                </div>
                <div>
                  <span className="text-[#F2EBDD]/40 block text-[10px]">المنصة المدعومة</span>
                  <span className="text-[#D7FF38] font-semibold truncate block">{config.platform || 'أندرويد / كمبيوتر'}</span>
                </div>
                <div>
                  <span className="text-[#F2EBDD]/40 block text-[10px]">تاريخ التحديث</span>
                  <span className="text-[#F2EBDD] font-semibold">{config.releaseDate || 'حديث'}</span>
                </div>
              </div>

              {/* Security & Installation Notice */}
              <div className="p-3.5 bg-[#252822]/60 border border-[#343831] rounded-lg flex items-start gap-3 text-xs text-[#F2EBDD]/70">
                <ShieldAlert className="w-4 h-4 text-[#FF5A1F] shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="text-[#F2EBDD] block font-semibold mb-0.5">تنويه التثبيت والأمان:</strong>
                  لأجهزة أندرويد، يرجى الموافقة على تثبيت التطبيقات من مصادر غير معروفة عند تشغيل ملف APK. لملفات ZIP الخاصة بالكمبيوتر، فك الضغط ثم شغّل الملف التنفيذي للعبة.
                </div>
              </div>

              {/* Download Action */}
              <div className="pt-2">
                <button
                  onClick={handleDownloadFile}
                  className="w-full py-3.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer text-sm shadow-lg shadow-[#FF5A1F]/20"
                >
                  <Download className="w-4 h-4 ml-1" />
                  <span>بدء تنزيل الملف الآن ({config.fileSize || '45 MB'})</span>
                </button>

                {downloadStarted && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#D7FF38]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تم بدء التحميل بنجاح. يرجى متابعة التنزيل في متصفحك.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. External Game or Website */}
          {config.launchMode === 'external_url' && (
            <div className="max-w-lg mx-auto w-full bg-[#1F211C] border border-[#2E312B] rounded-xl p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F] flex items-center justify-center mx-auto">
                <ExternalLink className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-[#F2EBDD]">وجهة اللعبة الخارجية</h4>
              <p className="text-xs text-[#F2EBDD]/70 leading-relaxed">
                هذه اللعبة مستضافة على خادم أو متجر خارجي. سيتم فتح الوجهة في تبويب جديد وآمن مع تسجيل عملية التشغيل.
              </p>
              <div className="p-3 bg-[#151713] rounded-lg border border-[#282B24] text-xs font-mono text-[#D7FF38] break-all">
                {config.externalUrl || config.webGameUrl || 'رابط خارجي معتمد'}
              </div>
              <button
                onClick={() => {
                  handleLaunchTrack();
                  window.open(config.externalUrl || config.webGameUrl || '#', '_blank', 'noopener,noreferrer');
                }}
                className="w-full py-3 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer text-sm shadow-lg shadow-[#FF5A1F]/20"
              >
                <ExternalLink className="w-4 h-4 ml-1 rtl-flip" />
                <span>فتح الوجهة الخارجية ومتابعة اللعب</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
