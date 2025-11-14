'use client';

import { useState, useCallback } from 'react';

interface FacilityStatistics {
  dischargeCount: number;
  preventionCount: number;
  outletCount: number;
}

type FacilityStatsMap = { [businessId: string]: FacilityStatistics };

/**
 * 시설 통계 관리 커스텀 훅
 * - 시설 통계 계산 및 조회
 * - 배출시설, 방지시설, 배출구 개수 추적
 */
export function useFacilityStats() {
  const [facilityStats, setFacilityStats] = useState<FacilityStatsMap>({});
  const [facilityLoading, setFacilityLoading] = useState(false);

  /**
   * 시설 통계 계산 함수
   * @param airPermitData - 대기 오염 허가 데이터 배열
   * @returns 사업장 ID별 시설 통계
   */
  const calculateFacilityStats = useCallback((airPermitData: any[]): FacilityStatsMap => {
    const stats: FacilityStatsMap = {};

    airPermitData.forEach((permit: any) => {
      if (!permit.business_id || !permit.outlets) return;

      const businessId = permit.business_id;
      if (!stats[businessId]) {
        stats[businessId] = { dischargeCount: 0, preventionCount: 0, outletCount: 0 };
      }

      permit.outlets.forEach((outlet: any) => {
        stats[businessId].outletCount += 1;
        stats[businessId].dischargeCount += (outlet.discharge_facilities?.length || 0);
        stats[businessId].preventionCount += (outlet.prevention_facilities?.length || 0);
      });
    });

    return stats;
  }, []);

  /**
   * 특정 사업장의 시설 통계 조회
   * @param businessId - 사업장 ID
   */
  const loadBusinessFacilityStats = useCallback(async (businessId: string) => {
    try {
      const response = await fetch(`/api/air-permit?businessId=${businessId}&details=true`);
      if (response.ok) {
        const result = await response.json();
        const permits = result.data || [];
        const stats = calculateFacilityStats(permits);

        setFacilityStats(prev => ({
          ...prev,
          ...stats
        }));
      }
    } catch (error) {
      console.error('[useFacilityStats] 시설 통계 로드 실패:', error);
    }
  }, [calculateFacilityStats]);

  /**
   * 사업장별 시설 정보 조회
   * @param businessName - 사업장명
   */
  const loadBusinessFacilities = useCallback(async (businessName: string) => {
    setFacilityLoading(true);
    try {
      const encodedBusinessName = encodeURIComponent(businessName);
      const response = await fetch(`/api/facilities-supabase/${encodedBusinessName}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          console.log(`📊 [useFacilityStats] ${businessName} 시설 정보 로딩 완료`);
          return result.data;
        }
      }
    } catch (error) {
      console.error('[useFacilityStats] 시설 정보 로드 오류:', error);
    } finally {
      setFacilityLoading(false);
    }
    return null;
  }, []);

  return {
    facilityStats,
    facilityLoading,
    calculateFacilityStats,
    loadBusinessFacilityStats,
    loadBusinessFacilities,
    setFacilityStats
  };
}
