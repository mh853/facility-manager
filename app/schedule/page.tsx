'use client';

import { lazy, Suspense } from 'react';
import AdminLayout from '@/components/ui/AdminLayout';

// Lazy load CalendarBoard for better initial load performance (34KB component)
const CalendarBoard = lazy(() => import('@/components/boards/CalendarBoard'));

/**
 * 일정 관리 페이지
 * - 전체 화면 캘린더 뷰
 * - 단계별로 파일 첨부 및 기간 설정 기능 추가 예정
 */
export default function SchedulePage() {
  return (
    <AdminLayout
      title="일정 관리"
      description="업무 일정 및 파일을 관리하세요"
    >
      <div className="h-full">
        <Suspense fallback={
          <div className="bg-white rounded-md md:rounded-lg shadow p-3 sm:p-4 md:p-6 animate-pulse">
            {/* 캘린더 헤더 스켈레톤 */}
            <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
              <div className="h-6 sm:h-7 md:h-8 bg-gray-200 rounded w-32 sm:w-40 md:w-48"></div>
              <div className="flex gap-1 sm:gap-1.5 md:gap-2">
                <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 bg-gray-200 rounded"></div>
                <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 bg-gray-200 rounded"></div>
                <div className="h-8 w-24 sm:w-28 md:w-32 bg-gray-200 rounded"></div>
              </div>
            </div>

            {/* 캘린더 그리드 스켈레톤 */}
            <div className="grid grid-cols-7 gap-0.5 md:gap-1">
              {/* 요일 헤더 */}
              {[...Array(7)].map((_, i) => (
                <div key={`header-${i}`} className="h-6 sm:h-7 md:h-8 bg-gray-100 rounded"></div>
              ))}
              {/* 날짜 셀 */}
              {[...Array(35)].map((_, i) => (
                <div key={`cell-${i}`} className="h-16 sm:h-18 md:h-20 bg-gray-50 rounded border border-gray-200"></div>
              ))}
            </div>
          </div>
        }>
          <CalendarBoard />
        </Suspense>
      </div>
    </AdminLayout>
  );
}
