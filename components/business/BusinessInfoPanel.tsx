'use client';

import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, User, Calendar, AlertCircle } from 'lucide-react';

/**
 * 사업장 정보 인터페이스
 * 향후 필드 추가 시 여기에 타입을 추가하면 됩니다.
 */
interface BusinessInfo {
  id: string;
  business_name: string;
  address?: string;
  local_government?: string;
  representative_name?: string;
  business_contact?: string;
  manager_name?: string;
  manager_contact?: string;
  email?: string;
  business_registration_number?: string;
  created_at?: string;
  updated_at?: string;
  // 향후 추가 필드를 여기에 정의
  // installation_count?: number;
  // last_inspection_date?: string;
  // etc.
}

interface BusinessInfoPanelProps {
  businessId: string;
  businessName: string;
  onClose?: () => void;
}

/**
 * 사업장 정보 패널 컴포넌트
 * - 캘린더 모달 우측에 표시되는 사업장 상세 정보
 * - 읽기 전용 디스플레이
 * - 모듈화된 섹션 구조로 향후 필드 추가 용이
 */
export default function BusinessInfoPanel({
  businessId,
  businessName,
  onClose
}: BusinessInfoPanelProps) {
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBusinessInfo();
  }, [businessId]);

  const loadBusinessInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/business/${businessId}`);
      if (!response.ok) {
        throw new Error('사업장 정보 조회 실패');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setBusinessInfo(data.data);
        console.log(`✅ [BUSINESS-INFO-PANEL] 사업장 정보 로드 완료: ${businessName}`);
      } else {
        throw new Error(data.error || '사업장 정보를 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('❌ [BUSINESS-INFO-PANEL] 사업장 정보 로드 실패:', err);
      setError(err instanceof Error ? err.message : '사업장 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 로딩 상태
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">사업장 정보 로드 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={loadBusinessInfo}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 정보 없음
  if (!businessInfo) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">사업장 정보가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <Building2 className="h-5 w-5 mr-2" />
              <h3 className="text-lg font-bold">사업장 정보</h3>
            </div>
            <p className="text-sm text-blue-100 mt-1">
              일정과 연결된 사업장의 상세 정보입니다.
            </p>
          </div>
        </div>
      </div>

      {/* 콘텐츠 영역 - 스크롤 가능 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* 기본 정보 섹션 */}
        <InfoSection title="기본 정보">
          <InfoRow
            icon={<Building2 className="h-4 w-4 text-blue-500" />}
            label="사업장명"
            value={businessInfo.business_name}
          />
          {businessInfo.local_government && (
            <InfoRow
              icon={<Building2 className="h-4 w-4 text-cyan-500" />}
              label="지자체"
              value={businessInfo.local_government}
            />
          )}
          {businessInfo.address && (
            <InfoRow
              icon={<MapPin className="h-4 w-4 text-green-500" />}
              label="주소"
              value={businessInfo.address}
            />
          )}
          {businessInfo.business_registration_number && (
            <InfoRow
              icon={<Building2 className="h-4 w-4 text-gray-500" />}
              label="사업자등록번호"
              value={businessInfo.business_registration_number}
            />
          )}
        </InfoSection>

        {/* 담당자 정보 섹션 */}
        {(businessInfo.representative_name || businessInfo.manager_name || businessInfo.business_contact || businessInfo.manager_contact || businessInfo.email) && (
          <InfoSection title="담당자 정보">
            {businessInfo.representative_name && (
              <InfoRow
                icon={<User className="h-4 w-4 text-purple-500" />}
                label="대표자명"
                value={businessInfo.representative_name}
              />
            )}
            {businessInfo.manager_name && (
              <InfoRow
                icon={<User className="h-4 w-4 text-blue-500" />}
                label="담당자명"
                value={businessInfo.manager_name}
              />
            )}
            {businessInfo.business_contact && (
              <InfoRow
                icon={<Phone className="h-4 w-4 text-orange-500" />}
                label="사업장 연락처"
                value={businessInfo.business_contact}
              />
            )}
            {businessInfo.manager_contact && (
              <InfoRow
                icon={<Phone className="h-4 w-4 text-green-500" />}
                label="담당자 연락처"
                value={businessInfo.manager_contact}
              />
            )}
            {businessInfo.email && (
              <InfoRow
                icon={<Phone className="h-4 w-4 text-indigo-500" />}
                label="이메일"
                value={businessInfo.email}
              />
            )}
          </InfoSection>
        )}

        {/* 등록 정보 섹션 */}
        {businessInfo.created_at && (
          <InfoSection title="등록 정보">
            <InfoRow
              icon={<Calendar className="h-4 w-4 text-indigo-500" />}
              label="등록일"
              value={new Date(businessInfo.created_at).toLocaleDateString('ko-KR')}
            />
            {businessInfo.updated_at && (
              <InfoRow
                icon={<Calendar className="h-4 w-4 text-indigo-400" />}
                label="최종 수정일"
                value={new Date(businessInfo.updated_at).toLocaleDateString('ko-KR')}
              />
            )}
          </InfoSection>
        )}

        {/*
          향후 섹션 추가 예시:

          <InfoSection title="시설 정보">
            <InfoRow
              icon={<Factory className="h-4 w-4 text-red-500" />}
              label="설치 시설 수"
              value={businessInfo.installation_count?.toString() || '0'}
            />
          </InfoSection>

          <InfoSection title="점검 이력">
            <InfoRow
              icon={<CheckCircle className="h-4 w-4 text-teal-500" />}
              label="최근 점검일"
              value={businessInfo.last_inspection_date
                ? new Date(businessInfo.last_inspection_date).toLocaleDateString('ko-KR')
                : '점검 이력 없음'
              }
            />
          </InfoSection>
        */}
      </div>

      {/* 푸터 */}
      <div className="border-t p-4 bg-gray-50 flex-shrink-0">
        <p className="text-xs text-gray-500 text-center">
          사업장 ID: {businessInfo.id}
        </p>
      </div>
    </div>
  );
}

/**
 * 정보 섹션 컴포넌트 (재사용 가능)
 */
interface InfoSectionProps {
  title: string;
  children: React.ReactNode;
}

function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

/**
 * 정보 행 컴포넌트 (재사용 가능)
 */
interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start">
      <div className="flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="ml-3 flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
