'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TokenManager } from '@/lib/api-client';
import AdminLayout from '@/components/ui/AdminLayout';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { AuthLevel } from '@/lib/auth/AuthLevels';
import StatsCard from '@/components/ui/StatsCard';
import Modal, { ModalActions } from '@/components/ui/Modal';
import { MANUFACTURER_NAMES_REVERSE, type ManufacturerName } from '@/constants/manufacturers';

// Code Splitting: 무거운 모달 및 디스플레이 컴포넌트를 동적 로딩
const InvoiceDisplay = dynamic(() => import('@/components/business/InvoiceDisplay').then(mod => ({ default: mod.InvoiceDisplay })), {
  loading: () => <div className="text-center py-4">로딩 중...</div>,
  ssr: false
});

const BusinessRevenueModal = dynamic(() => import('@/components/business/BusinessRevenueModal'), {
  loading: () => <div className="text-center py-4">로딩 중...</div>,
  ssr: false
});
import {
  BarChart3,
  Calculator,
  TrendingUp,
  DollarSign,
  Building2,
  Calendar,
  FileText,
  Search,
  Filter,
  Download,
  Loader2,
  Settings
} from 'lucide-react';

interface BusinessInfo {
  id: string;
  business_name: string;
  sales_office: string;
  address?: string;
  manager_name?: string;
  manager_contact?: string;
  [key: string]: any;
}

interface RevenueCalculation {
  id: string;
  business_id: string;
  business_name: string;
  sales_office: string;
  business_category?: string;
  calculation_date: string;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  sales_commission: number;
  adjusted_sales_commission?: number;
  survey_costs: number;
  installation_costs: number;
  installation_extra_cost?: number;
  net_profit: number;
  equipment_breakdown: any[];
  cost_breakdown: any;
}

interface DashboardStats {
  total_businesses: number;
  total_revenue: number;
  total_profit: number;
  average_margin: string;
  top_performing_office: string;
}

