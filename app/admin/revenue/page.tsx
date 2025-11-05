'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TokenManager } from '@/lib/api-client';
import AdminLayout from '@/components/ui/AdminLayout';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { AuthLevel } from '@/lib/auth/AuthLevels';
import StatsCard from '@/components/ui/StatsCard';
import Modal, { ModalActions } from '@/components/ui/Modal';
import { InvoiceDisplay } from '@/components/business/InvoiceDisplay';
import { MANUFACTURER_NAMES_REVERSE, type ManufacturerName } from '@/constants/manufacturers';
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
  survey_costs: number;
  installation_costs: number;
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

  // 🔍 권한 디버깅 - 상세한 권한 정보 로깅
  useEffect(() => {
    console.log('🔍 [REVENUE-PAGE] 사용자 권한 디버깅:', {
      user: user,
      userPermission: userPermission,
      permission_level: user?.permission_level,
      hasLevel3Access: userPermission >= 3,
      hasLevel4Access: userPermission >= 4,
      buttonShouldBeEnabled: userPermission >= 3,
      buttonDisabledCheck: userPermission < 3,
      rawUser: JSON.stringify(user, null, 2)
    });
  }, [user, userPermission]);

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

  // 동적 가격 데이터 로드
  const loadPricingData = async () => {
    try {
      // 환경부 고시가 로드
      const govResponse = await fetch('/api/revenue/government-pricing', {
        headers: getAuthHeaders()
      });
      const govData = await govResponse.json();

      if (govData.success) {
        const govPrices: Record<string, number> = {};
        govData.data.pricing.forEach((item: any) => {
          govPrices[item.equipment_type] = item.official_price;
        });
        setOfficialPrices(govPrices);
        console.log('✅ [PRICING] 환경부 고시가 로드:', Object.keys(govPrices).length, '개');
      }

      // 제조사별 원가 로드 (모든 제조사)
      const manuResponse = await fetch('/api/revenue/manufacturer-pricing', {
        headers: getAuthHeaders()
      });
      const manuData = await manuResponse.json();

      if (manuData.success) {
        const manuPrices: Record<string, Record<string, number>> = {};
        manuData.data.pricing.forEach((item: any) => {
          if (!manuPrices[item.manufacturer]) {
            manuPrices[item.manufacturer] = {};
          }
          manuPrices[item.manufacturer][item.equipment_type] = item.cost_price;
        });
        setManufacturerPrices(manuPrices);
        console.log('✅ [PRICING] 제조사별 원가 로드:', Object.keys(manuPrices).length, '개 제조사');
      }

      // 영업점별 비용 설정 로드
      const salesOfficeResponse = await fetch('/api/revenue/sales-office-settings', {
        headers: getAuthHeaders()
      });
      const salesOfficeData = await salesOfficeResponse.json();

      if (salesOfficeData.success) {
        const salesSettings: Record<string, any> = {};
        salesOfficeData.data.settings.forEach((item: any) => {
          salesSettings[item.sales_office] = item;
        });
        setSalesOfficeSettings(salesSettings);
        console.log('✅ [COST-SETTINGS] 영업점 비용 설정 로드:', Object.keys(salesSettings).length, '개 영업점');
      }

      // 실사비용 설정 로드
      const surveyCostResponse = await fetch('/api/revenue/survey-costs', {
        headers: getAuthHeaders()
      });
      const surveyCostData = await surveyCostResponse.json();

      if (surveyCostData.success) {
        const surveyCosts: Record<string, number> = {};
        surveyCostData.data.forEach((item: any) => {
          surveyCosts[item.survey_type] = item.base_cost;
        });
        setSurveyCostSettings(surveyCosts);
        console.log('✅ [COST-SETTINGS] 실사비용 설정 로드:', Object.keys(surveyCosts).length, '개 유형');
      }

      // 기본 설치비 로드
      const installCostResponse = await fetch('/api/revenue/installation-cost', {
        headers: getAuthHeaders()
      });
      const installCostData = await installCostResponse.json();

      if (installCostData.success) {
        const installCosts: Record<string, number> = {};
        installCostData.data.costs.forEach((item: any) => {
          installCosts[item.equipment_type] = item.base_installation_cost;
        });
        setBaseInstallationCosts(installCosts);
        console.log('✅ [COST-SETTINGS] 기본 설치비 로드:', Object.keys(installCosts).length, '개 기기');
      }

      // 제조사별 수수료율 로드
      const commissionResponse = await fetch('/api/revenue/commission-rates', {
        headers: getAuthHeaders()
      });
      const commissionData = await commissionResponse.json();

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
        console.log('✅ [COMMISSION] 제조사별 수수료율 로드:', Object.keys(rates).length, '개 영업점');
        console.log('📊 [COMMISSION] 로드된 수수료율 상세:', rates);
      } else {
        console.warn('⚠️ [COMMISSION] 수수료율 로드 실패:', { success: commissionData.success, hasOffices: !!commissionData.data?.offices });
      }

      setPricesLoaded(true);
      setCostSettingsLoaded(true);
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
    if (business.business_name && business.business_name.includes('일신산업')) {
      console.log('🔍 [(주)일신산업] 매입금액 계산 상세:', {
        사업장명: business.business_name,
        제조사: businessManufacturer,
        기기목록: equipmentDetails,
        총매출: totalRevenue,
        총매입: totalCost,
        기본설치비: totalBaseInstallationCost,
        가격로드상태: pricesLoaded ? '완료' : '미완료'
      });
    }

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

    // 최종 매출 = 기본 매출 + 추가공사비 + 추가설치비 - 협의사항
    const adjustedRevenue = totalRevenue + additionalCost + additionalInstallationRevenue - negotiation;

    // 영업비용 계산 (제조사별 수수료율 우선, 없으면 영업점 설정, 최종 기본값 10%)
    let salesCommission = 0;
    const salesOffice = business.sales_office || '';

    // 디버깅: 수수료 계산 조건 확인
    console.log(`🔍 [${business.business_name}] 수수료 계산 조건:`, {
      commissionRatesLoaded,
      salesOffice,
      rawManufacturer,
      businessManufacturer,
      hasOfficeInRates: !!commissionRates[salesOffice],
      hasManufacturerRate: commissionRates[salesOffice] ? commissionRates[salesOffice][businessManufacturer] : 'N/A',
      availableOffices: Object.keys(commissionRates),
      availableManufacturers: commissionRates[salesOffice] ? Object.keys(commissionRates[salesOffice]) : []
    });

    // 1순위: 제조사별 수수료율
    if (commissionRatesLoaded && salesOffice && commissionRates[salesOffice] && commissionRates[salesOffice][businessManufacturer] !== undefined) {
      const commissionRate = commissionRates[salesOffice][businessManufacturer];
      salesCommission = adjustedRevenue * (commissionRate / 100);
      console.log(`💰 [${business.business_name}] 제조사별 수수료율 적용:`, {
        영업점: salesOffice,
        제조사: businessManufacturer,
        수수료율: `${commissionRate}%`,
        계산결과: salesCommission
      });
    }
    // 2순위: 영업점별 기본 설정
    else if (costSettingsLoaded && salesOffice && salesOfficeSettings[salesOffice]) {
      const setting = salesOfficeSettings[salesOffice];
      if (setting.commission_type === 'percentage' && setting.commission_percentage !== undefined) {
        // 퍼센트 방식
        salesCommission = adjustedRevenue * (setting.commission_percentage / 100);
      } else if (setting.commission_type === 'per_unit' && setting.commission_per_unit !== undefined) {
        // 단가 방식 (전체 기기 수량 계산)
        const totalQuantity = EQUIPMENT_FIELDS.reduce((sum, field) => sum + (business[field] || 0), 0);
        salesCommission = totalQuantity * setting.commission_per_unit;
      } else {
        // 설정이 있지만 값이 없으면 기본값 사용
        salesCommission = adjustedRevenue * 0.10;
      }
      console.log(`💰 [${business.business_name}] 영업점 기본 설정 적용:`, {
        영업점: salesOffice,
        방식: setting.commission_type,
        설정값: setting.commission_type === 'percentage' ? `${setting.commission_percentage}%` : `${setting.commission_per_unit}원/대`,
        계산결과: salesCommission
      });
    }
    // 3순위: 기본값 10%
    else {
      salesCommission = adjustedRevenue * 0.10;
      if (salesOffice) {
        console.log(`⚠️ [${business.business_name}] 수수료 설정 없음, 기본값 10% 사용:`, { salesOffice, manufacturer: businessManufacturer });
      }
    }

    // 실사비용 계산 (실사일이 있는 경우에만 비용 추가)
    let surveyCosts = 0;

    if (costSettingsLoaded && Object.keys(surveyCostSettings).length > 0) {
      // 견적실사 비용 (견적실사일이 있고 빈 문자열이 아닌 경우에만)
      if (business.estimate_survey_date && business.estimate_survey_date.trim() !== '') {
        surveyCosts += surveyCostSettings['estimate'] || 0;
        console.log(`✅ [${business.business_name}] 견적실사 비용 추가: ${surveyCostSettings['estimate']} (실사일: ${business.estimate_survey_date})`);
      }

      // 착공전실사 비용 (착공전실사일이 있고 빈 문자열이 아닌 경우에만)
      if (business.pre_construction_survey_date && business.pre_construction_survey_date.trim() !== '') {
        surveyCosts += surveyCostSettings['pre_construction'] || 0;
        console.log(`✅ [${business.business_name}] 착공전실사 비용 추가: ${surveyCostSettings['pre_construction']} (실사일: ${business.pre_construction_survey_date})`);
      }

      // 준공실사 비용 (준공실사일이 있고 빈 문자열이 아닌 경우에만)
      if (business.completion_survey_date && business.completion_survey_date.trim() !== '') {
        surveyCosts += surveyCostSettings['completion'] || 0;
        console.log(`✅ [${business.business_name}] 준공실사 비용 추가: ${surveyCostSettings['completion']} (실사일: ${business.completion_survey_date})`);
      }

      console.log(`💰 [${business.business_name}] 총 실사비용: ${surveyCosts}`);
    } else {
      // DB 로드 실패 → 실사비용 0으로 설정
      surveyCosts = 0;
      console.log(`⚠️ [${business.business_name}] 실사비용 설정 없음, 비용 0원`);
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
    try {
      // business-info-direct API 사용 (project_year 포함된 완전한 정보)
      const response = await fetch('/api/business-info-direct', {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (data.success) {
        const businessData = data.data || [];
        if (process.env.NODE_ENV === 'development') {
          console.log('🏢 [REVENUE] 사업장 데이터 로드:', businessData.length, '개');
          console.log('📊 [REVENUE] API 응답 count:', data.count, '개');
        }

        // 각 사업장에 대해 자동 매출 계산 적용
        const businessesWithCalculation = businessData.map((business: any) => {
          const calculatedData = calculateBusinessRevenue(business);
          return {
            ...business,
            ...calculatedData
          };
        });

        if (process.env.NODE_ENV === 'development') {
          console.log('💰 [REVENUE] 자동 계산 완료:', businessesWithCalculation.length, '개');
        }
        setBusinesses(businessesWithCalculation);
      } else {
        console.error('🔴 [REVENUE] 사업장 로드 실패:', data.message);
      }
    } catch (error) {
      console.error('🔴 [REVENUE] 사업장 목록 로드 오류:', error);
    }
  };

  const loadCalculations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBusiness) params.append('business_id', selectedBusiness);
      if (selectedOffice) params.append('sales_office', selectedOffice);
      params.append('limit', '100');

      const response = await fetch(`/api/revenue/calculate?${params}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (data.success) {
        setCalculations(data.data.calculations || []);
        calculateStats(data.data.calculations || []);
      }
    } catch (error) {
      console.error('계산 결과 로드 오류:', error);
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

        console.log('✅ [RECALCULATE] 재계산 완료 및 데이터 갱신');
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

      console.log('🔄 [RECALCULATE-ALL] 전체 재계산 시작');

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

        console.log('✅ [RECALCULATE-ALL] 전체 재계산 완료 및 데이터 갱신');
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
          console.log(`⏭️ [BULK-CALCULATE] ${b.business_name} - 이미 계산됨, 건너뜀`);
        }
        return !hasCalculation;
      });

      if (businessesToCalculate.length === 0) {
        alert('모든 사업장이 이미 계산되어 있습니다.');
        setIsCalculating(false);
        return;
      }

      console.log(`🚀 [BULK-CALCULATE] 시작: ${businessesToCalculate.length}개 사업장 계산 (${skippedCount}개 건너뜀)`);

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
            console.log(`✅ [BULK-CALCULATE] ${business.business_name} 계산 완료`);
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
      // 서버 계산 결과가 있으면 우선 사용, 없으면 클라이언트 자동 계산 값 사용
      total_revenue: revenueCalc?.total_revenue || business.total_revenue || 0,
      total_cost: revenueCalc?.total_cost || business.total_cost || 0,
      net_profit: revenueCalc?.net_profit || business.net_profit || 0,
      gross_profit: revenueCalc?.gross_profit || business.gross_profit || 0,
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
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (userPermission >= 3) {
                  router.push('/admin/revenue/pricing');
                } else {
                  alert(`원가 관리는 권한 레벨 3 이상이 필요합니다. 현재 권한: ${userPermission}`);
                }
              }}
              disabled={userPermission < 3}
              className={`px-3 md:px-4 py-2 border rounded-lg flex items-center gap-1 md:gap-2 transition-colors text-sm ${
                userPermission >= 3
                  ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer'
                  : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
              }`}
              title={userPermission < 3 ? `권한 부족: 레벨 ${userPermission} (필요: 레벨 3+)` : '원가 관리 페이지로 이동'}
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">원가 관리</span>
              <span className="sm:hidden">원가</span>
            </button>
            <button
              onClick={exportData}
              className="px-3 md:px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1 md:gap-2 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">엑셀 내보내기</span>
              <span className="sm:hidden">엑셀</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4">
          <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            필터 및 검색
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs md:text-sm font-medium mb-1.5 block">사업장 선택</label>
              <select
                value={selectedBusiness}
                onChange={(e) => setSelectedBusiness(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="text-xs md:text-sm font-medium mb-1.5 block">영업점</label>
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="text-xs md:text-sm font-medium mb-1.5 block">지역</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="text-xs md:text-sm font-medium mb-1.5 block">진행구분</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="text-xs md:text-sm font-medium mb-1.5 block">사업 진행 연도</label>
              <select
                value={selectedProjectYear}
                onChange={(e) => setSelectedProjectYear(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="text-xs md:text-sm font-medium mb-1.5 block">설치 월</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            <div>
              <label className="text-xs md:text-sm font-medium mb-1.5 block">미수금 필터</label>
              <div className="flex items-center h-8 px-2 py-1.5 bg-gray-50 border border-gray-300 rounded">
                <input
                  type="checkbox"
                  id="receivables-filter"
                  checked={showReceivablesOnly}
                  onChange={(e) => setShowReceivablesOnly(e.target.checked)}
                  className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                />
                <label htmlFor="receivables-filter" className="ml-2 text-xs md:text-sm font-medium text-gray-700 cursor-pointer">
                  미수금만
                </label>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={loadCalculations}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                <Search className="w-4 h-4" />
                조회
              </button>
              {selectedBusiness && (
                <button
                  onClick={() => calculateRevenue(selectedBusiness)}
                  disabled={isCalculating}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                >
                  <Calculator className="w-4 h-4" />
                  {isCalculating ? '계산 중...' : '계산'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs md:text-sm font-medium mb-1.5 block">검색</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="사업장명 또는 영업점..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs md:text-sm font-medium mb-1.5 block">최소 매출금액 (원)</label>
              <input
                type="number"
                placeholder="0"
                value={revenueFilter.min}
                onChange={(e) => setRevenueFilter(prev => ({ ...prev, min: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="100000"
              />
            </div>

            <div>
              <label className="text-xs md:text-sm font-medium mb-1.5 block">최대 매출금액 (원)</label>
              <input
                type="number"
                placeholder="제한없음"
                value={revenueFilter.max}
                onChange={(e) => setRevenueFilter(prev => ({ ...prev, max: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="100000"
              />
            </div>
          </div>
        </div>

        {/* 요약 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          <div className="bg-white p-3 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-blue-50 rounded-lg flex-shrink-0">
                <Building2 className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600">총 사업장</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">{sortedBusinesses.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-3 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-green-50 rounded-lg flex-shrink-0">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">총 매출금액</p>
                <p className="text-sm md:text-lg font-bold text-green-600 break-words">
                  {formatCurrency(sortedBusinesses.reduce((sum, b) => sum + b.total_revenue, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-3 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-purple-50 rounded-lg flex-shrink-0">
                <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">총 이익금액</p>
                <p className="text-sm md:text-lg font-bold text-purple-600 break-words">
                  {formatCurrency(sortedBusinesses.reduce((sum, b) => sum + b.net_profit, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-3 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-orange-50 rounded-lg flex-shrink-0">
                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">평균 이익률</p>
                <p className="text-sm md:text-lg font-bold text-orange-600">
                  {sortedBusinesses.length > 0 ?
                    ((sortedBusinesses.reduce((sum, b) => sum + (b.total_revenue > 0 ? (b.net_profit / b.total_revenue * 100) : 0), 0) / sortedBusinesses.length)).toFixed(1)
                    : '0'}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 사업장별 매출 현황 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                사업장별 매출 현황 ({sortedBusinesses.length}건)
              </h3>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">
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
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      title="슈퍼관리자 전용: 개별 사업장 재계산"
                    >
                      <Calculator className="w-4 h-4" />
                      개별 재계산
                    </button>
                    <button
                      onClick={handleRecalculateAll}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      title="슈퍼관리자 전용: 전체 사업장 재계산"
                    >
                      <Calculator className="w-4 h-4" />
                      전체 재계산
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <div className="text-gray-500">사업장 매출 데이터를 불러오는 중...</div>
              </div>
            ) : sortedBusinesses.length === 0 && calculations.length === 0 ? (
              <div className="text-center py-12">
                <div className="mb-6">
                  <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">매출 계산 결과가 없습니다</h3>
                  <div className="text-gray-500 space-y-1">
                    <p>• 총 {businesses.length}개의 사업장이 등록되어 있습니다</p>
                    <p>• 아직 매출 계산이 수행되지 않았습니다</p>
                    <p>• 사업장을 선택하여 매출을 계산해보세요</p>
                  </div>
                </div>

                {businesses.length > 0 && userPermission >= 3 && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">매출 계산 시작하기</h4>
                      <div className="space-y-2">
                        <select
                          value={selectedBusiness}
                          onChange={(e) => setSelectedBusiness(e.target.value)}
                          className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm"
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
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {isCalculating ? '계산 중...' : '매출 계산 실행'}
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-gray-400">
                      💡 팁: 사업장별 매출 계산 후 결과가 이 화면에 표시됩니다
                    </div>

                  </div>
                )}

                {userPermission < 3 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-sm text-yellow-800">
                      ⚠️ 매출 계산은 권한 레벨 3 이상이 필요합니다 (현재: 레벨 {userPermission})
                    </p>
                  </div>
                )}
              </div>
            ) : sortedBusinesses.length === 0 && calculations.length > 0 ? (
              <div className="text-center py-12">
                <div className="mb-6">
                  <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">필터 조건에 맞는 사업장이 없습니다</h3>
                  <div className="text-gray-500 space-y-1">
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            ) : (
              <>
                {/* 모바일 카드뷰 */}
                <div className="md:hidden space-y-3">
                  {paginatedBusinesses.map((business) => {
                    const profitMargin = business.total_revenue > 0
                      ? ((business.net_profit / business.total_revenue) * 100).toFixed(1)
                      : '0';

                    return (
                      <div
                        key={business.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <button
                            onClick={() => {
                              setSelectedEquipmentBusiness(business);
                              setShowEquipmentModal(true);
                            }}
                            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left flex-1"
                          >
                            {business.business_name}
                          </button>
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            business.category === '보조금' || business.category === '보조금 동시진행'
                              ? 'bg-purple-100 text-purple-800' :
                            business.category === '자비' ? 'bg-green-100 text-green-800' :
                            business.category === 'AS' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {business.category || 'N/A'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">지역:</span>{' '}
                            <span className="font-medium">{business.address ? business.address.split(' ').slice(0, 2).join(' ') : '미등록'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">영업점:</span>{' '}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {business.sales_office || '미배정'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">담당자:</span>{' '}
                            <span className="font-medium">{business.manager_name || '미등록'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">이익률:</span>{' '}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              parseFloat(profitMargin) >= 10 ? 'bg-green-100 text-green-800' :
                              parseFloat(profitMargin) >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {profitMargin}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">매출금액</div>
                            <div className="font-mono font-semibold text-green-600">{formatCurrency(business.total_revenue)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">매입금액</div>
                            <div className="font-mono font-semibold text-orange-600">{formatCurrency(business.total_cost)}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-xs text-gray-500 mb-1">이익금액</div>
                            <div className={`font-mono font-bold text-lg ${business.net_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {formatCurrency(business.net_profit)}
                            </div>
                          </div>
                          {showReceivablesOnly && business.total_receivables > 0 && (
                            <div className="col-span-2 bg-red-50 p-2 rounded">
                              <div className="text-xs text-gray-500 mb-1">미수금</div>
                              <div className="font-mono font-bold text-red-600">
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
                                  console.log('🔍 [MODAL-DEBUG] 선택된 사업장 데이터:', {
                                    name: business.business_name,
                                    additional_cost: business.additional_cost,
                                    negotiation: business.negotiation,
                                    total_revenue: business.total_revenue,
                                    multiple_stack: business.multiple_stack,
                                    vpn_wireless: business.vpn_wireless,
                                    gateway: business.gateway
                                  });
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
        {showEquipmentModal && selectedEquipmentBusiness && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-3 md:px-6 py-3 md:py-4 flex justify-between items-center">
                <h3 className="text-base md:text-xl font-bold text-gray-900 pr-2">
                  {selectedEquipmentBusiness.business_name}
                  <span className="hidden md:inline"> - 기기 상세 정보</span>
                </h3>
                <button
                  onClick={async () => {
                    setShowEquipmentModal(false);
                    // 모달 닫을 때 매출 데이터 자동 새로고침
                    console.log('🔄 [MODAL-CLOSE] 모달 닫힘, 매출 데이터 새로고침 시작');
                    await loadCalculations();
                    console.log('✅ [MODAL-CLOSE] 매출 데이터 새로고침 완료');
                  }}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-3 md:p-6 space-y-4 md:space-y-6">
                {/* 사업장 기본 정보 */}
                <div className="bg-gray-50 rounded-lg p-3 md:p-4 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                    <div>
                      <span className="text-xs md:text-sm font-medium text-gray-600">영업점:</span>
                      <span className="ml-2 text-xs md:text-sm text-gray-900">{selectedEquipmentBusiness.sales_office || '미배정'}</span>
                    </div>
                    <div>
                      <span className="text-xs md:text-sm font-medium text-gray-600">진행 구분:</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        selectedEquipmentBusiness.category === '보조금' || selectedEquipmentBusiness.category === '보조금 동시진행'
                          ? 'bg-purple-100 text-purple-800' :
                        selectedEquipmentBusiness.category === '자비' ? 'bg-green-100 text-green-800' :
                        selectedEquipmentBusiness.category === 'AS' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedEquipmentBusiness.category || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs md:text-sm font-medium text-gray-600">제조사:</span>
                      <span className="ml-2 text-xs md:text-sm text-gray-900">{selectedEquipmentBusiness.manufacturer || '미지정'}</span>
                    </div>
                  </div>
                  {selectedEquipmentBusiness.address && (
                    <div>
                      <span className="text-xs md:text-sm font-medium text-gray-600">주소:</span>
                      <span className="ml-2 text-xs md:text-sm text-gray-900">{selectedEquipmentBusiness.address}</span>
                    </div>
                  )}
                </div>

                {/* 매출/매입/이익 정보 */}
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 mb-3 md:mb-4">
                      <div className="bg-green-50 rounded-lg p-3 md:p-4">
                        <p className="text-xs font-medium text-green-600 mb-1">매출금액</p>
                        <p className="text-sm md:text-lg font-bold text-green-700 break-words">
                          {formatCurrency(selectedEquipmentBusiness.total_revenue)}
                        </p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 md:p-4">
                        <p className="text-xs font-medium text-red-600 mb-1">매입금액</p>
                        <p className="text-sm md:text-lg font-bold text-red-700 break-words">
                          {formatCurrency(selectedEquipmentBusiness.total_cost)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 md:p-4 col-span-2 md:col-span-1">
                        <p className="text-xs font-medium text-gray-600 mb-1">총 이익 (매출-매입)</p>
                        <p className="text-sm md:text-lg font-bold text-gray-700 break-words">
                          {formatCurrency(selectedEquipmentBusiness.gross_profit || (selectedEquipmentBusiness.total_revenue - selectedEquipmentBusiness.total_cost))}
                        </p>
                      </div>
                    </div>

                    {/* 비용 항목 */}
                    {(selectedEquipmentBusiness.sales_commission > 0 ||
                      selectedEquipmentBusiness.survey_costs > 0 ||
                      selectedEquipmentBusiness.installation_costs > 0) && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 mb-3 md:mb-4">
                        {selectedEquipmentBusiness.sales_commission > 0 && (
                          <div className="bg-orange-50 rounded-lg p-3 md:p-4">
                            <p className="text-xs font-medium text-orange-600 mb-1">
                              영업비용 ({(() => {
                                const business = businesses.find(b => b.id === selectedEquipmentBusiness.id);
                                const salesOffice = business?.sales_office || '';
                                const rawManufacturer = business?.manufacturer || 'ecosense';
                                const businessManufacturer = MANUFACTURER_NAMES_REVERSE[rawManufacturer as ManufacturerName] || rawManufacturer;

                                // 1순위: 제조사별 수수료율
                                if (commissionRatesLoaded && salesOffice && commissionRates[salesOffice] && commissionRates[salesOffice][businessManufacturer] !== undefined) {
                                  return `${commissionRates[salesOffice][businessManufacturer]}%`;
                                }

                                // 2순위: 영업점 기본 설정
                                if (costSettingsLoaded && salesOffice && salesOfficeSettings[salesOffice]) {
                                  const setting = salesOfficeSettings[salesOffice];
                                  if (setting.commission_type === 'percentage') {
                                    return `${setting.commission_percentage}%`;
                                  } else {
                                    return `${setting.commission_per_unit?.toLocaleString()}원/대`;
                                  }
                                }

                                // 3순위: 기본값
                                return '10%';
                              })()})
                            </p>
                            <p className="text-sm md:text-lg font-bold text-orange-700 break-words">
                              {formatCurrency(selectedEquipmentBusiness.sales_commission)}
                            </p>
                          </div>
                        )}
                        {selectedEquipmentBusiness.survey_costs > 0 && (
                          <div className="bg-yellow-50 rounded-lg p-3 md:p-4">
                            <p className="text-xs font-medium text-yellow-600 mb-1">
                              실사비용 (견적{costSettingsLoaded && surveyCostSettings['estimate'] ? `${(surveyCostSettings['estimate']/10000).toFixed(0)}만` : ''}+착공{costSettingsLoaded && surveyCostSettings['pre_construction'] ? `${(surveyCostSettings['pre_construction']/10000).toFixed(0)}만` : ''}+준공{costSettingsLoaded && surveyCostSettings['completion'] ? `${(surveyCostSettings['completion']/10000).toFixed(0)}만` : ''})
                            </p>
                            <p className="text-sm md:text-lg font-bold text-yellow-700 break-words">
                              {formatCurrency(selectedEquipmentBusiness.survey_costs)}
                            </p>
                          </div>
                        )}
                        {selectedEquipmentBusiness.installation_costs > 0 && (
                          <div className="bg-indigo-50 rounded-lg p-3 md:p-4">
                            <p className="text-xs font-medium text-indigo-600 mb-1">기본 설치비</p>
                            <p className="text-sm md:text-lg font-bold text-indigo-700 break-words">
                              {formatCurrency(selectedEquipmentBusiness.installation_costs)}
                            </p>
                          </div>
                        )}
                        {(selectedEquipmentBusiness.installation_extra_cost || 0) > 0 && (
                          <div className="bg-orange-50 rounded-lg p-3 md:p-4">
                            <p className="text-xs font-medium text-orange-600 mb-1">추가설치비</p>
                            <p className="text-sm md:text-lg font-bold text-orange-700 break-words">
                              {formatCurrency(selectedEquipmentBusiness.installation_extra_cost)}
                            </p>
                            <p className="text-xs text-orange-600 mt-1">설치팀 추가 비용</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 최종 이익 */}
                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                      <div className={`rounded-lg p-3 md:p-4 ${selectedEquipmentBusiness.net_profit >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                        <p className={`text-xs font-medium mb-1 ${selectedEquipmentBusiness.net_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>순이익</p>
                        <p className={`text-sm md:text-lg font-bold ${selectedEquipmentBusiness.net_profit >= 0 ? 'text-blue-700' : 'text-red-700'} break-words`}>
                          {formatCurrency(selectedEquipmentBusiness.net_profit)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 hidden md:block">
                          = 총이익 - {(selectedEquipmentBusiness.installation_extra_cost || 0) > 0 ? '추가설치비 - ' : ''}영업 - 실사 - 설치
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 md:p-4">
                        <p className="text-xs font-medium text-purple-600 mb-1">이익률</p>
                        <p className="text-sm md:text-lg font-bold text-purple-700">
                          {selectedEquipmentBusiness.total_revenue > 0
                            ? ((selectedEquipmentBusiness.net_profit / selectedEquipmentBusiness.total_revenue) * 100).toFixed(1)
                            : '0'}%
                        </p>
                      </div>
                    </div>

                    {/* 추가공사비 및 협의사항 */}
                    {(selectedEquipmentBusiness.additional_cost > 0 ||
                      selectedEquipmentBusiness.negotiation > 0) && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h5 className="text-sm font-semibold text-gray-800 mb-3">매출 조정 내역</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedEquipmentBusiness.additional_cost > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">추가공사비 (+):</span>
                              <span className="text-sm font-semibold text-green-700">
                                +{formatCurrency(selectedEquipmentBusiness.additional_cost)}
                              </span>
                            </div>
                          )}
                          {selectedEquipmentBusiness.negotiation > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">협의사항/네고 (-):</span>
                              <span className="text-sm font-semibold text-red-700">
                                -{formatCurrency(selectedEquipmentBusiness.negotiation)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 매출 계산식 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h5 className="text-sm font-semibold text-gray-800 mb-3">💰 최종 매출금액 계산식</h5>
                      <div className="text-sm text-gray-700 space-y-1">
                        <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                          <span>기본 매출 (기기 합계)</span>
                          <span className="font-mono">{formatCurrency(
                            selectedEquipmentBusiness.total_revenue -
                            (selectedEquipmentBusiness.additional_cost || 0) +
                            (selectedEquipmentBusiness.negotiation || 0)
                          )}</span>
                        </div>
                        {selectedEquipmentBusiness.additional_cost > 0 && (
                          <div className="flex items-center justify-between text-green-700">
                            <span>+ 추가공사비</span>
                            <span className="font-mono">+{formatCurrency(selectedEquipmentBusiness.additional_cost)}</span>
                          </div>
                        )}
                        {selectedEquipmentBusiness.negotiation > 0 && (
                          <div className="flex items-center justify-between text-red-700">
                            <span>- 협의사항/네고</span>
                            <span className="font-mono">-{formatCurrency(selectedEquipmentBusiness.negotiation)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t-2 border-blue-300 pt-2 font-bold text-blue-900">
                          <span>= 최종 매출금액</span>
                          <span className="font-mono text-lg">{formatCurrency(selectedEquipmentBusiness.total_revenue)}</span>
                        </div>
                      </div>
                    </div>
                  </>

                {/* 설치 기기 목록 */}
                <div>
                  <h4 className="text-sm md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">설치 기기 목록</h4>

                  {/* 모바일 카드뷰 */}
                  <div className="md:hidden space-y-3 mb-4">
                    {(() => {
                      const equipmentFields = [
                        { key: 'ph_meter', name: 'PH센서' },
                        { key: 'differential_pressure_meter', name: '차압계' },
                        { key: 'temperature_meter', name: '온도계' },
                        { key: 'discharge_current_meter', name: '배출전류계' },
                        { key: 'fan_current_meter', name: '송풍전류계' },
                        { key: 'pump_current_meter', name: '펌프전류계' },
                        { key: 'gateway', name: '게이트웨이' },
                        { key: 'vpn_wired', name: 'VPN(유선)' },
                        { key: 'vpn_wireless', name: 'VPN(무선)' },
                        { key: 'explosion_proof_differential_pressure_meter_domestic', name: '방폭차압계(국산)' },
                        { key: 'explosion_proof_temperature_meter_domestic', name: '방폭온도계(국산)' },
                        { key: 'expansion_device', name: '확장디바이스' },
                        { key: 'relay_8ch', name: '중계기(8채널)' },
                        { key: 'relay_16ch', name: '중계기(16채널)' },
                        { key: 'main_board_replacement', name: '메인보드교체' },
                        { key: 'multiple_stack', name: '복수굴뚝' }
                      ];

                      const equipmentList = equipmentFields
                        .filter(field => {
                          const quantity = selectedEquipmentBusiness[field.key];
                          return quantity && quantity > 0;
                        })
                        .map(field => {
                          const quantity = selectedEquipmentBusiness[field.key];
                          const businessManufacturer = selectedEquipmentBusiness.manufacturer || 'ecosense';

                          const unitRevenue = (pricesLoaded && officialPrices[field.key] !== undefined)
                            ? officialPrices[field.key]
                            : (OFFICIAL_PRICES[field.key] || 0);

                          const unitCost = (pricesLoaded && manufacturerPrices[businessManufacturer]?.[field.key] !== undefined)
                            ? manufacturerPrices[businessManufacturer][field.key]
                            : (MANUFACTURER_COSTS[field.key] || 0);

                          const totalRevenue = unitRevenue * quantity;
                          const totalCost = unitCost * quantity;

                          return { field, quantity, unitRevenue, unitCost, totalRevenue, totalCost };
                        });

                      if (equipmentList.length === 0) {
                        return (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                            등록된 기기 정보가 없습니다.
                          </div>
                        );
                      }

                      const businessManufacturer = selectedEquipmentBusiness.manufacturer || 'ecosense';
                      const totals = equipmentList.reduce((acc, item) => {
                        acc.totalRevenue += item.totalRevenue;
                        acc.totalCost += item.totalCost;
                        return acc;
                      }, { totalRevenue: 0, totalCost: 0 });

                      return (
                        <>
                          {equipmentList.map(({ field, quantity, unitRevenue, unitCost, totalRevenue, totalCost }) => (
                            <div key={field.key} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                              <div className="flex items-start justify-between mb-2">
                                <h5 className="font-semibold text-gray-900">{field.name}</h5>
                                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">{quantity}대</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <div className="text-gray-500">매출단가</div>
                                  <div className="font-mono font-medium text-green-700">{unitRevenue.toLocaleString()}원</div>
                                </div>
                                <div>
                                  <div className="text-gray-500">매입단가</div>
                                  <div className="font-mono font-medium text-red-700">{unitCost.toLocaleString()}원</div>
                                </div>
                                <div>
                                  <div className="text-gray-500">매출합계</div>
                                  <div className="font-mono font-semibold text-green-700">{totalRevenue.toLocaleString()}원</div>
                                </div>
                                <div>
                                  <div className="text-gray-500">매입합계</div>
                                  <div className="font-mono font-semibold text-red-700">{totalCost.toLocaleString()}원</div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* 합계 카드 */}
                          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                            <h5 className="font-bold text-blue-900 mb-2">합계</h5>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <div className="text-blue-700 font-medium">총 매출</div>
                                <div className="font-mono font-bold text-blue-900">{totals.totalRevenue.toLocaleString()}원</div>
                              </div>
                              <div>
                                <div className="text-red-700 font-medium">총 매입</div>
                                <div className="font-mono font-bold text-red-900">{totals.totalCost.toLocaleString()}원</div>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* 데스크톱 테이블뷰 */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">기기명</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">수량</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">매출단가</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">매입단가</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">매출합계</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">매입합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const equipmentFields = [
                            { key: 'ph_meter', name: 'PH센서' },
                            { key: 'differential_pressure_meter', name: '차압계' },
                            { key: 'temperature_meter', name: '온도계' },
                            { key: 'discharge_current_meter', name: '배출전류계' },
                            { key: 'fan_current_meter', name: '송풍전류계' },
                            { key: 'pump_current_meter', name: '펌프전류계' },
                            { key: 'gateway', name: '게이트웨이' },
                            { key: 'vpn_wired', name: 'VPN(유선)' },
                            { key: 'vpn_wireless', name: 'VPN(무선)' },
                            { key: 'explosion_proof_differential_pressure_meter_domestic', name: '방폭차압계(국산)' },
                            { key: 'explosion_proof_temperature_meter_domestic', name: '방폭온도계(국산)' },
                            { key: 'expansion_device', name: '확장디바이스' },
                            { key: 'relay_8ch', name: '중계기(8채널)' },
                            { key: 'relay_16ch', name: '중계기(16채널)' },
                            { key: 'main_board_replacement', name: '메인보드교체' },
                            { key: 'multiple_stack', name: '복수굴뚝' }
                          ];

                          const equipmentList = equipmentFields
                            .filter(field => {
                              const quantity = selectedEquipmentBusiness[field.key];
                              return quantity && quantity > 0;
                            })
                            .map(field => {
                              const quantity = selectedEquipmentBusiness[field.key];
                              const businessManufacturer = selectedEquipmentBusiness.manufacturer || 'ecosense';

                              // 동적 가격 사용 (0원도 유효한 값이므로 !== undefined로 확인)
                              const unitRevenue = (pricesLoaded && officialPrices[field.key] !== undefined)
                                ? officialPrices[field.key]
                                : (OFFICIAL_PRICES[field.key] || 0);

                              const unitCost = (pricesLoaded && manufacturerPrices[businessManufacturer]?.[field.key] !== undefined)
                                ? manufacturerPrices[businessManufacturer][field.key]
                                : (MANUFACTURER_COSTS[field.key] || 0);

                              const totalRevenue = unitRevenue * quantity;
                              const totalCost = unitCost * quantity;

                              return (
                                <tr key={field.key} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-4 py-2">{field.name}</td>
                                  <td className="border border-gray-300 px-4 py-2 text-center font-medium">{quantity}대</td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-mono text-sm">
                                    {unitRevenue.toLocaleString()}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-mono text-sm text-red-600">
                                    {unitCost.toLocaleString()}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-mono font-medium">
                                    {totalRevenue.toLocaleString()}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-mono font-medium text-red-700">
                                    {totalCost.toLocaleString()}
                                  </td>
                                </tr>
                              );
                            });

                          if (equipmentList.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} className="border border-gray-300 px-4 py-6 text-center text-gray-500">
                                  등록된 기기 정보가 없습니다.
                                </td>
                              </tr>
                            );
                          }

                          const totalEquipment = equipmentFields.reduce((sum, field) => {
                            return sum + (selectedEquipmentBusiness[field.key] || 0);
                          }, 0);

                          const businessManufacturer = selectedEquipmentBusiness.manufacturer || 'ecosense';

                          const totals = equipmentFields.reduce((acc, field) => {
                            const quantity = selectedEquipmentBusiness[field.key] || 0;
                            if (quantity > 0) {
                              const unitRevenue = (pricesLoaded && officialPrices[field.key] !== undefined)
                                ? officialPrices[field.key]
                                : (OFFICIAL_PRICES[field.key] || 0);

                              const unitCost = (pricesLoaded && manufacturerPrices[businessManufacturer]?.[field.key] !== undefined)
                                ? manufacturerPrices[businessManufacturer][field.key]
                                : (MANUFACTURER_COSTS[field.key] || 0);

                              acc.totalRevenue += unitRevenue * quantity;
                              acc.totalCost += unitCost * quantity;
                            }
                            return acc;
                          }, { totalRevenue: 0, totalCost: 0 });

                          return (
                            <>
                              {equipmentList}
                              <tr className="bg-blue-50 font-bold">
                                <td className="border border-gray-300 px-4 py-2" colSpan={4}>합계</td>
                                <td className="border border-gray-300 px-4 py-2 text-right font-mono text-blue-700">
                                  {totals.totalRevenue.toLocaleString()}원
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-right font-mono text-red-700">
                                  {totals.totalCost.toLocaleString()}원
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500">
                      * 매출단가: 환경부 고시가 기준
                    </p>
                    <p className="text-xs text-gray-500">
                      * 매입단가: <span className="font-semibold">{selectedEquipmentBusiness.manufacturer || 'ecosense'}</span> 제조사 원가 기준
                    </p>
                    <p className="text-xs text-blue-600">
                      💡 가격출처: {pricesLoaded ? '데이터베이스 (최신 원가)' : '기본값 (하드코딩)'}
                    </p>
                  </div>
                </div>

                {/* 추가 비용 정보 */}
                <div className="mt-4 md:mt-6">
                  <h4 className="text-sm md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">추가 비용 정보</h4>
                  <div className="bg-gray-50 rounded-lg p-3 md:p-4 space-y-2 md:space-y-3">
                    <div className="flex items-center justify-between py-1.5 md:py-2 border-b border-gray-200">
                      <span className="text-xs md:text-sm font-medium text-gray-700">추가공사비</span>
                      <span className="text-sm md:text-base font-semibold text-green-700">
                        {selectedEquipmentBusiness.additional_cost
                          ? `+${formatCurrency(selectedEquipmentBusiness.additional_cost)}`
                          : '₩0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 md:py-2">
                      <span className="text-xs md:text-sm font-medium text-gray-700">협의사항 (할인 금액)</span>
                      <span className="text-sm md:text-base font-semibold text-red-700">
                        {selectedEquipmentBusiness.negotiation
                          ? `-${formatCurrency(selectedEquipmentBusiness.negotiation)}`
                          : '₩0'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 계산서 및 입금 현황 */}
                {selectedEquipmentBusiness.id && (
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 md:p-6 border border-purple-200">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-purple-600 rounded-lg mr-3">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-base md:text-lg font-semibold text-slate-800">계산서 및 입금 현황 (미수금 관리)</h3>
                    </div>
                    <InvoiceDisplay
                      businessId={selectedEquipmentBusiness.id}
                      businessCategory={selectedEquipmentBusiness.category || selectedEquipmentBusiness.business_category || selectedEquipmentBusiness.progress_status}
                      additionalCost={selectedEquipmentBusiness.additional_cost}
                    />
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-gray-50 px-3 md:px-6 py-3 md:py-4 border-t border-gray-200">
                <button
                  onClick={async () => {
                    setShowEquipmentModal(false);
                    // 모달 닫을 때 매출 데이터 자동 새로고침
                    console.log('🔄 [MODAL-CLOSE] 모달 닫힘, 매출 데이터 새로고침 시작');
                    await loadCalculations();
                    console.log('✅ [MODAL-CLOSE] 매출 데이터 새로고침 완료');
                  }}
                  className="w-full px-4 py-2 md:py-3 text-sm md:text-base bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedPage>
  );
}

// 새로운 AuthGuard 시스템 적용 완료
export default RevenueDashboard;