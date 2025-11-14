'use client';

import { useState, useCallback, useEffect } from 'react';

// ⚠️ UnifiedBusinessInfo는 page.tsx에 정의되어 있어 재정의 필요
// 향후 types/index.ts로 이동 권장
type UnifiedBusinessInfo = any; // 임시 타입 정의

/**
 * 사업장 데이터 관리 커스텀 훅
 * - 사업장 목록 로딩 및 상태 관리
 * - 파일 통계 포함
 * - 재로딩 기능 제공
 */
export function useBusinessData() {
  const [allBusinesses, setAllBusinesses] = useState<UnifiedBusinessInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 사업장 데이터 로딩 함수
   * - Supabase business_info 테이블에서 직접 조회
   * - 파일 통계 포함
   */
  const loadAllBusinesses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 [useBusinessData] 최적화된 사업장 정보 로딩 시작...');

      // 직접 business_info 테이블에서 사업장 정보 조회 (파일 통계 포함)
      const response = await fetch('/api/business-info-direct?includeFileStats=true');
      if (!response.ok) {
        throw new Error('사업장 데이터를 불러오는데 실패했습니다.');
      }
      const data = await response.json();

      if (process.env.NODE_ENV === 'development') {
        console.log('📊 [useBusinessData] API 응답 데이터:', {
          success: data.success,
          dataLength: data.data?.length,
          count: data.count,
          hasData: !!data.data
        });
      }

      if (data.success && data.data && Array.isArray(data.data)) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ [useBusinessData] ${data.data.length}개 사업장 정보 로딩 완료 (API count: ${data.count})`);
        }

        // 직접 API 응답 데이터를 한국어 필드명으로 매핑
        const businessObjects = data.data.map((business: any) => ({
          id: business.id,
          사업장명: business.business_name,
          주소: business.address || '',
          담당자명: business.manager_name || '',
          담당자연락처: business.manager_contact || '',
          담당자직급: business.manager_position || '',
          contacts: business.additional_info?.contacts || [],
          대표자: business.representative_name || '',
          사업자등록번호: business.business_registration_number || '',
          업종: business.business_type || '',
          사업장연락처: business.business_contact || '',
          상태: business.is_active ? '활성' : '비활성',
          등록일: business.created_at,
          수정일: business.updated_at,
          // 추가 database 필드들
          fax_number: business.fax_number || '',
          email: business.email || '',
          local_government: business.local_government || '',
          representative_birth_date: business.representative_birth_date || '',
          // 센서 및 장비 정보
          ph_meter: business.ph_meter || 0,
          differential_pressure_meter: business.differential_pressure_meter || 0,
          temperature_meter: business.temperature_meter || 0,
          discharge_current_meter: business.discharge_current_meter || 0,
          fan_current_meter: business.fan_current_meter || 0,
          pump_current_meter: business.pump_current_meter || 0,
          gateway: business.gateway || 0,
          vpn_wired: business.vpn_wired || 0,
          vpn_wireless: business.vpn_wireless || 0,
          multiple_stack: business.multiple_stack || 0,
          manufacturer: business.manufacturer === 'ecosense' ? '에코센스' :
                        business.manufacturer === 'cleanearth' ? '크린어스' :
                        business.manufacturer === 'gaia_cns' ? '가이아씨앤에스' :
                        business.manufacturer === 'evs' ? '이브이에스' :
                        business.manufacturer || '',
          negotiation: business.negotiation || '',
          // 한국어 센서/장비 필드명 매핑
          PH센서: business.ph_meter || 0,
          차압계: business.differential_pressure_meter || 0,
          온도계: business.temperature_meter || 0,
          배출전류계: business.discharge_current_meter || 0,
          송풍전류계: business.fan_current_meter || 0,
          펌프전류계: business.pump_current_meter || 0,
          게이트웨이: business.gateway || 0,
          VPN유선: business.vpn_wired === true ? 1 : (business.vpn_wired === false ? 0 : (business.vpn_wired || 0)),
          VPN무선: business.vpn_wireless === true ? 1 : (business.vpn_wireless === false ? 0 : (business.vpn_wireless || 0)),
          복수굴뚝: business.multiple_stack === true ? 1 : (business.multiple_stack === false ? 0 : (business.multiple_stack || 0)),

          // 추가 측정기기 한국어 필드명 매핑
          방폭차압계국산: business.explosion_proof_differential_pressure_meter_domestic || 0,
          방폭온도계국산: business.explosion_proof_temperature_meter_domestic || 0,
          확장디바이스: business.expansion_device || 0,
          중계기8채널: business.relay_8ch || 0,
          중계기16채널: business.relay_16ch || 0,
          메인보드교체: business.main_board_replacement || 0,

          // 추가 한국어 필드
          지자체: business.local_government || '',
          팩스번호: business.fax_number || '',
          이메일: business.email || '',
          // 시스템 정보 필드
          사업장관리코드: business.business_management_code || null,
          그린링크ID: business.greenlink_id || '',
          그린링크PW: business.greenlink_pw || '',
          영업점: business.sales_office || '',
          // 프로젝트 관리 필드
          progress_status: business.progress_status || null,
          진행상태: business.progress_status || null,
          project_year: business.project_year || null,
          사업진행연도: business.project_year || null,
          revenue_source: business.revenue_source || null,
          매출처: business.revenue_source || null,
          installation_team: business.installation_team || null,
          설치팀: business.installation_team || null,
          order_manager: business.order_manager || null,
          // 현재 단계 필드
          현재단계: '준비 중',
          // 호환성을 위한 영어 필드명
          business_name: business.business_name,
          address: business.address || '',
          representative_name: business.representative_name || '',
          business_registration_number: business.business_registration_number || '',
          manager_name: business.manager_name || '',
          manager_position: business.manager_position || '',
          manager_contact: business.manager_contact || '',
          business_contact: business.business_contact || '',
          created_at: business.created_at,
          updated_at: business.updated_at,
          is_active: business.is_active,
          is_deleted: false,
          // 파일 관련 필드 (businesses 테이블 연동)
          hasFiles: business.hasFileRecords || false,
          fileCount: business.fileStats?.totalFiles || 0,
          files: business.fileStats ? {
            id: business.id,
            name: business.fileStats.businessName,
            status: business.fileStats.totalFiles > 0 ? 'active' : 'inactive',
            fileStats: {
              total: business.fileStats.totalFiles,
              uploaded: business.fileStats.totalFiles,
              syncing: 0,
              synced: business.fileStats.totalFiles,
              failed: 0
            },
            url: business.fileStats.storageUrl,
            createdAt: business.fileStats.lastUploadDate || business.created_at,
            updatedAt: business.fileStats.lastUploadDate || business.updated_at
          } : null,

          // 실사 관리 필드
          estimate_survey_manager: business.estimate_survey_manager || null,
          estimate_survey_date: business.estimate_survey_date || null,
          pre_construction_survey_manager: business.pre_construction_survey_manager || null,
          pre_construction_survey_date: business.pre_construction_survey_date || null,
          completion_survey_manager: business.completion_survey_manager || null,
          completion_survey_date: business.completion_survey_date || null,

          // 계산서 및 입금 관리 필드 (보조금 사업장)
          invoice_1st_date: business.invoice_1st_date || null,
          invoice_1st_amount: business.invoice_1st_amount || null,
          payment_1st_date: business.payment_1st_date || null,
          payment_1st_amount: business.payment_1st_amount || null,
          invoice_2nd_date: business.invoice_2nd_date || null,
          invoice_2nd_amount: business.invoice_2nd_amount || null,
          payment_2nd_date: business.payment_2nd_date || null,
          payment_2nd_amount: business.payment_2nd_amount || null,
          invoice_additional_date: business.invoice_additional_date || null,
          payment_additional_date: business.payment_additional_date || null,
          payment_additional_amount: business.payment_additional_amount || null,

          // 계산서 및 입금 관리 필드 (자비 사업장)
          invoice_advance_date: business.invoice_advance_date || null,
          invoice_advance_amount: business.invoice_advance_amount || null,
          payment_advance_date: business.payment_advance_date || null,
          payment_advance_amount: business.payment_advance_amount || null,
          invoice_balance_date: business.invoice_balance_date || null,
          invoice_balance_amount: business.invoice_balance_amount || null,
          payment_balance_date: business.payment_balance_date || null,
          payment_balance_amount: business.payment_balance_amount || null,

          // 추가공사비
          additional_cost: business.additional_cost || null
        }));

        setAllBusinesses(businessObjects);

        console.log(`📊 [useBusinessData] 사업장 데이터 로딩 완료: 총 ${businessObjects.length}개`);
      } else {
        console.error('[useBusinessData] Invalid data format:', data);
        setAllBusinesses([]);
        setError('데이터 형식이 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('[useBusinessData] 사업장 데이터 로딩 오류:', error);
      setAllBusinesses([]);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 데이터 로딩
  useEffect(() => {
    loadAllBusinesses();
  }, [loadAllBusinesses]);

  return {
    allBusinesses,
    isLoading,
    error,
    refetch: loadAllBusinesses
  };
}