function RevenueDashboard() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([]);
  const [calculations, setCalculations] = useState<RevenueCalculation[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [selectedOffice, setSelectedOffice] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [revenueFilter, setRevenueFilter] = useState({
    min: '',
    max: ''
  });

  // 동적 가격 데이터
  const [officialPrices, setOfficialPrices] = useState<Record<string, number>>({});
  const [manufacturerPrices, setManufacturerPrices] = useState<Record<string, Record<string, number>>>({});
  const [pricesLoaded, setPricesLoaded] = useState(false);

  // 영업비용 및 실사비용 데이터
  const [salesOfficeSettings, setSalesOfficeSettings] = useState<Record<string, any>>({});
  const [surveyCostSettings, setSurveyCostSettings] = useState<Record<string, number>>({});
  const [baseInstallationCosts, setBaseInstallationCosts] = useState<Record<string, number>>({});
  const [costSettingsLoaded, setCostSettingsLoaded] = useState(false);

  // 제조사별 수수료율 데이터 (영업점 → 제조사 → 수수료율)
  const [commissionRates, setCommissionRates] = useState<Record<string, Record<string, number>>>({});
  const [commissionRatesLoaded, setCommissionRatesLoaded] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(''); // 카테고리(진행구분) 필터
  const [selectedProjectYear, setSelectedProjectYear] = useState(''); // 사업 진행 연도 필터
  const [selectedMonth, setSelectedMonth] = useState(''); // 월별 필터 (1-12)
  const [showReceivablesOnly, setShowReceivablesOnly] = useState(false); // 미수금 필터
  const [sortField, setSortField] = useState<string>('business_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [selectedEquipmentBusiness, setSelectedEquipmentBusiness] = useState<any>(null);

  const { user } = useAuth();
  const userPermission = user?.permission_level || 0;


  useEffect(() => {
    // 가격 데이터 먼저 로드
    loadPricingData();
  }, []);

  useEffect(() => {
    // 가격 데이터가 로드되면 사업장 데이터 로드
    if (pricesLoaded) {
      loadBusinesses();
      loadCalculations();
    }
  }, [pricesLoaded]);

  const getAuthHeaders = () => {
    const token = TokenManager.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // 동적 가격 데이터 로드 (병렬 처리로 성능 최적화)
  const loadPricingData = async () => {
    try {
      const startTime = performance.now();
      console.log('⚡ [PRICING] 가격 데이터 병렬 로드 시작');

      // ✅ 성능 개선: 6개 API를 병렬로 호출 (3초+ → 0.5초)
      const [
        govResponse,
        manuResponse,
        salesOfficeResponse,
        surveyCostResponse,
        installCostResponse,
        commissionResponse
      ] = await Promise.all([
        fetch('/api/revenue/government-pricing', { headers: getAuthHeaders() }),
        fetch('/api/revenue/manufacturer-pricing', { headers: getAuthHeaders() }),
        fetch('/api/revenue/sales-office-settings', { headers: getAuthHeaders() }),
        fetch('/api/revenue/survey-costs', { headers: getAuthHeaders() }),
        fetch('/api/revenue/installation-cost', { headers: getAuthHeaders() }),
        fetch('/api/revenue/commission-rates', { headers: getAuthHeaders() })
      ]);

      // JSON 파싱도 병렬 처리
      const [
        govData,
        manuData,
        salesOfficeData,
        surveyCostData,
        installCostData,
        commissionData
      ] = await Promise.all([
        govResponse.json(),
        manuResponse.json(),
        salesOfficeResponse.json(),
        surveyCostResponse.json(),
        installCostResponse.json(),
        commissionResponse.json()
      ]);

      // 환경부 고시가 처리
      if (govData.success) {
        const govPrices: Record<string, number> = {};
        govData.data.pricing.forEach((item: any) => {
          govPrices[item.equipment_type] = item.official_price;
        });
        setOfficialPrices(govPrices);
      }

      // 제조사별 원가 처리
      if (manuData.success) {
        const manuPrices: Record<string, Record<string, number>> = {};
        manuData.data.pricing.forEach((item: any) => {
          if (!manuPrices[item.manufacturer]) {
            manuPrices[item.manufacturer] = {};
          }
          manuPrices[item.manufacturer][item.equipment_type] = item.cost_price;
        });
        setManufacturerPrices(manuPrices);
      }

      // 영업점별 비용 설정 처리
      if (salesOfficeData.success) {
        const salesSettings: Record<string, any> = {};
        salesOfficeData.data.settings.forEach((item: any) => {
          salesSettings[item.sales_office] = item;
        });
        setSalesOfficeSettings(salesSettings);
      }

      // 실사비용 설정 처리
      if (surveyCostData.success) {
        const surveyCosts: Record<string, number> = {};
        surveyCostData.data.forEach((item: any) => {
          surveyCosts[item.survey_type] = item.base_cost;
        });
        setSurveyCostSettings(surveyCosts);
      }

      // 기본 설치비 처리
      if (installCostData.success) {
        const installCosts: Record<string, number> = {};
        installCostData.data.costs.forEach((item: any) => {
          installCosts[item.equipment_type] = item.base_installation_cost;
        });
        setBaseInstallationCosts(installCosts);
      }

      // 제조사별 수수료율 처리
      if (commissionData.success && commissionData.data.offices) {
        const rates: Record<string, Record<string, number>> = {};
        commissionData.data.offices.forEach((office: any) => {
          rates[office.sales_office] = {};
          office.rates.forEach((rate: any) => {
            rates[office.sales_office][rate.manufacturer] = rate.commission_rate;
          });
        });
        setCommissionRates(rates);
        setCommissionRatesLoaded(true);
      } else {
        console.warn('⚠️ [COMMISSION] 수수료율 로드 실패:', { success: commissionData.success, hasOffices: !!commissionData.data?.offices });
      }

      setPricesLoaded(true);
      setCostSettingsLoaded(true);

      const endTime = performance.now();
      console.log(`✅ [PRICING] 가격 데이터 병렬 로드 완료 (${(endTime - startTime).toFixed(0)}ms)`);
    } catch (error) {
      console.error('❌ [PRICING] 가격 데이터 로드 오류:', error);
      // 로드 실패 시 하드코딩된 기본값 사용
      setPricesLoaded(true);
      setCostSettingsLoaded(true);
    }
  };

  // 환경부 고시가 (매출 단가) - 기본값 (API 로드 실패 시 사용)
  const OFFICIAL_PRICES: Record<string, number> = {
    'ph_meter': 1000000,
    'differential_pressure_meter': 400000,
    'temperature_meter': 500000,
    'discharge_current_meter': 300000,
    'fan_current_meter': 300000,
    'pump_current_meter': 300000,
    'gateway': 1600000,
    'vpn_wired': 400000,
    'vpn_wireless': 400000,
    'explosion_proof_differential_pressure_meter_domestic': 800000,
    'explosion_proof_temperature_meter_domestic': 1500000,
    'expansion_device': 800000,
    'relay_8ch': 300000,
    'relay_16ch': 1600000,
    'main_board_replacement': 350000,
    'multiple_stack': 480000
  };

  // 제조사별 원가 (매입 단가) - 에코센스 기준
  const MANUFACTURER_COSTS: Record<string, number> = {
    'ph_meter': 250000,
    'differential_pressure_meter': 100000,
    'temperature_meter': 125000,
    'discharge_current_meter': 80000,
    'fan_current_meter': 80000,
    'pump_current_meter': 80000,
    'gateway': 200000,
    'vpn_wired': 100000,
    'vpn_wireless': 120000,
    'explosion_proof_differential_pressure_meter_domestic': 150000,
    'explosion_proof_temperature_meter_domestic': 180000,
    'expansion_device': 120000,
    'relay_8ch': 80000,
    'relay_16ch': 150000,
    'main_board_replacement': 100000,
    'multiple_stack': 120000
  };

  // 기기별 기본 설치비
  const INSTALLATION_COSTS: Record<string, number> = {
    'ph_meter': 0,
    'differential_pressure_meter': 0,
    'temperature_meter': 0,
    'discharge_current_meter': 0,
    'fan_current_meter': 0,
    'pump_current_meter': 0,
    'gateway': 0,
    'vpn_wired': 0,
    'vpn_wireless': 0,
    'explosion_proof_differential_pressure_meter_domestic': 0,
    'explosion_proof_temperature_meter_domestic': 0,
    'expansion_device': 0,
    'relay_8ch': 0,
    'relay_16ch': 0,
    'main_board_replacement': 0,
    'multiple_stack': 0
  };

  const EQUIPMENT_FIELDS = [
    'ph_meter', 'differential_pressure_meter', 'temperature_meter',
    'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
    'gateway', 'vpn_wired', 'vpn_wireless',
    'explosion_proof_differential_pressure_meter_domestic',
    'explosion_proof_temperature_meter_domestic', 'expansion_device',
    'relay_8ch', 'relay_16ch', 'main_board_replacement', 'multiple_stack'
  ];

  // 사업장별 매출/매입/이익 자동 계산 함수
  const calculateBusinessRevenue = (business: any) => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalBaseInstallationCost = 0; // 기본 설치비 (비용)
    let totalAdditionalInstallationRevenue = 0; // 추가 설치비 (매출)

    // 사업장의 제조사 정보 (한글 → 영문 코드 변환)
    const rawManufacturer = business.manufacturer || 'ecosense';
    const businessManufacturer = MANUFACTURER_NAMES_REVERSE[rawManufacturer as ManufacturerName] || rawManufacturer;

    // 일신산업 디버깅을 위한 상세 로그
    const equipmentDetails: any[] = [];

    // 각 기기별 매출/매입 계산
    EQUIPMENT_FIELDS.forEach(field => {
      const quantity = business[field] || 0;
      if (quantity > 0) {
        // 동적 가격 사용 (로드 실패 시 하드코딩된 기본값 사용)
        // 주의: 0원도 유효한 값이므로 !== undefined로 확인
        const unitRevenue = (pricesLoaded && officialPrices[field] !== undefined)
          ? officialPrices[field]
          : (OFFICIAL_PRICES[field] || 0);

        const unitCost = (pricesLoaded && manufacturerPrices[businessManufacturer]?.[field] !== undefined)
          ? manufacturerPrices[businessManufacturer][field]
          : (MANUFACTURER_COSTS[field] || 0);

        // 기본 설치비 (DB에서 로드, 없으면 하드코딩 값 사용)
        const unitBaseInstallation = (costSettingsLoaded && baseInstallationCosts[field] !== undefined)
          ? baseInstallationCosts[field]
          : (INSTALLATION_COSTS[field] || 0);

        totalRevenue += unitRevenue * quantity;
        totalCost += unitCost * quantity;
        totalBaseInstallationCost += unitBaseInstallation * quantity;

        // 일신산업 디버깅용
        if (business.business_name && business.business_name.includes('일신산업')) {
          equipmentDetails.push({
            기기명: field,
            수량: quantity,
            제조사: businessManufacturer,
            단가_매출: unitRevenue,
            단가_매입: unitCost,
            합계_매출: unitRevenue * quantity,
            합계_매입: unitCost * quantity,
            가격출처: pricesLoaded ? 'DB' : '하드코딩'
          });
        }
      }
    });

    // 일신산업 상세 로그 출력

    // 추가공사비 및 협의사항 반영 (문자열을 숫자로 변환)
    const additionalCost = business.additional_cost
      ? (typeof business.additional_cost === 'string'
          ? parseInt(business.additional_cost.replace(/,/g, '')) || 0
          : business.additional_cost || 0)
      : 0;
    const negotiation = business.negotiation
      ? (typeof business.negotiation === 'string'
          ? parseFloat(business.negotiation.replace(/,/g, '')) || 0
          : business.negotiation || 0)
      : 0;

    // 추가 설치비 (DB에 저장된 값, 매출에 추가)
    const additionalInstallationRevenue = business.installation_costs
      ? (typeof business.installation_costs === 'string'
          ? parseInt(business.installation_costs.replace(/,/g, '')) || 0
          : business.installation_costs || 0)
      : 0;

    // 영업비용 계산 기준: 기본 매출 - 협의사항 (추가공사비, 추가설치비 제외)
    const commissionBaseRevenue = totalRevenue - negotiation;

    // 최종 매출 = 기본 매출 + 추가공사비 + 추가설치비 - 협의사항
    const adjustedRevenue = totalRevenue + additionalCost + additionalInstallationRevenue - negotiation;

    // 영업비용 계산 (제조사별 수수료율 우선, 없으면 영업점 설정, 최종 기본값 10%)
    let salesCommission = 0;
    const salesOffice = business.sales_office || '';

    // 1순위: 제조사별 수수료율
    if (commissionRatesLoaded && salesOffice && commissionRates[salesOffice] && commissionRates[salesOffice][businessManufacturer] !== undefined) {
      const commissionRate = commissionRates[salesOffice][businessManufacturer];
      salesCommission = commissionBaseRevenue * (commissionRate / 100);
    }
    // 2순위: 영업점별 기본 설정
    else if (costSettingsLoaded && salesOffice && salesOfficeSettings[salesOffice]) {
      const setting = salesOfficeSettings[salesOffice];
      if (setting.commission_type === 'percentage' && setting.commission_percentage !== undefined) {
        // 퍼센트 방식 (추가공사비 제외)
        salesCommission = commissionBaseRevenue * (setting.commission_percentage / 100);
      } else if (setting.commission_type === 'per_unit' && setting.commission_per_unit !== undefined) {
        // 단가 방식 (전체 기기 수량 계산)
        const totalQuantity = EQUIPMENT_FIELDS.reduce((sum, field) => sum + (business[field] || 0), 0);
        salesCommission = totalQuantity * setting.commission_per_unit;
      } else {
        // 설정이 있지만 값이 없으면 기본값 사용
        salesCommission = commissionBaseRevenue * 0.10;
      }
    }
    // 3순위: 기본값 10%
    else {
      salesCommission = commissionBaseRevenue * 0.10;
    }

    // 실사비용 계산 (실사일이 있는 경우에만 비용 추가)
    let surveyCosts = 0;

    if (costSettingsLoaded && Object.keys(surveyCostSettings).length > 0) {
      // 견적실사 비용 (견적실사일이 있고 빈 문자열이 아닌 경우에만)
      if (business.estimate_survey_date && business.estimate_survey_date.trim() !== '') {
        surveyCosts += surveyCostSettings['estimate'] || 0;
      }

      // 착공전실사 비용 (착공전실사일이 있고 빈 문자열이 아닌 경우에만)
      if (business.pre_construction_survey_date && business.pre_construction_survey_date.trim() !== '') {
        surveyCosts += surveyCostSettings['pre_construction'] || 0;
      }

      // 준공실사 비용 (준공실사일이 있고 빈 문자열이 아닌 경우에만)
      if (business.completion_survey_date && business.completion_survey_date.trim() !== '') {
        surveyCosts += surveyCostSettings['completion'] || 0;
      }
    } else {
      // DB 로드 실패 → 실사비용 0으로 설정
      surveyCosts = 0;
    }

    // 총 이익 = 매출 - 매입
    const grossProfit = adjustedRevenue - totalCost;

    // 순이익 = 총이익 - 영업비용 - 실사비용 - 기본설치비
    const netProfit = grossProfit - salesCommission - surveyCosts - totalBaseInstallationCost;

    // 디버깅 로그 (필요시 활성화)
    // if (business.business_name && business.business_name.includes('특정사업장명')) {
    //   console.log('🔍 [매출계산] 상세:', {
    //     사업장명: business.business_name,
    //     기본매출: totalRevenue,
    //     추가공사비: additionalCost,
    //     최종매출: adjustedRevenue,
    //     순이익: netProfit
    //   });
    // }

    return {
      total_revenue: adjustedRevenue,
      total_cost: totalCost,
      gross_profit: grossProfit,
      net_profit: netProfit,
      installation_costs: totalBaseInstallationCost, // 기본 설치비 (비용)
      additional_installation_revenue: additionalInstallationRevenue, // 추가 설치비 (매출에 포함됨)
      sales_commission: salesCommission,
      survey_costs: surveyCosts,
      has_calculation: true // 자동 계산되었음을 표시
    };
  };

  const loadBusinesses = async () => {
    console.log('📊 [LOAD-BUSINESSES] 사업장 데이터 로드 시작');
    try {
      // business-info-direct API 사용 (project_year 포함된 완전한 정보)
      const response = await fetch('/api/business-info-direct', {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (data.success) {
        const businessData = data.data || [];
        console.log(`📊 [LOAD-BUSINESSES] ${businessData.length}개 사업장 조회 완료`);

        // 각 사업장에 대해 자동 매출 계산 적용
        const businessesWithCalculation = businessData.map((business: any) => {
          const calculatedData = calculateBusinessRevenue(business);
          return {
            ...business,
            ...calculatedData
          };
        });

        setBusinesses(businessesWithCalculation);
        console.log('✅ [LOAD-BUSINESSES] businesses 상태 업데이트 완료');
      } else {
        console.error('🔴 [REVENUE] 사업장 로드 실패:', data.message);
      }
    } catch (error) {
      console.error('🔴 [REVENUE] 사업장 목록 로드 오류:', error);
    }
  };

  const loadCalculations = async () => {
    console.log('📊 [LOAD-CALCULATIONS] 계산 결과 로드 시작');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBusiness) params.append('business_id', selectedBusiness);
      if (selectedOffice) params.append('sales_office', selectedOffice);
      params.append('limit', '100');

      console.log('📊 [LOAD-CALCULATIONS] 요청 파라미터:', params.toString());

      const response = await fetch(`/api/revenue/calculate?${params}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (data.success) {
        const calculations = data.data.calculations || [];
        console.log(`📊 [LOAD-CALCULATIONS] ${calculations.length}개 계산 결과 조회 완료`);

        // 영업비용 조정 정보 로깅
        const adjustedCount = calculations.filter((c: any) => c.adjusted_sales_commission).length;
        console.log(`💰 [LOAD-CALCULATIONS] 영업비용 조정된 계산: ${adjustedCount}개`);

        // 각 계산 결과의 영업비용 필드 확인
        calculations.forEach((calc: any) => {
          if (calc.adjusted_sales_commission || calc.sales_commission) {
            console.log(`🔍 [LOAD-CALCULATIONS] ${calc.business_name}:`, {
              sales_commission: calc.sales_commission,
              adjusted_sales_commission: calc.adjusted_sales_commission,
              has_adjustment: !!calc.adjusted_sales_commission
            });
          }
        });

        setCalculations(calculations);
        calculateStats(calculations);
        console.log('✅ [LOAD-CALCULATIONS] calculations 상태 업데이트 완료');
      }
    } catch (error) {
      console.error('🔴 [LOAD-CALCULATIONS] 계산 결과 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 매출 재계산 함수 (권한 레벨 4 전용)
  const handleRecalculate = async (businessId: string, businessName: string) => {
    try {
      console.log('🔄 [RECALCULATE] 재계산 시작:', { businessId, businessName });

      const response = await fetch('/api/revenue/recalculate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ businessId })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ ${businessName}의 매출 정보가 재계산되었습니다.`);

        // 데이터 다시 로드
        await loadBusinesses();
        await loadCalculations();
      } else {
        alert(`❌ 재계산 실패: ${data.message}`);
        console.error('❌ [RECALCULATE] 실패:', data.message);
      }
    } catch (error) {
      console.error('❌ [RECALCULATE] 오류:', error);
      alert('재계산 중 오류가 발생했습니다.');
    }
  };

  // 전체 재계산 함수 (권한 레벨 4 전용)
  const handleRecalculateAll = async () => {
    try {
      if (!confirm(`⚠️ 전체 사업장 재계산\n\n총 ${sortedBusinesses.length}개 사업장의 매출 정보를 모두 재계산하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 기존 계산 기록이 모두 삭제됩니다.`)) {
        return;
      }

      const response = await fetch('/api/revenue/recalculate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ recalculateAll: true })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ 모든 사업장의 매출 정보가 재계산되었습니다.`);

        // 데이터 다시 로드
        await loadBusinesses();
        await loadCalculations();
      } else {
        alert(`❌ 전체 재계산 실패: ${data.message}`);
        console.error('❌ [RECALCULATE-ALL] 실패:', data.message);
      }
    } catch (error) {
      console.error('❌ [RECALCULATE-ALL] 오류:', error);
      alert('전체 재계산 중 오류가 발생했습니다.');
    }
  };

  const calculateStats = (calcs: RevenueCalculation[]) => {
    if (!calcs.length) {
      setStats(null);
      return;
    }

    const totalRevenue = calcs.reduce((sum, calc) => sum + calc.total_revenue, 0);
    const totalProfit = calcs.reduce((sum, calc) => sum + calc.net_profit, 0);
    const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

    // 영업점별 수익 계산
    const officeStats = calcs.reduce((acc, calc) => {
      const office = calc.sales_office || '기본';
      if (!acc[office]) {
        acc[office] = { revenue: 0, profit: 0 };
      }
      acc[office].revenue += calc.total_revenue;
      acc[office].profit += calc.net_profit;
      return acc;
    }, {} as Record<string, {revenue: number, profit: number}>);

    const topOffice = Object.entries(officeStats)
      .sort(([,a], [,b]) => b.profit - a.profit)[0]?.[0] || '';

    setStats({
      total_businesses: new Set(calcs.map(c => c.business_id)).size,
      total_revenue: totalRevenue,
      total_profit: totalProfit,
      average_margin: avgMargin + '%',
      top_performing_office: topOffice
    });
  };

  const calculateRevenue = async (businessId: string) => {
    if (!businessId) return;

    setIsCalculating(true);
    try {
      const response = await fetch('/api/revenue/calculate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          business_id: businessId,
          calculation_date: new Date().toISOString().split('T')[0],
          save_result: userPermission >= 3
        })
      });

      const data = await response.json();

      if (data.success) {
        const newCalculation = data.data.calculation;

        // 기존 calculations 배열에서 동일한 business_id가 있으면 업데이트, 없으면 추가
        setCalculations(prevCalcs => {
          const existingIndex = prevCalcs.findIndex(c => c.business_id === businessId);

          if (existingIndex >= 0) {
            // 기존 계산 결과 업데이트
            const updated = [...prevCalcs];
            updated[existingIndex] = {
              ...newCalculation,
              id: prevCalcs[existingIndex].id // 기존 ID 유지
            };
            return updated;
          } else {
            // 새로운 계산 결과 추가
            return [...prevCalcs, newCalculation];
          }
        });

        // 통계도 즉시 업데이트
        setCalculations(prevCalcs => {
          calculateStats(prevCalcs);
          return prevCalcs;
        });

        alert('매출 계산이 완료되었습니다.');

        // 사업장 목록만 새로고침 (계산 결과는 이미 위에서 업데이트됨)
        await loadBusinesses();
      } else {
        alert('계산 실패: ' + data.message);
      }
    } catch (error) {
      console.error('매출 계산 오류:', error);
      alert('매출 계산 중 오류가 발생했습니다.');
    } finally {
      setIsCalculating(false);
    }
  };

  const calculateAllBusinesses = async () => {
    if (!businesses.length || userPermission < 3) return;

    setIsCalculating(true);
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    try {
      // 계산이 필요한 사업장만 필터링
      const businessesToCalculate = businesses.filter(b => {
        const hasCalculation = calculations.some(c => c.business_id === b.id);
        if (hasCalculation) {
          skippedCount++;
        }
        return !hasCalculation;
      });

      if (businessesToCalculate.length === 0) {
        alert('모든 사업장이 이미 계산되어 있습니다.');
        setIsCalculating(false);
        return;
      }

      for (const business of businessesToCalculate) {
        try {
          const response = await fetch('/api/revenue/calculate', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              business_id: business.id,
              calculation_date: new Date().toISOString().split('T')[0],
              save_result: true
            })
          });

          const data = await response.json();
          if (data.success) {
            successCount++;
          } else {
            errorCount++;
            console.error(`❌ [BULK-CALCULATE] ${business.business_name} 계산 실패:`, data.message);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ [BULK-CALCULATE] ${business.business_name} 오류:`, error);
        }

        // 서버 부하 방지를 위한 짧은 지연
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const message = `일괄 계산 완료\n\n✅ 성공: ${successCount}건\n❌ 실패: ${errorCount}건\n⏭️ 건너뜀: ${skippedCount}건`;
      alert(message);

      // 계산 완료 후 데이터 새로고침 (계산 결과 + 사업장 목록)
      await Promise.all([
        loadCalculations(),
        loadBusinesses()
      ]);
    } catch (error) {
      console.error('일괄 계산 오류:', error);
      alert('일괄 계산 중 오류가 발생했습니다.');
    } finally {
      setIsCalculating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  const exportData = () => {
    if (!calculations.length) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const csvData = calculations.map(calc => ({
      '계산일': calc.calculation_date,
      '사업장명': calc.business_name,
      '영업점': calc.sales_office,
      '총 매출': calc.total_revenue,
      '총 매입': calc.total_cost,
      '총 이익': calc.gross_profit,
      '영업비용': calc.sales_commission,
      '실사비용': calc.survey_costs,
      '설치비용': calc.installation_costs,
      '순이익': calc.net_profit,
      '이익률': ((calc.net_profit / calc.total_revenue) * 100).toFixed(2) + '%'
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const today = new Date().toISOString().split('T')[0];
    link.download = `매출관리_${today}.csv`;
    link.click();
  };

  const filteredCalculations = calculations.filter(calc =>
    !searchTerm ||
    calc.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    calc.sales_office.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 사업장 데이터와 매출 계산 통합
  const filteredBusinesses = businesses.filter(business => {
    // 검색어 필터
    const searchMatch = !searchTerm ||
      business.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (business.sales_office && business.sales_office.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (business.manager_name && business.manager_name.toLowerCase().includes(searchTerm.toLowerCase()));

    // 드롭다운 필터
    const officeMatch = !selectedOffice || business.sales_office === selectedOffice;
    const regionMatch = !selectedRegion || (business.address && business.address.toLowerCase().includes(selectedRegion.toLowerCase()));
    const categoryMatch = !selectedCategory || business.progress_status === selectedCategory;
    const yearMatch = !selectedProjectYear || business.project_year === Number(selectedProjectYear);

    // 월별 필터 (설치일 기준)
    let monthMatch = true;
    if (selectedMonth) {
      const installDate = business.installation_date;
      if (installDate) {
        const date = new Date(installDate);
        monthMatch = (date.getMonth() + 1) === Number(selectedMonth);
      } else {
        monthMatch = false; // 설치일이 없으면 필터에서 제외
      }
    }

    return searchMatch && officeMatch && regionMatch && categoryMatch && yearMatch && monthMatch;
  }).map(business => {
    // 해당 사업장의 매출 계산 결과 찾기 (가장 최신)
    const revenueCalc = calculations
      .filter(calc => calc.business_id === business.id)
      .sort((a, b) => new Date(b.calculation_date).getTime() - new Date(a.calculation_date).getTime())[0];

    // 디버깅: 영업비용 조정 정보 확인
    if (revenueCalc?.adjusted_sales_commission) {
      console.log(`💰 [TABLE-RENDER] ${business.business_name}: 조정된 영업비용 = ${revenueCalc.adjusted_sales_commission}`);
    }

    // 기기 수 계산
    const equipmentFields = [
      'ph_meter', 'differential_pressure_meter', 'temperature_meter',
      'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
      'gateway', 'vpn_wired', 'vpn_wireless',
      'explosion_proof_differential_pressure_meter_domestic',
      'explosion_proof_temperature_meter_domestic', 'expansion_device',
      'relay_8ch', 'relay_16ch', 'main_board_replacement', 'multiple_stack'
    ];

    const totalEquipment = equipmentFields.reduce((sum, field) => {
      return sum + (business[field as keyof BusinessInfo] as number || 0);
    }, 0);

    // 설치 기기 목록 기준 매입금액 계산 (모달과 동일)
    const businessManufacturer = business.manufacturer || 'ecosense';
    const actualTotalCost = equipmentFields.reduce((sum, field) => {
      const quantity = business[field as keyof BusinessInfo] as number || 0;
      if (quantity > 0) {
        const unitCost = (pricesLoaded && manufacturerPrices[businessManufacturer]?.[field] !== undefined)
          ? manufacturerPrices[businessManufacturer][field]
          : (MANUFACTURER_COSTS[field] || 0);
        sum += unitCost * quantity;
      }
      return sum;
    }, 0);

    // 총이익 = 매출 - 매입
    const grossProfit = business.total_revenue - actualTotalCost;

    // 영업비용: 저장된 계산 결과에서 조정된 값 우선 사용
    console.log(`🔍 [TABLE-CALC] ${business.business_name} - revenueCalc:`, {
      has_revenueCalc: !!revenueCalc,
      adjusted_sales_commission: revenueCalc?.adjusted_sales_commission,
      sales_commission: revenueCalc?.sales_commission,
      business_adjusted: business.adjusted_sales_commission,
      business_sales: business.sales_commission
    });

    const salesCommission = revenueCalc?.adjusted_sales_commission
      || revenueCalc?.sales_commission
      || business.adjusted_sales_commission
      || business.sales_commission
      || 0;

    // 디버깅: 최종 영업비용 및 순이익 로깅
    const netProfitCalc = grossProfit - salesCommission - (business.survey_costs || 0) - (business.installation_costs || 0) - ((business as any).installation_extra_cost || 0);
    console.log(`📊 [TABLE-CALC] ${business.business_name} - 최종 계산:`, {
      grossProfit,
      salesCommission,
      netProfit: netProfitCalc,
      source: revenueCalc?.adjusted_sales_commission ? '조정된 영업비용' :
              revenueCalc?.sales_commission ? '기본 영업비용' : '사업장 기본값'
    });

    // 순이익 = 총이익 - 조정된 영업비용 - 실사비용 - 기본설치비 - 추가설치비
    const netProfit = grossProfit
      - salesCommission
      - (business.survey_costs || 0)
      - (business.installation_costs || 0)
      - ((business as any).installation_extra_cost || 0);

    // 미수금 계산 (진행구분에 따라 다르게 계산)
    let totalReceivables = 0;
    const progressStatus = business.progress_status || '';
    const normalizedCategory = progressStatus.trim();

    if (normalizedCategory === '보조금' || normalizedCategory === '보조금 동시진행') {
      // 보조금: 1차 + 2차 + 추가공사비
      const receivable1st = ((business as any).invoice_1st_amount || 0) - ((business as any).payment_1st_amount || 0);
      const receivable2nd = ((business as any).invoice_2nd_amount || 0) - ((business as any).payment_2nd_amount || 0);
      // 추가공사비는 계산서가 발행된 경우에만 미수금 계산 (invoice_additional_date 존재 여부 확인)
      const hasAdditionalInvoice = (business as any).invoice_additional_date;
      const receivableAdditional = hasAdditionalInvoice
        ? (business.additional_cost || 0) - ((business as any).payment_additional_amount || 0)
        : 0;
      totalReceivables = receivable1st + receivable2nd + receivableAdditional;
    } else if (normalizedCategory === '자비' || normalizedCategory === '대리점' || normalizedCategory === 'AS') {
      // 자비: 선금 + 잔금
      const receivableAdvance = ((business as any).invoice_advance_amount || 0) - ((business as any).payment_advance_amount || 0);
      const receivableBalance = ((business as any).invoice_balance_amount || 0) - ((business as any).payment_balance_amount || 0);
      totalReceivables = receivableAdvance + receivableBalance;
    }

    return {
      ...business,
      // 실시간 계산 값 사용 (모달과 동일한 로직)
      total_revenue: business.total_revenue || 0,
      total_cost: actualTotalCost, // 설치 기기 목록 기준 매입금액
      net_profit: netProfit, // 순이익 (총이익 - 조정된 영업비용 포함)
      gross_profit: grossProfit, // 총이익 (매출 - 매입)
      sales_commission: revenueCalc?.sales_commission || business.sales_commission || 0, // 기본 영업비용
      adjusted_sales_commission: salesCommission, // 조정된 영업비용 (실제 사용된 값)
      equipment_count: totalEquipment,
      calculation_date: revenueCalc?.calculation_date || null,
      category: business.progress_status || 'N/A', // progress_status 사용 (진행구분)
      has_calculation: !!revenueCalc || business.has_calculation || false, // 서버 계산 또는 클라이언트 자동 계산
      additional_cost: business.additional_cost || 0, // 추가공사비
      negotiation: business.negotiation ? parseFloat(business.negotiation.toString()) : 0, // 협의사항/네고
      total_receivables: totalReceivables // 총 미수금
    };
  }).filter(business => {
    // 매출 금액 필터 적용 - 매출 계산이 없는 경우 필터에서 제외하지 않음
    if (!business.has_calculation && !revenueFilter.min && !revenueFilter.max) {
      return true; // 매출 필터가 없고 계산이 없는 경우 표시
    }
    const minRevenue = revenueFilter.min ? parseFloat(revenueFilter.min) : 0;
    const maxRevenue = revenueFilter.max ? parseFloat(revenueFilter.max) : Number.MAX_SAFE_INTEGER;
    return business.total_revenue >= minRevenue && business.total_revenue <= maxRevenue;
  }).filter(business => {
    // 미수금 필터 적용
    if (!showReceivablesOnly) {
      return true; // 미수금 필터가 꺼져있으면 모두 표시
    }
    return business.total_receivables > 0; // 미수금이 있는 사업장만 표시
  });

  const salesOffices = [...new Set(businesses.map(b => b.sales_office).filter(Boolean))];
  const regions = [...new Set(businesses.map(b => b.address ? b.address.split(' ').slice(0, 2).join(' ') : '').filter(Boolean))];
  const projectYears = [...new Set(businesses.map(b => b.project_year).filter(Boolean))].sort((a, b) => b - a);

  // 정렬 함수
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1); // 정렬시 첫 페이지로 이동
  };

  // 정렬된 데이터
  const sortedBusinesses = [...filteredBusinesses].sort((a, b) => {
    const aValue = a[sortField as keyof typeof a] || '';
    const bValue = b[sortField as keyof typeof b] || '';

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }

    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    return sortOrder === 'asc'
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  // 페이지네이션
  const totalPages = Math.ceil(sortedBusinesses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBusinesses = sortedBusinesses.slice(startIndex, startIndex + itemsPerPage);

  return (
    <ProtectedPage
      requiredLevel={AuthLevel.ADMIN}
      fallbackMessage="매출 관리 시스템은 관리자 권한이 필요합니다."
    >
      <AdminLayout
        title="매출 관리"
        description="환경부 고시가 기준 매출 현황 및 분석"
        actions={
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                if (userPermission >= 3) {
                  router.push('/admin/revenue/pricing');
                } else {
                  alert(`원가 관리는 권한 레벨 3 이상이 필요합니다. 현재 권한: ${userPermission}`);
                }
              }}
              disabled={userPermission < 3}
              className={`px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 border rounded-lg flex items-center gap-1 sm:gap-1.5 md:gap-2 transition-colors text-xs sm:text-sm ${
                userPermission >= 3
                  ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer'
                  : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
              }`}
              title={userPermission < 3 ? `권한 부족: 레벨 ${userPermission} (필요: 레벨 3+)` : '원가 관리 페이지로 이동'}
            >
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">원가 관리</span>
              <span className="sm:hidden">원가</span>
            </button>
            <button
              onClick={exportData}
              className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1 sm:gap-1.5 md:gap-2 transition-colors text-xs sm:text-sm"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">엑셀 내보내기</span>
              <span className="sm:hidden">엑셀</span>
            </button>
          </div>
        }
      >
        <div className="space-y-3 sm:space-y-4">

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <StatsCard
            title="총 사업장 수"
            value={`${businesses.length}개`}
            icon={Building2}
            color="blue"
            description={`필터 적용: ${filteredBusinesses.length}개`}
          />

          <StatsCard
            title="총 매출"
            value={formatCurrency(businesses.reduce((sum, b) => sum + (b.total_revenue || 0), 0))}
            icon={BarChart3}
            color="green"
            description="전체 사업장 매출 합계"
          />

          <StatsCard
            title="총 순이익"
            value={formatCurrency(businesses.reduce((sum, b) => sum + (b.net_profit || 0), 0))}
            icon={TrendingUp}
            color="purple"
            description={`평균 이익률: ${
              businesses.reduce((sum, b) => sum + (b.total_revenue || 0), 0) > 0
                ? ((businesses.reduce((sum, b) => sum + (b.net_profit || 0), 0) / businesses.reduce((sum, b) => sum + (b.total_revenue || 0), 0)) * 100).toFixed(1) + '%'
                : '0%'
            }`}
          />

          <StatsCard
            title="총 영업비용"
            value={formatCurrency(businesses.reduce((sum, b) => {
              const salesCommission = b.adjusted_sales_commission || b.sales_commission || 0;
              return sum + salesCommission;
            }, 0))}
            icon={Calculator}
            color="orange"
            description="전체 사업장 영업비용 합계"
          />

          <StatsCard
            title="총 설치비용"
            value={formatCurrency(businesses.reduce((sum, b) => {
              const installationCosts = (b.installation_costs || 0) + (b.installation_extra_cost || 0);
              return sum + installationCosts;
            }, 0))}
            icon={Settings}
            color="blue"
            description="기본 설치비 + 추가 설치비"
          />

          <StatsCard
            title="최고 수익 영업점"
            value={(() => {
              const officeStats = businesses.reduce((acc: Record<string, number>, b) => {
                const office = b.sales_office || '미배정';
                acc[office] = (acc[office] || 0) + (b.net_profit || 0);
                return acc;
              }, {});
              const topOffice = Object.entries(officeStats).sort(([,a], [,b]) => b - a)[0];
              return topOffice ? topOffice[0] : '데이터 없음';
            })()}
            icon={DollarSign}
            color="indigo"
            description="순이익 기준 최고 영업점"
          />
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm md:text-base font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
            <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            필터 및 검색
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <div>
              <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-1.5 block">사업장 선택</label>
              <select
                value={selectedBusiness}
                onChange={(e) => setSelectedBusiness(e.target.value)}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체 사업장</option>
                {businesses.map(business => (
                  <option key={business.id} value={business.id}>
                    {business.business_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-1.5 block">영업점</label>
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체 영업점</option>
                {salesOffices.map(office => (
                  <option key={office} value={office}>
                    {office}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-1.5 block">지역</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체 지역</option>
                {regions.sort().map(region => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-1.5 block">진행구분</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체</option>
                <option value="자비">자비</option>
                <option value="보조금">보조금</option>
                <option value="보조금 동시진행">보조금 동시진행</option>
                <option value="대리점">대리점</option>
                <option value="AS">AS</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-1.5 block">사업 진행 연도</label>
              <select
                value={selectedProjectYear}
                onChange={(e) => setSelectedProjectYear(e.target.value)}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체 연도</option>
                {projectYears.map(year => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-1.5 block">설치 월</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체 월</option>
                <option value="1">1월</option>
                <option value="2">2월</option>
                <option value="3">3월</option>
                <option value="4">4월</option>
                <option value="5">5월</option>
                <option value="6">6월</option>
                <option value="7">7월</option>
                <option value="8">8월</option>
                <option value="9">9월</option>
                <option value="10">10월</option>
                <option value="11">11월</option>
                <option value="12">12월</option>
              </select>
            </div>

            <div className="sm:col-span-2 md:col-span-1">
              <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-1.5 block">미수금 필터</label>
              <div className="flex items-center h-8 px-2 py-1.5 bg-gray-50 border border-gray-300 rounded">
                <input
                  type="checkbox"
                  id="receivables-filter"
                  checked={showReceivablesOnly}
                  onChange={(e) => setShowReceivablesOnly(e.target.checked)}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                />
                <label htmlFor="receivables-filter" className="ml-1.5 sm:ml-2 text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 cursor-pointer">
                  미수금만
                </label>
              </div>
            </div>

            <div className="flex items-end gap-1.5 sm:gap-2 sm:col-span-2 md:col-span-3 lg:col-span-1">
              <button
                onClick={loadCalculations}
                disabled={loading}
                className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-1.5 transition-colors"
              >
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                조회
              </button>
              {selectedBusiness && (
                <button
                  onClick={() => calculateRevenue(selectedBusiness)}
                  disabled={isCalculating}
                  className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-1.5 transition-colors"
                >
                  <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {isCalculating ? '계산 중...' : '계산'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 sm:mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
            <div>
              <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-1.5 block">검색</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="사업장명 또는 영업점"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-1.5 block">최소 매출금액 (원)</label>
              <input
                type="number"
                placeholder="0"
                value={revenueFilter.min}
                onChange={(e) => setRevenueFilter(prev => ({ ...prev, min: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="100000"
              />
            </div>

            <div>
              <label className="text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-1.5 block">최대 매출금액 (원)</label>
              <input
                type="number"
                placeholder="제한없음"
                value={revenueFilter.max}
                onChange={(e) => setRevenueFilter(prev => ({ ...prev, max: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="100000"
              />
            </div>
          </div>
        </div>

        {/* 요약 통계 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <div className="bg-white p-2 sm:p-3 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="p-1 sm:p-1.5 bg-blue-50 rounded flex-shrink-0">
                <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-medium text-gray-600">총 사업장</p>
                <p className="text-sm sm:text-lg font-bold text-gray-900">{sortedBusinesses.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-2 sm:p-3 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="p-1 sm:p-1.5 bg-green-50 rounded flex-shrink-0">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-medium text-gray-600">총 매출금액</p>
                <p className="text-xs sm:text-sm font-bold text-green-600 break-words">
                  {formatCurrency(sortedBusinesses.reduce((sum, b) => sum + b.total_revenue, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-2 sm:p-3 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="p-1 sm:p-1.5 bg-purple-50 rounded flex-shrink-0">
                <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-medium text-gray-600">총 이익금액</p>
                <p className="text-xs sm:text-sm font-bold text-purple-600 break-words">
                  {formatCurrency(sortedBusinesses.reduce((sum, b) => sum + b.net_profit, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-2 sm:p-3 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="p-1 sm:p-1.5 bg-orange-50 rounded flex-shrink-0">
                <Calculator className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-medium text-gray-600">총 영업비용</p>
                <p className="text-xs sm:text-sm font-bold text-orange-600 break-words">
                  {formatCurrency(sortedBusinesses.reduce((sum, b) => {
                    const salesCommission = b.adjusted_sales_commission || b.sales_commission || 0;
                    return sum + salesCommission;
                  }, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-2 sm:p-3 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="p-1 sm:p-1.5 bg-blue-50 rounded flex-shrink-0">
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-medium text-gray-600">총 설치비용</p>
                <p className="text-xs sm:text-sm font-bold text-blue-600 break-words">
                  {formatCurrency(sortedBusinesses.reduce((sum, b) => {
                    const installationCosts = (b.installation_costs || 0) + (b.installation_extra_cost || 0);
                    return sum + installationCosts;
                  }, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-2 sm:p-3 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="p-1 sm:p-1.5 bg-indigo-50 rounded flex-shrink-0">
                <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-medium text-gray-600">평균 이익률</p>
                <p className="text-xs sm:text-sm font-bold text-indigo-600">
                  {sortedBusinesses.length > 0 ?
                    ((sortedBusinesses.reduce((sum, b) => sum + (b.total_revenue > 0 ? (b.net_profit / b.total_revenue * 100) : 0), 0) / sortedBusinesses.length)).toFixed(1)
                    : '0'}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 사업장별 매출 현황 테이블 */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
          <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                사업장별 매출 현황 ({sortedBusinesses.length}건)
              </h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 w-full sm:w-auto">
                <div className="text-xs sm:text-sm text-gray-500">
                  평균 이익률: {sortedBusinesses.length > 0 ?
                    ((sortedBusinesses.reduce((sum, b) => sum + (b.total_revenue > 0 ? (b.net_profit / b.total_revenue * 100) : 0), 0) / sortedBusinesses.length)).toFixed(1)
                    : '0'}%
                </div>
                {/* 재계산 버튼 - 권한 레벨 4 (슈퍼관리자) 전용 */}
                {userPermission >= 4 && (
                  <>
                    <button
                      onClick={() => {
                        if (confirm('선택한 사업장의 매출 정보를 재계산하시겠습니까?\n\n재계산하면 데이터베이스에 저장된 기존 계산값이 삭제되고 최신 로직으로 다시 계산됩니다.')) {
                          const businessName = prompt('재계산할 사업장명을 입력하세요:');
                          if (businessName) {
                            const business = sortedBusinesses.find(b => b.business_name === businessName);
                            if (business) {
                              handleRecalculate(business.id, business.business_name);
                            } else {
                              alert('해당 사업장을 찾을 수 없습니다.');
                            }
                          }
                        }
                      }}
                      className="flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      title="슈퍼관리자 전용: 개별 사업장 재계산"
                    >
                      <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">개별 재계산</span>
                      <span className="sm:hidden">개별</span>
                    </button>
                    <button
                      onClick={handleRecalculateAll}
                      className="flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      title="슈퍼관리자 전용: 전체 사업장 재계산"
                    >
                      <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">전체 재계산</span>
                      <span className="sm:hidden">전체</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="p-3 sm:p-4 md:p-6">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mx-auto mb-2" />
                <div className="text-gray-500 text-xs sm:text-sm">사업장 매출 데이터를 불러오는 중...</div>
              </div>
            ) : sortedBusinesses.length === 0 && calculations.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="mb-4 sm:mb-6">
                  <Calculator className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">매출 계산 결과가 없습니다</h3>
                  <div className="text-gray-500 space-y-1 text-xs sm:text-sm">
                    <p>• 총 {businesses.length}개의 사업장이 등록되어 있습니다</p>
                    <p>• 아직 매출 계산이 수행되지 않았습니다</p>
                    <p>• 사업장을 선택하여 매출을 계산해보세요</p>
                  </div>
                </div>

                {businesses.length > 0 && userPermission >= 3 && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 max-w-md mx-auto">
                      <h4 className="text-xs sm:text-sm font-medium text-blue-900 mb-2">매출 계산 시작하기</h4>
                      <div className="space-y-2">
                        <select
                          value={selectedBusiness}
                          onChange={(e) => setSelectedBusiness(e.target.value)}
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-blue-300 rounded-md text-xs sm:text-sm"
                        >
                          <option value="">사업장을 선택하세요</option>
                          {businesses.map((business) => (
                            <option key={business.id} value={business.id}>
                              {business.business_name} ({business.sales_office})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => calculateRevenue(selectedBusiness)}
                          disabled={!selectedBusiness || isCalculating}
                          className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium"
                        >
                          {isCalculating ? '계산 중...' : '매출 계산 실행'}
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] sm:text-xs text-gray-400">
                      💡 팁: 사업장별 매출 계산 후 결과가 이 화면에 표시됩니다
                    </div>

                  </div>
                )}

                {userPermission < 3 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 max-w-md mx-auto">
                    <p className="text-xs sm:text-sm text-yellow-800">
                      ⚠️ 매출 계산은 권한 레벨 3 이상이 필요합니다 (현재: 레벨 {userPermission})
                    </p>
                  </div>
                )}
              </div>
            ) : sortedBusinesses.length === 0 && calculations.length > 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="mb-4 sm:mb-6">
                  <Building2 className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">필터 조건에 맞는 사업장이 없습니다</h3>
                  <div className="text-gray-500 space-y-1 text-xs sm:text-sm">
                    <p>• 총 {businesses.length}개의 사업장 중 {calculations.length}개 사업장에 매출 계산 완료</p>
                    <p>• 검색어나 필터 조건을 확인해보세요</p>
                    <p>• 모든 사업장을 보려면 필터를 초기화하세요</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedBusiness('');
                    setSelectedOffice('');
                    setSelectedRegion('');
                    setRevenueFilter({ min: '', max: '' });
                    setShowReceivablesOnly(false);
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm"
                >
                  필터 초기화
                </button>
              </div>
            ) : (
              <>
                {/* 모바일 카드뷰 */}
                <div className="md:hidden space-y-2 sm:space-y-3">
                  {paginatedBusinesses.map((business) => {
                    const profitMargin = business.total_revenue > 0
                      ? ((business.net_profit / business.total_revenue) * 100).toFixed(1)
                      : '0';

                    return (
                      <div
                        key={business.id}
                        className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-2 sm:mb-3">
                          <button
                            onClick={() => {
                              setSelectedEquipmentBusiness(business);
                              setShowEquipmentModal(true);
                            }}
                            className="text-sm sm:text-base font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left flex-1"
                          >
                            {business.business_name}
                          </button>
                          <span className={`ml-2 inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium flex-shrink-0 ${
                            business.category === '보조금' || business.category === '보조금 동시진행'
                              ? 'bg-purple-100 text-purple-800' :
                            business.category === '자비' ? 'bg-green-100 text-green-800' :
                            business.category === 'AS' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {business.category || 'N/A'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-500">지역:</span>{' '}
                            <span className="font-medium">{business.address ? business.address.split(' ').slice(0, 2).join(' ') : '미등록'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">영업점:</span>{' '}
                            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-800">
                              {business.sales_office || '미배정'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">담당자:</span>{' '}
                            <span className="font-medium">{business.manager_name || '미등록'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">이익률:</span>{' '}
                            <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                              parseFloat(profitMargin) >= 10 ? 'bg-green-100 text-green-800' :
                              parseFloat(profitMargin) >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {profitMargin}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 grid grid-cols-2 gap-1.5 sm:gap-2 text-xs sm:text-sm">
                          <div>
                            <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">매출금액</div>
                            <div className="font-mono font-semibold text-green-600 text-xs sm:text-sm">{formatCurrency(business.total_revenue)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">매입금액</div>
                            <div className="font-mono font-semibold text-orange-600 text-xs sm:text-sm">{formatCurrency(business.total_cost)}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">이익금액</div>
                            <div className={`font-mono font-bold text-base sm:text-lg ${business.net_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {formatCurrency(business.net_profit)}
                            </div>
                          </div>
                          {showReceivablesOnly && business.total_receivables > 0 && (
                            <div className="col-span-2 bg-red-50 p-2 rounded">
                              <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">미수금</div>
                              <div className="font-mono font-bold text-red-600 text-xs sm:text-sm">
                                {formatCurrency(business.total_receivables)} ⚠️
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 데스크톱 테이블뷰 */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th
                          className="border border-gray-300 px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('business_name')}
                        >
                          사업장명 {sortField === 'business_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-left">지역</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">담당자</th>
                        <th className="border border-gray-300 px-4 py-2 text-center">카테고리</th>
                        <th
                          className="border border-gray-300 px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('sales_office')}
                        >
                          영업점 {sortField === 'sales_office' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="border border-gray-300 px-4 py-2 text-right cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('total_revenue')}
                        >
                          매출금액 {sortField === 'total_revenue' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="border border-gray-300 px-4 py-2 text-right cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('total_cost')}
                        >
                          매입금액 {sortField === 'total_cost' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="border border-gray-300 px-4 py-2 text-right cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('net_profit')}
                        >
                          이익금액 {sortField === 'net_profit' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right">이익률</th>
                        {showReceivablesOnly && (
                          <th
                            className="border border-gray-300 px-4 py-2 text-right cursor-pointer hover:bg-gray-100 bg-red-50"
                            onClick={() => handleSort('total_receivables')}
                          >
                            미수금 {sortField === 'total_receivables' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBusinesses.map((business) => {
                        const profitMargin = business.total_revenue > 0
                          ? ((business.net_profit / business.total_revenue) * 100).toFixed(1)
                          : '0';

                        return (
                          <tr key={business.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">
                              <button
                                onClick={() => {
                                  setSelectedEquipmentBusiness(business);
                                  setShowEquipmentModal(true);
                                }}
                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                              >
                                {business.business_name}
                              </button>
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {business.address ? business.address.split(' ').slice(0, 2).join(' ') : '미등록'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {business.manager_name || '미등록'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                business.category === '보조금' || business.category === '보조금 동시진행'
                                  ? 'bg-purple-100 text-purple-800' :
                                business.category === '자비' ? 'bg-green-100 text-green-800' :
                                business.category === 'AS' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {business.category || 'N/A'}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {business.sales_office || '미배정'}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono">
                              {formatCurrency(business.total_revenue)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono">
                              {formatCurrency(business.total_cost)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono font-bold">
                              <span className={business.net_profit >= 0 ? 'text-blue-600' : 'text-red-600'}>
                                {formatCurrency(business.net_profit)}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                parseFloat(profitMargin) >= 10 ? 'bg-green-100 text-green-800' :
                                parseFloat(profitMargin) >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {profitMargin}%
                              </span>
                            </td>
                            {showReceivablesOnly && (
                              <td className="border border-gray-300 px-4 py-2 text-right font-mono font-bold bg-red-50">
                                <span className={`${
                                  business.total_receivables > 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {formatCurrency(business.total_receivables)}
                                  {business.total_receivables > 0 ? ' ⚠️' : ' ✅'}
                                </span>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedBusinesses.length)} / {sortedBusinesses.length}건
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        이전
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const startPage = Math.max(1, currentPage - 2);
                        const pageNumber = startPage + i;
                        if (pageNumber > totalPages) return null;

                        return (
                          <button
                            key={pageNumber}
                            onClick={() => setCurrentPage(pageNumber)}
                            className={`px-3 py-1 text-sm border border-gray-300 rounded ${
                              currentPage === pageNumber
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        다음
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        </div>


        {/* 기기 상세 정보 모달 */}
        <BusinessRevenueModal
          business={selectedEquipmentBusiness}
          isOpen={showEquipmentModal}
          onClose={async () => {
            console.log('🔄 [MODAL-CLOSE] 모달 닫기 시작');
            setShowEquipmentModal(false);

            // 모달 닫을 때 사업장 데이터와 계산 결과 모두 재조회
            console.log('🔄 [MODAL-CLOSE] 데이터 재조회 시작...');
            await Promise.all([
              loadBusinesses(),
              loadCalculations()
            ]);
            console.log('✅ [MODAL-CLOSE] 데이터 재조회 완료');
          }}
          userPermission={userPermission}
        />
      </AdminLayout>
    </ProtectedPage>
  );
}

// 새로운 AuthGuard 시스템 적용 완료
export default RevenueDashboard;