'use client';

import { lazy, Suspense } from 'react';
import AdminLayout from '@/components/ui/AdminLayout';

// Lazy load board components for better initial load performance
const AnnouncementBoard = lazy(() => import('@/components/boards/AnnouncementBoard'));
const MessageBoard = lazy(() => import('@/components/boards/MessageBoard'));
const CalendarBoard = lazy(() => import('@/components/boards/CalendarBoard'));

/**
 * 보드 컴포넌트 로딩 스켈레톤
 */
function BoardSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${height}`}>
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * 메인 페이지 (루트 페이지 개편)
 * - AdminLayout 기반 레이아웃
 * - 공지사항, 전달사항, 캘린더 통합 대시보드
 * - 성능 최적화: Lazy loading으로 초기 번들 크기 감소
 */
export default function HomePage() {
  return (
    <AdminLayout
      title="시설관리 시스템"
      description="주요 공지사항 및 업무 일정을 확인하세요"
    >
      <div className="space-y-4 md:space-y-6">
        {/* 상단: 공지사항 및 전달사항 (2열) - Lazy loaded */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Suspense fallback={<BoardSkeleton />}>
            <AnnouncementBoard />
          </Suspense>
          <Suspense fallback={<BoardSkeleton />}>
            <MessageBoard />
          </Suspense>
        </div>

        {/* 하단: 캘린더 (전체 너비) - Lazy loaded */}
        <div className="w-full">
          <Suspense fallback={<BoardSkeleton height="h-96" />}>
            <CalendarBoard />
          </Suspense>
        </div>
      </div>
    </AdminLayout>
  );
}
