'use client';

import { memo } from 'react';
import { Building2, User, Calendar, Camera } from 'lucide-react';

export interface BusinessInfo {
  id: string;
  business_name: string;
  address?: string;

  // 실사자 정보
  presurvey_inspector_name?: string;
  presurvey_inspector_contact?: string;
  presurvey_inspector_date?: string;

  postinstall_installer_name?: string;
  postinstall_installer_contact?: string;
  postinstall_installer_date?: string;

  aftersales_technician_name?: string;
  aftersales_technician_contact?: string;
  aftersales_technician_date?: string;

  // 사진 통계
  photo_count?: number;
  has_photos?: boolean;

  // Phase 진행 상태
  phases?: {
    presurvey: boolean;
    postinstall: boolean;
    aftersales: boolean;
  };
}

interface BusinessCardProps {
  business: BusinessInfo;
  onClick: (businessName: string) => void;
}

export default memo(function BusinessCard({ business, onClick }: BusinessCardProps) {
  // 실사자 정보 우선순위: 설치 전 실사자 > 설치자 > AS 담당자
  const primaryInspector = business.presurvey_inspector_name || business.postinstall_installer_name || business.aftersales_technician_name;
  const primaryDate = business.presurvey_inspector_date || business.postinstall_installer_date || business.aftersales_technician_date;

  // 날짜 포맷팅
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <button
      onClick={() => onClick(business.business_name)}
      className="w-full px-6 py-3 text-left transition-all group grid grid-cols-[auto_1fr_auto] gap-4 items-center hover:bg-blue-50 cursor-pointer hover:shadow-sm"
    >
      {/* 1열: 아이콘 */}
      <div className="p-2.5 rounded-lg bg-gray-100 group-hover:bg-blue-100 transition-colors">
        <Building2 className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
      </div>

      {/* 2열: 메인 정보 영역 (서브 그리드) */}
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 min-w-0 items-center">
        {/* 2-1: 사업장명 + 주소 + Phase 배지 */}
        <div className="min-w-0 flex flex-col justify-center">
          {/* 사업장명 + 주소 */}
          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 truncate">
              {business.business_name}
            </h3>
            {business.address && (
              <span className="text-xs text-gray-500 truncate flex-shrink">
                {business.address}
              </span>
            )}
          </div>

          {/* Phase 진행 상태 배지 */}
          {business.phases && (
            <div className="flex flex-wrap gap-1">
              {business.phases.presurvey && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium whitespace-nowrap">
                  🔍 설치 전 실사
                </span>
              )}
              {business.phases.postinstall && (
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium whitespace-nowrap">
                  📸 설치 후 사진
                </span>
              )}
              {business.phases.aftersales && (
                <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium whitespace-nowrap">
                  🔧 AS 사진
                </span>
              )}
            </div>
          )}
        </div>

        {/* 2-2: 실사자 */}
        <div className="flex items-center gap-1.5 min-w-0">
          {primaryInspector ? (
            <>
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 truncate">{primaryInspector}</span>
            </>
          ) : (
            <span className="text-sm text-gray-400">실사자 미배정</span>
          )}
        </div>

        {/* 2-3: 날짜 + 사진 */}
        <div className="flex flex-col gap-1.5">
          {/* 실사일자 */}
          <div className="flex items-center gap-1.5">
            {primaryDate ? (
              <>
                <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600">{formatDate(primaryDate)}</span>
              </>
            ) : (
              <span className="text-xs text-gray-400">날짜 미정</span>
            )}
          </div>

          {/* 사진 통계 */}
          <div className="flex items-center gap-1.5">
            {business.has_photos && business.photo_count ? (
              <>
                <Camera className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <span className="text-sm text-green-700 font-medium">사진 {business.photo_count}장</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500">사진 없음</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3열: 화살표 */}
      <div className="text-gray-400 group-hover:text-blue-600 transition-colors">
        →
      </div>
    </button>
  );
});
