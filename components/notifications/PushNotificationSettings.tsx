'use client';

import { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  Settings,
  Check,
  X,
  AlertCircle,
  Smartphone,
  Monitor,
  Volume2
} from 'lucide-react';
import { usePushNotifications } from '@/lib/push-notifications';

export default function PushNotificationSettings() {
  const {
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    unsubscribe,
    showTestNotification,
    isSupported
  } = usePushNotifications();

  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  useEffect(() => {
    loadSubscriptionInfo();
  }, [isSubscribed]);

  const loadSubscriptionInfo = async () => {
    if (!isSubscribed) return;

    setLoadingInfo(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/push-subscription', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success && result.data.subscriptionInfo) {
        setSubscriptionInfo(result.data.subscriptionInfo);
      }
    } catch (error) {
      console.error('구독 정보 로드 실패:', error);
    } finally {
      setLoadingInfo(false);
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return {
          icon: Check,
          text: '허용됨',
          color: 'text-green-600 bg-green-100',
          description: '브라우저 알림이 허용되었습니다.'
        };
      case 'denied':
        return {
          icon: X,
          text: '차단됨',
          color: 'text-red-600 bg-red-100',
          description: '브라우저 설정에서 알림을 허용해주세요.'
        };
      case 'default':
        return {
          icon: AlertCircle,
          text: '대기중',
          color: 'text-yellow-600 bg-yellow-100',
          description: '알림 권한을 요청하지 않았습니다.'
        };
      default:
        return {
          icon: AlertCircle,
          text: '알 수 없음',
          color: 'text-gray-600 bg-gray-100',
          description: '알림 상태를 확인할 수 없습니다.'
        };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="w-6 h-6 text-yellow-600" />
          <h3 className="text-lg font-medium text-yellow-800">
            알림 기능을 사용할 수 없습니다
          </h3>
        </div>
        <p className="text-yellow-700">
          이 브라우저는 푸시 알림을 지원하지 않습니다. Chrome, Firefox, Safari 등의 최신 브라우저를 사용해주세요.
        </p>
      </div>
    );
  }

  const statusInfo = getPermissionStatus();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">푸시 알림 설정</h2>
      </div>

      {/* 현재 상태 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">현재 상태</h3>

        <div className="space-y-4">
          {/* 브라우저 권한 상태 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-gray-500" />
              <div>
                <p className="font-medium text-gray-900">브라우저 권한</p>
                <p className="text-sm text-gray-600">{statusInfo.description}</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
              <StatusIcon className="w-4 h-4" />
              {statusInfo.text}
            </span>
          </div>

          {/* 구독 상태 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-gray-500" />
              <div>
                <p className="font-medium text-gray-900">서버 구독</p>
                <p className="text-sm text-gray-600">
                  {isSubscribed
                    ? '푸시 알림을 받을 수 있습니다.'
                    : '서버에 구독되지 않았습니다.'
                  }
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              isSubscribed
                ? 'text-green-600 bg-green-100'
                : 'text-gray-600 bg-gray-100'
            }`}>
              {isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              {isSubscribed ? '구독됨' : '구독 안됨'}
            </span>
          </div>
        </div>

        {/* 구독 정보 */}
        {isSubscribed && subscriptionInfo && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">구독 정보</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">등록일:</span>
                <span className="ml-2 text-gray-900">
                  {formatDate(subscriptionInfo.created_at)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">마지막 업데이트:</span>
                <span className="ml-2 text-gray-900">
                  {formatDate(subscriptionInfo.updated_at)}
                </span>
              </div>
              <div className="md:col-span-2">
                <span className="text-gray-600">엔드포인트:</span>
                <span className="ml-2 text-gray-900 font-mono text-xs break-all">
                  {subscriptionInfo.endpoint}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 액션 버튼들 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">액션</h3>

        <div className="space-y-3">
          {/* 권한 요청 */}
          {permission === 'default' && (
            <button
              onClick={requestPermission}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Bell className="w-5 h-5" />
              {isLoading ? '요청 중...' : '알림 권한 요청'}
            </button>
          )}

          {/* 구독 해제 */}
          {isSubscribed && (
            <button
              onClick={unsubscribe}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <BellOff className="w-5 h-5" />
              {isLoading ? '해제 중...' : '알림 구독 해제'}
            </button>
          )}

          {/* 테스트 알림 */}
          {permission === 'granted' && (
            <button
              onClick={showTestNotification}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Volume2 className="w-5 h-5" />
              테스트 알림 보내기
            </button>
          )}

          {/* 재구독 */}
          {permission === 'granted' && !isSubscribed && (
            <button
              onClick={requestPermission}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Bell className="w-5 h-5" />
              {isLoading ? '구독 중...' : '알림 구독하기'}
            </button>
          )}
        </div>
      </div>

      {/* 브라우저 차단 안내 */}
      {permission === 'denied' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <X className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-medium text-red-800">
              알림이 차단되었습니다
            </h3>
          </div>
          <div className="text-red-700 space-y-2">
            <p>브라우저 설정에서 알림을 허용해주세요:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>브라우저 주소창 옆의 자물쇠 아이콘을 클릭하세요</li>
              <li>알림 설정을 "허용"으로 변경하세요</li>
              <li>페이지를 새로고침하세요</li>
            </ol>
          </div>
        </div>
      )}

      {/* 알림 유형 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-800 mb-3">
          받을 수 있는 알림
        </h3>
        <ul className="space-y-2 text-blue-700">
          <li className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            새로운 업무가 배정될 때
          </li>
          <li className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            업무에 댓글이 달릴 때
          </li>
          <li className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            누군가 나를 멘션할 때
          </li>
          <li className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            업무가 완료될 때
          </li>
          <li className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            중요한 시스템 알림
          </li>
        </ul>
      </div>
    </div>
  );
}