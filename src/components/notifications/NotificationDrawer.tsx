import React from 'react';
import { X, CheckCheck, Bell, ExternalLink } from 'lucide-react';
import { NotificationItem } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigateToItem: (link: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onNavigateToItem,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      dir="rtl"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-start animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm h-full bg-[#1A1C17] border-l border-[#2E3129] flex flex-col shadow-2xl text-right"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#2B2E26] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#FF5A1F]" />
            <h3 className="font-bold text-sm text-[#F2EBDD] font-mono">التنبيهات والإشعارات</h3>
          </div>

          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.isRead) && (
              <button
                onClick={onMarkAllRead}
                className="text-[11px] text-[#D7FF38] hover:underline flex items-center gap-1 cursor-pointer font-mono"
                title="تحديد الكل كمقروء"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تحديد الكل</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1 text-[#F2EBDD]/60 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#F2EBDD]/50 font-mono">
              لا توجد تنبيهات أو إشعارات جديدة حالياً.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  onMarkRead(notif.id);
                  if (notif.linkUrl) {
                    onNavigateToItem(notif.linkUrl);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  notif.isRead
                    ? 'bg-[#151713] border-[#252720] opacity-75'
                    : 'bg-[#22251E] border-[#383C30] hover:border-[#FF5A1F]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#F2EBDD] font-mono">{notif.title}</span>
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#D7FF38]" />
                  )}
                </div>

                <p className="text-xs text-[#F2EBDD]/70 leading-relaxed">{notif.message}</p>

                <div className="flex items-center justify-between pt-1 text-[10px] text-[#F2EBDD]/40 font-mono">
                  <span>{new Date(notif.createdAt).toLocaleDateString('ar-EG')}</span>
                  {notif.linkUrl && (
                    <span className="text-[#FF5A1F] flex items-center gap-1">
                      <span>عرض الإصدار</span>
                      <ExternalLink className="w-2.5 h-2.5 rtl-flip" />
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
