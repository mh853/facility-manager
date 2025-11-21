'use client';

import { useEffect, useState } from 'react';
import { X, Bell, AlertTriangle, Info, CheckCircle } from 'lucide-react';

export interface InAppToastNotification {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  onClick?: () => void;
}

interface InAppNotificationToastProps {
  notification: InAppToastNotification;
  onClose: (id: string) => void;
  duration?: number;
}

export function InAppNotificationToast({
  notification,
  onClose,
  duration = 5000
}: InAppNotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // 애니메이션을 위해 약간의 지연 후 표시
    const showTimer = setTimeout(() => setIsVisible(true), 10);

    // 우선순위에 따라 자동 닫힘 시간 조정
    const autoCloseDelay = notification.priority === 'critical' || notification.priority === 'high'
      ? duration * 2  // 중요한 알림은 2배 더 오래 표시
      : duration;

    // 자동 닫힘 타이머
    const closeTimer = setTimeout(() => {
      handleClose();
    }, autoCloseDelay);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(closeTimer);
    };
  }, [notification.id, notification.priority, duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(notification.id);
    }, 300); // 애니메이션 시간과 일치
  };

  const handleClick = () => {
    if (notification.onClick) {
      notification.onClick();
      handleClose();
    }
  };

  const getPriorityStyles = () => {
    switch (notification.priority) {
      case 'critical':
        return {
          bg: 'bg-red-50 border-red-500',
          icon: AlertTriangle,
          iconColor: 'text-red-600',
          text: 'text-red-900'
        };
      case 'high':
        return {
          bg: 'bg-orange-50 border-orange-500',
          icon: AlertTriangle,
          iconColor: 'text-orange-600',
          text: 'text-orange-900'
        };
      case 'low':
        return {
          bg: 'bg-blue-50 border-blue-400',
          icon: Info,
          iconColor: 'text-blue-600',
          text: 'text-blue-900'
        };
      default: // normal
        return {
          bg: 'bg-white border-gray-300',
          icon: Bell,
          iconColor: 'text-gray-600',
          text: 'text-gray-900'
        };
    }
  };

  const styles = getPriorityStyles();
  const IconComponent = styles.icon;

  return (
    <div
      className={`
        ${styles.bg}
        border-l-4
        rounded-lg
        shadow-lg
        p-4
        mb-3
        transition-all
        duration-300
        ease-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${notification.onClick ? 'cursor-pointer hover:shadow-xl' : ''}
      `}
      onClick={handleClick}
      role={notification.onClick ? 'button' : 'alert'}
      style={{ minWidth: '320px', maxWidth: '420px' }}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${styles.iconColor}`}>
          <IconComponent className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${styles.text} mb-1`}>
            {notification.title}
          </h4>
          <p className={`text-sm ${styles.text} opacity-90`}>
            {notification.message}
          </p>
          {notification.onClick && (
            <p className="text-xs text-gray-500 mt-2">
              클릭하여 자세히 보기
            </p>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className={`flex-shrink-0 ${styles.iconColor} hover:opacity-70 transition-opacity`}
          aria-label="알림 닫기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

interface InAppNotificationContainerProps {
  notifications: InAppToastNotification[];
  onClose: (id: string) => void;
}

export function InAppNotificationContainer({
  notifications,
  onClose
}: InAppNotificationContainerProps) {
  return (
    <div
      className="fixed top-4 right-4 z-[9999] pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex flex-col items-end pointer-events-auto">
        {notifications.map((notification) => (
          <InAppNotificationToast
            key={notification.id}
            notification={notification}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
}
