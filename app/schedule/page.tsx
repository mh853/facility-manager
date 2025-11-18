'use client';

import AdminLayout from '@/components/ui/AdminLayout';
import CalendarBoard from '@/components/boards/CalendarBoard';

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
        <CalendarBoard />
      </div>
    </AdminLayout>
  );
}
