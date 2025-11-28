'use client';

import { lazy, Suspense } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/ui/AdminLayout';
import { FileText, ArrowRight } from 'lucide-react';

// Lazy load board components for better initial load performance
const AnnouncementBoard = lazy(() => import('@/components/boards/AnnouncementBoard'));
const MessageBoard = lazy(() => import('@/components/boards/MessageBoard'));

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
 * - 인증 필요: 로그인한 사용자만 접근 가능
 * - AdminLayout 기반 레이아웃
 * - 공지사항, 전달사항 대시보드
 * - 성능 최적화: Lazy loading으로 초기 번들 크기 감소
 * - 캘린더는 Schedule 페이지에서 확인 가능
 */
export default function HomePage() {
  return (
    <AdminLayout
      title="시설관리 시스템"
      description="주요 공지사항 및 전달사항을 확인하세요"
    >
      <div className="space-y-4 md:space-y-6">
        {/* 공지사항 및 전달사항 (2열) - Lazy loaded */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Suspense fallback={<BoardSkeleton />}>
            <AnnouncementBoard />
          </Suspense>
          <Suspense fallback={<BoardSkeleton />}>
            <MessageBoard />
          </Suspense>
        </div>

        {/* 보조금 공고 바로가기 */}
        <Link
          href="/admin/subsidy"
          className="block bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 p-6 group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">지자체 보조금 공고 모니터링</h3>
                <p className="text-green-50 text-sm">IoT 관련 지원사업 공고를 확인하세요</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </AdminLayout>
  );
}
