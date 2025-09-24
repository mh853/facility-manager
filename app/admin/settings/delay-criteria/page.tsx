'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/ui/AdminLayout';
import {
  Settings,
  Save,
  RotateCcw,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

// 지연/위험 기준 타입 정의
interface DelayCriteria {
  self: {
    delayed: number;
    risky: number;
  };
  subsidy: {
    delayed: number;
    risky: number;
  };
  as: {
    delayed: number;
    risky: number;
  };
  etc: {
    delayed: number;
    risky: number;
  };
}

// 기본값
const DEFAULT_CRITERIA: DelayCriteria = {
  self: { delayed: 7, risky: 14 },
  subsidy: { delayed: 14, risky: 20 },
  as: { delayed: 3, risky: 7 },
  etc: { delayed: 7, risky: 10 }
};

export default function DelayCriteriaSettingsPage() {
  const router = useRouter();

  // 컴포넌트 마운트 시 새로운 통합 페이지로 리다이렉트
  useEffect(() => {
    router.push('/admin/settings');
  }, [router]);

  // 리다이렉트 중 로딩 화면 표시
  return (
    <AdminLayout
      title="페이지 이동 중..."
      description="새로운 관리자 설정 페이지로 이동하고 있습니다."
    >
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">관리자 설정 페이지로 이동 중...</p>
          <p className="text-sm text-gray-500 mt-2">지연/위험 업무 기준 설정이 통합된 새로운 페이지로 안내됩니다.</p>
        </div>
      </div>
    </AdminLayout>
  );
}