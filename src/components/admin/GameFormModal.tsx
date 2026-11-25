import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Download,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Calendar,
  Tag,
  Monitor,
  Film,
  Plus,
  Trash2,
  HardDrive,
  Cpu,
  HelpCircle,
  Smartphone,
  Globe,
  FileCode,
} from 'lucide-react';
import { ContentItem, GameDeliveryType, GameLaunchMode, GameCategory, PublicationStatus } from '../../types';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

interface GameFormModalProps {
  gameToEdit?: ContentItem | null;
  onClose: () => void;
  onSuccess: (savedGame: ContentItem, mode: 'published' | 'draft') => void;
}

export const GameFormModal: React.FC<GameFormModalProps> = ({
  gameToEdit,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  // Form core fields
  const [title, setTitle] = useState(gameToEdit?.title || '');
  const [summary, setSummary] = useState(gameToEdit?.summary || '');
  const [description, setDescription] = useState(gameToEdit?.description || '');
  const [category, setCategory] = useState(gameToEdit?.category || 'ألعاب الأكشن والسرعة');
  const [coverImage, setCoverImage] = useState(gameToEdit?.coverImage || '');
  const [status, setStatus] = useState<PublicationStatus>(gameToEdit?.status || 'published');
  const [isFeatured, setIsFeatured] = useState<boolean>(gameToEdit?.isFeatured ?? false);

  // Game specific configs
  const [launchMode, setLaunchMode] = useState<GameLaunchMode>(
    gameToEdit?.gameConfig?.launchMode || 'internal_embed'
  );
  const [webGameUrl, setWebGameUrl] = useState(gameToEdit?.gameConfig?.webGameUrl || '');
  const [apkUrl, setApkUrl] = useState(gameToEdit?.gameConfig?.apkUrl || '');
  const [externalUrl, setExternalUrl] = useState(gameToEdit?.gameConfig?.externalUrl || '');
  const [downloadUrl, setDownloadUrl] = useState(gameToEdit?.gameConfig?.downloadUrl || '');
  const [version, setVersion] = useState(gameToEdit?.gameConfig?.version || '1.0.0');
  const [releaseDate, setReleaseDate] = useState(
    gameToEdit?.gameConfig?.releaseDate ||
      (gameToEdit?.createdAt ? gameToEdit.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])
  );
  const [genre, setGenre] = useState(gameToEdit?.gameConfig?.genre || 'أكشن');
  const [fileSize, setFileSize] = useState(gameToEdit?.gameConfig?.fileSize || '45 MB');
  const [systemReqs, setSystemReqs] = useState(
    gameToEdit?.gameConfig?.systemReqs || 'متصفح يدعم WebGL 2.0، ذاكرة 4GB RAM'
  );
  const [platform, setPlatform] = useState(
    gameToEdit?.gameConfig?.platform || 'متصفح الويب (WebGL) / أندرويد'
  );
  const [videoUrl, setVideoUrl] = useState(gameToEdit?.gameConfig?.videoUrl || '');

  // Tags & Gallery
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(gameToEdit?.tags || ['ألعاب', 'محاكاة']);
  const [galleryImages, setGalleryImages] = useState<string[]>(gameToEdit?.galleryImages || []);
  const [galleryUrlInput, setGalleryUrlInput] = useState('');

  // Categories list & Quick Add
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [imageTab, setImageTab] = useState<'url' | 'upload'>('url');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    setTitle(gameToEdit?.title || '');
    setSummary(gameToEdit?.summary || '');
    setDescription(gameToEdit?.description || '');
    setCategory(gameToEdit?.category || 'ألعاب الأكشن والسرعة');
    setCoverImage(gameToEdit?.coverImage || '');
    setStatus(gameToEdit?.status || 'published');
    setIsFeatured(gameToEdit?.isFeatured ?? false);

    setLaunchMode(gameToEdit?.gameConfig?.launchMode || 'internal_embed');
    setWebGameUrl(gameToEdit?.gameConfig?.webGameUrl || '');
    setApkUrl(gameToEdit?.gameConfig?.apkUrl || '');
    setExternalUrl(gameToEdit?.gameConfig?.externalUrl || '');
    setDownloadUrl(gameToEdit?.gameConfig?.downloadUrl || '');
    setVersion(gameToEdit?.gameConfig?.version || '1.0.0');
    setReleaseDate(
      gameToEdit?.gameConfig?.releaseDate ||
        (gameToEdit?.createdAt ? gameToEdit.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])
    );
    setGenre(gameToEdit?.gameConfig?.genre || 'أكشن');
    setFileSize(gameToEdit?.gameConfig?.fileSize || '45 MB');
    setSystemReqs(
      gameToEdit?.gameConfig?.systemReqs || 'متصفح يدعم WebGL 2.0، ذاكرة 4GB RAM'
    );
    setPlatform(
      gameToEdit?.gameConfig?.platform || 'متصفح الويب (WebGL) / أندرويد'
    );
    setVideoUrl(gameToEdit?.gameConfig?.videoUrl || '');
    setTags(gameToEdit?.tags || ['ألعاب', 'محاكاة']);
    setGalleryImages(gameToEdit?.galleryImages || []);
  }, [gameToEdit]);

  const loadCategories = async () => {
    try {
      const cats = await api.getCategories('game');
      setCategories(cats);
      if (!category && cats.length > 0) {
        setCategory(cats[0].name);
      }
    } catch (e) {
      console.error('Failed to load categories', e);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setIsAddingCat(true);
    try {
      const created = await api.createCategory({ name: newCatName.trim(), type: 'game' });
      setCategories((prev) => [...prev, created]);
      setCategory(created.name);
      setNewCatName('');
      setShowAddCategory(false);
    } catch (err: any) {
      showToast(err.message || 'فشل إضافة التصنيف.', 'error');
    } finally {
      setIsAddingCat(false);
    }
  };

  // Image upload handler via Firebase Storage (production) or local dev upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 5 ميجابايت.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const rawResult = reader.result;
        const previousCover = coverImage;
        setCoverImage(rawResult);
        setIsUploadingImage(true);
        try {
          const res = await api.uploadFile(rawResult, file.name, 'covers');
          if (res?.url) {
            setCoverImage(res.url);
            showToast('تم رفع صورة الغلاف إلى Firebase Storage بنجاح.', 'success');
          }
        } catch (err: any) {
          setCoverImage(previousCover);
          showToast(
            err?.message || 'تعذر رفع الصورة. استخدم رابط صورة مباشر أو تأكد من تفعيل Firebase Storage.',
            'error'
          );
        } finally {
          setIsUploadingImage(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const clean = tagInput.trim().replace(/^#/, '');
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddGalleryImage = () => {
    if (!galleryUrlInput.trim()) return;
    setGalleryImages([...galleryImages, galleryUrlInput.trim()]);
    setGalleryUrlInput('');
  };

  const handleRemoveGalleryImage = (index: number) => {
    setGalleryImages(galleryImages.filter((_, idx) => idx !== index));
  };

  // Validation
  const validateForm = () => {
    setErrorMsg('');
    if (!title.trim()) {
      setErrorMsg('اسم اللعبة حقل مطلوب.');
      return false;
    }
    if (!description.trim() && !summary.trim()) {
      setErrorMsg('يرجى كتابة وصف أو ملخص للعبة.');
      return false;
    }
    if (!category.trim()) {
      setErrorMsg('يرجى اختيار تصنيف للعبة.');
      return false;
    }

    // Launch method validation
    if (launchMode === 'internal_embed' && !webGameUrl.trim() && !externalUrl.trim()) {
      setErrorMsg('يرجى إدخال رابط تشغيل اللعبة المدمج أو الخارجي.');
      return false;
    }
    if (launchMode === 'internal_page' && !webGameUrl.trim() && !externalUrl.trim()) {
      setErrorMsg('يرجى إدخال رابط اللعبة للتشغيل في صفحة مستقلة.');
      return false;
    }
    if (launchMode === 'external_url' && !externalUrl.trim() && !webGameUrl.trim()) {
      setErrorMsg('يرجى إدخال رابط موقع اللعبة الخارجي.');
      return false;
    }
    if (launchMode === 'apk_download' && !apkUrl.trim() && !downloadUrl.trim()) {
      setErrorMsg('يرجى إدخال رابط تحميل ملف حزمة اللعبة (APK أو ZIP).');
      return false;
    }

    return true;
  };

  // Save handler (draft or publish)
  const handleSave = async (targetStatus: 'published' | 'draft') => {
    if (!validateForm()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      let deliveryType: GameDeliveryType = 'web_game';
      if (launchMode === 'apk_download') deliveryType = 'apk';
      else if (launchMode === 'external_url') deliveryType = 'external';

      const payload: Partial<ContentItem> = {
        title: title.trim(),
        summary: summary.trim() || description.trim().slice(0, 120),
        description: description.trim() || summary.trim(),
        category: category.trim(),
        type: 'game',
        coverImage: coverImage.trim(),
        galleryImages,
        status: targetStatus,
        isFeatured,
        tags,
        gameConfig: {
          deliveryType,
          launchMode,
          webGameUrl: webGameUrl.trim() || undefined,
          apkUrl: apkUrl.trim() || downloadUrl.trim() || undefined,
          externalUrl: externalUrl.trim() || undefined,
          downloadUrl: downloadUrl.trim() || apkUrl.trim() || undefined,
          version: version.trim() || '1.0.0',
          releaseDate,
          fileSize: fileSize.trim() || undefined,
          systemReqs: systemReqs.trim() || undefined,
          platform: platform.trim() || undefined,
          genre: genre.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
        },
      };

      let result: ContentItem;
      if (gameToEdit?.id) {
        result = await api.updateContent(gameToEdit.id, payload);
      } else {
        result = await api.createContent(payload);
      }

      onSuccess(result, targetStatus);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ اللعبة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-[#191A17] border border-[#2D302A] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-right"
      >
        {/* Sticky Modal Header */}
        <div className="sticky top-0 z-20 px-6 py-4 bg-[#1F211C] border-b border-[#2D302A] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF5A1F]/15 text-[#FF5A1F] flex items-center justify-center">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-mono text-[#F2EBDD]">
                  {gameToEdit ? 'تعديل بيانات اللعبة' : 'إضافة ونشر لعبة جديدة'}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#D7FF38]/10 text-[#D7FF38] border border-[#D7FF38]/30">
                  لوحة التحكم
                </span>
              </div>
              <p className="text-xs text-[#F2EBDD]/60 mt-0.5">
                تكوين شامل لطريقة التشغيل، الغلاف، المنصات، وحزم التثبيت.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#F2EBDD]/60 hover:text-white hover:bg-[#282B24] rounded-lg transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-red-500/15 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Basic Game Info */}
          <div className="space-y-4 bg-[#1D1F1A] border border-[#2B2E26] p-4 sm:p-5 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-mono text-[#FF5A1F] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>1. المعلومات الأساسية</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#F2EBDD] mb-1.5 font-mono">
                  اسم اللعبة <span className="text-[#FF5A1F]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title || ''}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: Kinetic Void 2026"
                  className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl px-3.5 py-2.5 text-xs text-[#F2EBDD] focus:outline-none placeholder:text-[#F2EBDD]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#F2EBDD] mb-1.5 font-mono">
                  التصنيف <span className="text-[#FF5A1F]">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={category || ''}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl px-3 py-2.5 text-xs text-[#F2EBDD] focus:outline-none cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {!categories.some((c) => c.name === category) && category && (
                      <option value={category}>{category}</option>
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowAddCategory(!showAddCategory)}
                    className="px-3 py-2.5 bg-[#252822] hover:bg-[#2F322B] text-xs font-mono text-[#D7FF38] border border-[#35382F] rounded-xl flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="إضافة تصنيف جديد"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">تصنيف جديد</span>
                  </button>
                </div>

                {showAddCategory && (
                  <div className="mt-2.5 p-3 bg-[#161714] border border-[#2B2E26] rounded-lg flex items-center gap-2">
                    <input
                      type="text"
                      value={newCatName || ''}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="اسم التصنيف الجديد..."
                      className="flex-1 bg-[#1A1C17] border border-[#32362C] rounded-lg px-2.5 py-1.5 text-xs text-[#F2EBDD] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isAddingCat || !newCatName.trim()}
                      onClick={handleCreateCategory}
                      className="px-3 py-1.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      {isAddingCat ? 'جاري الإضافة...' : 'حفظ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddCategory(false)}
                      className="px-2 py-1.5 text-xs text-[#F2EBDD]/50 hover:text-white cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Short Summary and Long Description */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-[#F2EBDD] mb-1.5 font-mono">
                  وصف مختصر (يظهر في بطاقة اللعبة) <span className="text-[#FF5A1F]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={summary || ''}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="سطر مكثف يصف تجربة اللعبة ويجذب اللاعبين..."
                  className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl px-3.5 py-2.5 text-xs text-[#F2EBDD] focus:outline-none placeholder:text-[#F2EBDD]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#F2EBDD] mb-1.5 font-mono">
                  الوصف الكامل والشرح
                </label>
                <textarea
                  rows={3}
                  value={description || ''}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اشرح أسلوب اللعب (Gameplay)، القصة، وعناصر التحكم..."
                  className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl p-3 text-xs text-[#F2EBDD] focus:outline-none placeholder:text-[#F2EBDD]/30 resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Version & Release Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-[#F2EBDD] mb-1.5 font-mono">
                  رقم الإصدار (Version)
                </label>
                <input
                  type="text"
                  value={version || ''}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="مثال: 1.0.0 أو 2.4-Beta"
                  className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl px-3.5 py-2.5 text-xs text-[#F2EBDD] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#F2EBDD] mb-1.5 font-mono">
                  تاريخ الإصدار
                </label>
                <div className="relative">
                  <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F2EBDD]/40 pointer-events-none" />
                  <input
                    type="date"
                    value={releaseDate || ''}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-[#F2EBDD] focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Cover Image with Upload / URL and Live Preview */}
          <div className="space-y-4 bg-[#1D1F1A] border border-[#2B2E26] p-4 sm:p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-[#D7FF38] uppercase tracking-wider">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>2. صورة الغلاف والمعاينة</span>
              </div>

              <div className="flex items-center gap-1 bg-[#141512] p-1 rounded-lg border border-[#272922] text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setImageTab('url')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    imageTab === 'url' ? 'bg-[#FF5A1F] text-white font-bold' : 'text-[#F2EBDD]/60 hover:text-white'
                  }`}
                >
                  رابط مباشر
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab('upload')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    imageTab === 'upload' ? 'bg-[#FF5A1F] text-white font-bold' : 'text-[#F2EBDD]/60 hover:text-white'
                  }`}
                >
                  رفع من الجهاز
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              {/* Input Area */}
              <div className="md:col-span-7 space-y-3">
                {imageTab === 'url' ? (
                  <div>
                    <label className="block text-xs font-bold text-[#F2EBDD] mb-1 font-mono">
                      رابط صورة الغلاف (URL)
                    </label>
                    <input
                      type="url"
                      value={coverImage || ''}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="https://images.unsplash.com/... أو رابط الصورة"
                      className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl px-3.5 py-2.5 text-xs text-[#F2EBDD] focus:outline-none"
                    />
                    <p className="text-[11px] text-[#F2EBDD]/50 mt-1">
                      يدعم روابط الصور بصيغ JPG و PNG و WebP و SVG.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-[#F2EBDD] mb-1 font-mono">
                      اختيار ملف صورة من جهازك
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div
                      onClick={() => !isUploadingImage && fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-[#343830] hover:border-[#FF5A1F] rounded-xl p-5 text-center cursor-pointer bg-[#141512] hover:bg-[#181A15] transition-all space-y-2"
                    >
                      <Upload className={`w-6 h-6 text-[#FF5A1F] mx-auto ${isUploadingImage ? 'animate-bounce' : ''}`} />
                      <p className="text-xs font-semibold text-[#F2EBDD]">
                        {isUploadingImage ? 'جاري معالجة وحفظ الصورة...' : 'انقر لاختيار صورة من جهازك'}
                      </p>
                      <p className="text-[10px] text-[#F2EBDD]/40 font-mono">
                        PNG أو JPG أو WebP (أقل من 5 ميجابايت)
                      </p>
                    </div>
                  </div>
                )}

                {coverImage && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCoverImage('')}
                      className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف الصورة</span>
                    </button>
                    <span className="text-[11px] text-[#D7FF38] font-mono">
                      ✓ الغلاف مهيأ بنجاح
                    </span>
                  </div>
                )}
              </div>

              {/* Preview Thumbnail Area */}
              <div className="md:col-span-5 flex flex-col items-center">
                <span className="text-[11px] font-mono text-[#F2EBDD]/50 block mb-1.5 self-start">
                  معاينة نسبة الأبعاد (16:10):
                </span>
                <div className="relative w-full aspect-[16/10] bg-[#141512] border border-[#2E3129] rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt="معاينة الغلاف"
                      className="w-full h-full object-cover"
                      onError={() => setErrorMsg('تعذر تحميل رابط الصورة. يرجى التأكد من صحته.')}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#F2EBDD]/30 space-y-1">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <span className="text-[11px] font-mono">لا يوجد غلاف محدد</span>
                    </div>
                  )}

                  {isFeatured && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white bg-[#FF5A1F] rounded shadow">
                      مميز
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Launch Methods Configuration (Requirement 2) */}
          <div className="space-y-4 bg-[#1D1F1A] border border-[#2B2E26] p-4 sm:p-5 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-mono text-[#FF5A1F] uppercase tracking-wider">
              <Monitor className="w-3.5 h-3.5" />
              <span>3. طريقة تشغيل اللعبة</span>
            </div>

            {/* 4 Dedicated Method Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'internal_embed' as GameLaunchMode,
                  title: 'تشغيل مدمج داخل المنصة',
                  desc: 'عرض اللعبة داخل مشغل VYRN المدمج (Iframe / WebGL) مع تكبير الشاشة.',
                  icon: Play,
                  badge: 'موصى به لـ WebGL',
                },
                {
                  id: 'internal_page' as GameLaunchMode,
                  title: 'صفحة مستقلة داخل VYRN',
                  desc: 'فتح اللعبة في صفحة مخصصة داخل فضاء VYRN بملء الشاشة مع أدوات التحكم.',
                  icon: Layers,
                  badge: 'تجربة مركزة',
                },
                {
                  id: 'external_url' as GameLaunchMode,
                  title: 'فتح رابط خارجي',
                  desc: 'توجيه اللاعب إلى الموقع الأصلي أو الخادم الخارجي للعبة في تبويب آمن.',
                  icon: ExternalLink,
                  badge: 'للألعاب الخارجية',
                },
                {
                  id: 'apk_download' as GameLaunchMode,
                  title: 'تنزيل حزمة تثبيت (APK / ZIP)',
                  desc: 'توفير تحميل مباشر لحزمة أندرويد APK أو ملف اللعبة مع إرشادات الأمان.',
                  icon: Download,
                  badge: 'أندرويد / ملفات',
                },
              ].map((method) => {
                const Icon = method.icon;
                const isSelected = launchMode === method.id;
                return (
                  <div
                    key={method.id}
                    onClick={() => setLaunchMode(method.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'bg-[#22251E] border-[#FF5A1F] shadow-md shadow-[#FF5A1F]/10 ring-1 ring-[#FF5A1F]'
                        : 'bg-[#151713] border-[#2A2D25] hover:border-[#383C32]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-[#FF5A1F] text-white' : 'bg-[#252822] text-[#F2EBDD]/60'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-[#F2EBDD] font-mono">{method.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#D7FF38] bg-[#D7FF38]/10 px-1.5 py-0.5 rounded">
                        {method.badge}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#F2EBDD]/60 leading-relaxed pr-9">{method.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Link Inputs Based on Selected Method */}
            <div className="pt-2 space-y-3">
              {(launchMode === 'internal_embed' || launchMode === 'internal_page') && (
                <div>
                  <label className="block text-xs font-bold text-[#F2EBDD] mb-1 font-mono">
                    رابط تشغيل اللعبة (WebGL / Web Game URL) <span className="text-[#FF5A1F]">*</span>
                  </label>
                  <input
                    type="url"
                    value={webGameUrl || ''}
                    onChange={(e) => setWebGameUrl(e.target.value)}
                    placeholder="https://mygame.itch.io/... أو رابط الصفحة القابلة للتضمين"
                    className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl px-3.5 py-2.5 text-xs text-[#F2EBDD] focus:outline-none"
                  />
                  <p className="text-[11px] text-[#F2EBDD]/50 mt-1">
                    ملاحظة: إذا كان الموقع يمنع التضمين داخل Iframe، ستقوم منصة VYRN بعرض خيار التشغيل الخارجي تلقائياً دون تعطل الواجهة.
                  </p>
                </div>
              )}

              {launchMode === 'external_url' && (
                <div>
                  <label className="block text-xs font-bold text-[#F2EBDD] mb-1 font-mono">
                    رابط موقع اللعبة الخارجي (External URL) <span className="text-[#FF5A1F]">*</span>
                  </label>
                  <input
                    type="url"
                    value={externalUrl || ''}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://store.steampowered.com/... أو رابط صفحة اللعبة"
                    className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl px-3.5 py-2.5 text-xs text-[#F2EBDD] focus:outline-none"
                  />
                </div>
              )}

              {/* Download URL (Always available or required for apk_download) */}
              <div>
                <label className="block text-xs font-bold text-[#F2EBDD] mb-1 font-mono">
                  رابط تحميل ملف اللعبة (اختياري، أو مطلوب لنمط التحميل)
                  {launchMode === 'apk_download' && <span className="text-[#FF5A1F]"> *</span>}
                </label>
                <input
                  type="url"
                  value={downloadUrl || apkUrl || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setApkUrl(val);
                    setDownloadUrl(val);
                  }}
                  placeholder="https://.../download/game.apk أو رابط ملف ZIP"
                  className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-xl px-3.5 py-2.5 text-xs text-[#F2EBDD] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Publishing & Feature Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#1D1F1A] border border-[#2B2E26] p-4 sm:p-5 rounded-xl">
            {/* Publish Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#141512] border border-[#2A2D25] rounded-xl">
              <div>
                <span className="text-xs font-bold text-[#F2EBDD] block font-mono">
                  منشورة للعامة (Published)
                </span>
                <span className="text-[11px] text-[#F2EBDD]/50">
                  {status === 'published' ? 'تظهر للزوار في قسم الألعاب' : 'محفوظة كمسودة لا يراها إلا المدير'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStatus(status === 'published' ? 'draft' : 'published')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  status === 'published' ? 'bg-[#D7FF38]' : 'bg-[#2E3129]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[#191A17] absolute top-1 transition-transform ${
                    status === 'published' ? 'left-1' : 'left-7'
                  }`}
                />
              </button>
            </div>

            {/* Featured Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#141512] border border-[#2A2D25] rounded-xl">
              <div>
                <span className="text-xs font-bold text-[#F2EBDD] block font-mono">
                  مميزة على الرئيسية (Featured)
                </span>
                <span className="text-[11px] text-[#F2EBDD]/50">
                  {isFeatured ? 'ستظهر في بنر الواجهة الرئيسي' : 'عرض عادي داخل دليل الألعاب'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsFeatured(!isFeatured)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  isFeatured ? 'bg-[#FF5A1F]' : 'bg-[#2E3129]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    isFeatured ? 'left-1' : 'left-7'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section 5: Expandable Advanced Specifications */}
          <div className="border border-[#2B2E26] rounded-xl overflow-hidden bg-[#1D1F1A]">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-mono font-bold text-[#F2EBDD] hover:bg-[#242720] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 text-[#D7FF38]">
                <Cpu className="w-4 h-4" />
                <span>حقول إضافية موسعة (المنصات، متطلبات التشغيل، الحجم، الفيديو، وسوم البحث)</span>
              </div>
              <span className="text-xs text-[#F2EBDD]/50 font-mono">
                {showAdvanced ? '▲ إخفاء' : '▼ إظهار'}
              </span>
            </button>

            {showAdvanced && (
              <div className="p-5 border-t border-[#2B2E26] space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[#F2EBDD]/70 mb-1 font-mono">نوع اللعبة (Genre)</label>
                    <input
                      type="text"
                      value={genre || ''}
                      onChange={(e) => setGenre(e.target.value)}
                      placeholder="أكشن، سباق، RPG، ألغاز..."
                      className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#F2EBDD]/70 mb-1 font-mono">حجم الملف (File Size)</label>
                    <input
                      type="text"
                      value={fileSize || ''}
                      onChange={(e) => setFileSize(e.target.value)}
                      placeholder="مثال: 45 MB أو 1.2 GB"
                      className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#F2EBDD]/70 mb-1 font-mono">المنصات المدعومة</label>
                    <input
                      type="text"
                      value={platform || ''}
                      onChange={(e) => setPlatform(e.target.value)}
                      placeholder="WebGL, Android, Windows..."
                      className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#F2EBDD]/70 mb-1 font-mono">متطلبات النظام والتشغيل</label>
                  <input
                    type="text"
                    value={systemReqs || ''}
                    onChange={(e) => setSystemReqs(e.target.value)}
                    placeholder="مثال: متصفح حديث يدعم WebGL 2.0، ذاكرة 4GB RAM"
                    className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
                  />
                </div>

                <div>
                  <label className="block text-[#F2EBDD]/70 mb-1 font-mono">رابط فيديو ترويجي (Trailer / Video URL)</label>
                  <input
                    type="url"
                    value={videoUrl || ''}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
                  />
                </div>

                {/* Tags Management */}
                <div>
                  <label className="block text-[#F2EBDD]/70 mb-1 font-mono">وسوم البحث (Tags)</label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={tagInput || ''}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="اكتب وسماً ثم اضغط Enter أو إضافة..."
                      className="flex-1 bg-[#141512] border border-[#2D3028] rounded-lg p-2 text-[#F2EBDD]"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-3 py-2 bg-[#252822] hover:bg-[#2F322B] text-white rounded-lg cursor-pointer"
                    >
                      إضافة وسم
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#141512] border border-[#2C2F27] text-[#D7FF38] rounded-lg text-[11px] font-mono"
                      >
                        <span>#{t}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="text-[#F2EBDD]/40 hover:text-red-400 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Gallery Images */}
                <div className="pt-2">
                  <label className="block text-[#F2EBDD]/70 mb-1 font-mono">صور إضافية للمعرض (Gallery)</label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="url"
                      value={galleryUrlInput || ''}
                      onChange={(e) => setGalleryUrlInput(e.target.value)}
                      placeholder="رابط لقطة شاشة إضافية من اللعبة..."
                      className="flex-1 bg-[#141512] border border-[#2D3028] rounded-lg p-2 text-[#F2EBDD]"
                    />
                    <button
                      type="button"
                      onClick={handleAddGalleryImage}
                      className="px-3 py-2 bg-[#252822] hover:bg-[#2F322B] text-white rounded-lg cursor-pointer"
                    >
                      إضافة للمعرض
                    </button>
                  </div>
                  {galleryImages.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {galleryImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-[#2D3028] group">
                          <img src={img} alt="لقطة" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveGalleryImage(idx)}
                            className="absolute top-1 left-1 p-1 bg-black/70 hover:bg-red-600 text-white rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Preview Modal Overlay if preview clicked */}
        {previewOpen && (
          <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
            <div className="bg-[#1C1E19] border border-[#2D3027] rounded-2xl max-w-md w-full p-6 space-y-4 text-right">
              <div className="flex items-center justify-between border-b border-[#2B2E26] pb-3">
                <span className="text-xs font-mono text-[#D7FF38]">معاينة بطاقة اللعبة</span>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="text-[#F2EBDD]/60 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative aspect-[16/10] bg-[#141512] rounded-xl overflow-hidden border border-[#2A2D25]">
                {coverImage ? (
                  <img src={coverImage} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#F2EBDD]/30 font-mono text-xs">
                    لا يوجد غلاف
                  </div>
                )}
                <div className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-bold text-[#191A17] bg-[#D7FF38] rounded">
                  جديد
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono text-[#FF5A1F] uppercase">{category}</span>
                <h4 className="text-base font-bold text-[#F2EBDD] font-mono">{title || 'اسم اللعبة'}</h4>
                <p className="text-xs text-[#F2EBDD]/70 mt-1 line-clamp-2">
                  {summary || 'وصف موجز للعبة سيظهر هنا للمستخدمين...'}
                </p>
              </div>

              <div className="pt-2 border-t border-[#292C25] flex items-center justify-between text-xs text-[#F2EBDD]/50 font-mono">
                <span>نمط التشغيل: {launchMode}</span>
                <span>الإصدار: {version}</span>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Action Footer Bar (Requirement 3 & 5) */}
        <div className="sticky bottom-0 z-20 px-6 py-4 bg-[#1F211C] border-t border-[#2D302A] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="px-4 py-2.5 bg-[#252822] hover:bg-[#2C2F28] border border-[#363A30] text-[#F2EBDD] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4 ml-1 text-[#D7FF38]" />
              <span>معاينة البطاقة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-[#F2EBDD]/60 hover:text-white transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Save as Draft */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('draft')}
              className="px-4 py-2.5 bg-[#252822] hover:bg-[#2D3128] border border-[#383C32] text-[#F2EBDD] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <EyeOff className="w-4 h-4 ml-1 text-amber-400" />
              <span>حفظ كمسودة</span>
            </button>

            {/* Publish Game */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('published')}
              className="px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-[#FF5A1F]/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : gameToEdit ? 'تحديث ونشر اللعبة' : 'نشر اللعبة الآن'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
