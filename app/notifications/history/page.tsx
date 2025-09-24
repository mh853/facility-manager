'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 히스토리 페이지는 메인 알림 페이지로 리디렉션
export default function NotificationHistoryRedirect() {
  const router = useRouter();

  useEffect(() => {
    // 메인 알림 페이지로 리디렉션
    router.replace('/notifications');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">알림 페이지로 이동 중...</p>
      </div>
    </div>
  );
}