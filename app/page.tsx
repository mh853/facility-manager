'use client';

import AdminLayout from '@/components/ui/AdminLayout';
import AnnouncementBoard from '@/components/boards/AnnouncementBoard';
import MessageBoard from '@/components/boards/MessageBoard';
import CalendarBoard from '@/components/boards/CalendarBoard';

/**
 * 메인 페이지 (루트 페이지 개편)
 * - AdminLayout 기반 레이아웃
 * - 공지사항, 전달사항, 캘린더 통합 대시보드
 */
export default function HomePage() {
  return (
    <AdminLayout
      title="시설관리 시스템"
      description="주요 공지사항 및 업무 일정을 확인하세요"
    >
      <div className="space-y-6">
        {/* 상단: 공지사항 및 전달사항 (2열) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnnouncementBoard />
          <MessageBoard />
        </div>

        {/* 하단: 캘린더 (전체 너비) */}
        <div className="w-full">
          <CalendarBoard />
        </div>
      </div>
    </AdminLayout>
  );
}
