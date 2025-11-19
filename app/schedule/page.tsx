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
          <div className="bg-white rounded-lg shadow p-6 animate-pulse">
            {/* 캘린더 헤더 스켈레톤 */}
            <div className="flex items-center justify-between mb-6">
              <div className="h-8 bg-gray-200 rounded w-48"></div>
              <div className="flex gap-2">
                <div className="h-10 w-10 bg-gray-200 rounded"></div>
                <div className="h-10 w-10 bg-gray-200 rounded"></div>
                <div className="h-10 w-32 bg-gray-200 rounded"></div>
              </div>
            </div>

            {/* 캘린더 그리드 스켈레톤 */}
            <div className="grid grid-cols-7 gap-1">
              {/* 요일 헤더 */}
              {[...Array(7)].map((_, i) => (
                <div key={`header-${i}`} className="h-8 bg-gray-100 rounded"></div>
              ))}
              {/* 날짜 셀 */}
              {[...Array(35)].map((_, i) => (
                <div key={`cell-${i}`} className="h-20 bg-gray-50 rounded border border-gray-200"></div>
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
