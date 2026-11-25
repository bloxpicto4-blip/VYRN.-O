import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Heart,
  Share2,
  Download,
  Play,
  ExternalLink,
  MessageSquare,
  CornerDownLeft,
  Flag,
  Trash2,
  Check,
  BookOpen,
  Info,
} from 'lucide-react';
import { ContentItem, CommentItem } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PodcastPlayer } from '../media/PodcastPlayer';

interface ContentDetailPageProps {
  item: ContentItem;
  onBack: () => void;
  onLaunchGame: (item: ContentItem) => void;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
  onRequireAuth?: () => void;
}

export const ContentDetailPage: React.FC<ContentDetailPageProps> = ({
  item,
  onBack,
  onLaunchGame,
  onToggleFavorite,
  isFavorite = false,
  onRequireAuth,
}) => {
  const { currentUser, isFirebaseAuthenticated } = useAuth();
  const { showToast, confirmAction } = useToast();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likesCount, setLikesCount] = useState(item.likesCount || 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');

  useEffect(() => {
    loadComments();
    api.checkIsLiked(item.id).then(setHasLiked).catch(() => setHasLiked(false));
    window.location.hash = `item/${item.id}`;
  }, [item.id, currentUser?.id]);

  const loadComments = async () => {
    try {
      const data = await api.getComments(item.id);
      setComments(data);
    } catch (e) {
      console.error('Error fetching comments:', e);
    }
  };

  const handleToggleLike = async () => {
    if (!currentUser || !isFirebaseAuthenticated) {
      showToast('يرجى تسجيل الدخول بحساب Firebase للإعجاب بالمحتوى.', 'info');
      onRequireAuth?.();
      return;
    }
    try {
      const res = await api.toggleLike(item.id);
      setLikesCount(res.count);
      setHasLiked(res.liked);
    } catch (e: any) {
      showToast(e?.message || 'تعذر تسجيل الإعجاب حالياً.', 'error');
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}#item/${item.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareFeedback(true);
      setTimeout(() => setShareFeedback(false), 2000);
    });
  };

  const handlePostComment = async (parentId?: string) => {
    if (!currentUser || !isFirebaseAuthenticated) {
      showToast('يجب تسجيل الدخول بحساب Firebase للمشاركة في التعليقات.', 'info');
      onRequireAuth?.();
      return;
    }
    const text = parentId ? replyInput : commentInput;
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      await api.postComment({
        contentId: item.id,
        content: text.trim(),
        parentId,
      });
      if (parentId) {
        setReplyInput('');
        setReplyParentId(null);
      } else {
        setCommentInput('');
      }
      await loadComments();
      showToast('تم نشر التعليق بنجاح.', 'success');
    } catch (err: any) {
      showToast(err.message || 'فشل نشر التعليق.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (id: string) => {
    const confirmed = await confirmAction({
      title: 'حذف التعليق',
      message: 'هل أنت متأكد من حذف هذا التعليق؟',
      confirmLabel: 'حذف التعليق',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await api.deleteComment(id);
      await loadComments();
      showToast('تم حذف التعليق بنجاح.', 'success');
    } catch (err: any) {
      showToast(err.message || 'فشل حذف التعليق.', 'error');
    }
  };

  const handleReportComment = async (id: string) => {
    if (!currentUser || !isFirebaseAuthenticated) {
      showToast('يرجى تسجيل الدخول لإرسال بلاغ.', 'info');
      onRequireAuth?.();
      return;
    }
    if (!reportReason.trim()) return;
    try {
      await api.reportComment(id, reportReason);
      showToast('تم إرسال البلاغ لمراجعة الإدارة.', 'success');
      setReportingCommentId(null);
      setReportReason('');
      await loadComments();
    } catch (err: any) {
      showToast(err.message || 'فشل إرسال البلاغ.', 'error');
    }
  };

  const rootComments = comments.filter((c) => !c.parentId);
  const getReplies = (parentId: string) => comments.filter((c) => c.parentId === parentId);

  return (
    <article dir="rtl" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-in fade-in duration-300 text-right">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between border-b border-[#292C25] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-[#F2EBDD]/70 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 ml-1" />
          <span>العودة للدليل</span>
        </button>

        <div className="flex items-center gap-2">
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(item.id)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                isFavorite
                  ? 'bg-[#FF5A1F]/20 border-[#FF5A1F] text-[#FF5A1F]'
                  : 'bg-[#22241F] border-[#32362E] text-[#F2EBDD]/70 hover:text-white'
              }`}
              title="حفظ في المفضلة"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#FF5A1F]' : ''}`} />
            </button>
          )}

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#F2EBDD]/80 bg-[#22241F] hover:bg-[#2C3028] border border-[#32362E] rounded-lg transition-colors cursor-pointer"
          >
            {shareFeedback ? <Check className="w-3.5 h-3.5 text-[#D7FF38]" /> : <Share2 className="w-3.5 h-3.5 ml-1" />}
            <span>{shareFeedback ? 'تم نسخ الرابط' : 'مشاركة'}</span>
          </button>
        </div>
      </div>

      {/* Main Showcase Hero */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D7FF38]">
          <span>{item.type}</span>
          <span className="text-[#F2EBDD]/30">/</span>
          <span className="text-[#F2EBDD]/70">{item.category}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#F2EBDD] font-mono tracking-tight">
          {item.title}
        </h1>

        <p className="text-base sm:text-lg text-[#F2EBDD]/80 max-w-3xl leading-relaxed">
          {item.summary}
        </p>

        {/* Media Frame */}
        {item.coverImage && (
          <div className="relative aspect-[16/9] w-full bg-[#141512] border border-[#2D302A] rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={item.coverImage}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Primary Action Button Row */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          {item.type === 'game' && (
            <button
              onClick={() => onLaunchGame(item)}
              className="px-6 py-3 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-xl flex items-center gap-2 text-sm shadow-lg shadow-[#FF5A1F]/25 cursor-pointer transition-all"
            >
              <Play className="w-4 h-4 fill-current ml-1" />
              <span>تشغيل اللعبة الآن</span>
            </button>
          )}

          {item.type === 'app' && item.appConfig?.downloadUrl && (
            <a
              href={item.appConfig.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-xl flex items-center gap-2 text-sm shadow-lg shadow-[#FF5A1F]/25 cursor-pointer transition-all"
            >
              <Download className="w-4 h-4 ml-1" />
              <span>تحميل التطبيق</span>
            </a>
          )}

          {item.type === 'book' && item.bookConfig?.readingLink && (
            <a
              href={item.bookConfig.readingLink}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-[#FF5A1F] hover:bg-[#FF3300] text-white font-bold rounded-xl flex items-center gap-2 text-sm shadow-lg shadow-[#FF5A1F]/25 cursor-pointer transition-all"
            >
              <BookOpen className="w-4 h-4 ml-1" />
              <span>قراءة المنشور رقمياً</span>
            </a>
          )}

          {item.type === 'project' && item.projectConfig?.repoUrl && (
            <a
              href={item.projectConfig.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-[#22241F] hover:bg-[#2C3028] border border-[#383C33] text-[#F2EBDD] font-bold rounded-xl flex items-center gap-2 text-sm cursor-pointer transition-all"
            >
              <ExternalLink className="w-4 h-4 ml-1 rtl-flip" />
              <span>مستودع الكود البرمجي</span>
            </a>
          )}

          {/* Like Button */}
          <button
            onClick={handleToggleLike}
            className={`px-4 py-3 rounded-xl border flex items-center gap-2 text-sm font-semibold transition-colors cursor-pointer ${
              hasLiked
                ? 'bg-[#FF5A1F]/20 border-[#FF5A1F] text-[#FF5A1F]'
                : 'bg-[#1E201B] border-[#30342B] text-[#F2EBDD]/80 hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${hasLiked ? 'fill-[#FF5A1F]' : ''}`} />
            <span className="tabular-nums font-mono">{likesCount} إعجاب</span>
          </button>
        </div>
      </div>

      {/* Podcast Audio Player Module if type is podcast */}
      {item.type === 'podcast' && (
        <div className="pt-2">
          <PodcastPlayer
            title={item.title}
            host={item.podcastConfig?.host}
            audioUrl={item.podcastConfig?.audioUrl}
            episodeNumber={item.podcastConfig?.episodeNumber}
            durationString={item.podcastConfig?.duration}
            artworkUrl={item.coverImage}
          />
        </div>
      )}

      {/* Deep Specification & Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-[#292C25]">
        {/* Full Prose Description */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-[#F2EBDD] font-mono">نظرة عامة والمنهجية</h2>
          <div className="text-sm text-[#F2EBDD]/80 leading-relaxed whitespace-pre-line">
            {item.description}
          </div>

          {/* Changelog or Show Notes */}
          {item.appConfig?.changelog && (
            <div className="mt-6 p-4 bg-[#1E201B] border border-[#2D3027] rounded-xl space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#D7FF38]">سجل التحديثات (Changelog)</h3>
              <p className="text-xs text-[#F2EBDD]/70">{item.appConfig.changelog}</p>
            </div>
          )}

          {item.podcastConfig?.showNotes && (
            <div className="mt-6 p-4 bg-[#1E201B] border border-[#2D3027] rounded-xl space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#D7FF38]">محاور وتوقيتات الحلقة</h3>
              <p className="text-xs text-[#F2EBDD]/70 whitespace-pre-line">{item.podcastConfig.showNotes}</p>
            </div>
          )}
        </div>

        {/* Metadata Sidebar */}
        <div className="space-y-6 bg-[#1A1C17] border border-[#2A2D25] rounded-xl p-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#F2EBDD]/60">المواصفات والبيانات</h3>
          
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#F2EBDD]/40 block text-[11px]">المطور / الناشر</span>
              <span className="font-bold text-[#F2EBDD]">{item.creator}</span>
            </div>

            <div>
              <span className="text-[#F2EBDD]/40 block text-[11px]">تاريخ النشر</span>
              <span className="font-mono text-[#F2EBDD]">
                {new Date(item.createdAt).toLocaleDateString('ar-EG', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>

            {item.gameConfig?.platform && (
              <div>
                <span className="text-[#F2EBDD]/40 block text-[11px]">المنصة</span>
                <span className="font-bold text-[#F2EBDD]">{item.gameConfig.platform}</span>
              </div>
            )}

            {item.appConfig?.supportedOS && (
              <div>
                <span className="text-[#F2EBDD]/40 block text-[11px]">التوافق</span>
                <span className="font-bold text-[#F2EBDD]">{item.appConfig.supportedOS}</span>
              </div>
            )}

            {item.bookConfig?.pageCount && (
              <div>
                <span className="text-[#F2EBDD]/40 block text-[11px]">عدد الصفحات</span>
                <span className="font-mono text-[#F2EBDD]">{item.bookConfig.pageCount} صفحة</span>
              </div>
            )}

            {item.projectConfig?.techStack && (
              <div>
                <span className="text-[#F2EBDD]/40 block text-[11px]">الحزمة التقنية</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {item.projectConfig.techStack.map((tech) => (
                    <span key={tech} className="px-2 py-0.5 text-[10px] bg-[#242720] border border-[#33372D] rounded text-[#D7FF38] font-mono">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments & Interactive Section */}
      {item.commentsEnabled ? (
        <section className="pt-10 border-t border-[#292C25] space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#F2EBDD] font-mono flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#FF5A1F]" />
              <span>مشاركات ونقاشات المجتمع ({comments.length})</span>
            </h2>
          </div>

          {/* New Comment Box */}
          {currentUser && isFirebaseAuthenticated ? (
            <div className="bg-[#1E201B] border border-[#2D3027] rounded-xl p-4 space-y-3">
              <textarea
                value={commentInput || ''}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="شارك برأيك أو تقييمك التقني..."
                rows={3}
                className="w-full bg-[#161713] border border-[#2A2D25] focus:border-[#FF5A1F] rounded-lg p-3 text-sm text-[#F2EBDD] focus:outline-none placeholder:text-[#F2EBDD]/30 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#F2EBDD]/50">
                  النشر باسم: <strong className="text-[#D7FF38]">{currentUser.displayName}</strong>
                </span>
                <button
                  onClick={() => handlePostComment()}
                  disabled={isSubmitting || !commentInput.trim()}
                  className="px-5 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'جاري النشر...' : 'إرسال التعليق'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#1E201B] border border-[#2D3027] rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#F2EBDD]">
                  المشاركة في التعليقات والإعجاب متاحة للأعضاء المسجلين
                </p>
                <p className="text-[11px] text-[#F2EBDD]/55">
                  سجّل الدخول بحساب Firebase أو Google لإضافة تعليقك وكسب نقاط الخبرة.
                </p>
              </div>
              <button
                onClick={() => onRequireAuth?.()}
                className="px-4 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg cursor-pointer shrink-0 transition-colors"
              >
                تسجيل الدخول للمشاركة
              </button>
            </div>
          )}

          {/* Comment Thread List */}
          <div className="space-y-4">
            {rootComments.length === 0 ? (
              <p className="text-xs text-[#F2EBDD]/50 text-center py-8 font-mono">
                لا توجد تعليقات بعد. كن أول من يفتح باب النقاش حول هذا الإصدار.
              </p>
            ) : (
              rootComments.map((comment) => (
                <div key={comment.id} className="bg-[#1A1C17] border border-[#2B2E26] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#FF5A1F]/20 text-[#FF5A1F] font-mono font-bold flex items-center justify-center text-xs">
                        {comment.userDisplayName.charAt(0)}
                      </div>
                      <span className="font-bold text-[#F2EBDD]">{comment.userDisplayName}</span>
                      <span className="text-[#F2EBDD]/40 text-[11px]">
                        · {new Date(comment.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#F2EBDD]/50">
                      <button
                        onClick={() => setReplyParentId(replyParentId === comment.id ? null : comment.id)}
                        className="hover:text-[#D7FF38] cursor-pointer"
                      >
                        رد
                      </button>

                      <button
                        onClick={() => setReportingCommentId(comment.id)}
                        className="hover:text-[#FF5A1F] cursor-pointer"
                        title="إبلاغ عن محتوى غير لائق"
                      >
                        <Flag className="w-3 h-3" />
                      </button>

                      {(currentUser?.role === 'admin' || currentUser?.id === comment.userId) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="hover:text-red-400 cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[#F2EBDD]/80 leading-relaxed pr-8">
                    {comment.content}
                  </p>

                  {/* Inline Reply Input if Active */}
                  {replyParentId === comment.id && (
                    <div className="mt-3 pr-8 space-y-2">
                      <input
                        type="text"
                        value={replyInput || ''}
                        onChange={(e) => setReplyInput(e.target.value)}
                        placeholder={`الرد على ${comment.userDisplayName}...`}
                        className="w-full bg-[#141512] border border-[#2D3027] rounded-lg px-3 py-1.5 text-xs text-[#F2EBDD] focus:border-[#D7FF38] focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setReplyParentId(null)}
                          className="px-2.5 py-1 text-[11px] text-[#F2EBDD]/60 hover:text-white"
                        >
                          إلغاء
                        </button>
                        <button
                          onClick={() => handlePostComment(comment.id)}
                          className="px-3 py-1 bg-[#D7FF38] text-[#191A17] text-[11px] font-bold rounded"
                        >
                          إرسال الرد
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Threaded Nested Replies */}
                  {getReplies(comment.id).map((reply) => (
                    <div key={reply.id} className="mt-2 pr-8 border-r-2 border-[#2F3229] space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <CornerDownLeft className="w-3 h-3 text-[#FF5A1F]" />
                          <span className="font-bold text-[#F2EBDD]">{reply.userDisplayName}</span>
                          <span className="text-[#F2EBDD]/40 text-[10px]">
                            · {new Date(reply.createdAt).toLocaleDateString('ar-EG')}
                          </span>
                        </div>
                        {(currentUser?.role === 'admin' || currentUser?.id === reply.userId) && (
                          <button
                            onClick={() => handleDeleteComment(reply.id)}
                            className="text-[#F2EBDD]/40 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-[#F2EBDD]/80 pr-4">{reply.content}</p>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </section>
      ) : (
        <div className="pt-6 border-t border-[#292C25] text-xs text-[#F2EBDD]/50 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#F2EBDD]/40" />
          <span>المشاركات والتعليقات مغلقة لهذا الإصدار.</span>
        </div>
      )}

      {/* Report Modal */}
      {reportingCommentId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1C1E19] border border-[#2D3027] rounded-xl p-5 max-w-sm w-full space-y-4 text-right">
            <h4 className="text-sm font-bold text-[#F2EBDD] font-mono">الإبلاغ عن محتوى للمراجعة</h4>
            <textarea
              value={reportReason || ''}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="سبب الإبلاغ (سبام، محتوى مسيء، انتهاك حقوق...)"
              rows={3}
              className="w-full bg-[#141512] border border-[#2D3027] rounded-lg p-2.5 text-xs text-[#F2EBDD] focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReportingCommentId(null)}
                className="px-3 py-1.5 text-xs text-[#F2EBDD]/60 hover:text-white"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleReportComment(reportingCommentId)}
                className="px-3.5 py-1.5 bg-[#FF5A1F] text-white text-xs font-bold rounded-lg"
              >
                إرسال البلاغ
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
