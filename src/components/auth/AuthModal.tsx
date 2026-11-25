import React, { useState } from 'react';
import { X, Lock, Mail, User, Shield, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../brand/Logo';

interface AuthModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const { login, loginWithGoogle, register, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDevEnv = import.meta.env.DEV;

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر تسجيل الدخول عبر حساب Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setSuccessMsg('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
        return;
      }

      if (mode === 'login') {
        await login(identifier, password);
      } else {
        await register({ username, email, password, displayName });
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشلت عملية التحقق. يرجى التأكد من صحة البيانات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillAdmin = () => {
    setMode('login');
    setIdentifier('boda');
    setPassword('abdo');
  };

  return (
    <div
      onClick={onClose}
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#1C1E19] border border-[#2E3129] rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl relative text-right max-h-[92vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-5 left-5 text-[#F2EBDD]/60 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2">
          <Logo size="md" showWordmark={true} className="justify-center" />
          <h3 className="text-lg font-bold font-mono text-[#F2EBDD]">
            {mode === 'login'
              ? 'تسجيل الدخول السحابي إلى VYRN'
              : mode === 'register'
              ? 'إنشاء حساب سحابي جديد'
              : 'استعادة كلمة المرور'}
          </h3>
          <p className="text-xs text-[#F2EBDD]/60">
            حساب موحد عبر Firebase Authentication لغرف اللعب، النقاط، الإنجازات، والمفضلة.
          </p>
        </div>

        {/* Primary Google Firebase Sign-In */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleGoogleLogin}
          className="w-full py-3 bg-[#F2EBDD] hover:bg-white text-[#191A17] font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 shadow-md"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
            />
          </svg>
          <span>الدخول السريع عبر Google (موصى به للإدارة والأعضاء)</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#2B2E26] w-full" />
          <span className="px-3 bg-[#1C1E19] text-[10px] font-mono text-[#F2EBDD]/40 shrink-0">
            أو عبر البريد وكلمة المرور
          </span>
          <div className="border-t border-[#2B2E26] w-full" />
        </div>

        {/* Tab switch */}
        <div className="flex p-1 bg-[#141512] border border-[#272922] rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
              mode === 'login' ? 'bg-[#FF5A1F] text-white font-bold' : 'text-[#F2EBDD]/60 hover:text-white'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
              mode === 'register' ? 'bg-[#FF5A1F] text-white font-bold' : 'text-[#F2EBDD]/60 hover:text-white'
            }`}
          >
            حساب جديد
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-xs text-red-300 font-mono leading-relaxed">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {mode === 'reset' ? (
            <div>
              <label className="block text-[#F2EBDD]/60 mb-1 font-mono">البريد الإلكتروني المسجل *</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F2EBDD]/40" />
                <input
                  type="email"
                  required
                  value={email || ''}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#141512] border border-[#2B2D26] focus:border-[#FF5A1F] rounded-lg pr-9 pl-3 py-2.5 text-[#F2EBDD] focus:outline-none"
                />
              </div>
            </div>
          ) : mode === 'login' ? (
            <div>
              <label className="block text-[#F2EBDD]/60 mb-1 font-mono">
                {isDevEnv ? 'البريد الإلكتروني (Firebase) أو اسم المستخدم المحلي' : 'البريد الإلكتروني المسجل في Firebase'}
              </label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F2EBDD]/40" />
                <input
                  type={isDevEnv ? 'text' : 'email'}
                  required
                  value={identifier || ''}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={isDevEnv ? 'example@gmail.com أو boda' : 'example@gmail.com'}
                  className="w-full bg-[#141512] border border-[#2B2D26] focus:border-[#FF5A1F] rounded-lg pr-9 pl-3 py-2.5 text-[#F2EBDD] focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[#F2EBDD]/60 mb-1 font-mono">اسم المستخدم *</label>
                <input
                  type="text"
                  required
                  value={username || ''}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: player_pro"
                  className="w-full bg-[#141512] border border-[#2B2D26] rounded-lg p-2.5 text-[#F2EBDD]"
                />
              </div>
              <div>
                <label className="block text-[#F2EBDD]/60 mb-1 font-mono">الاسم المعروض</label>
                <input
                  type="text"
                  value={displayName || ''}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: طارق المهندس"
                  className="w-full bg-[#141512] border border-[#2B2D26] rounded-lg p-2.5 text-[#F2EBDD]"
                />
              </div>
              <div>
                <label className="block text-[#F2EBDD]/60 mb-1 font-mono">البريد الإلكتروني *</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F2EBDD]/40" />
                  <input
                    type="email"
                    required
                    value={email || ''}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-[#141512] border border-[#2B2D26] rounded-lg pr-9 pl-3 py-2.5 text-[#F2EBDD]"
                  />
                </div>
              </div>
            </>
          )}

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[#F2EBDD]/60 font-mono">كلمة المرور</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] text-[#FF5A1F] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>نسيت كلمة المرور؟</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F2EBDD]/40" />
                <input
                  type="password"
                  required
                  value={password || ''}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#141512] border border-[#2B2D26] focus:border-[#FF5A1F] rounded-lg pr-9 pl-3 py-2.5 text-[#F2EBDD] focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-md shadow-[#FF5A1F]/20"
          >
            {isSubmitting
              ? 'جاري التنفيذ...'
              : mode === 'login'
              ? 'تسجيل الدخول'
              : mode === 'register'
              ? 'إنشاء الحساب في Firebase'
              : 'إرسال رابط استعادة كلمة المرور'}
          </button>
        </form>

        {(mode === 'reset' || isDevEnv) && (
          <div className="pt-2 border-t border-[#262822] text-center space-y-1.5">
            {mode === 'reset' ? (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-[11px] text-[#F2EBDD]/60 hover:text-white cursor-pointer"
              >
                العودة إلى تسجيل الدخول
              </button>
            ) : isDevEnv ? (
              <button
                type="button"
                onClick={handleFillAdmin}
                className="text-[11px] font-mono text-[#D7FF38]/80 hover:text-[#D7FF38] hover:underline flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>جسر الإدارة المحلي (التطوير فقط)</span>
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
