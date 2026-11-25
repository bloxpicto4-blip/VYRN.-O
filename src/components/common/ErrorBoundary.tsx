import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = 'حدث خطأ غير متوقع أثناء تشغيل التطبيق.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.operationType && parsed.error) {
        displayMessage = `تعذر إتمام العملية (${parsed.operationType}): يرجى التحقق من الصلاحيات أو الاتصال بقاعدة البيانات.`;
      }
    } catch {
      if (error?.message) {
        displayMessage = error.message;
      }
    }
    return { hasError: true, message: displayMessage };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#191A17] text-[#F2EBDD] flex items-center justify-center p-6 text-right"
        >
          <div className="max-w-md w-full bg-[#1F211C] border border-[#2D3028] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-[#FF5A1F]/15 text-[#FF5A1F] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold font-mono text-[#F2EBDD]">
              حدث خلل مؤقت في واجهة التطبيق
            </h2>
            <p className="text-xs text-[#F2EBDD]/70 leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
