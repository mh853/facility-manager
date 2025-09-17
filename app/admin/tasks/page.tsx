'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import TaskManagement from '@/components/tasks/TaskManagement';

export default function TasksPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-full">
          <div className="text-lg text-gray-600">업무 관리 시스템 로딩 중...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">업무 관리</h1>
          <p className="mt-2 text-sm text-gray-700">
            시설 점검 및 관리 업무를 체계적으로 추적하고 관리하세요
          </p>
        </div>

        {/* 업무 관리 대시보드 */}
        <TaskManagement />
      </div>
    </AppLayout>
  );
}