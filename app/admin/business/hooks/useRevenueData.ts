'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TokenManager } from '@/lib/api-client';
import { getManufacturerName } from '@/constants/manufacturers';

interface SurveyCosts {
  estimate: number;
  pre_construction: number;
  completion: number;
  total: number;
}

interface SalesOfficeCommissions {
  [salesOffice: string]: number; // 영업점명 -> 수수료 비율(%)
}

interface ManufacturerCosts {
  [equipmentType: string]: number; // 장비타입 -> 원가
}

/**
 * 매출 및 원가 데이터 관리 커스텀 훅
 * - 영업점별 수수료 정보
 * - 영업점 목록
 * - 실사비용 정보
 * - 제조사별 원가 정보
 */
export function useRevenueData() {
  // 영업점 수수료 관련 상태
  const [salesOfficeCommissions, setSalesOfficeCommissions] = useState<SalesOfficeCommissions>({});
  const [commissionsLoading, setCommissionsLoading] = useState(false);

  // 영업점 목록 상태
  const [salesOfficeList, setSalesOfficeList] = useState<string[]>([]);
  const [salesOfficeLoading, setSalesOfficeLoading] = useState(false);

  // 실사비용 상태
  const [surveyCosts, setSurveyCosts] = useState<SurveyCosts>({
    estimate: 100000,
    pre_construction: 150000,
    completion: 200000,
    total: 450000
  });
  const [surveyCostsLoading, setSurveyCostsLoading] = useState(false);

  // 제조사별 원가 상태
  const [manufacturerCosts, setManufacturerCosts] = useState<ManufacturerCosts>({});
  const [manufacturerCostsLoading, setManufacturerCostsLoading] = useState(false);

  /**
   * ⚡ 성능 최적화: 초기 데이터 병렬 로딩 (4개 API 동시 호출)
   */
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('⚡ [useRevenueData] 초기 데이터 병렬 로딩 시작...');
      const startTime = performance.now();

      // 로딩 상태 일괄 설정
      setCommissionsLoading(true);
      setSalesOfficeLoading(true);
      setSurveyCostsLoading(true);
      setManufacturerCostsLoading(true);

      try {
        // 병렬 실행: Promise.allSettled로 동시 호출
        const [
          commissionsResult,
          salesOfficeResult,
          surveyCostsResult,
          manufacturerCostsResult
        ] = await Promise.allSettled([
          // ❌ DEPRECATED: 1. 영업점별 수수료 정보 - Direct PostgreSQL로 이동
          // Revenue Calculate API가 모든 계산 처리하므로 프론트엔드에서 조회 불필요
          (async () => {
            console.log('ℹ️ 영업점 수수료는 Revenue Calculate API에서 처리됩니다');
            // 기본값 설정 (하위 호환성)
            setSalesOfficeCommissions({});
          })(),

          // 2. 영업점 목록 로드 (자동완성용)
          (async () => {
            console.log('🔄 영업점 목록 로드 시작...');
            const response = await fetch('/api/sales-office-list');
            const result = await response.json();

            if (result.success && result.data.sales_offices) {
              const officeNames = result.data.sales_offices.map((office: any) => office.name);
              setSalesOfficeList(officeNames);
              console.log('✅ 영업점 목록 로드 완료');
            }
          })(),

          // 3. 실사비용 정보 로드
          (async () => {
            console.log('🔄 실사비용 로드 시작...');
            const { data, error } = await supabase
              .from('survey_cost_settings')
              .select('survey_type, base_cost, is_active')
              .eq('is_active', true)
              .order('effective_from', { ascending: false });

            if (error) throw error;
            if (data && data.length > 0) {
              const costs = {
                estimate: 100000,
                pre_construction: 150000,
                completion: 200000,
                total: 450000
              };

              data.forEach((item: any) => {
                const baseCost = Number(item.base_cost) || 0;
                if (item.survey_type === 'estimate') {
                  costs.estimate = baseCost;
                } else if (item.survey_type === 'pre_construction') {
                  costs.pre_construction = baseCost;
                } else if (item.survey_type === 'completion') {
                  costs.completion = baseCost;
                }
              });

              costs.total = costs.estimate + costs.pre_construction + costs.completion;
              setSurveyCosts(costs);
              console.log('✅ 실사비용 로드 완료');
            }
          })(),

          // 4. 제조사별 원가 정보 로드
          (async () => {
            console.log('🔄 제조사별 원가 로드 시작...');
            const token = TokenManager.getToken();
            if (!token) {
              console.warn('⚠️ 인증 토큰이 없습니다');
              return;
            }

            const manufacturerName = getManufacturerName('cleanearth');
            const response = await fetch(`/api/revenue/manufacturer-pricing?manufacturer=${encodeURIComponent(manufacturerName)}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (!response.ok) throw new Error(`API 호출 실패: ${response.status}`);

            const result = await response.json();
            if (result.success && result.data?.pricing && result.data.pricing.length > 0) {
              const costsMap: { [key: string]: number } = {};
              result.data.pricing.forEach((item: any) => {
                if (!costsMap[item.equipment_type]) {
                  costsMap[item.equipment_type] = Number(item.cost_price) || 0;
                }
              });
              setManufacturerCosts(costsMap);
              console.log('✅ 제조사별 원가 로드 완료');
            }
          })()
        ]);

        // 개별 에러 처리
        if (commissionsResult.status === 'rejected') {
          console.error('❌ 영업점 수수료 로드 실패:', commissionsResult.reason);
        }
        if (salesOfficeResult.status === 'rejected') {
          console.error('❌ 영업점 목록 로드 실패:', salesOfficeResult.reason);
        }
        if (surveyCostsResult.status === 'rejected') {
          console.error('❌ 실사비용 로드 실패:', surveyCostsResult.reason);
        }
        if (manufacturerCostsResult.status === 'rejected') {
          console.error('❌ 제조사별 원가 로드 실패:', manufacturerCostsResult.reason);
        }

        const endTime = performance.now();
        console.log(`⚡ [useRevenueData] 초기 데이터 병렬 로딩 완료 (${Math.round(endTime - startTime)}ms)`);
      } catch (error) {
        console.error('❌ [useRevenueData] 초기 데이터 로딩 오류:', error);
      } finally {
        // 로딩 상태 일괄 해제
        setCommissionsLoading(false);
        setSalesOfficeLoading(false);
        setSurveyCostsLoading(false);
        setManufacturerCostsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  return {
    // 영업점 수수료
    salesOfficeCommissions,
    commissionsLoading,
    // 영업점 목록
    salesOfficeList,
    salesOfficeLoading,
    // 실사비용
    surveyCosts,
    surveyCostsLoading,
    // 제조사별 원가
    manufacturerCosts,
    manufacturerCostsLoading
  };
}
