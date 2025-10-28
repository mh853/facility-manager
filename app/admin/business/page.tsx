// app/admin/business/page.tsx - 사업장 관리 페이지
'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { BusinessInfo } from '@/lib/database-service'
import type { BusinessMemo, CreateBusinessMemoInput, UpdateBusinessMemoInput } from '@/types/database'
import { getBusinessTaskStatus, getBatchBusinessTaskStatuses, getTaskSummary } from '@/lib/business-task-utils'
import { supabase } from '@/lib/supabase'
import BusinessRevenueModal from '@/components/business/BusinessRevenueModal'
import { useAuth } from '@/contexts/AuthContext'
import { TokenManager } from '@/lib/api-client'
import { getManufacturerName } from '@/constants/manufacturers'

interface Contact {
  name: string;
  position: string;
  phone: string;
  role: string;
}

interface FacilitySummary {
  discharge_count: number;
  prevention_count: number;
  total_facilities: number;
}

interface BusinessFacilityData {
  business: {
    id: string;
    business_name: string;
  } | null;
  discharge_facilities: Array<{
    id: string;
    outlet_number: number;
    outlet_name: string;
    facility_number: number;
    facility_name: string;
    capacity: string;
    quantity: number;
    display_name: string;
  }>;
  prevention_facilities: Array<{
    id: string;
    outlet_number: number;
    outlet_name: string;
    facility_number: number;
    facility_name: string;
    capacity: string;
    quantity: number;
    display_name: string;
  }>;
  summary: FacilitySummary;
}

interface UnifiedBusinessInfo {
  // Base fields from BusinessInfo
  id: string;
  created_at: string;
  updated_at: string;
  business_name: string;
  local_government: string | null;
  address: string | null;
  manager_name: string | null;
  manager_position: string | null;
  manager_contact: string | null;
  business_contact: string | null;
  fax_number: string | null;
  email: string | null;
  representative_name: string | null;
  business_registration_number: string | null;
  
  // 프로젝트 관리 필드들
  row_number?: number | null;
  department?: string | null;
  progress_status?: string | null;
  project_year?: number | null;
  contract_document?: string | null;
  order_request_date?: string | null;
  wireless_document?: string | null;
  installation_support?: string | null;
  order_manager?: string | null;
  order_date?: string | null;
  shipment_date?: string | null;
  inventory_check?: string | null;
  installation_date?: string | null;
  installation_team?: string | null;
  business_type?: string | null;
  business_category?: string | null;
  pollutants?: string | null;
  annual_emission_amount?: number | null;
  first_report_date?: string | null;
  operation_start_date?: string | null;
  subsidy_approval_date?: string | null;
  expansion_pack?: number | null;
  other_equipment?: string | null;
  additional_cost?: number | null;
  installation_extra_cost?: number | null;  // 추가설치비 (설치팀 요청 추가 비용)
  negotiation?: string | null;
  multiple_stack_cost?: number | null;
  representative_birth_date?: string | null;

  // 계산서 및 입금 정보 - 보조금 사업장 (3개)
  invoice_1st_date?: string | null;
  invoice_1st_amount?: number | null;
  payment_1st_date?: string | null;
  payment_1st_amount?: number | null;

  invoice_2nd_date?: string | null;
  invoice_2nd_amount?: number | null;
  payment_2nd_date?: string | null;
  payment_2nd_amount?: number | null;

  invoice_additional_date?: string | null;
  payment_additional_date?: string | null;
  payment_additional_amount?: number | null;

  // 계산서 및 입금 정보 - 자비 사업장 (2개)
  invoice_advance_date?: string | null;
  invoice_advance_amount?: number | null;
  payment_advance_date?: string | null;
  payment_advance_amount?: number | null;

  invoice_balance_date?: string | null;
  invoice_balance_amount?: number | null;
  payment_balance_date?: string | null;
  payment_balance_amount?: number | null;

  // 실사 관리 필드
  estimate_survey_manager?: string | null;
  estimate_survey_date?: string | null;
  pre_construction_survey_manager?: string | null;
  pre_construction_survey_date?: string | null;
  completion_survey_manager?: string | null;
  completion_survey_date?: string | null;

  // 시스템 필드들
  manufacturer?: 'ecosense' | 'cleanearth' | 'gaia_cns' | 'evs' | null;
  vpn?: 'wired' | 'wireless' | null;
  greenlink_id?: string | null;
  greenlink_pw?: string | null;
  business_management_code?: number | null;
  
  // 센서/장비 수량 필드들
  ph_meter?: number | null;
  differential_pressure_meter?: number | null;
  temperature_meter?: number | null;
  discharge_current_meter?: number | null;
  fan_current_meter?: number | null;
  pump_current_meter?: number | null;
  gateway?: number | null;
  vpn_wired?: number | null;
  vpn_wireless?: number | null;
  explosion_proof_differential_pressure_meter_domestic?: number | null;
  explosion_proof_temperature_meter_domestic?: number | null;
  expansion_device?: number | null;
  relay_8ch?: number | null;
  relay_16ch?: number | null;
  main_board_replacement?: number | null;
  multiple_stack?: number | null;
  
  // 영업점
  sales_office?: string | null;
  
  // 시설 요약 정보
  facility_summary?: {
    outlets?: Array<{
      outlet: number;
      discharge_count: number;
      prevention_count: number;
      discharge_facilities: string[];
      prevention_facilities: string[];
    }>;
    totals?: {
      total_outlets: number;
      total_discharge: number;
      total_prevention: number;
    };
    last_updated?: string;
  } | null;
  
  additional_info?: Record<string, any>;
  is_active: boolean;
  is_deleted: boolean;
  
  // Korean display fields
  사업장명: string;
  주소: string;
  담당자명: string;
  담당자연락처: string;
  담당자직급: string;
  contacts?: Contact[];
  대표자: string;
  사업자등록번호: string;
  업종: string;
  사업장연락처: string;
  상태: string;
  현재단계?: string;
  PH센서?: number;
  차압계?: number;
  온도계?: number;
  배출전류계?: number;
  송풍전류계?: number;
  펌프전류계?: number;
  게이트웨이?: number;
  VPN유선?: number;
  VPN무선?: number;
  복수굴뚝?: number;
  방폭차압계국산?: number;
  방폭온도계국산?: number;
  확장디바이스?: number;
  중계기8채널?: number;
  중계기16채널?: number;
  메인보드교체?: number;
  등록일: string;
  수정일: string;
  지자체?: string;
  팩스번호?: string;
  이메일?: string;
  사업장관리코드?: number;
  그린링크ID?: string;
  그린링크PW?: string;
  영업점?: string;
  files?: any | null;
  hasFiles: boolean;
  fileCount: number;
}
import * as XLSX from 'xlsx'
import AdminLayout from '@/components/ui/AdminLayout'
import { withAuth, usePermission } from '@/contexts/AuthContext'
import StatsCard from '@/components/ui/StatsCard'
import DataTable, { commonActions } from '@/components/ui/DataTable'
import { ConfirmModal } from '@/components/ui/Modal'
import TaskProgressMiniBoard from '@/components/business/TaskProgressMiniBoard'
import { InvoiceDisplay } from '@/components/business/InvoiceDisplay'
import { InvoiceFormInput } from '@/components/business/InvoiceFormInput'
import {
  Users,
  FileText,
  Database,
  History,
  RefreshCw,
  Download,
  Upload,
  X,
  Plus,
  Building2,
  UserCheck,
  Clock,
  Eye,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Mail,
  User,
  Calendar,
  Building,
  Briefcase,
  Contact,
  Shield,
  Hash,
  Factory,
  Filter,
  Settings,
  ClipboardList,
  AlertTriangle,
  Search,
  MessageSquarePlus,
  Edit3,
  MessageSquare,
  Save,
  Calculator,
  FileCheck,
  DollarSign,
  Wallet,
  Receipt
} from 'lucide-react'

// 대한민국 지자체 목록
const KOREAN_LOCAL_GOVERNMENTS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원도', '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
  '서울시 종로구', '서울시 중구', '서울시 용산구', '서울시 성동구', '서울시 광진구', '서울시 동대문구',
  '서울시 중랑구', '서울시 성북구', '서울시 강북구', '서울시 도봉구', '서울시 노원구', '서울시 은평구',
  '서울시 서대문구', '서울시 마포구', '서울시 양천구', '서울시 강서구', '서울시 구로구', '서울시 금천구',
  '서울시 영등포구', '서울시 동작구', '서울시 관악구', '서울시 서초구', '서울시 강남구', '서울시 송파구',
  '서울시 강동구', '부산시 중구', '부산시 서구', '부산시 동구', '부산시 영도구', '부산시 부산진구',
  '부산시 동래구', '부산시 남구', '부산시 북구', '부산시 해운대구', '부산시 사하구', '부산시 금정구',
  '부산시 강서구', '부산시 연제구', '부산시 수영구', '부산시 사상구', '대구시 중구', '대구시 동구',
  '대구시 서구', '대구시 남구', '대구시 북구', '대구시 수성구', '대구시 달서구', '대구시 달성군',
  '인천시 중구', '인천시 동구', '인천시 미추홀구', '인천시 연수구', '인천시 남동구', '인천시 부평구',
  '인천시 계양구', '인천시 서구', '인천시 강화군', '인천시 옹진군'
].sort()

// 진행구분을 보조금/자비로 매핑하는 헬퍼 함수
const mapCategoryToInvoiceType = (category: string | null | undefined): '보조금' | '자비' => {
  const normalized = category?.trim() || '';

  // 보조금 처리
  if (normalized === '보조금' || normalized === '보조금 동시진행') {
    return '보조금';
  }

  // 자비 처리: 자비, 대리점, AS
  if (normalized === '자비' || normalized === '대리점' || normalized === 'AS') {
    return '자비';
  }

  // 기본값: 자비
  return '자비';
};

function BusinessManagementPage() {
  // 권한 확인 훅
  const { canDeleteAutoMemos } = usePermission()
  const { user } = useAuth()
  const userPermission = user?.permission_level || 0

  // URL 파라미터 처리
  const searchParams = useSearchParams()

  const [allBusinesses, setAllBusinesses] = useState<UnifiedBusinessInfo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<UnifiedBusinessInfo | null>(null)
  const [formData, setFormData] = useState<Partial<UnifiedBusinessInfo>>({})
  const [localGovSuggestions, setLocalGovSuggestions] = useState<string[]>([])
  const [showLocalGovSuggestions, setShowLocalGovSuggestions] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<UnifiedBusinessInfo | null>(null)
  const [facilityData, setFacilityData] = useState<BusinessFacilityData | null>(null)
  const [facilityLoading, setFacilityLoading] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [duplicateCheck, setDuplicateCheck] = useState<{
    isDuplicate: boolean
    exactMatch: UnifiedBusinessInfo | null
    similarMatches: UnifiedBusinessInfo[]
    message: string
  } | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [businessToDelete, setBusinessToDelete] = useState<UnifiedBusinessInfo | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [facilityStats, setFacilityStats] = useState<{[businessId: string]: {dischargeCount: number, preventionCount: number, outletCount: number}}>({})
  const [facilityDeviceCounts, setFacilityDeviceCounts] = useState<{
    ph?: number, 
    pressure?: number, 
    temperature?: number, 
    discharge?: number, 
    fan?: number, 
    pump?: number, 
    gateway?: number,
    explosionProofPressure?: number,
    explosionProofTemp?: number,
    expansionDevice?: number,
    relay8ch?: number,
    relay16ch?: number,
    mainBoard?: number,
    vpnWired?: number,
    vpnWireless?: number,
    multipleStack?: number
  } | null>(null)

  // 매출 정보 state
  const [revenueData, setRevenueData] = useState<{
    total_revenue?: number;
    total_cost?: number;
    gross_profit?: number;
    net_profit?: number;
    profit_margin_percentage?: number;
    sales_commission?: number;
    commission_rate?: number; // 실제 적용된 수수료 비율
    survey_costs?: number; // 실사비용
  } | null>(null)
  const [revenueLoading, setRevenueLoading] = useState(false)

  // 영업점별 수수료 정보 state
  const [salesOfficeCommissions, setSalesOfficeCommissions] = useState<{
    [salesOffice: string]: number; // 영업점명 -> 수수료 비율(%)
  }>({})
  const [commissionsLoading, setCommissionsLoading] = useState(false)

  // 실사비용 정보 state
  const [surveyCosts, setSurveyCosts] = useState<{
    estimate: number; // 견적실사
    pre_construction: number; // 착공전실사
    completion: number; // 준공실사
    total: number; // 합계
  }>({
    estimate: 100000,
    pre_construction: 150000,
    completion: 200000,
    total: 450000
  })
  const [surveyCostsLoading, setSurveyCostsLoading] = useState(false)

  // 제조사별 원가 정보 state
  const [manufacturerCosts, setManufacturerCosts] = useState<{
    [equipmentType: string]: number; // 기기 타입 -> 원가
  }>({})
  const [manufacturerCostsLoading, setManufacturerCostsLoading] = useState(false)

  // Revenue 모달 state
  const [showRevenueModal, setShowRevenueModal] = useState(false)
  const [selectedRevenueBusiness, setSelectedRevenueBusiness] = useState<UnifiedBusinessInfo | null>(null)

  // 영업점별 수수료 정보 로드
  useEffect(() => {
    const loadSalesOfficeCommissions = async () => {
      console.log('🔄 영업점 수수료 로드 시작...')
      setCommissionsLoading(true)
      try {
        const { data, error } = await supabase
          .from('sales_office_cost_settings')
          .select('sales_office, commission_percentage, is_active, effective_from')
          .eq('is_active', true)
          .order('effective_from', { ascending: false })

        console.log('📊 Supabase 응답:', { data, error })

        if (error) {
          console.error('❌ 영업점 수수료 로드 실패:', error)
          return
        }

        if (data && data.length > 0) {
          console.log('✅ 조회된 데이터 개수:', data.length)
          console.log('📋 조회된 원본 데이터:', data)

          // 영업점별로 가장 최신 수수료 정보만 저장
          const commissionMap: { [key: string]: number } = {}
          data.forEach((item: any) => {
            if (!commissionMap[item.sales_office]) {
              commissionMap[item.sales_office] = item.commission_percentage || 10.0
              console.log(`  → ${item.sales_office}: ${item.commission_percentage}%`)
            }
          })
          setSalesOfficeCommissions(commissionMap)
          console.log('✅ 영업점별 수수료 로드 완료:', commissionMap)
        } else {
          console.warn('⚠️ 조회된 데이터가 없습니다')
        }
      } catch (error) {
        console.error('❌ 영업점 수수료 로드 오류:', error)
      } finally {
        setCommissionsLoading(false)
      }
    }

    loadSalesOfficeCommissions()
  }, [])

  // 실사비용 정보 로드
  useEffect(() => {
    const loadSurveyCosts = async () => {
      console.log('🔄 실사비용 로드 시작...')
      setSurveyCostsLoading(true)
      try {
        const { data, error } = await supabase
          .from('survey_cost_settings')
          .select('survey_type, base_cost, is_active')
          .eq('is_active', true)
          .order('effective_from', { ascending: false })

        console.log('📊 실사비용 Supabase 응답:', { data, error })

        if (error) {
          console.error('❌ 실사비용 로드 실패:', error)
          return
        }

        if (data && data.length > 0) {
          console.log('✅ 조회된 실사비용 데이터:', data)

          // 실사 유형별로 최신 비용 저장
          const costs = {
            estimate: 100000,
            pre_construction: 150000,
            completion: 200000,
            total: 450000
          }

          data.forEach((item: any) => {
            const baseCost = Number(item.base_cost) || 0
            if (item.survey_type === 'estimate') {
              costs.estimate = baseCost
            } else if (item.survey_type === 'pre_construction') {
              costs.pre_construction = baseCost
            } else if (item.survey_type === 'completion') {
              costs.completion = baseCost
            }
          })

          costs.total = costs.estimate + costs.pre_construction + costs.completion

          setSurveyCosts(costs)
          console.log('✅ 실사비용 로드 완료:', costs)
        } else {
          console.warn('⚠️ 실사비용 데이터가 없습니다 - 기본값 사용')
        }
      } catch (error) {
        console.error('❌ 실사비용 로드 오류:', error)
      } finally {
        setSurveyCostsLoading(false)
      }
    }

    loadSurveyCosts()
  }, [])

  // 제조사별 원가 정보 로드
  useEffect(() => {
    const loadManufacturerCosts = async () => {
      console.log('🔄 제조사별 원가 로드 시작...')
      setManufacturerCostsLoading(true)
      try {
        const token = TokenManager.getToken()
        if (!token) {
          console.warn('⚠️ 인증 토큰이 없습니다')
          return
        }

        // API를 통해 제조사별 원가 조회 (영어 코드 → 한글 이름 변환)
        const manufacturerName = getManufacturerName('cleanearth') // 'cleanearth' → '크린어스'
        console.log('🔍 조회할 제조사:', manufacturerName)
        const response = await fetch(`/api/revenue/manufacturer-pricing?manufacturer=${encodeURIComponent(manufacturerName)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          console.error('❌ 제조사별 원가 API 호출 실패:', response.status)
          return
        }

        const result = await response.json()
        console.log('📊 제조사별 원가 API 응답:', result)

        if (result.success && result.data?.pricing && result.data.pricing.length > 0) {
          console.log('✅ 조회된 제조사별 원가 데이터:', result.data.pricing)

          // 기기 타입별로 최신 원가 저장
          const costsMap: { [key: string]: number } = {}
          result.data.pricing.forEach((item: any) => {
            if (!costsMap[item.equipment_type]) {
              costsMap[item.equipment_type] = Number(item.cost_price) || 0
            }
          })

          setManufacturerCosts(costsMap)
          console.log('✅ 제조사별 원가 로드 완료:', costsMap)
        } else {
          console.warn('⚠️ 제조사별 원가 데이터가 없습니다 - MANUFACTURER_COSTS 상수 사용')
        }
      } catch (error) {
        console.error('❌ 제조사별 원가 로드 오류:', error)
      } finally {
        setManufacturerCostsLoading(false)
      }
    }

    loadManufacturerCosts()
  }, [])

  // 시설 통계 계산 함수
  const calculateFacilityStats = useCallback((airPermitData: any[]) => {
    const stats: {[businessId: string]: {dischargeCount: number, preventionCount: number, outletCount: number}} = {}
    
    airPermitData.forEach((permit: any) => {
      if (!permit.business_id || !permit.outlets) return
      
      const businessId = permit.business_id
      if (!stats[businessId]) {
        stats[businessId] = { dischargeCount: 0, preventionCount: 0, outletCount: 0 }
      }
      
      permit.outlets.forEach((outlet: any) => {
        stats[businessId].outletCount += 1
        stats[businessId].dischargeCount += (outlet.discharge_facilities?.length || 0)
        stats[businessId].preventionCount += (outlet.prevention_facilities?.length || 0)
      })
    })
    
    return stats
  }, [])
  
  // 특정 사업장의 시설 통계 조회
  const loadBusinessFacilityStats = useCallback(async (businessId: string) => {
    try {
      const response = await fetch(`/api/air-permit?businessId=${businessId}&details=true`)
      if (response.ok) {
        const result = await response.json()
        const permits = result.data || []
        const stats = calculateFacilityStats(permits)
        
        setFacilityStats(prev => ({
          ...prev,
          ...stats
        }))
      }
    } catch (error) {
      console.error('시설 통계 로드 실패:', error)
    }
  }, [calculateFacilityStats])

  // 사업장별 시설 정보 조회
  const loadBusinessFacilities = useCallback(async (businessName: string) => {
    setFacilityLoading(true)
    try {
      const encodedBusinessName = encodeURIComponent(businessName)
      const response = await fetch(`/api/facilities-supabase/${encodedBusinessName}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          // facilities-supabase API 데이터를 BusinessFacilityData 형식으로 변환
          const facilityApiData = result.data
          const transformedData: BusinessFacilityData = {
            business: {
              id: facilityApiData.businessInfo?.businessName || businessName,
              business_name: businessName
            },
            discharge_facilities: facilityApiData.facilities?.discharge?.map((facility: any) => ({
              id: `discharge-${facility.outlet}-${facility.number}`,
              outlet_number: facility.outlet || 1,
              outlet_name: `배출구 ${facility.outlet || 1}`,
              facility_number: facility.number || 1,
              facility_name: facility.name || '배출시설',
              capacity: facility.capacity || '',
              quantity: facility.quantity || 1,
              display_name: facility.displayName || `배출구${facility.outlet}-배출시설${facility.number}`
            })) || [],
            prevention_facilities: facilityApiData.facilities?.prevention?.map((facility: any) => ({
              id: `prevention-${facility.outlet}-${facility.number}`,
              outlet_number: facility.outlet || 1,
              outlet_name: `배출구 ${facility.outlet || 1}`,
              facility_number: facility.number || 1,
              facility_name: facility.name || '방지시설',
              capacity: facility.capacity || '',
              quantity: facility.quantity || 1,
              display_name: facility.displayName || `배출구${facility.outlet}-방지시설${facility.number}`
            })) || [],
            summary: {
              discharge_count: facilityApiData.dischargeCount || 0,
              prevention_count: facilityApiData.preventionCount || 0,
              total_facilities: (facilityApiData.dischargeCount || 0) + (facilityApiData.preventionCount || 0)
            }
          }
          setFacilityData(transformedData)
        } else {
          setFacilityData(null)
        }
      } else {
        setFacilityData(null)
      }
    } catch (error) {
      console.error('사업장 시설 정보 로드 실패:', error)
      setFacilityData(null)
    } finally {
      setFacilityLoading(false)
    }
  }, [])

  // 환경부 고시가 (매출 단가)
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
  }

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
  }

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
  }

  const EQUIPMENT_FIELDS = [
    'ph_meter', 'differential_pressure_meter', 'temperature_meter',
    'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
    'gateway', 'vpn_wired', 'vpn_wireless',
    'explosion_proof_differential_pressure_meter_domestic',
    'explosion_proof_temperature_meter_domestic', 'expansion_device',
    'relay_8ch', 'relay_16ch', 'main_board_replacement', 'multiple_stack'
  ]

  // 사업장별 매출/매입/이익 자동 계산 함수 (매출관리 페이지와 동일)
  const calculateBusinessRevenue = useCallback((business: UnifiedBusinessInfo, commissions?: { [key: string]: number }) => {
    const commissionsToUse = commissions || salesOfficeCommissions
    let totalRevenue = 0
    let totalCost = 0
    let totalInstallation = 0

    // 각 기기별 매출/매입 계산
    console.log('🔍 [원가 계산] 제조사별 원가 상태:', manufacturerCosts)
    console.log('🔍 [원가 계산] 하드코딩 상수:', MANUFACTURER_COSTS)

    EQUIPMENT_FIELDS.forEach(field => {
      const quantity = (business as any)[field] || 0
      if (quantity > 0) {
        const unitRevenue = OFFICIAL_PRICES[field] || 0
        // 제조사별 원가: state에서 가져오고, 없으면 하드코딩 상수 사용
        const unitCost = manufacturerCosts[field] || MANUFACTURER_COSTS[field] || 0
        const unitInstallation = INSTALLATION_COSTS[field] || 0

        console.log(`🔍 [원가 계산] ${field}: 수량=${quantity}, 매출=${unitRevenue}, 원가=${unitCost}, 설치비=${unitInstallation}`)

        totalRevenue += unitRevenue * quantity
        totalCost += unitCost * quantity
        totalInstallation += unitInstallation * quantity
      }
    })

    // 추가공사비 및 협의사항 반영 (문자열을 숫자로 변환)
    const additionalCost = business.additional_cost
      ? (typeof business.additional_cost === 'string'
          ? parseInt(business.additional_cost.replace(/,/g, '')) || 0
          : business.additional_cost || 0)
      : 0
    const negotiation = business.negotiation
      ? (typeof business.negotiation === 'string'
          ? parseFloat(business.negotiation.replace(/,/g, '')) || 0
          : business.negotiation || 0)
      : 0

    // 최종 매출 = 기본 매출 + 추가공사비 - 협의사항
    const adjustedRevenue = totalRevenue + additionalCost - negotiation

    // 영업비용 - 영업점별 수수료 비율 적용
    const salesOffice = business.sales_office || business.영업점 || ''
    let commissionRate = 0
    let salesCommission = 0

    if (salesOffice && salesOffice.trim() !== '') {
      // 영업점 정보가 있는 경우
      console.log('📊 [수수료 계산] 사업장:', business.사업장명 || business.business_name)
      console.log('📊 [수수료 계산] 영업점:', salesOffice)
      console.log('📊 [수수료 계산] 로드된 수수료 정보:', commissionsToUse)

      if (commissionsToUse[salesOffice] !== undefined) {
        // 원가관리에 설정된 수수료율 사용
        commissionRate = commissionsToUse[salesOffice]
        console.log('📊 [수수료 계산] 설정된 수수료율 사용:', commissionRate + '%')
      } else {
        // 원가관리에 설정이 없으면 기본 10%
        commissionRate = 10.0
        console.log('📊 [수수료 계산] 기본 10% 적용 (원가관리 설정 없음)')
      }
      salesCommission = adjustedRevenue * (commissionRate / 100)
    } else {
      // 영업점 정보가 없으면 수수료 없음 (0%)
      commissionRate = 0
      salesCommission = 0
      console.log('📊 [수수료 계산] 영업점 미설정 - 수수료 0%')
    }

    // 실사비용 (state에서 가져오기)
    const totalSurveyCosts = surveyCosts.total

    // 총 이익 = 매출 - 매입 - 설치비 - 영업비용 - 실사비용
    const grossProfit = adjustedRevenue - totalCost
    const netProfit = grossProfit - salesCommission - totalSurveyCosts - totalInstallation

    // 이익률 계산
    const profitMarginPercentage = adjustedRevenue > 0
      ? ((netProfit / adjustedRevenue) * 100)
      : 0

    return {
      total_revenue: adjustedRevenue,
      total_cost: totalCost,
      gross_profit: grossProfit,
      net_profit: netProfit,
      profit_margin_percentage: profitMarginPercentage,
      sales_commission: salesCommission,
      commission_rate: commissionRate,
      survey_costs: totalSurveyCosts // 실사비용 추가
    }
  }, [salesOfficeCommissions, surveyCosts, manufacturerCosts])

  // 매출 정보 로드 함수 - 클라이언트 측 직접 계산으로 변경
  const loadRevenueData = useCallback(async (business: UnifiedBusinessInfo) => {
    setRevenueLoading(true)
    console.log('📊 매출 정보 계산 시작:', business.사업장명)

    try {
      // 수수료 정보 로드 (항상 최신 정보 사용)
      let currentCommissions = salesOfficeCommissions

      console.log('🔍 현재 수수료 정보 상태:', currentCommissions)

      if (Object.keys(currentCommissions).length === 0) {
        console.log('⚠️ 수수료 정보 미로드 - 지금 로드 시작')
        try {
          // 먼저 조건 없이 전체 조회 (디버깅)
          const { data: allData, error: allError } = await supabase
            .from('sales_office_cost_settings')
            .select('*')

          console.log('🔍 전체 데이터 조회 (조건 없음):', { allData, allError })

          const { data, error } = await supabase
            .from('sales_office_cost_settings')
            .select('sales_office, commission_percentage')
            .eq('is_active', true)
            .order('effective_from', { ascending: false })

          console.log('📊 즉시 로드 응답 (is_active=true):', { data, error })

          if (!error && data && data.length > 0) {
            const commissionMap: { [key: string]: number } = {}
            data.forEach((item: any) => {
              if (!commissionMap[item.sales_office]) {
                commissionMap[item.sales_office] = item.commission_percentage || 10.0
                console.log(`  ✓ ${item.sales_office}: ${item.commission_percentage}%`)
              }
            })
            setSalesOfficeCommissions(commissionMap)
            currentCommissions = commissionMap // 즉시 사용
            console.log('✅ 수수료 정보 즉시 로드 완료:', commissionMap)
          } else {
            console.log('⚠️ 수수료 데이터 없음 또는 에러:', error)
          }
        } catch (err) {
          console.error('❌ 수수료 정보 즉시 로드 실패:', err)
        }
      }

      // 현재 수수료 정보를 사용해서 계산
      const salesOffice = business.sales_office || business.영업점 || ''
      console.log('💰 계산에 사용할 영업점:', salesOffice)
      console.log('💰 사용할 수수료 맵:', currentCommissions)

      const calculatedRevenue = calculateBusinessRevenue(business, currentCommissions)
      console.log('📊 계산된 매출 정보:', calculatedRevenue)
      setRevenueData(calculatedRevenue)
    } catch (error) {
      console.error('📊 매출 정보 계산 실패:', error)
      setRevenueData(null)
    } finally {
      setRevenueLoading(false)
    }
  }, [calculateBusinessRevenue, salesOfficeCommissions])

  // 대기필증 관련 상태
  const [airPermitData, setAirPermitData] = useState<{
    business_type: string
    category: string
    permits: Array<{
      id: string
      business_type: string
      additional_info?: {
        category?: string
      }
    }>
  } | null>(null)
  const [airPermitLoading, setAirPermitLoading] = useState(false)
  
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<{
    total: number
    success: number
    failed: number
    errors: string[]
    created?: number
    updated?: number
  } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  // 메모 관련 상태
  const [businessMemos, setBusinessMemos] = useState<BusinessMemo[]>([])

  // businessMemos state 변경 추적
  useEffect(() => {
    console.log('🔧 [FRONTEND] businessMemos state 변경됨:', businessMemos.length, '개', businessMemos)
  }, [businessMemos])
  const [isAddingMemo, setIsAddingMemo] = useState(false)
  const [editingMemo, setEditingMemo] = useState<BusinessMemo | null>(null)
  const [memoForm, setMemoForm] = useState({ title: '', content: '' })
  const [isLoadingMemos, setIsLoadingMemos] = useState(false)

  // 업무 관련 상태
  const [businessTasks, setBusinessTasks] = useState<any[]>([])

  // 사업장별 업무 상태 정보
  const [businessTaskStatuses, setBusinessTaskStatuses] = useState<{
    [businessName: string]: {
      statusText: string
      colorClass: string
      lastUpdated: string
      taskCount: number
      hasActiveTasks: boolean
    }
  }>({})
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)

  // 🔄 검색 로딩 상태 (검색시 현재 단계 로딩용)
  const [isSearchLoading, setIsSearchLoading] = useState(false)

  // 필터 상태
  const [filterOffice, setFilterOffice] = useState<string>('')
  const [filterRegion, setFilterRegion] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterProjectYear, setFilterProjectYear] = useState<string>('')

  // 업무 상태 매핑 유틸리티 함수들
  const getStatusDisplayName = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'quotation': '견적',
      'site_inspection': '현장조사',
      'customer_contact': '고객연락',
      'contract': '계약',
      'installation': '설치',
      'completion': '완료',
      'pending': '대기',
      'in_progress': '진행중',
      'on_hold': '보류',
      'cancelled': '취소'
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'quotation': return { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700', badge: 'bg-amber-100' }
      case 'site_inspection': return { bg: 'bg-cyan-50', border: 'border-cyan-400', text: 'text-cyan-700', badge: 'bg-cyan-100' }
      case 'customer_contact': return { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', badge: 'bg-blue-100' }
      case 'contract': return { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700', badge: 'bg-purple-100' }
      case 'installation': return { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-700', badge: 'bg-orange-100' }
      case 'completion': return { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', badge: 'bg-green-100' }
      case 'pending': return { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-700', badge: 'bg-gray-100' }
      case 'in_progress': return { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-700', badge: 'bg-indigo-100' }
      case 'on_hold': return { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-700', badge: 'bg-yellow-100' }
      case 'cancelled': return { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700', badge: 'bg-red-100' }
      default: return { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-700', badge: 'bg-gray-100' }
    }
  }

  // 메모와 업무를 통합해서 최신순으로 정렬하는 함수
  const getIntegratedItems = () => {
    const items: Array<{
      type: 'memo' | 'task',
      id: string,
      title: string,
      content?: string,
      description?: string,
      created_at: string,
      status?: string,
      task_type?: string,
      assignee?: string,
      data: any
    }> = []

    // 메모 추가 (type: 'memo')
    businessMemos.forEach(memo => {
      items.push({
        type: 'memo',
        id: memo.id,
        title: memo.title,
        content: memo.content,
        created_at: memo.created_at,
        data: memo
      })
    })

    // 업무 추가 (type: 'task')
    businessTasks.forEach(task => {
      items.push({
        type: 'task',
        id: task.id,
        title: task.title,
        description: task.description,
        created_at: task.created_at,
        status: task.status,
        task_type: task.task_type,
        assignee: task.assignee,
        data: task
      })
    })

    // 업무를 먼저, 그 다음 메모를 최신순으로 정렬
    return items.sort((a, b) => {
      // 타입이 다르면 업무(task)를 먼저
      if (a.type !== b.type) {
        if (a.type === 'task') return -1;
        if (b.type === 'task') return 1;
      }
      // 같은 타입 내에서는 최신순으로 정렬
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
  }

  // 엑셀 템플릿 다운로드 함수 (API 엔드포인트 사용)
  const downloadExcelTemplate = async () => {
    try {
      const response = await fetch('/api/download-excel-template');
      
      if (!response.ok) {
        throw new Error(`템플릿 다운로드 실패: ${response.status}`);
      }
      
      // 파일 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `사업장정보_업로드템플릿_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('✅ 엑셀 템플릿 다운로드 완료');
    } catch (error) {
      console.error('❌ 템플릿 다운로드 실패:', error);
      alert('템플릿 다운로드 중 오류가 발생했습니다.');
    }
  }
  
  // 메모 관리 함수들
  const loadBusinessMemos = async (businessId: string) => {
    console.log('🔧 [FRONTEND] loadBusinessMemos 시작 - businessId:', businessId)
    setIsLoadingMemos(true)
    try {
      const url = `/api/business-memos?businessId=${businessId}`
      console.log('🔧 [FRONTEND] 메모 로드 요청 URL:', url)

      const response = await fetch(url)
      const result = await response.json()

      console.log('🔧 [FRONTEND] 메모 로드 API 응답:', result)
      console.log('🔧 [FRONTEND] 받은 메모 데이터:', result.data)
      console.log('🔧 [FRONTEND] 메모 개수:', result.data?.length || 0)

      if (result.success) {
        // API 응답이 {data: {data: [...], metadata: {...}}} 구조이므로 실제 배열은 result.data.data에 있음
        const memos = result.data?.data || []
        console.log('🔧 [FRONTEND] 추출된 메모 배열:', memos)
        console.log('🔧 [FRONTEND] setBusinessMemos 호출 전 - 설정할 메모:', memos.length, '개')
        setBusinessMemos(memos)
        console.log('🔧 [FRONTEND] setBusinessMemos 호출 완료')
      } else {
        console.error('❌ 메모 로드 실패:', result.error)
        setBusinessMemos([])
      }
    } catch (error) {
      console.error('❌ 메모 로드 오류:', error)
      setBusinessMemos([])
    } finally {
      setIsLoadingMemos(false)
    }
  }

  // 업무 조회 함수
  const loadBusinessTasks = async (businessName: string) => {
    setIsLoadingTasks(true)
    try {
      // 토큰을 포함한 인증 헤더 추가 - TokenManager 사용
      const { TokenManager } = await import('@/lib/api-client');
      const token = TokenManager.getToken();

      // 디버깅 로그 추가
      console.log('🔍 [FACILITY-TASKS-CLIENT] 토큰 상태:', {
        hasWindow: typeof window !== 'undefined',
        tokenExists: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'null',
        businessName
      });

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('✅ [FACILITY-TASKS-CLIENT] Authorization 헤더 추가됨');
      } else {
        console.warn('⚠️ [FACILITY-TASKS-CLIENT] 토큰이 없어서 Authorization 헤더 없이 요청');
      }

      const response = await fetch(`/api/facility-tasks?businessName=${encodeURIComponent(businessName)}`, {
        headers
      });
      const result = await response.json()

      if (result.success) {
        setBusinessTasks(result.data?.tasks || [])
      } else {
        console.error('❌ 업무 로드 실패:', result.error)
        setBusinessTasks([])
      }
    } catch (error) {
      console.error('❌ 업무 로드 오류:', error)
      setBusinessTasks([])
    } finally {
      setIsLoadingTasks(false)
    }
  }

  const handleAddMemo = async () => {
    if (!selectedBusiness || !memoForm.title?.trim() || !memoForm.content?.trim()) {
      alert('제목과 내용을 모두 입력해주세요.')
      return
    }

    try {
      const memoData: CreateBusinessMemoInput = {
        business_id: selectedBusiness.id,
        title: memoForm.title.trim(),
        content: memoForm.content.trim(),
        created_by: '관리자' // 향후 실제 계정 정보로 변경
      }

      console.log('🔧 [FRONTEND] 메모 전송 데이터:', {
        businessName: selectedBusiness.business_name,
        memoData,
        formData: memoForm
      })

      const response = await fetch('/api/business-memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memoData)
      })

      const result = await response.json()
      
      console.log('🔧 [FRONTEND] API 응답:', result)

      if (result.success) {
        console.log('🔧 [FRONTEND] 새 메모 추가 성공:', result.data)

        // 메모 폼 초기화
        setMemoForm({ title: '', content: '' })
        setIsAddingMemo(false)

        // 서버에서 전체 메모 목록 다시 로드
        console.log('🔧 [FRONTEND] 전체 메모 목록 다시 로드 시작')
        await loadBusinessMemos(selectedBusiness.id)
        console.log('🔧 [FRONTEND] 메모 목록 다시 로드 완료')
      } else {
        console.error('🔧 [FRONTEND] 메모 추가 실패:', result.error)
        alert(`메모 추가 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ 메모 추가 오류:', error)
      alert('메모 추가 중 오류가 발생했습니다.')
    }
  }

  const handleEditMemo = async () => {
    if (!editingMemo || !memoForm.title?.trim() || !memoForm.content?.trim()) {
      alert('제목과 내용을 모두 입력해주세요.')
      return
    }

    try {
      const updateData: UpdateBusinessMemoInput = {
        title: memoForm.title.trim(),
        content: memoForm.content.trim(),
        updated_by: '관리자' // 향후 실제 계정 정보로 변경
      }

      const response = await fetch(`/api/business-memos?id=${editingMemo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      const result = await response.json()
      
      if (result.success) {
        console.log('🔧 [FRONTEND] 메모 수정 성공:', result.data)

        // 메모 폼 초기화
        setMemoForm({ title: '', content: '' })
        setEditingMemo(null)

        // 서버에서 전체 메모 목록 다시 로드
        if (selectedBusiness) {
          await loadBusinessMemos(selectedBusiness.id)
        }
        console.log('🔧 [FRONTEND] 메모 수정 후 목록 다시 로드 완료')
      } else {
        alert(`메모 수정 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ 메모 수정 오류:', error)
      alert('메모 수정 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteMemo = async (memo: BusinessMemo) => {
    if (!memo.id) {
      alert('메모 ID가 없어 삭제할 수 없습니다.')
      return
    }

    if (!confirm('정말로 이 메모를 삭제하시겠습니까?')) {
      return
    }

    try {
      console.log('🔧 [FRONTEND] 메모 삭제 요청 시작:', memo.id)

      const response = await fetch(`/api/business-memos?id=${memo.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      console.log('🔧 [FRONTEND] 메모 삭제 API 응답:', result)

      if (result.success) {
        console.log('🔧 [FRONTEND] 메모 삭제 성공, 전체 메모 목록 다시 로드 시작')
        if (selectedBusiness?.id) {
          await loadBusinessMemos(selectedBusiness.id)
          console.log('🔧 [FRONTEND] 메모 목록 다시 로드 완료')
        }
      } else {
        alert(`메모 삭제 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ 메모 삭제 오류:', error)
      alert('메모 삭제 중 오류가 발생했습니다.')
    }
  }

  const startEditMemo = (memo: BusinessMemo) => {
    if (!memo.id) {
      alert('메모 ID가 없어 수정할 수 없습니다.')
      return
    }
    setEditingMemo(memo)
    setMemoForm({ title: memo.title, content: memo.content })
    setIsAddingMemo(true) // 같은 폼을 재사용
  }

  const cancelMemoEdit = () => {
    setIsAddingMemo(false)
    setEditingMemo(null)
    setMemoForm({ title: '', content: '' })
  }
  
  // Stats calculation
  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const thisYearBusinesses = allBusinesses.filter(b => b.project_year === currentYear).length
    const subsidyBusinesses = allBusinesses.filter(b => b.progress_status === '보조금').length
    const selfFundedBusinesses = allBusinesses.filter(b => b.progress_status === '자비').length
    const businessesWithTasks = Object.keys(businessTaskStatuses).length

    return {
      thisYear: thisYearBusinesses,
      subsidy: subsidyBusinesses,
      selfFunded: selfFundedBusinesses,
      withTasks: businessesWithTasks
    }
  }, [allBusinesses, businessTaskStatuses])


  // 기본 데이터 로딩 - Supabase에서 직접 조회로 최적화
  const loadAllBusinesses = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log('🔄 최적화된 사업장 정보 로딩 시작...')
      
      // 직접 business_info 테이블에서 사업장 정보 조회 (파일 통계 포함)
      const response = await fetch('/api/business-info-direct?includeFileStats=true')
      if (!response.ok) {
        throw new Error('사업장 데이터를 불러오는데 실패했습니다.')
      }
      const data = await response.json()
      
      if (data.success && data.data && Array.isArray(data.data)) {
        console.log(`✅ ${data.data.length}개 사업장 정보 로딩 완료`)
        
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
        }))
        
        setAllBusinesses(businessObjects)
        
        // selectedBusiness가 있다면 업데이트된 데이터로 동기화 (useEffect에서 처리)
        
        console.log(`📊 사업장 데이터 로딩 완료: 총 ${businessObjects.length}개`)
      } else {
        console.error('Invalid data format:', data)
        setAllBusinesses([])
      }
    } catch (error) {
      console.error('사업장 데이터 로딩 오류:', error)
      setAllBusinesses([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 🔍 검색 시 동적 상태 조회 (새로 추가된 기능)
  useEffect(() => {
    const handleSearchResults = async () => {
      if (searchQuery.trim() && filteredBusinesses.length > 0) {
        console.log('🔍 [SEARCH-STATUS] 검색 결과에 대한 상태 조회 시작:', filteredBusinesses.length, '개 사업장')

        // 현재 상태가 없는 사업장들만 필터링
        const businessesNeedingStatus = filteredBusinesses.filter(business => {
          const businessName = business.사업장명 || business.business_name || ''
          return businessName && !businessTaskStatuses[businessName]
        }).slice(0, 30) // 최대 30개까지만 조회

        if (businessesNeedingStatus.length > 0) {
          console.log('⚡ [SEARCH-STATUS] 상태 조회가 필요한 사업장:', businessesNeedingStatus.length, '개')

          setIsSearchLoading(true) // 검색 로딩 시작

          try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
            const businessNames = businessesNeedingStatus
              .map(business => business.사업장명 || business.business_name || '')
              .filter(name => name)

            // 개별 조회로 안전하게 처리 (배치 API 문제를 피하기 위해)
            for (const businessName of businessNames.slice(0, 10)) { // 처음 10개만
              try {
                console.log('📋 [SEARCH-STATUS] 개별 조회:', businessName)
                const status = await getBusinessTaskStatus(businessName, token)

                // 즉시 업데이트하여 사용자가 바로 볼 수 있도록
                setBusinessTaskStatuses(prev => ({
                  ...prev,
                  [businessName]: status
                }))

                // 100ms 딜레이로 서버 부하 방지
                await new Promise(resolve => setTimeout(resolve, 100))
              } catch (error) {
                console.warn(`검색 상태 조회 실패 (${businessName}):`, error)
                setBusinessTaskStatuses(prev => ({
                  ...prev,
                  [businessName]: {
                    statusText: '조회 실패',
                    colorClass: 'bg-gray-100 text-gray-600',
                    lastUpdated: '',
                    taskCount: 0,
                    hasActiveTasks: false
                  }
                }))
              }
            }

            console.log('✅ [SEARCH-STATUS] 검색 상태 조회 완료')

          } catch (error) {
            console.error('검색 상태 조회 오류:', error)
          } finally {
            setIsSearchLoading(false) // 검색 로딩 완료
          }
        } else {
          console.log('ℹ️ [SEARCH-STATUS] 모든 검색 결과의 상태가 이미 로드됨')
        }
      }
    }

    // 검색어가 있을 때만 실행하고, 300ms 디바운스 적용
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearchResults()
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery]) // 검색어 변경 시에만 실행

  // 콤마 기반 다중 검색 키워드 파싱
  const searchTerms = useMemo(() => {
    if (!searchQuery.trim()) return []
    return searchQuery
      .split(',')
      .map(term => term.trim())
      .filter(term => term.length > 0)
  }, [searchQuery])

  // 검색 필터링 (useMemo 사용으로 자동 필터링)
  const filteredBusinesses = useMemo(() => {
    console.log('🔍 useMemo 필터링 실행:', searchTerms, 'allBusinesses 수:', allBusinesses.length)

    let filtered = allBusinesses

    // 드롭다운 필터 적용
    if (filterOffice) {
      filtered = filtered.filter(b => b.영업점 === filterOffice || b.sales_office === filterOffice)
    }
    if (filterRegion) {
      filtered = filtered.filter(b => {
        const address = b.주소 || b.address || ''
        return address.includes(filterRegion)
      })
    }
    if (filterCategory) {
      filtered = filtered.filter(b => (b as any).진행상태 === filterCategory || b.progress_status === filterCategory)
    }
    if (filterProjectYear) {
      filtered = filtered.filter(b => {
        const year = (b as any).사업진행연도 || b.project_year
        return year === Number(filterProjectYear)
      })
    }

    // 검색어가 없으면 필터링된 결과를 정렬해서 반환
    if (searchTerms.length === 0) {
      console.log('📋 검색어 없음 - 필터링된 목록 표시 (최근 수정순):', filtered.length)
      return [...filtered].sort((a, b) => {
        const dateA = new Date(a.수정일 || a.updated_at || a.생성일 || a.created_at || 0)
        const dateB = new Date(b.수정일 || b.updated_at || b.생성일 || b.created_at || 0)
        return dateB.getTime() - dateA.getTime() // 내림차순 (최신이 위로)
      })
    }

    // 검색어 필터링
    filtered = filtered.filter(business => {
      // 모든 검색 가능한 필드들을 하나의 문자열로 결합
      const searchableText = [
        // 기본 정보
        business.사업장명 || business.business_name || '',
        business.주소 || business.address || business.local_government || '',
        business.담당자명 || business.manager_name || '',
        business.담당자연락처 || business.manager_contact || business.business_contact || '',
        business.업종 || business.business_type || '',
        (business as any).사업장분류 || business.business_category || '',

        // 프로젝트 관리 정보
        (business as any).진행상태 || business.progress_status || '',
        (business as any).발주담당자 || business.order_manager || '',
        (business as any).설치팀 || business.installation_team || '',
        (business as any).계약서류 || business.contract_document || '',
        (business as any).부무선서류 || business.wireless_document || '',
        (business as any).설치지원 || business.installation_support || '',

        // 시설 정보
        (business as any).오염물질 || business.pollutants || '',
        (business as any).기타장비 || business.other_equipment || '',
        (business as any).협의사항 || business.negotiation || '',

        // 시스템 정보
        (business as any).제조사 || business.manufacturer || '',
        (business as any).vpn방식 || business.vpn || '',
        (business as any).그린링크아이디 || business.greenlink_id || '',

        // 대표자 정보
        (business as any).대표자명 || business.representative_name || '',
        business.사업자등록번호 || business.business_registration_number || '',
        business.팩스번호 || business.fax_number || '',
        business.이메일 || business.email || ''
      ].join(' ').toLowerCase()

      // 모든 검색어가 포함되어야 함 (AND 조건)
      return searchTerms.every(term =>
        searchableText.includes(term.toLowerCase())
      )
    })

    console.log('🎯 필터링 결과:', filtered.length, '개 사업장 (검색어:', searchTerms.length, '개)')
    return filtered
  }, [searchTerms, allBusinesses, filterOffice, filterRegion, filterCategory, filterProjectYear])

  // 필터 옵션 추출
  const filterOptions = useMemo(() => {
    const offices = [...new Set(allBusinesses.map(b => b.영업점 || b.sales_office).filter(Boolean))] as string[]
    const regions = [...new Set(
      allBusinesses.map(b => {
        const address = b.주소 || b.address || ''
        if (!address) return ''
        const parts = address.split(' ')
        return parts.slice(0, 2).join(' ')
      }).filter(Boolean)
    )] as string[]
    const categories = [...new Set(
      allBusinesses.map(b => (b as any).진행상태 || b.progress_status).filter(Boolean)
    )] as string[]
    const years = [...new Set(
      allBusinesses.map(b => (b as any).사업진행연도 || b.project_year).filter(Boolean)
    )] as number[]

    return {
      offices: offices.sort(),
      regions: regions.sort(),
      categories,
      years: years.sort((a, b) => b - a) // 최신 연도부터
    }
  }, [allBusinesses])

  // 검색어 하이라이팅 함수
  const highlightSearchTerm = useCallback((text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text

    // 정규표현식 특수 문자 escape 처리
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    )
  }, [])


  // 대기필증 데이터 로딩 함수
  const loadAirPermitData = useCallback(async (businessId: string) => {
    try {
      setAirPermitLoading(true)
      const response = await fetch(`/api/air-permit?businessId=${businessId}`)
      
      if (!response.ok) {
        // 404는 정상적인 경우 (대기필증이 없는 사업장)
        if (response.status === 404) {
          setAirPermitData(null)
          return
        }
        throw new Error('대기필증 데이터 로딩 실패')
      }

      const result = await response.json()
      if (result.data && result.data.length > 0) {
        // 첫 번째 대기필증의 업종과 종별 정보를 사용
        const firstPermit = result.data[0]
        setAirPermitData({
          business_type: firstPermit.business_type || '',
          category: firstPermit.additional_info?.category || '',
          permits: result.data
        })
      } else {
        setAirPermitData(null)
      }
    } catch (error) {
      console.error('대기필증 데이터 로딩 오류:', error)
      setAirPermitData(null)
    } finally {
      setAirPermitLoading(false)
    }
  }, [])

  // 대기필증 데이터 업데이트 함수 (양방향 동기화)
  const syncAirPermitData = useCallback(async (businessId: string, updatedBusinessType: string, updatedCategory: string) => {
    if (!airPermitData || airPermitData.permits.length === 0) return

    try {
      // 각 대기필증을 업데이트
      for (const permit of airPermitData.permits) {
        const updateData = {
          id: permit.id,
          business_type: updatedBusinessType,
          additional_info: {
            ...permit.additional_info,
            category: updatedCategory
          }
        }

        const response = await fetch('/api/air-permit', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        })

        if (!response.ok) {
          console.error(`대기필증 ${permit.id} 업데이트 실패`)
        }
      }

      // 로컬 상태 업데이트
      setAirPermitData(prev => prev ? {
        ...prev,
        business_type: updatedBusinessType,
        category: updatedCategory
      } : null)
      
    } catch (error) {
      console.error('대기필증 동기화 오류:', error)
    }
  }, [airPermitData])

  // 🚀 페이지별 지연 로딩: 현재 페이지 사업장들의 현재 단계만 로딩
  const loadCurrentPageTaskStatuses = useCallback(async (pageBusinesses: UnifiedBusinessInfo[]) => {
    if (pageBusinesses.length === 0) return

    console.log(`🎯 [PAGE-LOADING] 페이지별 현재 단계 로딩: ${pageBusinesses.length}개 사업장`)

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      const businessNames = pageBusinesses
        .map(business => business.사업장명 || business.business_name || '')
        .filter(name => name)

      // 이미 캐시된 사업장들 제외
      const uncachedBusinesses = businessNames.filter(name =>
        !businessTaskStatuses[name] || businessTaskStatuses[name].statusText === '로딩 중...'
      )

      if (uncachedBusinesses.length === 0) {
        console.log('✅ [PAGE-LOADING] 모든 사업장이 이미 캐시됨')
        return
      }

      console.log(`📊 [PAGE-LOADING] 캐시되지 않은 ${uncachedBusinesses.length}개 사업장 로딩`)

      // 로딩 상태 표시
      setBusinessTaskStatuses(prev => {
        const newState = { ...prev }
        uncachedBusinesses.forEach(businessName => {
          newState[businessName] = {
            statusText: '로딩 중...',
            colorClass: 'bg-gray-100 text-gray-500 animate-pulse',
            lastUpdated: '',
            taskCount: 0,
            hasActiveTasks: false
          }
        })
        return newState
      })

      const batchResults = await getBatchBusinessTaskStatuses(uncachedBusinesses, token)

      // 결과 업데이트 (기존 캐시 유지)
      setBusinessTaskStatuses(prev => {
        const newState = { ...prev }
        uncachedBusinesses.forEach(businessName => {
          if (batchResults[businessName]) {
            newState[businessName] = batchResults[businessName]
          } else {
            newState[businessName] = {
              statusText: '업무 미등록',
              colorClass: 'bg-gray-100 text-gray-600',
              lastUpdated: '',
              taskCount: 0,
              hasActiveTasks: false
            }
          }
        })
        return newState
      })

      console.log(`✅ [PAGE-LOADING] 완료: ${uncachedBusinesses.length}개 사업장`)

    } catch (error) {
      console.error('❌ [PAGE-LOADING] 페이지별 업무 상태 로딩 오류:', error)

      // 오류 발생시 오류 상태로 설정
      setBusinessTaskStatuses(prev => {
        const newState = { ...prev }
        pageBusinesses.forEach(business => {
          const businessName = business.사업장명 || business.business_name || ''
          if (businessName) {
            newState[businessName] = {
              statusText: '조회 실패',
              colorClass: 'bg-gray-100 text-gray-600',
              lastUpdated: '',
              taskCount: 0,
              hasActiveTasks: false
            }
          }
        })
        return newState
      })
    }
  }, []) // 의존성 배열 제거 - setBusinessTaskStatuses는 함수형 업데이트(prev =>)를 사용하므로 안전

  // 초기 데이터 로딩 - 의존성 제거하여 무한루프 방지
  useEffect(() => {
    loadAllBusinesses()
  }, [])

  // 🎯 초기 로딩: 첫 페이지(8개)만 현재 단계 로딩
  useEffect(() => {
    if (allBusinesses.length > 0) {
      console.log(`🚀 [INITIAL-LOAD] 첫 페이지 로딩 시작: 총 ${allBusinesses.length}개 중 8개`)
      const firstPage = allBusinesses.slice(0, 8)
      loadCurrentPageTaskStatuses(firstPage)
    }
  }, [allBusinesses.length]) // loadCurrentPageTaskStatuses 의존성 제거로 무한 루프 방지

  // 🎯 페이지 변경 핸들러: 새 페이지 사업장들의 현재 단계 로딩
  const handlePageChange = useCallback((page: number, pageData: UnifiedBusinessInfo[]) => {
    console.log(`📄 [PAGE-CHANGE] ${page}페이지로 이동, ${pageData.length}개 사업장`)
    loadCurrentPageTaskStatuses(pageData)
  }, []) // 의존성 제거로 무한 루프 방지

  // 🔍 검색시 핸들러: 검색 결과의 현재 단계 로딩
  const handleSearchChange = useCallback((searchResults: UnifiedBusinessInfo[]) => {
    if (searchResults.length > 0) {
      console.log(`🔍 [SEARCH] 검색 결과 ${searchResults.length}개 사업장의 현재 단계 로딩`)
      loadCurrentPageTaskStatuses(searchResults.slice(0, 8)) // 첫 페이지만 로딩
    }
  }, []) // 의존성 제거로 무한 루프 방지

  // 🔍 검색 쿼리 변경 감지: 검색 결과의 첫 페이지 현재 단계 로딩
  useEffect(() => {
    if (searchQuery && filteredBusinesses.length > 0) {
      console.log(`🔍 [SEARCH-TRIGGER] 검색어 변경: "${searchQuery}", 결과 ${filteredBusinesses.length}개`)
      const firstPageOfResults = filteredBusinesses.slice(0, 8)
      loadCurrentPageTaskStatuses(firstPageOfResults)
    }
  }, [searchQuery, filteredBusinesses.length]) // loadCurrentPageTaskStatuses 의존성 제거로 무한 루프 방지

  // ✅ 페이지별 지연 로딩 구현 완료 - 백그라운드 로딩 제거됨

  // selectedBusiness 동기화를 위한 별도 useEffect (완전 최적화)
  useEffect(() => {
    if (selectedBusiness && allBusinesses.length > 0) {
      const updatedSelected = allBusinesses.find(b => b.id === selectedBusiness.id)
      if (updatedSelected && updatedSelected.수정일 !== selectedBusiness.수정일) {
        console.log('🔄 selectedBusiness 동기화:', updatedSelected.사업장명, '담당자:', updatedSelected.담당자명)
        setSelectedBusiness(updatedSelected)
      }
    }
  }, [allBusinesses.length, selectedBusiness?.id]) // length 변화만 감지

  // URL 파라미터 처리 - 알림에서 사업장으로 직접 이동
  useEffect(() => {
    const businessParam = searchParams?.get('business')
    const focusParam = searchParams?.get('focus')

    if (businessParam && allBusinesses.length > 0 && !selectedBusiness) {
      console.log('🔍 [URL-PARAMS] 사업장 검색:', businessParam, 'focus:', focusParam)

      // URL에서 받은 사업장명으로 검색 (URL 디코딩)
      const targetBusinessName = decodeURIComponent(businessParam)
      const foundBusiness = allBusinesses.find(b =>
        b.사업장명 === targetBusinessName || b.business_name === targetBusinessName
      )

      if (foundBusiness) {
        console.log('✅ [URL-PARAMS] 사업장 발견, 상세 모달 열기:', foundBusiness.사업장명)

        // 사업장 선택 및 상세 모달 열기
        setSelectedBusiness(foundBusiness)
        setIsDetailModalOpen(true)

        // focus=tasks인 경우 업무 탭으로 자동 이동 (추가 구현 필요시)
        if (focusParam === 'tasks') {
          console.log('🎯 [URL-PARAMS] 업무 탭에 포커스')
          // TODO: 업무 탭 활성화 로직 추가 (탭 상태 관리가 있는 경우)
        }
      } else {
        console.warn('⚠️ [URL-PARAMS] 사업장을 찾을 수 없음:', targetBusinessName)

        // 사업장을 찾을 수 없으면 검색어로 설정
        setSearchQuery(targetBusinessName)
      }
    }
  }, [allBusinesses.length, searchParams, selectedBusiness])

  // 사업장 선택 시 메모와 업무 로드
  useEffect(() => {
    if (selectedBusiness) {
      loadBusinessMemos(selectedBusiness.id)
      loadBusinessTasks(selectedBusiness.사업장명)
    }
  }, [selectedBusiness?.id])

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isDetailModalOpen) {
          setIsDetailModalOpen(false)
        }
        if (isModalOpen) {
          setIsModalOpen(false)
          setShowLocalGovSuggestions(false)
        }
      }
    }

    document.addEventListener('keydown', handleEscKey)
    return () => {
      document.removeEventListener('keydown', handleEscKey)
    }
  }, [isDetailModalOpen, isModalOpen])

  // 통합 새로고침 함수 - 모든 데이터 동기화를 위한 단일 소스
  const refreshBusinessData = async (businessId: string, businessName: string): Promise<UnifiedBusinessInfo | null> => {
    try {
      const timestamp = Date.now()
      const response = await fetch(`/api/business-info-direct?id=${businessId}&t=${timestamp}`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Charset': 'utf-8'
        }
      })
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('🔄 새로고침된 데이터:', {
        사업장명: data.data?.[0]?.business_name,
        담당자명: data.data?.[0]?.manager_name,
        담당자직급: data.data?.[0]?.manager_position,
        계산서1차발행일: data.data?.[0]?.invoice_1st_date,
        계산서1차금액: data.data?.[0]?.invoice_1st_amount,
        견적실사담당자: data.data?.[0]?.estimate_survey_manager,
        fullData: data.data?.[0]
      })
      
      if (data.success && data.data?.length > 0) {
        const business = data.data[0]
        // 직접 API 응답을 한국어 필드명으로 변환
        const refreshedBusiness = {
          // Base BusinessInfo fields
          id: business.id,
          created_at: business.created_at,
          updated_at: business.updated_at,
          business_name: business.business_name || '정보없음',
          local_government: business.local_government,
          address: business.address,
          manager_name: business.manager_name,
          manager_position: business.manager_position,
          manager_contact: business.manager_contact,
          business_contact: business.business_contact,
          fax_number: business.fax_number,
          email: business.email,
          representative_name: business.representative_name,
          business_registration_number: business.business_registration_number,
          
          // 프로젝트 관리 필드들
          row_number: business.row_number,
          department: business.department,
          progress_status: business.progress_status,
          project_year: business.project_year,
          contract_document: business.contract_document,
          order_request_date: business.order_request_date,
          wireless_document: business.wireless_document,
          installation_support: business.installation_support,
          order_manager: business.order_manager,
          order_date: business.order_date,
          shipment_date: business.shipment_date,
          inventory_check: business.inventory_check,
          installation_date: business.installation_date,
          installation_team: business.installation_team,
          business_type: business.business_type,
          business_category: business.business_category,
          pollutants: business.pollutants,
          annual_emission_amount: business.annual_emission_amount,
          first_report_date: business.first_report_date,
          operation_start_date: business.operation_start_date,
          subsidy_approval_date: business.subsidy_approval_date,
          expansion_pack: business.expansion_pack,
          other_equipment: business.other_equipment,
          additional_cost: business.additional_cost,
          negotiation: business.negotiation,
          multiple_stack_cost: business.multiple_stack_cost,
          representative_birth_date: business.representative_birth_date,
          
          // 시스템 필드들
          manufacturer: business.manufacturer,
          vpn: business.vpn,
          greenlink_id: business.greenlink_id,
          greenlink_pw: business.greenlink_pw,
          business_management_code: business.business_management_code,
          
          // 센서/장비 수량 필드들
          ph_meter: business.ph_meter,
          differential_pressure_meter: business.differential_pressure_meter,
          temperature_meter: business.temperature_meter,
          discharge_current_meter: business.discharge_current_meter,
          fan_current_meter: business.fan_current_meter,
          pump_current_meter: business.pump_current_meter,
          gateway: business.gateway,
          vpn_wired: business.vpn_wired === true ? 1 : (business.vpn_wired === false ? 0 : (business.vpn_wired || 0)),
          vpn_wireless: business.vpn_wireless === true ? 1 : (business.vpn_wireless === false ? 0 : (business.vpn_wireless || 0)),
          explosion_proof_differential_pressure_meter_domestic: business.explosion_proof_differential_pressure_meter_domestic,
          explosion_proof_temperature_meter_domestic: business.explosion_proof_temperature_meter_domestic,
          expansion_device: business.expansion_device,
          relay_8ch: business.relay_8ch,
          relay_16ch: business.relay_16ch,
          main_board_replacement: business.main_board_replacement,
          multiple_stack: business.multiple_stack === true ? 1 : (business.multiple_stack === false ? 0 : (business.multiple_stack || 0)),
          
          // 영업점
          sales_office: business.sales_office,
          
          // 시설 요약 정보
          facility_summary: business.facility_summary,
          
          additional_info: business.additional_info,
          is_active: business.is_active,
          is_deleted: business.is_deleted,
          
          // UI 표시용 한국어 필드들
          사업장명: business.business_name || '정보없음',
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
          지자체: business.local_government || '',
          팩스번호: business.fax_number || '',
          이메일: business.email || '',
          // 시스템 정보 필드
          사업장관리코드: business.business_management_code || null,
          그린링크ID: business.greenlink_id || '',
          그린링크PW: business.greenlink_pw || '',
          영업점: business.sales_office || '',
          // 프로젝트 관리 한국어 필드
          진행상태: business.progress_status || null,
          사업진행연도: business.project_year || null,
          설치팀: business.installation_team || null,
          // 현재 단계 필드
          현재단계: '준비 중',
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

          // UI specific fields
          hasFiles: false,
          fileCount: 0,
          files: null
        }
        return refreshedBusiness
      }
      return null
    } catch (error) {
      console.error('데이터 새로고침 오류:', error)
      return null
    }
  }

  // Modal functions
  const openDetailModal = async (business: UnifiedBusinessInfo) => {
    try {
      console.log('📋 모달 열기 시작:', business.사업장명)
      
      // 기본 데이터로 먼저 모달 열기
      setSelectedBusiness(business)
      setIsDetailModalOpen(true)
      
      // 대기필증 데이터 로딩
      if (business.id) {
        loadAirPermitData(business.id)
      }
      
      // 백그라운드에서 최신 데이터 조회
      if (business.id && business.사업장명) {
        const refreshedBusiness = await refreshBusinessData(business.id, business.사업장명)
        if (refreshedBusiness) {
          console.log('🔄 모달용 최신 데이터 조회 완료:', {
            사업장명: refreshedBusiness.사업장명,
            계산서1차발행일: refreshedBusiness.invoice_1st_date,
            계산서1차금액: refreshedBusiness.invoice_1st_amount,
            견적실사담당자: refreshedBusiness.estimate_survey_manager,
            진행구분: refreshedBusiness.progress_status,
            business_category: refreshedBusiness.business_category
          })
          setSelectedBusiness(refreshedBusiness)
        } else {
          console.warn('⚠️ refreshBusinessData 반환값 null - API 실패 또는 데이터 없음')
        }
      }

      // 메모 데이터 로드
      if (business.id) {
        await loadBusinessMemos(business.id)
      }
      
      // 시설 통계 로드
      if (business.id) {
        await loadBusinessFacilityStats(business.id)
      }
      
      // 시설 정보 로드 (사업장명 사용)
      const businessName = business.사업장명 || business.business_name
      if (businessName) {
        await loadBusinessFacilities(businessName)
      }

      // 매출 정보 계산 (클라이언트 측 직접 계산)
      loadRevenueData(business)
    } catch (error) {
      console.error('❌ 모달 열기 오류:', error)
      // 기본 데이터라도 표시
      setSelectedBusiness(business)
      setIsDetailModalOpen(true)
      
      // 대기필증 데이터 로딩
      if (business.id) {
        loadAirPermitData(business.id)
      }
      
      // 메모 로드 시도
      if (business.id) {
        await loadBusinessMemos(business.id)
      }
    }
  }

  const openAddModal = () => {
    setEditingBusiness(null)
    setFormData({
      business_name: '',
      local_government: '',
      address: '',
      representative_name: '',
      business_registration_number: '',
      manager_name: '',
      manager_position: '',
      manager_contact: '',
      business_contact: '',
      fax_number: '',
      email: '',
      manufacturer: 'ecosense' as 'ecosense' | 'cleanearth' | 'gaia_cns' | 'evs',
      vpn: null,
      greenlink_id: '',
      greenlink_pw: '',
      business_management_code: null,
      sales_office: '',
      ph_meter: null,
      differential_pressure_meter: null,
      temperature_meter: null,
      discharge_current_meter: null,
      fan_current_meter: null,
      pump_current_meter: null,
      gateway: null,
      vpn_wired: null,
      vpn_wireless: null,
      explosion_proof_differential_pressure_meter_domestic: null,
      explosion_proof_temperature_meter_domestic: null,
      expansion_device: null,
      relay_8ch: null,
      relay_16ch: null,
      main_board_replacement: null,
      multiple_stack: null,
      additional_cost: null,
      multiple_stack_cost: null,
      expansion_pack: null,
      other_equipment: '',
      negotiation: '',
      is_active: true,
      // 실사 관리
      estimate_survey_manager: '',
      estimate_survey_date: '',
      pre_construction_survey_manager: '',
      pre_construction_survey_date: '',
      completion_survey_manager: '',
      completion_survey_date: ''
    })
    setIsModalOpen(true)
  }

  const openEditModal = async (business: UnifiedBusinessInfo) => {
    setEditingBusiness(business)

    // API에서 최신 데이터 가져오기
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const response = await fetch(`/api/business-info-direct?id=${business.id}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error('Failed to fetch business data');
      }

      const result = await response.json();
      const freshData = result.data?.[0] || business;

      console.log('🔄 [openEditModal] API에서 가져온 최신 데이터:', {
        id: freshData.id,
        business_name: freshData.business_name,
        invoice_1st_date: freshData.invoice_1st_date,
        invoice_1st_amount: freshData.invoice_1st_amount,
        payment_1st_date: freshData.payment_1st_date,
        payment_1st_amount: freshData.payment_1st_amount,
        invoice_2nd_date: freshData.invoice_2nd_date,
        payment_2nd_date: freshData.payment_2nd_date,
        payment_2nd_amount: freshData.payment_2nd_amount
      });

      setFormData({
        id: freshData.id,
        business_name: freshData.business_name,
        local_government: freshData.local_government,
        address: freshData.address,
        manager_name: freshData.manager_name,
        manager_position: freshData.manager_position,
        manager_contact: freshData.manager_contact,
        representative_name: freshData.representative_name,
        business_registration_number: freshData.business_registration_number,
        business_type: airPermitData?.business_type || freshData.business_type,
        business_category: airPermitData?.category || freshData.business_category,
        business_contact: freshData.business_contact,
        fax_number: freshData.fax_number,
        email: freshData.email,
        business_management_code: freshData.business_management_code ? Number(freshData.business_management_code) : null,
        greenlink_id: freshData.greenlink_id,
        greenlink_pw: freshData.greenlink_pw,
        sales_office: freshData.sales_office,
        ph_meter: freshData.ph_meter,
        differential_pressure_meter: freshData.differential_pressure_meter,
        temperature_meter: freshData.temperature_meter,
        discharge_current_meter: freshData.discharge_current_meter,
        fan_current_meter: freshData.fan_current_meter,
        pump_current_meter: freshData.pump_current_meter,
        gateway: freshData.gateway,

        // VPN 및 네트워크 관련 필드들
        vpn_wired: freshData.vpn_wired,
        vpn_wireless: freshData.vpn_wireless,
        multiple_stack: freshData.multiple_stack,

        // 추가 측정기기 필드들
        explosion_proof_differential_pressure_meter_domestic: freshData.explosion_proof_differential_pressure_meter_domestic,
        explosion_proof_temperature_meter_domestic: freshData.explosion_proof_temperature_meter_domestic,
        expansion_device: freshData.expansion_device,
        relay_8ch: freshData.relay_8ch,
        relay_16ch: freshData.relay_16ch,
        main_board_replacement: freshData.main_board_replacement,

        // 비용 정보 필드들
        additional_cost: freshData.additional_cost,
        multiple_stack_cost: freshData.multiple_stack_cost,
        expansion_pack: freshData.expansion_pack,
        other_equipment: freshData.other_equipment,
        negotiation: freshData.negotiation,

        contacts: freshData.contacts || [],
        manufacturer: freshData.manufacturer,
        vpn: freshData.vpn,
        is_active: freshData.is_active,
        progress_status: freshData.progress_status,
        project_year: freshData.project_year,
        installation_team: freshData.installation_team,
        order_manager: freshData.order_manager || '',

        // 일정 관리
        order_request_date: freshData.order_request_date || '',
        order_date: freshData.order_date || '',
        shipment_date: freshData.shipment_date || '',
        installation_date: freshData.installation_date || '',

        // 실사 관리
        estimate_survey_manager: freshData.estimate_survey_manager || '',
        estimate_survey_date: freshData.estimate_survey_date || '',
        pre_construction_survey_manager: freshData.pre_construction_survey_manager || '',
        pre_construction_survey_date: freshData.pre_construction_survey_date || '',
        completion_survey_manager: freshData.completion_survey_manager || '',
        completion_survey_date: freshData.completion_survey_date || '',

        // 계산서 및 입금 관리 (보조금 사업장)
        invoice_1st_date: freshData.invoice_1st_date || '',
        invoice_1st_amount: freshData.invoice_1st_amount || null,
        payment_1st_date: freshData.payment_1st_date || '',
        payment_1st_amount: freshData.payment_1st_amount || null,
        invoice_2nd_date: freshData.invoice_2nd_date || '',
        invoice_2nd_amount: freshData.invoice_2nd_amount || null,
        payment_2nd_date: freshData.payment_2nd_date || '',
        payment_2nd_amount: freshData.payment_2nd_amount || null,
        invoice_additional_date: freshData.invoice_additional_date || '',
        payment_additional_date: freshData.payment_additional_date || '',
        payment_additional_amount: freshData.payment_additional_amount || null,

        // 계산서 및 입금 관리 (자비 사업장)
        invoice_advance_date: freshData.invoice_advance_date || '',
        invoice_advance_amount: freshData.invoice_advance_amount || null,
        payment_advance_date: freshData.payment_advance_date || '',
        payment_advance_amount: freshData.payment_advance_amount || null,
        invoice_balance_date: freshData.invoice_balance_date || '',
        invoice_balance_amount: freshData.invoice_balance_amount || null,
        payment_balance_date: freshData.payment_balance_date || '',
        payment_balance_amount: freshData.payment_balance_amount || null
      })

      setIsModalOpen(true)

      // 대기필증 데이터 로딩
      if (freshData.id) {
        loadAirPermitData(freshData.id)
      }

      // 메모 로드 시도
      if (freshData.id) {
        await loadBusinessMemos(freshData.id)
      }
    } catch (error) {
      console.error('❌ [openEditModal] API 데이터 로딩 실패:', error);
      alert('사업장 데이터를 불러오는데 실패했습니다. 페이지를 새로고침해주세요.');
    }
  }

  const confirmDelete = (business: UnifiedBusinessInfo) => {
    setBusinessToDelete(business)
    setDeleteConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (!businessToDelete) return

    try {
      const response = await fetch('/api/business-info-direct', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: businessToDelete.id }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        console.log('✅ 삭제 성공:', result.message)
        alert(result.message || '사업장이 성공적으로 삭제되었습니다.')
        await loadAllBusinesses()
        setDeleteConfirmOpen(false)
        setBusinessToDelete(null)
      } else {
        console.error('❌ 삭제 실패:', result.error)
        alert(result.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('삭제 오류:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  // 엑셀 파일 업로드 처리 (배치 업데이트/생성)
  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true)
      setUploadProgress(0)
      
      // 파일 읽기 진행률 10%
      setUploadProgress(10)
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      // 데이터 파싱 진행률 20%
      setUploadProgress(20)
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]
      
      if (jsonData.length === 0) {
        alert('파일에 데이터가 없습니다.')
        return
      }
      
      console.log('📊 엑셀 데이터 샘플:', jsonData.slice(0, 2))

      // 엑셀 날짜 변환 함수 (Excel serial date → YYYY-MM-DD)
      const parseExcelDate = (value: any): string | null => {
        if (!value || value === '-' || value === '') return null

        // 이미 YYYY-MM-DD 형식인 경우
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return value
        }

        // 엑셀 시리얼 날짜 (숫자)인 경우
        if (typeof value === 'number') {
          // Excel epoch: 1900-01-01 (단, Excel의 1900년 윤년 버그 고려)
          const excelEpoch = new Date(1899, 11, 30) // 1899-12-30
          const date = new Date(excelEpoch.getTime() + value * 86400000)
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        // 다른 문자열 형식 시도
        if (typeof value === 'string') {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
          }
        }

        return null
      }

      // 엑셀 헤더를 API 필드명으로 매핑
      const mappedBusinesses = jsonData.map((row: any) => ({
        business_name: row['사업장명'] || '',
        address: row['주소'] || '',
        manager_name: row['사업장담당자'] || '',
        manager_position: row['담당자직급'] || '',
        manager_contact: row['연락처'] || '',
        representative_name: row['대표자명'] || '',
        business_registration_number: row['사업자등록번호'] || '',
        business_type: row['업종'] || '',
        business_contact: row['사업장연락처'] || '',
        fax_number: row['팩스번호'] || '',
        email: row['이메일'] || '',
        local_government: row['지자체'] || '',

        // 센서/미터 정보
        ph_meter: parseInt(row['PH센서'] || '0') || 0,
        differential_pressure_meter: parseInt(row['차압계'] || '0') || 0,
        temperature_meter: parseInt(row['온도계'] || '0') || 0,
        discharge_current_meter: parseInt(row['배출전류계'] || '0') || 0,
        fan_current_meter: parseInt(row['송풍전류계'] || '0') || 0,
        pump_current_meter: parseInt(row['펌프전류계'] || '0') || 0,

        // 네트워크 장비
        gateway: parseInt(row['게이트웨이'] || '0') || 0,
        vpn_wired: parseInt(row['VPN(유선)'] || '0') || 0,
        vpn_wireless: parseInt(row['VPN(무선)'] || '0') || 0,
        vpn: row['VPN타입'] === '무선' ? 'wireless' : row['VPN타입'] === '유선' ? 'wired' : null,
        multiple_stack: parseInt(row['복수굴뚝(설치비)'] || '0') || 0,

        // 추가 측정기기
        explosion_proof_differential_pressure_meter_domestic: parseInt(row['방폭차압계국산'] || '0') || 0,
        explosion_proof_temperature_meter_domestic: parseInt(row['방폭온도계국산'] || '0') || 0,
        expansion_device: parseInt(row['확장디바이스'] || '0') || 0,
        relay_8ch: parseInt(row['중계기8채널'] || '0') || 0,
        relay_16ch: parseInt(row['중계기16채널'] || '0') || 0,
        main_board_replacement: parseInt(row['메인보드교체'] || '0') || 0,

        // 기타 정보
        manufacturer: row['제조사'] || '',
        sales_office: row['영업점'] || '',
        department: row['담당부서'] || '',
        progress_status: row['진행구분'] || '',
        project_year: row['사업 진행연도'] ? parseInt(row['사업 진행연도']) : null,
        greenlink_id: row['그린링크ID'] || '',
        greenlink_pw: row['그린링크PW'] || '',
        business_management_code: row['사업장관리코드'] ? parseInt(row['사업장관리코드']) : null,

        // 일정 관리
        installation_team: row['설치팀'] || '',
        order_manager: row['발주담당'] || '',
        order_request_date: parseExcelDate(row['발주요청일']),
        order_date: parseExcelDate(row['발주일']),
        shipment_date: parseExcelDate(row['출고일']),
        installation_date: parseExcelDate(row['설치일']),

        // 실사 관리
        estimate_survey_manager: row['견적실사담당자'] || '',
        estimate_survey_date: parseExcelDate(row['견적실사일']),
        pre_construction_survey_manager: row['착공전실사담당자'] || '',
        pre_construction_survey_date: parseExcelDate(row['착공전실사일']),
        completion_survey_manager: row['준공실사담당자'] || '',
        completion_survey_date: parseExcelDate(row['준공실사일']),

        // 계산서 및 입금 관리 (보조금 사업장)
        invoice_1st_date: parseExcelDate(row['1차계산서일']),
        invoice_1st_amount: row['1차계산서금액'] ? parseInt(row['1차계산서금액']) : null,
        payment_1st_date: parseExcelDate(row['1차입금일']),
        payment_1st_amount: row['1차입금액'] ? parseInt(row['1차입금액']) : null,
        invoice_2nd_date: parseExcelDate(row['2차계산서일']),
        invoice_2nd_amount: row['2차계산서금액'] ? parseInt(row['2차계산서금액']) : null,
        payment_2nd_date: parseExcelDate(row['2차입금일']),
        payment_2nd_amount: row['2차입금액'] ? parseInt(row['2차입금액']) : null,
        invoice_additional_date: parseExcelDate(row['추가계산서일']),
        payment_additional_date: parseExcelDate(row['추가입금일']),
        payment_additional_amount: row['추가입금액'] ? parseInt(row['추가입금액']) : null,

        // 계산서 및 입금 관리 (자비 사업장)
        invoice_advance_date: parseExcelDate(row['선금계산서일']),
        invoice_advance_amount: row['선금계산서금액'] ? parseInt(row['선금계산서금액']) : null,
        payment_advance_date: parseExcelDate(row['선금입금일']),
        payment_advance_amount: row['선금입금액'] ? parseInt(row['선금입금액']) : null,
        invoice_balance_date: parseExcelDate(row['잔금계산서일']),
        invoice_balance_amount: row['잔금계산서금액'] ? parseInt(row['잔금계산서금액']) : null,
        payment_balance_date: parseExcelDate(row['잔금입금일']),
        payment_balance_amount: row['잔금입금액'] ? parseInt(row['잔금입금액']) : null,

        // 비용 정보
        additional_cost: row['추가공사비'] ? parseInt(row['추가공사비']) : null,
        multiple_stack_cost: row['복수굴뚝비용'] ? parseInt(row['복수굴뚝비용']) : null,
        expansion_pack: row['확장팩'] || '',
        negotiation: row['네고'] || '',
        other_equipment: row['기타'] || ''
      }));
      
      console.log('🔄 헤더 기반 매핑 완료:', mappedBusinesses.slice(0, 2));
      
      // 진행률 추적을 위한 이벤트 스트림 설정
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev < 90) {
            return Math.min(prev + 2, 90) // 90%까지만 자동 증가
          }
          return prev
        })
      }, 500)
      
      try {
        // 배치 업로드 API 호출
        const response = await fetch('/api/business-info-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isBatchUpload: true,
            businesses: mappedBusinesses
          })
        })
        
        clearInterval(progressInterval)
        setUploadProgress(95) // API 완료시 95%
        
        const result = await response.json()
        
        if (response.ok && result.success) {
          setUploadProgress(100) // 완료시 100%
          
          setUploadResults({
            total: result.data.results.total,
            success: result.data.results.created + result.data.results.updated,
            failed: result.data.results.errors,
            errors: result.data.results.errorDetails || [],
            created: result.data.results.created,
            updated: result.data.results.updated
          })
          
          console.log('✅ 배치 업로드 완료:', result.data.results)
          
          // 데이터 새로고침
          await loadAllBusinesses()
        } else {
          throw new Error(result.error || '배치 업로드 실패')
        }
      } catch (apiError) {
        clearInterval(progressInterval)
        throw apiError
      }
      
    } catch (error: any) {
      console.error('파일 업로드 오류:', error)
      alert(`파일 처리 중 오류가 발생했습니다: ${error.message}`)
    } finally {
      setIsUploading(false)
      setUploadProgress(100)
    }
  }

  // 폼 제출 처리 - 실시간 업데이트 최적화
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 편집 모드에서는 원래 사업장명을 보장
    const finalFormData = { ...formData }
    if (editingBusiness && !finalFormData.business_name?.trim()) {
      finalFormData.business_name = editingBusiness.사업장명
    }
    
    if (!finalFormData.business_name?.trim()) {
      alert('사업장명을 입력해주세요.')
      return
    }

    // 제출 버튼 비활성화를 위한 상태 추가
    const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement
    if (submitButton) {
      submitButton.disabled = true
      submitButton.textContent = editingBusiness ? '수정 중...' : '추가 중...'
    }

    try {
      const method = editingBusiness ? 'PUT' : 'POST'
      
      // 담당자 정보는 개별 필드로 직접 사용
      let processedFormData = { ...finalFormData };

      const body = editingBusiness 
        ? { id: editingBusiness.id, updateData: processedFormData }
        : processedFormData

      console.log('📤 [FRONTEND] 전송할 데이터:', JSON.stringify(body, null, 2));

      // 1. 즉시 모달 닫기 (사용자 경험 개선)
      setIsModalOpen(false)
      setShowLocalGovSuggestions(false)

      // 2. Optimistic Update - 편집의 경우 즉시 로컬 상태 업데이트
      if (editingBusiness) {
        const optimisticUpdate = {
          ...editingBusiness,
          ...Object.keys(processedFormData).reduce((acc, key) => {
            // 한글 키로 매핑
            const koreanKeyMap: {[key: string]: string} = {
              'business_name': '사업장명',
              'local_government': '지자체',
              'address': '주소',
              'representative_name': '대표자명',
              'business_registration_number': '사업자등록번호',
              'business_type': '업종',
              'business_contact': '사업장전화번호',
              'manager_name': '담당자명',
              'manager_contact': '담당자연락처',
              'manager_position': '담당자직급',
              'fax_number': '팩스번호',
              'email': '이메일'
            }
            
            const koreanKey = koreanKeyMap[key] || key
            acc[koreanKey] = (processedFormData as any)[key]
            return acc
          }, {} as any),
          수정일: new Date().toISOString()
        }

        // 즉시 로컬 상태 업데이트
        setAllBusinesses(prev => prev.map(business => 
          business.id === editingBusiness.id ? optimisticUpdate : business
        ))
        
        // 선택된 사업장도 업데이트
        if (selectedBusiness && selectedBusiness.id === editingBusiness.id) {
          setSelectedBusiness(optimisticUpdate)
        }
      }

      const response = await fetch('/api/business-info-direct', {
        method,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
          'Accept-Charset': 'utf-8'
        },
        body: JSON.stringify(body)
      })

      const result = await response.json()
      console.log('🔄 API 응답 데이터:', result)

      if (response.ok) {
        // 성공 메시지 표시
        alert(editingBusiness ? '사업장 정보가 수정되었습니다.' : '새 사업장이 추가되었습니다.')

        // 2-1. 사업장 수정 시 자동으로 매출 재계산 (비동기 실행)
        if (editingBusiness && result.success && result.data) {
          const businessId = result.data.id;
          console.log('🔄 [AUTO-RECALCULATE] 사업장 수정됨, 매출 자동 재계산 시작:', businessId);

          // 백그라운드에서 재계산 실행 (사용자 대기 없음)
          const { TokenManager } = await import('@/lib/api-client');
          const token = TokenManager.getToken();

          fetch('/api/revenue/calculate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              business_id: businessId,
              calculation_date: new Date().toISOString().split('T')[0],
              save_result: true
            })
          }).then(calcResponse => calcResponse.json())
            .then(calcData => {
              if (calcData.success) {
                console.log('✅ [AUTO-RECALCULATE] 매출 재계산 완료:', calcData.data.calculation.total_revenue);
              } else {
                console.warn('⚠️ [AUTO-RECALCULATE] 매출 재계산 실패:', calcData.message);
              }
            })
            .catch(err => {
              console.error('❌ [AUTO-RECALCULATE] 매출 재계산 오류:', err);
            });
        }

        // 3. API 응답으로 정확한 데이터 동기화
        if (result.success && result.data) {
          console.log('✅ API 응답에서 받은 업데이트된 데이터:', result.data)
          
          if (editingBusiness) {
            // 편집의 경우: 서버에서 받은 정확한 데이터로 교체
            const serverData = result.data
            const updatedBusiness = {
              id: serverData.id,
              // 기본 정보 (한글/영어 병행)
              사업장명: serverData.business_name || '',
              business_name: serverData.business_name || '',
              지자체: serverData.local_government || '',
              local_government: serverData.local_government || '',
              주소: serverData.address || '',
              address: serverData.address || '',
              대표자명: serverData.representative_name || '',
              대표자: serverData.representative_name || '',
              representative_name: serverData.representative_name || '',
              사업자등록번호: serverData.business_registration_number || '',
              business_registration_number: serverData.business_registration_number || '',
              업종: serverData.business_type || '',
              business_type: serverData.business_type || '',
              사업장전화번호: serverData.business_contact || '',
              사업장연락처: serverData.business_contact || '',
              business_contact: serverData.business_contact || '',
              담당자명: serverData.manager_name || '',
              manager_name: serverData.manager_name || '',
              담당자연락처: serverData.manager_contact || '',
              manager_contact: serverData.manager_contact || '',
              담당자직급: serverData.manager_position || '',
              manager_position: serverData.manager_position || '',
              팩스번호: serverData.fax_number || '',
              fax_number: serverData.fax_number || '',
              이메일: serverData.email || '',
              email: serverData.email || '',
              생성일: serverData.created_at,
              등록일: serverData.created_at,
              created_at: serverData.created_at,
              수정일: serverData.updated_at,
              updated_at: serverData.updated_at,
              상태: serverData.is_active ? '활성' : '비활성',
              is_active: serverData.is_active ?? true,
              is_deleted: serverData.is_deleted ?? false,
              // 프로젝트 관리 필드
              progress_status: serverData.progress_status || null,
              진행상태: serverData.progress_status || null,
              project_year: serverData.project_year || null,
              사업진행연도: serverData.project_year || null,
              installation_team: serverData.installation_team || null,
              설치팀: serverData.installation_team || null,
              order_manager: serverData.order_manager || null,
              // 시스템 필드 (한글/영어 병행)
              manufacturer: serverData.manufacturer || null,
              vpn: serverData.vpn || null,
              greenlink_id: serverData.greenlink_id || null,
              그린링크ID: serverData.greenlink_id || null,
              greenlink_pw: serverData.greenlink_pw || null,
              그린링크PW: serverData.greenlink_pw || null,
              business_management_code: serverData.business_management_code || null,
              사업장관리코드: serverData.business_management_code || null,
              sales_office: serverData.sales_office || null,
              영업점: serverData.sales_office || null,
              // 측정기기 수량 필드 (한글/영어 병행)
              ph_meter: serverData.ph_meter || null,
              PH센서: serverData.ph_meter || null,
              differential_pressure_meter: serverData.differential_pressure_meter || null,
              차압계: serverData.differential_pressure_meter || null,
              temperature_meter: serverData.temperature_meter || null,
              온도계: serverData.temperature_meter || null,
              discharge_current_meter: serverData.discharge_current_meter || null,
              배출전류계: serverData.discharge_current_meter || null,
              fan_current_meter: serverData.fan_current_meter || null,
              송풍전류계: serverData.fan_current_meter || null,
              pump_current_meter: serverData.pump_current_meter || null,
              펌프전류계: serverData.pump_current_meter || null,
              gateway: serverData.gateway || null,
              게이트웨이: serverData.gateway || null,
              vpn_wired: serverData.vpn_wired || null,
              VPN유선: serverData.vpn_wired || null,
              vpn_wireless: serverData.vpn_wireless || null,
              VPN무선: serverData.vpn_wireless || null,
              explosion_proof_differential_pressure_meter_domestic: serverData.explosion_proof_differential_pressure_meter_domestic || null,
              방폭차압계국산: serverData.explosion_proof_differential_pressure_meter_domestic || null,
              explosion_proof_temperature_meter_domestic: serverData.explosion_proof_temperature_meter_domestic || null,
              방폭온도계국산: serverData.explosion_proof_temperature_meter_domestic || null,
              expansion_device: serverData.expansion_device || null,
              확장디바이스: serverData.expansion_device || null,
              relay_8ch: serverData.relay_8ch || null,
              중계기8채널: serverData.relay_8ch || null,
              relay_16ch: serverData.relay_16ch || null,
              중계기16채널: serverData.relay_16ch || null,
              main_board_replacement: serverData.main_board_replacement || null,
              메인보드교체: serverData.main_board_replacement || null,
              multiple_stack: serverData.multiple_stack || null,
              복수굴뚝: serverData.multiple_stack || null,
              // 계산서 및 입금 관리 필드 (보조금 사업장)
              invoice_1st_date: serverData.invoice_1st_date || null,
              invoice_1st_amount: serverData.invoice_1st_amount || null,
              payment_1st_date: serverData.payment_1st_date || null,
              payment_1st_amount: serverData.payment_1st_amount || null,
              invoice_2nd_date: serverData.invoice_2nd_date || null,
              invoice_2nd_amount: serverData.invoice_2nd_amount || null,
              payment_2nd_date: serverData.payment_2nd_date || null,
              payment_2nd_amount: serverData.payment_2nd_amount || null,
              invoice_additional_date: serverData.invoice_additional_date || null,
              payment_additional_date: serverData.payment_additional_date || null,
              payment_additional_amount: serverData.payment_additional_amount || null,
              // 계산서 및 입금 관리 필드 (자비 사업장)
              invoice_advance_date: serverData.invoice_advance_date || null,
              invoice_advance_amount: serverData.invoice_advance_amount || null,
              payment_advance_date: serverData.payment_advance_date || null,
              payment_advance_amount: serverData.payment_advance_amount || null,
              invoice_balance_date: serverData.invoice_balance_date || null,
              invoice_balance_amount: serverData.invoice_balance_amount || null,
              payment_balance_date: serverData.payment_balance_date || null,
              payment_balance_amount: serverData.payment_balance_amount || null,
              // 실사 관리 필드
              estimate_survey_manager: serverData.estimate_survey_manager || null,
              estimate_survey_date: serverData.estimate_survey_date || null,
              pre_construction_survey_manager: serverData.pre_construction_survey_manager || null,
              pre_construction_survey_date: serverData.pre_construction_survey_date || null,
              completion_survey_manager: serverData.completion_survey_manager || null,
              completion_survey_date: serverData.completion_survey_date || null,
              // 비용 정보
              additional_cost: serverData.additional_cost || null,
              multiple_stack_cost: serverData.multiple_stack_cost || null,
              expansion_pack: serverData.expansion_pack || null,
              other_equipment: serverData.other_equipment || null,
              negotiation: serverData.negotiation || null,
              // 기타 프로젝트 필드
              department: serverData.department || null,
              contract_document: serverData.contract_document || null,
              order_request_date: serverData.order_request_date || null,
              wireless_document: serverData.wireless_document || null,
              installation_support: serverData.installation_support || null,
              order_date: serverData.order_date || null,
              shipment_date: serverData.shipment_date || null,
              inventory_check: serverData.inventory_check || null,
              installation_date: serverData.installation_date || null,
              business_category: serverData.business_category || null,
              pollutants: serverData.pollutants || null,
              annual_emission_amount: serverData.annual_emission_amount || null,
              first_report_date: serverData.first_report_date || null,
              operation_start_date: serverData.operation_start_date || null,
              subsidy_approval_date: serverData.subsidy_approval_date || null,
              representative_birth_date: serverData.representative_birth_date || null,
              // 기존 통계 데이터 유지
              fileStats: (editingBusiness as any).fileStats
            }
            
            setAllBusinesses(prev => prev.map(business => 
              business.id === editingBusiness.id ? updatedBusiness as unknown as UnifiedBusinessInfo : business
            ))
            
            if (selectedBusiness && selectedBusiness.id === editingBusiness.id) {
              setSelectedBusiness(updatedBusiness as unknown as UnifiedBusinessInfo)
            }
          } else {
            // 새 사업장 추가의 경우: 전체 목록 새로고침
            await loadAllBusinesses()
          }
        } else {
          // API 응답에 데이터가 없는 경우 전체 새로고침
          await loadAllBusinesses()
        }
        
        // 대기필증 데이터 동기화 (편집인 경우에만)
        if (editingBusiness && finalFormData.business_type && finalFormData.business_category) {
          console.log('🔄 대기필증 데이터 동기화 시작:', {
            businessId: editingBusiness.id,
            businessType: finalFormData.business_type,
            category: finalFormData.business_category
          })
          
          await syncAirPermitData(
            editingBusiness.id,
            finalFormData.business_type,
            finalFormData.business_category
          )
          
          console.log('✅ 대기필증 데이터 동기화 완료')
        }
        
        // 상태 초기화
        setEditingBusiness(null)
        setFormData({})
        
      } else {
        // 에러 발생 시 optimistic update 롤백
        if (editingBusiness) {
          console.log('❌ API 오류로 인한 상태 롤백')
          await loadAllBusinesses()
        }
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : result.message || JSON.stringify(result.error) || '저장에 실패했습니다.';
        console.error('❌ [FRONTEND] API 에러 응답:', result);
        alert(errorMessage);
      }
    } catch (error) {
      console.error('❌ [FRONTEND] 저장 오류:', error)
      // 에러 발생 시 상태 롤백
      if (editingBusiness) {
        await loadAllBusinesses()
      }
      const errorMessage = error instanceof Error ? error.message : '사업장 저장에 실패했습니다.';
      alert(errorMessage);
    } finally {
      // 제출 버튼 상태 복원
      if (submitButton) {
        submitButton.disabled = false
        submitButton.textContent = editingBusiness ? '수정하기' : '추가하기'
      }
    }
  }

  // Table configuration - 시설관리 시스템에 맞게 수정
  const columns = [
    {
      key: '사업장명' as string,
      title: '사업장명',
      width: '200px',
      render: (item: any) => (
        <button
          onClick={() => openDetailModal(item)}
          className="text-left text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          {searchQuery ? highlightSearchTerm(item.사업장명 || '', searchQuery) : item.사업장명}
        </button>
      )
    },
    {
      key: '담당자명' as string,
      title: '담당자',
      width: '100px',
      render: (item: any) => (
        searchQuery ? highlightSearchTerm(item.담당자명 || '-', searchQuery) : (item.담당자명 || '-')
      )
    },
    {
      key: '담당자연락처' as string,
      title: '연락처',
      width: '110px',
      render: (item: any) => (
        searchQuery ? highlightSearchTerm(item.담당자연락처 || '-', searchQuery) : (item.담당자연락처 || '-')
      )
    },
    {
      key: 'manufacturer' as string,
      title: '제조사',
      width: '100px',
      render: (item: any) => {
        const manufacturer = item.manufacturer || '-'

        // 제조사별 스타일 정의
        const getManufacturerStyle = (name: string) => {
          switch(name) {
            case '에코센스':
              return 'bg-emerald-50 text-emerald-700 border-emerald-200'
            case '크린어스':
              return 'bg-sky-50 text-sky-700 border-sky-200'
            case '가이아씨앤에스':
              return 'bg-violet-50 text-violet-700 border-violet-200'
            case '이브이에스':
              return 'bg-amber-50 text-amber-700 border-amber-200'
            default:
              return 'bg-gray-50 text-gray-500 border-gray-200'
          }
        }

        return (
          <div className="text-center">
            <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getManufacturerStyle(manufacturer)}`}>
              {searchQuery ? highlightSearchTerm(manufacturer, searchQuery) : manufacturer}
            </span>
          </div>
        )
      }
    },
    {
      key: '주소' as string,
      title: '주소',
      width: '210px',
      render: (item: any) => (
        <div className="truncate" title={item.주소 || item.local_government || '-'}>
          {searchQuery ? highlightSearchTerm(item.주소 || item.local_government || '-', searchQuery) : (item.주소 || item.local_government || '-')}
        </div>
      )
    },
    {
      key: 'project_year' as string,
      title: '사업 진행연도',
      width: '90px',
      render: (item: any) => {
        const projectYear = item.project_year || (item as any).사업진행연도

        return projectYear ? (
          <div className="text-center">
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              {projectYear}년
            </span>
          </div>
        ) : (
          <div className="text-center text-gray-400 text-xs">-</div>
        )
      }
    },
    {
      key: 'progress_status' as string,
      title: '진행구분',
      width: '100px',
      render: (item: any) => {
        const progressStatus = item.progress_status || (item as any).진행상태 || '-'

        // 진행구분별 스타일 정의
        const getProgressStatusStyle = (status: string) => {
          switch(status) {
            case '자비':
              return 'bg-blue-100 text-blue-800 border-blue-200'
            case '보조금':
              return 'bg-green-100 text-green-800 border-green-200'
            case '보조금 동시진행':
              return 'bg-purple-100 text-purple-800 border-purple-200'
            case '대리점':
              return 'bg-cyan-100 text-cyan-800 border-cyan-200'
            case 'AS':
              return 'bg-orange-100 text-orange-800 border-orange-200'
            default:
              return 'bg-gray-100 text-gray-600 border-gray-200'
          }
        }

        return (
          <div className="text-center">
            <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getProgressStatusStyle(progressStatus)}`}>
              {progressStatus}
            </span>
          </div>
        )
      }
    },
    {
      key: '현재단계',
      title: '현재 단계',
      width: '120px',
      render: (item: any) => {
        const businessName = item.사업장명 || item.business_name || ''
        const taskStatus = businessTaskStatuses[businessName]

        // 로딩 중일 때
        if (isLoadingTasks && !taskStatus) {
          return (
            <div className="text-center">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                조회 중...
              </span>
              <div className="text-xs text-gray-500 mt-1">
                잠시만요
              </div>
            </div>
          )
        }

        // 업무 상태 정보가 있을 때
        if (taskStatus) {
          return (
            <div className="text-center">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${taskStatus.colorClass}`}>
                {taskStatus.statusText}
              </span>
              <div className="text-xs text-gray-500 mt-1">
                {getTaskSummary(taskStatus.taskCount, taskStatus.hasActiveTasks, taskStatus.lastUpdated)}
              </div>
            </div>
          )
        }

        // 기본값 (오류 상황)
        return (
          <div className="text-center">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              업무 미등록
            </span>
            <div className="text-xs text-gray-500 mt-1">
              등록 필요
            </div>
          </div>
        )
      }
    }
  ]

  const businessesWithId = useMemo(() => 
    filteredBusinesses.map(business => ({
      ...business,
      id: business.id
    })), [filteredBusinesses])

  const actions = [
    {
      label: '삭제',
      icon: Trash2,
      onClick: (item: UnifiedBusinessInfo) => confirmDelete(item),
      variant: 'danger' as const,
      show: () => true,
      compact: true  // 작은 버튼 스타일
    }
  ]

  return (
    <AdminLayout
      title="사업장 관리"
      description="사업장 정보 등록 및 관리 시스템"
      actions={
        <>
          {/* 데스크탑에서는 모든 버튼 표시 */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="hidden md:flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-[10px] sm:text-xs md:text-sm lg:text-base"
          >
            <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
            엑셀 업로드
          </button>

          {/* 모바일과 데스크탑 모두에서 표시 - 핵심 액션 */}
          <button
            onClick={openAddModal}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 md:px-4 md:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-[10px] sm:text-xs md:text-sm lg:text-base"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="sm:hidden">추가</span>
            <span className="hidden sm:inline">새 사업장 추가</span>
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2 md:gap-3 lg:gap-4">
          <StatsCard
            title="올해 진행 사업장"
            value={stats.thisYear.toString()}
            icon={Calendar}
            color="blue"
            description={`${new Date().getFullYear()}년 진행 사업장`}
          />
          <StatsCard
            title="보조금 진행 사업장"
            value={stats.subsidy.toString()}
            icon={DollarSign}
            color="green"
            description="보조금 사업 진행 중"
          />
          <StatsCard
            title="자비 진행 사업장"
            value={stats.selfFunded.toString()}
            icon={Wallet}
            color="orange"
            description="자비 사업 진행 중"
          />
          <StatsCard
            title="업무 진행 사업장"
            value={stats.withTasks.toString()}
            icon={ClipboardList}
            color="purple"
            description="업무 단계가 등록된 사업장"
          />
        </div>

        {/* Business List Panel - Single Column Layout */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-full overflow-hidden">
          <div className="p-3 sm:p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                사업장 목록
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs md:text-sm font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {searchQuery ? (
                    `검색결과 ${filteredBusinesses.length}개 (전체 ${allBusinesses.length}개 중)`
                  ) : (
                    `전체 ${allBusinesses.length}개 사업장`
                  )}
                </span>

                {/* 검색 로딩 상태 표시 */}
                {isSearchLoading && (
                  <div className="flex items-center gap-1 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent"></div>
                    <span>검색 상태 조회 중...</span>
                  </div>
                )}

                {/* 페이지별 지연 로딩으로 백그라운드 로딩 UI 제거됨 */}
              </div>
            </div>
            
            {/* 실시간 검색창 */}
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="콤마로 구분하여 다중 검색: 청주, 보조금, 에코센스 (사업장명, 주소, 담당자, 제조사, 진행상태 등)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 text-[10px] sm:text-sm border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>

              {/* 검색 태그 표시 */}
              {searchTerms.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-[10px] sm:text-xs md:text-sm text-gray-600 font-medium">활성 필터:</span>
                  {searchTerms.map((term, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs md:text-sm font-medium text-blue-700 bg-blue-100 border border-blue-200"
                    >
                      {term}
                      <button
                        onClick={() => {
                          const newTerms = searchTerms.filter((_, i) => i !== index)
                          setSearchQuery(newTerms.join(', '))
                        }}
                        className="ml-2 text-blue-500 hover:text-blue-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <span className="text-[10px] sm:text-xs md:text-sm text-gray-500">
                    총 {filteredBusinesses.length}개 사업장
                  </span>
                </div>
              )}

              {/* 필터 드롭다운 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-3 pt-3 border-t border-gray-200">
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">영업점</label>
                  <select
                    value={filterOffice}
                    onChange={(e) => setFilterOffice(e.target.value)}
                    className="w-full px-2 py-1.5 text-[10px] sm:text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">전체</option>
                    {filterOptions.offices.map(office => (
                      <option key={office} value={office}>{office}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">지역</label>
                  <select
                    value={filterRegion}
                    onChange={(e) => setFilterRegion(e.target.value)}
                    className="w-full px-2 py-1.5 text-[10px] sm:text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">전체</option>
                    {filterOptions.regions.map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">진행구분</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-2 py-1.5 text-[10px] sm:text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">전체</option>
                    {filterOptions.categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">사업 진행 연도</label>
                  <select
                    value={filterProjectYear}
                    onChange={(e) => setFilterProjectYear(e.target.value)}
                    className="w-full px-2 py-1.5 text-[10px] sm:text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">전체</option>
                    {filterOptions.years.map(year => (
                      <option key={year} value={year}>{year}년</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
          </div>

          {/* Data Table */}
          <div className="p-2 sm:p-6 overflow-x-auto">
            <div className="min-w-[1090px]">
              <DataTable
                data={businessesWithId}
                columns={columns}
                actions={actions}
                loading={isLoading}
                emptyMessage="등록된 사업장이 없습니다."
                searchable={false}
                pageSize={8}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Business Detail Modal - Enhanced Design */}
      {isDetailModalOpen && selectedBusiness && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50"
        >
          <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-2xl max-w-sm sm:max-w-2xl md:max-w-4xl lg:max-w-7xl w-full max-h-[95vh] overflow-hidden">
            {/* Header with gradient background */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-white bg-opacity-10 backdrop-blur-sm"></div>
              <div className="relative">
                {/* Mobile Layout */}
                <div className="flex flex-col sm:hidden gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-bold truncate">{selectedBusiness?.사업장명 || selectedBusiness?.business_name || '사업장명 없음'}</h2>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsDetailModalOpen(false)}
                      className="flex items-center p-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-blue-100 flex items-center text-xs truncate flex-1 mr-2">
                      <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                      {selectedBusiness?.주소 || selectedBusiness?.local_government || '주소 미등록'}
                    </p>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        selectedBusiness?.is_active || selectedBusiness?.상태 === '활성'
                          ? 'bg-green-500 bg-opacity-20 text-green-100 border border-green-300 border-opacity-30'
                          : 'bg-gray-500 bg-opacity-20 text-gray-200 border border-gray-300 border-opacity-30'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-1 ${
                          selectedBusiness?.is_active || selectedBusiness?.상태 === '활성' ? 'bg-green-300' : 'bg-gray-300'
                        }`}></div>
                        {selectedBusiness?.is_active || selectedBusiness?.상태 === '활성' ? '활성' : '비활성'}
                      </div>
                      <button
                        onClick={() => {
                          setIsDetailModalOpen(false)
                          openEditModal(selectedBusiness)
                        }}
                        className="flex items-center px-2 py-1 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200 text-xs font-medium border border-white border-opacity-30"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        수정
                      </button>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex items-center space-x-3 md:space-x-4 min-w-0 flex-1 mr-4">
                    <div className="p-2 md:p-3 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm flex-shrink-0">
                      <Building2 className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg md:text-xl lg:text-2xl font-bold truncate">{selectedBusiness?.사업장명 || selectedBusiness?.business_name || '사업장명 없음'}</h2>
                      <p className="text-blue-100 flex items-center mt-1 text-sm md:text-base truncate">
                        <MapPin className="w-3 h-3 md:w-4 md:h-4 mr-1 flex-shrink-0" />
                        {selectedBusiness?.주소 || selectedBusiness?.local_government || '주소 미등록'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
                    <div className="text-right">
                      <div className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                        selectedBusiness?.is_active || selectedBusiness?.상태 === '활성'
                          ? 'bg-green-500 bg-opacity-20 text-green-100 border border-green-300 border-opacity-30'
                          : 'bg-gray-500 bg-opacity-20 text-gray-200 border border-gray-300 border-opacity-30'
                      }`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          selectedBusiness?.is_active || selectedBusiness?.상태 === '활성' ? 'bg-green-300' : 'bg-gray-300'
                        }`}></div>
                        {selectedBusiness?.is_active || selectedBusiness?.상태 === '활성' ? '활성' : '비활성'}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 md:space-x-2">
                      <button
                        onClick={() => {
                          setIsDetailModalOpen(false)
                          openEditModal(selectedBusiness)
                        }}
                        className="flex items-center px-2 md:px-3 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200 text-xs md:text-sm font-medium border border-white border-opacity-30 hover:border-opacity-50"
                      >
                        <Edit className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-1.5" />
                        <span className="hidden md:inline">정보수정</span>
                        <span className="md:hidden">수정</span>
                      </button>
                      <button
                        onClick={() => setIsDetailModalOpen(false)}
                        className="flex items-center px-2 md:px-3 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200 text-xs md:text-sm font-medium border border-white border-opacity-30 hover:border-opacity-50"
                      >
                        <X className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-1.5" />
                        <span className="hidden md:inline">닫기</span>
                        <span className="md:hidden">닫기</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Content area with balanced layout */}
            <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
              <div className="p-3 sm:p-4 md:p-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                  {/* Left Column - Basic Info */}
                  <div className="space-y-3 sm:space-y-4 md:space-y-6">
                    {/* Basic Information Card */}
                    <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-slate-200">
                      <div className="flex items-center mb-2 sm:mb-3 md:mb-4">
                        <div className="p-1.5 sm:p-2 bg-blue-600 rounded-lg mr-2 sm:mr-3">
                          <Building className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">기본 정보</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <Factory className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-blue-500 flex-shrink-0" />
                            사업장명
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">{selectedBusiness.사업장명}</div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-green-500 flex-shrink-0" />
                            지자체
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">{selectedBusiness.지자체 || '-'}</div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm md:col-span-2">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-red-500 flex-shrink-0" />
                            주소
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">{selectedBusiness.주소 || '-'}</div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-purple-500 flex-shrink-0" />
                            대표자명
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">{selectedBusiness.대표자 || '-'}</div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <Hash className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-orange-500 flex-shrink-0" />
                            <span className="hidden sm:inline">사업자등록번호</span>
                            <span className="sm:hidden">사업자번호</span>
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">{selectedBusiness.사업자등록번호 || '-'}</div>
                        </div>

                        {selectedBusiness.project_year && (
                          <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                            <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-indigo-500 flex-shrink-0" />
                              사업 진행연도
                            </div>
                            <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">
                              <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                                {selectedBusiness.project_year}년
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contact Information Card */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-green-200">
                      <div className="flex items-center mb-2 sm:mb-3 md:mb-4">
                        <div className="p-1.5 sm:p-2 bg-green-600 rounded-lg mr-2 sm:mr-3">
                          <Contact className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">담당자 정보</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-green-500 flex-shrink-0" />
                            담당자명
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">
                            {selectedBusiness.담당자명 || '-'}
                          </div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <Briefcase className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-blue-500 flex-shrink-0" />
                            직급
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">
                            {selectedBusiness.담당자직급 || '-'}
                          </div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-green-500 flex-shrink-0" />
                            <span className="hidden sm:inline">담당자 연락처</span>
                            <span className="sm:hidden">담당자전화</span>
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">
                            {selectedBusiness.담당자연락처 || '-'}
                          </div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-blue-500 flex-shrink-0" />
                            <span className="hidden sm:inline">사업장 연락처</span>
                            <span className="sm:hidden">사업장전화</span>
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">{selectedBusiness.사업장연락처 || '-'}</div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-gray-500 flex-shrink-0" />
                            팩스번호
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">{selectedBusiness.fax_number || '-'}</div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                            <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-red-500 flex-shrink-0" />
                            이메일
                          </div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-all">{selectedBusiness.email || '-'}</div>
                        </div>

                        {selectedBusiness.representative_birth_date && (
                          <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                            <div className="flex items-center text-[10px] sm:text-xs md:text-sm text-gray-600 mb-1">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-purple-500 flex-shrink-0" />
                              <span className="hidden sm:inline">대표자생년월일</span>
                              <span className="sm:hidden">대표자생일</span>
                            </div>
                            <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">{selectedBusiness.representative_birth_date}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Work Progress & Communication Area */}
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-orange-200">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="flex items-center">
                          <div className="p-1.5 sm:p-2 bg-orange-600 rounded-lg mr-2 sm:mr-3">
                            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          </div>
                          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">업무 진행 현황</h3>
                        </div>
                        <button
                          onClick={() => setIsAddingMemo(true)}
                          className="flex items-center px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] md:text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors"
                        >
                          <MessageSquarePlus className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                          <span className="hidden sm:inline">메모 추가</span><span className="sm:hidden">메모</span>
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Task Progress Mini Board */}
                        <TaskProgressMiniBoard
                          businessName={selectedBusiness.사업장명}
                          onStatusChange={(taskId, newStatus) => {
                            console.log('업무 상태 변경:', { taskId, newStatus, business: selectedBusiness.사업장명 });
                          }}
                        />

                        {/* Team Communication */}
                        <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                          <div className="flex items-center text-xs sm:text-sm md:text-base text-gray-600 mb-2">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-blue-500" />
                            팀 공유 사항
                          </div>
                          <div className="space-y-1.5 sm:space-y-2">
                            <div className="text-xs sm:text-sm text-gray-700 p-2 sm:p-3 bg-gray-50 rounded-lg">
                              • 설치 담당자: {selectedBusiness.installation_team || '미배정'}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-700 p-2 sm:p-3 bg-blue-50 rounded-lg">
                              • 주문 담당자: {selectedBusiness.order_manager || '미배정'}
                            </div>
                            {selectedBusiness.installation_date && (
                              <div className="text-xs sm:text-sm text-gray-700 p-2 sm:p-3 bg-green-50 rounded-lg">
                                • 설치 예정일: {selectedBusiness.installation_date}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Important Notes */}
                        <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                          <div className="flex items-center text-xs sm:text-sm md:text-base text-gray-600 mb-2">
                            <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-amber-500" />
                            확인 필요 사항
                          </div>
                          <div className="space-y-1.5 sm:space-y-2">
                            {!selectedBusiness.manager_contact && (
                              <div className="text-xs sm:text-sm text-red-600 p-2 bg-red-50 rounded-lg flex items-center">
                                <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                담당자 연락처 확인 필요
                              </div>
                            )}
                            {!selectedBusiness.installation_support && (
                              <div className="text-xs sm:text-sm text-yellow-600 p-2 bg-yellow-50 rounded-lg flex items-center">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                설치 지원 여부 확인 필요
                              </div>
                            )}
                            {selectedBusiness.additional_cost && selectedBusiness.additional_cost > 0 && (
                              <div className="text-xs sm:text-sm text-blue-600 p-2 bg-blue-50 rounded-lg flex items-center">
                                <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                추가 비용 협의: {selectedBusiness.additional_cost?.toLocaleString()}원
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 메모 및 업무 통합 섹션 (최신순 정렬) */}
                        {(businessMemos.length > 0 || businessTasks.length > 0) && (
                          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                            <div className="flex items-center text-xs sm:text-sm md:text-base text-gray-600 mb-2 sm:mb-3">
                              <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-indigo-500" />
                              메모 및 업무 ({businessMemos.length + businessTasks.length}개)
                            </div>
                            {/* 스크롤 가능한 컨테이너 추가 - 최대 높이 제한으로 내용이 많아져도 스크롤 가능 */}
                            <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto pr-1 sm:pr-2" style={{scrollbarWidth: 'thin'}}>
                              {getIntegratedItems().map((item, index) => {
                                if (item.type === 'memo') {
                                  const memo = item.data
                                  const isAutoMemo = item.title?.startsWith('[자동]')
                                  return (
                                    <div key={`memo-${item.id}-${index}`} className={`${isAutoMemo ? 'bg-gray-50 border-gray-300' : 'bg-gray-50 border-indigo-400'} rounded-lg p-2 sm:p-3 border-l-4`}>
                                  <div className="flex items-start justify-between mb-1 sm:mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                                        <MessageSquare className={`w-3 h-3 sm:w-4 sm:h-4 ${isAutoMemo ? 'text-gray-400' : 'text-indigo-500'}`} />
                                        <h4 className={`${isAutoMemo ? 'font-normal text-gray-600 text-xs sm:text-sm' : 'font-medium text-gray-900 text-xs sm:text-sm md:text-base'}`}>{item.title}</h4>
                                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-medium rounded-full ${isAutoMemo ? 'bg-gray-100 text-gray-600' : 'bg-indigo-100 text-indigo-700'}`}>
                                          {isAutoMemo ? '자동' : '메모'}
                                        </span>
                                      </div>
                                      <p className={`text-xs sm:text-sm ${isAutoMemo ? 'text-gray-500' : 'text-gray-700'} leading-relaxed break-words`}>{item.content}</p>
                                    </div>
                                    {(!isAutoMemo || (isAutoMemo && canDeleteAutoMemos)) && (
                                      <div className="flex items-center space-x-0.5 sm:space-x-1 ml-1 sm:ml-2">
                                        {!isAutoMemo && (
                                          <button
                                            onClick={() => startEditMemo(memo)}
                                            disabled={!memo.id}
                                            className={`p-1 sm:p-1.5 rounded transition-colors ${
                                              memo.id
                                                ? 'text-gray-400 hover:text-indigo-600'
                                                : 'text-gray-300 cursor-not-allowed'
                                            }`}
                                            title={memo.id ? "메모 수정" : "메모 ID가 없어 수정할 수 없습니다"}
                                          >
                                            <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDeleteMemo(memo)}
                                          disabled={!memo.id}
                                          className={`p-1 sm:p-1.5 rounded transition-colors ${
                                            memo.id
                                              ? 'text-gray-400 hover:text-red-600'
                                              : 'text-gray-300 cursor-not-allowed'
                                          }`}
                                          title={memo.id ?
                                            (isAutoMemo ? "자동 메모 삭제 (슈퍼 관리자 전용)" : "메모 삭제") :
                                            "메모 ID가 없어 삭제할 수 없습니다"
                                          }
                                        >
                                          <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[10px] sm:text-xs text-gray-500 gap-1 sm:gap-0">
                                    <span>작성: {new Date(memo.created_at).toLocaleDateString('ko-KR', {
                                      year: 'numeric', month: 'short', day: 'numeric'
                                    })} ({memo.created_by})</span>
                                    {memo.updated_at !== memo.created_at && (
                                      <span>수정: {new Date(memo.updated_at).toLocaleDateString('ko-KR', {
                                        year: 'numeric', month: 'short', day: 'numeric'
                                      })} ({memo.updated_by})</span>
                                    )}
                                  </div>
                                    </div>
                                  )
                                } else {
                                  // 업무 카드
                                  const task = item.data
                                  const statusColors = getStatusColor(item.status || '')

                                  return (
                                    <div key={`task-${item.id}-${index}`} className={`${statusColors.bg} rounded-lg p-2 sm:p-3 md:p-4 border-l-4 ${statusColors.border} hover:shadow-md transition-shadow`}>
                                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-1 sm:space-x-2 mb-1 sm:mb-2">
                                            <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                                            <h4 className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base">{item.title}</h4>
                                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-medium rounded-full ${statusColors.badge} ${statusColors.text}`}>
                                              {getStatusDisplayName(item.status || '')}
                                            </span>
                                          </div>
                                          <p className="text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3 leading-relaxed break-words">{item.description}</p>
                                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                                            <span className="flex items-center space-x-1">
                                              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full"></span>
                                              <span className="text-gray-600">
                                                {item.task_type === 'subsidy' ? '지원사업' : '자체사업'}
                                              </span>
                                            </span>
                                            <span className="flex items-center space-x-1">
                                              <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                                              <span className="text-gray-600">{item.assignee}</span>
                                            </span>
                                            <span className="flex items-center space-x-1">
                                              <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                                              <span className="text-gray-600">
                                                {task.deadline ? new Date(task.deadline).toLocaleDateString('ko-KR', {
                                                  month: 'short', day: 'numeric'
                                                }) : '미정'}
                                              </span>
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[10px] sm:text-xs text-gray-500 pt-2 border-t border-gray-200 gap-1 sm:gap-0">
                                        <span className="flex items-center space-x-1">
                                          <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                          <span>생성: {new Date(item.created_at).toLocaleDateString('ko-KR', {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                          })}</span>
                                        </span>
                                        {task.updated_at !== task.created_at && (
                                          <span className="flex items-center space-x-1">
                                            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                            <span>수정: {new Date(task.updated_at).toLocaleDateString('ko-KR', {
                                              year: 'numeric', month: 'short', day: 'numeric'
                                            })}</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                }
                              })}
                            </div>
                          </div>
                        )}

                        {/* 메모 추가/편집 폼 */}
                        {(isAddingMemo || editingMemo) && (
                          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-indigo-200">
                            <div className="flex items-center text-xs sm:text-sm text-indigo-600 mb-2 sm:mb-3">
                              <MessageSquarePlus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                              {editingMemo ? '메모 수정' : '새 메모 추가'}
                            </div>
                            <div className="space-y-2 sm:space-y-3">
                              <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">제목</label>
                                <input
                                  type="text"
                                  value={memoForm.title}
                                  onChange={(e) => setMemoForm(prev => ({ ...prev, title: e.target.value }))}
                                  placeholder="메모 제목을 입력하세요"
                                  className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">내용</label>
                                <textarea
                                  value={memoForm.content}
                                  onChange={(e) => setMemoForm(prev => ({ ...prev, content: e.target.value }))}
                                  placeholder="메모 내용을 입력하세요"
                                  rows={3}
                                  className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm resize-none"
                                />
                              </div>
                              <div className="flex justify-end space-x-1.5 sm:space-x-2">
                                <button
                                  onClick={() => {
                                    setIsAddingMemo(false)
                                    setEditingMemo(null)
                                    setMemoForm({ title: '', content: '' })
                                  }}
                                  className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                  취소
                                </button>
                                <button
                                  onClick={editingMemo ? handleEditMemo : handleAddMemo}
                                  disabled={!memoForm.title?.trim() || !memoForm.content?.trim()}
                                  className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                                >
                                  {editingMemo ? '수정' : '추가'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - System Info & Status */}
                  <div className="space-y-3 sm:space-y-4 md:space-y-6">
                    {/* System Information Card */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-purple-200">
                      <div className="flex items-center mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-purple-600 rounded-lg mr-2 sm:mr-3">
                          <Database className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">시스템 정보</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="text-xs sm:text-sm text-gray-600 mb-1">제조사</div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">
                            {selectedBusiness.manufacturer === 'ecosense' ? '🏭 에코센스' :
                             selectedBusiness.manufacturer === 'cleanearth' ? '🌍 크린어스' :
                             selectedBusiness.manufacturer === 'gaia_cns' ? '🌿 가이아씨앤에스' :
                             selectedBusiness.manufacturer === 'evs' ? '⚡ 이브이에스' :
                             selectedBusiness.manufacturer || '-'}
                          </div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="text-xs sm:text-sm text-gray-600 mb-1">VPN 연결</div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">
                            {selectedBusiness.vpn === 'wired' ? '🔗 유선' :
                             selectedBusiness.vpn === 'wireless' ? '📶 무선' :
                             selectedBusiness.vpn || '-'}
                          </div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="text-xs sm:text-sm text-gray-600 mb-1">그린링크 ID</div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">{selectedBusiness.greenlink_id || '-'}</div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="text-xs sm:text-sm text-gray-600 mb-1">그린링크 PW</div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 flex items-center">
                            {selectedBusiness.greenlink_pw ? (
                              <>
                                <Shield className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-green-500" />
                                설정됨
                              </>
                            ) : '-'}
                          </div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="text-xs sm:text-sm text-gray-600 mb-1">사업장관리코드</div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">{selectedBusiness.business_management_code || '-'}</div>
                        </div>

                        <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                          <div className="text-xs sm:text-sm text-gray-600 mb-1">영업점</div>
                          <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">{selectedBusiness.sales_office || '-'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Equipment and Network Card */}
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-teal-200">
                      <div className="flex items-center mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-teal-600 rounded-lg mr-2 sm:mr-3">
                          <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">측정기기 및 네트워크</h3>
                      </div>
                      
                      {/* Equipment Quantities with Facility Management Comparison */}
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-3 sm:p-4 border border-purple-200 mb-3 sm:mb-4">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="text-xs sm:text-sm md:text-base font-semibold text-purple-700">측정기기 수량</div>
                          <button
                            onClick={() => {
                              // 시설관리 시스템의 해당 사업장 페이지로 연결
                              const businessName = encodeURIComponent(selectedBusiness.business_name || selectedBusiness.사업장명 || '');
                              if (businessName) {
                                window.open(`/business/${businessName}`, '_blank');
                              } else {
                                alert('사업장명 정보가 없어 시설관리 시스템으로 연결할 수 없습니다.');
                              }
                            }}
                            className="text-[9px] sm:text-[10px] md:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                          >
                            <span className="hidden sm:inline">시설관리 연동</span><span className="sm:hidden">연동</span>
                          </button>
                        </div>
                        <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                          {(() => {
                            const devices = [
                              { key: 'PH센서', value: selectedBusiness.PH센서, facilityKey: 'ph' },
                              { key: '차압계', value: selectedBusiness.차압계, facilityKey: 'pressure' },
                              { key: '온도계', value: selectedBusiness.온도계, facilityKey: 'temperature' },
                              { key: '배출전류계', value: selectedBusiness.배출전류계, facilityKey: 'discharge' },
                              { key: '송풍전류계', value: selectedBusiness.송풍전류계, facilityKey: 'fan' },
                              { key: '펌프전류계', value: selectedBusiness.펌프전류계, facilityKey: 'pump' },
                              { key: '게이트웨이', value: selectedBusiness.게이트웨이, facilityKey: 'gateway' },
                              { key: '방폭차압계(국산)', value: selectedBusiness.방폭차압계국산, facilityKey: 'explosionProofPressure' },
                              { key: '방폭온도계(국산)', value: selectedBusiness.방폭온도계국산, facilityKey: 'explosionProofTemp' },
                              { key: '확장디바이스', value: selectedBusiness.확장디바이스, facilityKey: 'expansionDevice' },
                              { key: '중계기(8채널)', value: selectedBusiness.중계기8채널, facilityKey: 'relay8ch' },
                              { key: '중계기(16채널)', value: selectedBusiness.중계기16채널, facilityKey: 'relay16ch' },
                              { key: '메인보드교체', value: selectedBusiness.메인보드교체, facilityKey: 'mainBoard' },
                              { key: 'VPN(유선)', value: selectedBusiness.VPN유선, facilityKey: 'vpnWired' },
                              { key: 'VPN(무선)', value: selectedBusiness.VPN무선, facilityKey: 'vpnWireless' },
                              { key: '복수굴뚝', value: selectedBusiness.복수굴뚝, facilityKey: 'multipleStack' }
                            ];
                            
                            return devices
                              .filter(device => device.value && device.value > 0)
                              .map((device, index) => (
                                <div key={`${device.facilityKey}-${device.key}-${index}`} className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 shadow-sm">
                                  <div className="text-[10px] sm:text-xs text-gray-600 mb-1 break-words">{device.key}</div>
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm sm:text-base md:text-lg font-bold text-gray-900">{device.value}</div>
                                    {facilityDeviceCounts?.[device.facilityKey as keyof typeof facilityDeviceCounts] !== undefined && (
                                      <div className={`text-[10px] sm:text-xs ${
                                        facilityDeviceCounts[device.facilityKey as keyof typeof facilityDeviceCounts] === device.value
                                          ? 'text-green-600'
                                          : 'text-orange-600'
                                      }`}>
                                        시설관리: {facilityDeviceCounts[device.facilityKey as keyof typeof facilityDeviceCounts] || 0}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ));
                          })()}
                        </div>
                      </div>

                      {/* Facility Information based on Air Permits */}
                      {facilityLoading ? (
                        <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 text-center text-gray-500">
                          <Settings className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-gray-300 mx-auto mb-2" />
                          <div className="text-xs sm:text-sm">시설 정보를 불러오는 중...</div>
                        </div>
                      ) : facilityData ? (
                        <>
                          {/* Facility Summary Card */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 sm:p-4 border border-blue-200 mb-3 sm:mb-4">
                            <div className="text-xs sm:text-sm md:text-base font-semibold text-blue-700 mb-2 sm:mb-3">시설 정보 (대기필증 기준)</div>
                            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 text-center">
                              <div>
                                <div className="text-[10px] sm:text-xs md:text-sm text-blue-600 mb-1">배출시설</div>
                                <div className="text-sm sm:text-lg md:text-xl font-bold text-blue-800">{facilityData.summary.discharge_count}</div>
                              </div>
                              <div>
                                <div className="text-[10px] sm:text-xs md:text-sm text-blue-600 mb-1">방지시설</div>
                                <div className="text-sm sm:text-lg md:text-xl font-bold text-blue-800">{facilityData.summary.prevention_count}</div>
                              </div>
                              <div>
                                <div className="text-[10px] sm:text-xs md:text-sm text-blue-600 mb-1">배출구</div>
                                <div className="text-sm sm:text-lg md:text-xl font-bold text-blue-900">
                                  {facilityData.discharge_facilities.concat(facilityData.prevention_facilities)
                                    .reduce((outlets, facility) => {
                                      const outletKey = facility.outlet_number;
                                      return outlets.includes(outletKey) ? outlets : [...outlets, outletKey];
                                    }, [] as number[]).length}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 text-center text-gray-500">
                          <Settings className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-gray-300 mx-auto mb-2" />
                          <div className="text-xs sm:text-sm">등록된 대기필증 정보가 없습니다</div>
                          <div className="text-[10px] sm:text-xs text-gray-400 mt-1">시설 정보를 확인하려면 먼저 대기필증을 등록하세요</div>
                        </div>
                      )}
                    </div>

                    {/* Project Information Card */}
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-orange-200">
                      <div className="flex items-center mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-orange-600 rounded-lg mr-2 sm:mr-3">
                          <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">프로젝트 정보</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                        {selectedBusiness.department && (
                          <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1">담당부서</div>
                            <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">{selectedBusiness.department}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.progress_status && (
                          <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1">진행구분</div>
                            <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">{selectedBusiness.progress_status}</div>
                          </div>
                        )}
                        
                        {/* 업종 - 대기필증 데이터 우선 표시 */}
                        {(airPermitData?.business_type || selectedBusiness.업종) && (
                          <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1 sm:gap-2">
                              업종
                              {airPermitData?.business_type && (
                                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-800 text-[9px] sm:text-[10px] md:text-xs rounded-full">
                                  대기필증 연동
                                </span>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 break-words">
                              {airPermitData?.business_type || selectedBusiness.업종}
                            </div>
                            {airPermitData?.business_type && selectedBusiness.업종 &&
                             airPermitData.business_type !== selectedBusiness.업종 && (
                              <div className="text-[10px] sm:text-xs text-amber-600 mt-1">
                                사업장 정보와 다름: {selectedBusiness.업종}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 종별 - 대기필증 데이터 우선 표시 */}
                        {(airPermitData?.category || selectedBusiness.business_category) && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                              종별
                              {airPermitData?.category && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  대기필증 연동
                                </span>
                              )}
                            </div>
                            <div className="text-base font-medium text-gray-900">
                              {airPermitData?.category || selectedBusiness.business_category}
                            </div>
                            {airPermitData?.category && selectedBusiness.business_category && 
                             airPermitData.category !== selectedBusiness.business_category && (
                              <div className="text-xs text-amber-600 mt-1">
                                사업장 정보와 다름: {selectedBusiness.business_category}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {selectedBusiness.상태 && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">상태</div>
                            <div className="text-base font-medium text-gray-900">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                selectedBusiness.상태 === '활성' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {selectedBusiness.상태}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {selectedBusiness.order_manager && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">발주담당</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.order_manager}</div>
                          </div>
                        )}

                        {selectedBusiness.progress_status && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">진행구분</div>
                            <div className="text-base font-medium">
                              <span className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                                selectedBusiness.progress_status === '자비'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : selectedBusiness.progress_status === '보조금'
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : selectedBusiness.progress_status === '보조금 동시진행'
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : selectedBusiness.progress_status === '대리점'
                                  ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
                                  : selectedBusiness.progress_status === 'AS'
                                  ? 'bg-orange-100 text-orange-800 border-orange-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}>
                                {selectedBusiness.progress_status}
                              </span>
                            </div>
                          </div>
                        )}

                        {selectedBusiness.project_year && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">사업 진행연도</div>
                            <div className="text-base font-medium text-gray-900">
                              <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                {selectedBusiness.project_year}년
                              </span>
                            </div>
                          </div>
                        )}

                        {selectedBusiness.installation_team && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">설치팀</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.installation_team}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Schedule Information Card */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-blue-200">
                      <div className="flex items-center mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-blue-600 rounded-lg mr-2 sm:mr-3">
                          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">일정 정보</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                        {selectedBusiness.order_request_date && (
                          <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1">발주요청일</div>
                            <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">{selectedBusiness.order_request_date}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.order_date && (
                          <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1">발주일</div>
                            <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">{selectedBusiness.order_date}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.shipment_date && (
                          <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1">출고일</div>
                            <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">{selectedBusiness.shipment_date}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.installation_date && (
                          <div className="bg-white rounded-md sm:rounded-lg p-2 sm:p-3 md:p-4 shadow-sm">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1">설치일</div>
                            <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900">{selectedBusiness.installation_date}</div>
                          </div>
                        )}
                        
                        
                        {selectedBusiness.subsidy_approval_date && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">보조금 승인일</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.subsidy_approval_date}</div>
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Financial Information Card - Revenue Management Link */}
                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-yellow-200">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="flex items-center">
                          <div className="p-1.5 sm:p-2 bg-yellow-600 rounded-lg mr-2 sm:mr-3">
                            <Database className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          </div>
                          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">비용 및 매출 정보</h3>
                        </div>
                      </div>

                      <div className="text-center py-6">
                        <p className="text-sm text-gray-600 mb-4">
                          이 사업장의 상세한 비용 및 매출 정보를<br />
                          확인할 수 있습니다.
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              // API를 통해 매출 계산 (DB의 환경부 고시가 및 제조사별 원가 사용)
                              console.log('🔢 [REVENUE-MODAL] API를 통한 매출 계산 시작:', selectedBusiness.id)

                              const token = localStorage.getItem('auth_token')
                              const response = await fetch('/api/revenue/calculate', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                  business_id: selectedBusiness.id,
                                  calculation_date: new Date().toISOString().split('T')[0],
                                  save_result: false // 저장하지 않고 계산만 수행
                                })
                              })

                              const data = await response.json()

                              if (data.success) {
                                const calculatedData = data.data.calculation
                                console.log('✅ [REVENUE-MODAL] API 계산 완료:', calculatedData)

                                // 계산된 데이터를 사업장 정보에 병합
                                const enrichedBusiness = {
                                  ...selectedBusiness,
                                  ...calculatedData
                                }

                                console.log('📊 [REVENUE-MODAL] 병합된 사업장 데이터:', enrichedBusiness)
                                setSelectedRevenueBusiness(enrichedBusiness)
                                setShowRevenueModal(true)
                              } else {
                                console.error('❌ [REVENUE-MODAL] API 계산 실패:', data.message)
                                alert('매출 계산에 실패했습니다: ' + data.message)
                              }
                            } catch (error) {
                              console.error('❌ [REVENUE-MODAL] API 호출 오류:', error)
                              alert('매출 계산 중 오류가 발생했습니다.')
                            }
                          }}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors shadow-md hover:shadow-lg font-medium"
                        >
                          <Calculator className="w-5 h-5" />
                          매출 상세보기
                        </button>
                      </div>
                    </div>

                    {/* Invoice Management Section */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-purple-200">
                      <div className="flex items-center mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-purple-600 rounded-lg mr-2 sm:mr-3">
                          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">계산서 및 입금 현황</h3>
                      </div>
                      {(() => {
                        // business_category 또는 progress_status에서 카테고리 가져오기
                        const category = selectedBusiness.business_category || selectedBusiness.진행구분 || (selectedBusiness as any).progress_status;
                        // 진행구분을 보조금/자비로 매핑 (모든 진행구분 허용)
                        const mappedCategory = mapCategoryToInvoiceType(category);

                        return (
                          <InvoiceDisplay
                            key={`invoice-${selectedBusiness.id}-${selectedBusiness.수정일 || selectedBusiness.생성일}`}
                            businessId={selectedBusiness.id}
                            businessCategory={mappedCategory}
                            additionalCost={selectedBusiness.additional_cost}
                          />
                        );
                      })()}
                    </div>

                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Business Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50"
        >
          <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-2xl max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-7xl w-full max-h-[90vh] sm:max-h-[90vh] overflow-hidden">
            <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-white bg-opacity-20 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 md:mr-4">
                    <Edit className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" />
                  </div>
                  <h2 className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold">
                    {editingBusiness ? '사업장 정보 수정' : '새 사업장 추가'}
                  </h2>
                </div>
                {/* Action Buttons */}
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <button
                    type="submit"
                    form="business-form"
                    className="flex items-center px-2 sm:px-3 py-1 sm:py-2 bg-white bg-opacity-20 text-white rounded-md sm:rounded-lg hover:bg-opacity-30 transition-all duration-200 text-[10px] sm:text-xs md:text-sm font-medium border border-white border-opacity-30 hover:border-opacity-50"
                  >
                    <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                    <span className="hidden sm:inline">{editingBusiness ? '수정완료' : '추가완료'}</span>
                    <span className="sm:hidden">{editingBusiness ? '수정' : '추가'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
                      setShowLocalGovSuggestions(false)
                    }}
                    className="flex items-center px-2 sm:px-3 py-1 sm:py-2 bg-white bg-opacity-20 text-white rounded-md sm:rounded-lg hover:bg-opacity-30 transition-all duration-200 text-[10px] sm:text-xs md:text-sm font-medium border border-white border-opacity-30 hover:border-opacity-50"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                    <span className="hidden sm:inline">취소</span>
                    <span className="sm:hidden">✕</span>
                  </button>
                </div>
              </div>
            </div>
            
            <form id="business-form" onSubmit={handleSubmit} className="p-3 sm:p-4 md:p-6 lg:p-8 max-h-[70vh] sm:max-h-[75vh] md:max-h-[80vh] overflow-y-auto">
              <div className="space-y-4 sm:space-y-6 md:space-y-8">
                {/* 기본 정보 */}
                <div>
                  <div className="flex items-center mb-3 sm:mb-4 md:mb-6">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-2 sm:mr-2.5 md:mr-3">
                      <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white" />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">기본 정보</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 sm:p-5 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">사업장명 *</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.business_name || ''}
                        onChange={(e) => setFormData({...formData, business_name: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">지자체</label>
                      <div className="relative">
                        <input
                          type="text"
                          lang="ko"
                          inputMode="text"
                          value={formData.local_government || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            setFormData({...formData, local_government: value})
                            
                            if (value.length > 0) {
                              const suggestions = KOREAN_LOCAL_GOVERNMENTS.filter(gov => 
                                gov.toLowerCase().includes(value.toLowerCase())
                              ).slice(0, 5)
                              setLocalGovSuggestions(suggestions)
                              setShowLocalGovSuggestions(true)
                            } else {
                              setShowLocalGovSuggestions(false)
                            }
                          }}
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                          placeholder="예: 서울특별시, 부산광역시..."
                        />
                        
                        {showLocalGovSuggestions && localGovSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {localGovSuggestions.map((gov, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setFormData({...formData, local_government: gov})
                                  setShowLocalGovSuggestions(false)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                              >
                                {gov}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">주소</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.address || ''}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">대표자명</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.representative_name || ''}
                        onChange={(e) => setFormData({...formData, representative_name: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">사업자등록번호</label>
                      <input
                        type="text"
                        value={formData.business_registration_number || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '')
                          let formatted = value
                          if (value.length >= 3 && value.length <= 5) {
                            formatted = `${value.slice(0, 3)}-${value.slice(3)}`
                          } else if (value.length > 5) {
                            formatted = `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5, 10)}`
                          }
                          setFormData({...formData, business_registration_number: formatted})
                        }}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="000-00-00000"
                        maxLength={12}
                      />
                    </div>
                    </div>
                  </div>
                </div>

                {/* 담당자 정보 */}
                <div>
                  <div className="flex items-center mb-3 sm:mb-4 md:mb-6">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-2 sm:mr-2.5 md:mr-3">
                      <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white" />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">담당자 정보</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 sm:p-5 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">담당자명</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.manager_name || ''}
                        onChange={(e) => setFormData({...formData, manager_name: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="김태훈"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">직급</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.manager_position || ''}
                        onChange={(e) => setFormData({...formData, manager_position: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="팀장"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">담당자 연락처</label>
                      <input
                        type="tel"
                        value={formData.manager_contact || ''}
                        onChange={(e) => setFormData({...formData, manager_contact: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="010-1234-5678"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">사업장 연락처</label>
                      <input
                        type="tel"
                        value={formData.business_contact || ''}
                        onChange={(e) => setFormData({...formData, business_contact: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="02-0000-0000"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">팩스번호</label>
                      <input
                        type="tel"
                        value={formData.fax_number || ''}
                        onChange={(e) => setFormData({...formData, fax_number: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="02-0000-0000"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">이메일</label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="example@company.com"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">대표자생년월일</label>
                      <input
                        type="date"
                        value={formData.representative_birth_date || ''}
                        onChange={(e) => setFormData({...formData, representative_birth_date: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>
                    </div>
                  </div>
                </div>

                {/* 사업장 정보 */}
                <div>
                  <div className="flex items-center mb-3 sm:mb-4 md:mb-6">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center mr-2 sm:mr-2.5 md:mr-3">
                      <Briefcase className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white" />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">사업장 정보</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 sm:p-5 md:p-6">
                    {/* 대기필증 연동 정보 안내 */}
                    {airPermitLoading ? (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        <div className="text-sm text-blue-700">대기필증 정보 로딩 중...</div>
                      </div>
                    </div>
                  ) : airPermitData && airPermitData.permits.length > 0 ? (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm text-blue-800 font-medium mb-1">✓ 대기필증 정보 연동됨</div>
                      <div className="text-xs text-blue-600">
                        업종과 종별이 대기필증 정보({airPermitData.permits.length}개)와 동기화됩니다.
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="text-sm text-gray-700 font-medium mb-1">대기필증 미등록</div>
                      <div className="text-xs text-gray-600">
                        대기필증이 등록되면 업종과 종별 정보가 자동으로 연동됩니다.
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        업종
                        {airPermitData?.business_type && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            대기필증 연동
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.business_type || airPermitData?.business_type || ''}
                        onChange={(e) => setFormData({...formData, business_type: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="예: 제조업, 서비스업..."
                      />
                      {airPermitData?.business_type && airPermitData.business_type !== (formData.business_type || '') && (
                        <div className="text-xs text-blue-600 mt-1">
                          대기필증 정보: {airPermitData.business_type}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        종별
                        {airPermitData?.category && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            대기필증 연동
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.business_category || airPermitData?.category || ''}
                        onChange={(e) => setFormData({...formData, business_category: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="사업 종별"
                      />
                      {airPermitData?.category && airPermitData.category !== (formData.business_category || '') && (
                        <div className="text-xs text-blue-600 mt-1">
                          대기필증 정보: {airPermitData.category}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">담당부서</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.department || ''}
                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="담당부서명"
                      />
                    </div>

                    </div>
                  </div>
                </div>

                {/* 프로젝트 관리 */}
                <div>
                  <div className="flex items-center mb-3 sm:mb-4 md:mb-6">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-2 sm:mr-2.5 md:mr-3">
                      <ClipboardList className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white" />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">프로젝트 관리</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 sm:p-5 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">진행구분</label>
                      <select
                        value={formData.progress_status || ''}
                        onChange={(e) => setFormData({...formData, progress_status: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      >
                        <option value="">선택하세요</option>
                        <option value="자비">자비</option>
                        <option value="보조금">보조금</option>
                        <option value="보조금 동시진행">보조금 동시진행</option>
                        <option value="대리점">대리점</option>
                        <option value="AS">AS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">사업 진행연도</label>
                      <input
                        type="number"
                        min="2020"
                        max="2050"
                        value={formData.project_year || ''}
                        onChange={(e) => setFormData({...formData, project_year: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="예: 2024"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">설치팀</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.installation_team || ''}
                        onChange={(e) => setFormData({...formData, installation_team: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="설치 담당팀"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">발주담당</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.order_manager || ''}
                        onChange={(e) => setFormData({...formData, order_manager: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                        placeholder="발주 담당자명"
                      />
                    </div>
                    </div>
                  </div>
                </div>

                {/* 일정 관리 */}
                <div>
                  <div className="flex items-center mb-3 sm:mb-4 md:mb-6">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mr-2 sm:mr-2.5 md:mr-3">
                      <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white" />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">일정 관리</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 sm:p-5 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">발주요청일</label>
                      <input
                        type="date"
                        value={formData.order_request_date || ''}
                        onChange={(e) => setFormData({...formData, order_request_date: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">발주일</label>
                      <input
                        type="date"
                        value={formData.order_date || ''}
                        onChange={(e) => setFormData({...formData, order_date: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">출고일</label>
                      <input
                        type="date"
                        value={formData.shipment_date || ''}
                        onChange={(e) => setFormData({...formData, shipment_date: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">설치일</label>
                      <input
                        type="date"
                        value={formData.installation_date || ''}
                        onChange={(e) => setFormData({...formData, installation_date: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>

                    </div>
                  </div>
                </div>

                {/* 실사 관리 */}
                <div>
                  <div className="flex items-center mb-3 sm:mb-4 md:mb-6">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-2 sm:mr-2.5 md:mr-3">
                      <FileCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white" />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">실사 관리</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                    {/* 견적실사 */}
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">견적실사</h4>
                      <div className="space-y-2 sm:space-y-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">담당자</label>
                          <input
                            type="text"
                            value={formData.estimate_survey_manager || ''}
                            onChange={(e) => setFormData({...formData, estimate_survey_manager: e.target.value})}
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-[10px] sm:text-xs"
                            placeholder="담당자명"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">실사일</label>
                          <input
                            type="date"
                            value={formData.estimate_survey_date || ''}
                            onChange={(e) => setFormData({...formData, estimate_survey_date: e.target.value})}
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-[10px] sm:text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 착공전실사 */}
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">착공전실사</h4>
                      <div className="space-y-2 sm:space-y-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">담당자</label>
                          <input
                            type="text"
                            value={formData.pre_construction_survey_manager || ''}
                            onChange={(e) => setFormData({...formData, pre_construction_survey_manager: e.target.value})}
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-[10px] sm:text-xs"
                            placeholder="담당자명"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">실사일</label>
                          <input
                            type="date"
                            value={formData.pre_construction_survey_date || ''}
                            onChange={(e) => setFormData({...formData, pre_construction_survey_date: e.target.value})}
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-[10px] sm:text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 준공실사 */}
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">준공실사</h4>
                      <div className="space-y-2 sm:space-y-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">담당자</label>
                          <input
                            type="text"
                            value={formData.completion_survey_manager || ''}
                            onChange={(e) => setFormData({...formData, completion_survey_manager: e.target.value})}
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-[10px] sm:text-xs"
                            placeholder="담당자명"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">실사일</label>
                          <input
                            type="date"
                            value={formData.completion_survey_date || ''}
                            onChange={(e) => setFormData({...formData, completion_survey_date: e.target.value})}
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-[10px] sm:text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 시스템 정보 */}
                <div>
                  <div className="flex items-center mb-3 sm:mb-4 md:mb-6">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-2 sm:mr-2.5 md:mr-3">
                      <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white" />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">시스템 정보</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 sm:p-5 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">제조사</label>
                      <select
                        value={formData.manufacturer || ''}
                        onChange={(e) => setFormData({...formData, manufacturer: (e.target.value || null) as '에코센스' | '크린어스' | '가이아씨앤에스' | '이브이에스' | null})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      >
                        <option value="">선택하세요</option>
                        <option value="에코센스">에코센스</option>
                        <option value="크린어스">크린어스</option>
                        <option value="가이아씨앤에스">가이아씨앤에스</option>
                        <option value="이브이에스">이브이에스</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">VPN</label>
                      <select
                        value={formData.vpn || ''}
                        onChange={(e) => setFormData({...formData, vpn: (e.target.value || null) as 'wired' | 'wireless' | null})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      >
                        <option value="">선택하세요</option>
                        <option value="wired">유선</option>
                        <option value="wireless">무선</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">그린링크 ID</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.greenlink_id || ''}
                        onChange={(e) => setFormData({...formData, greenlink_id: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">그린링크 PW</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.greenlink_pw || ''}
                        onChange={(e) => setFormData({...formData, greenlink_pw: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">사업장관리코드</label>
                      <input
                        type="number"
                        value={formData.business_management_code || ''}
                        onChange={(e) => setFormData({...formData, business_management_code: parseInt(e.target.value) || 0})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">영업점</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.sales_office || ''}
                        onChange={(e) => setFormData({...formData, sales_office: e.target.value})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      />
                    </div>
                    </div>
                  </div>
                </div>

                {/* 장비 수량 */}
                <div>
                  <div className="flex items-center mb-3 sm:mb-4">
                    <div className="p-1.5 sm:p-2 bg-purple-600 rounded-lg mr-2 sm:mr-3">
                      <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <h3 className="text-[10px] sm:text-xs md:text-sm lg:text-base font-semibold text-gray-800">측정기기</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 sm:p-5 md:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">PH센서</label>
                      <input
                        type="number"
                        value={formData.ph_meter ?? ''}
                        onChange={(e) => setFormData({...formData, ph_meter: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">차압계</label>
                      <input
                        type="number"
                        value={formData.differential_pressure_meter ?? ''}
                        onChange={(e) => setFormData({...formData, differential_pressure_meter: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">온도계</label>
                      <input
                        type="number"
                        value={formData.temperature_meter ?? ''}
                        onChange={(e) => setFormData({...formData, temperature_meter: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">배출전류계</label>
                      <input
                        type="number"
                        value={formData.discharge_current_meter ?? ''}
                        onChange={(e) => setFormData({...formData, discharge_current_meter: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">송풍전류계</label>
                      <input
                        type="number"
                        value={formData.fan_current_meter ?? ''}
                        onChange={(e) => setFormData({...formData, fan_current_meter: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">펌프전류계</label>
                      <input
                        type="number"
                        value={formData.pump_current_meter ?? ''}
                        onChange={(e) => setFormData({...formData, pump_current_meter: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">게이트웨이</label>
                      <input
                        type="number"
                        value={formData.gateway ?? ''}
                        onChange={(e) => setFormData({...formData, gateway: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">VPN(유선)</label>
                      <input
                        type="number"
                        value={formData.vpn_wired ?? ''}
                        onChange={(e) => setFormData({...formData, vpn_wired: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">VPN(무선)</label>
                      <input
                        type="number"
                        value={formData.vpn_wireless ?? ''}
                        onChange={(e) => setFormData({...formData, vpn_wireless: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">방폭차압계(국산)</label>
                      <input
                        type="number"
                        value={formData.explosion_proof_differential_pressure_meter_domestic ?? ''}
                        onChange={(e) => setFormData({...formData, explosion_proof_differential_pressure_meter_domestic: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">방폭온도계(국산)</label>
                      <input
                        type="number"
                        value={formData.explosion_proof_temperature_meter_domestic ?? ''}
                        onChange={(e) => setFormData({...formData, explosion_proof_temperature_meter_domestic: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">확장디바이스</label>
                      <input
                        type="number"
                        value={formData.expansion_device ?? ''}
                        onChange={(e) => setFormData({...formData, expansion_device: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">중계기(8채널)</label>
                      <input
                        type="number"
                        value={formData.relay_8ch ?? ''}
                        onChange={(e) => setFormData({...formData, relay_8ch: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">중계기(16채널)</label>
                      <input
                        type="number"
                        value={formData.relay_16ch ?? ''}
                        onChange={(e) => setFormData({...formData, relay_16ch: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">메인보드교체</label>
                      <input
                        type="number"
                        value={formData.main_board_replacement ?? ''}
                        onChange={(e) => setFormData({...formData, main_board_replacement: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">복수굴뚝</label>
                      <input
                        type="number"
                        value={formData.multiple_stack ?? ''}
                        onChange={(e) => setFormData({...formData, multiple_stack: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    </div>
                  </div>
                </div>

                {/* 비용 정보 */}
                <div>
                  <div className="flex items-center mb-3 sm:mb-4">
                    <div className="p-1.5 sm:p-2 bg-yellow-600 rounded-lg mr-2 sm:mr-3">
                      <Database className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <h3 className="text-[10px] sm:text-xs md:text-sm lg:text-base font-semibold text-gray-800">비용 정보</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 sm:p-5 md:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">추가공사비 (원)</label>
                      <input
                        type="text"
                        value={formData.additional_cost ? formData.additional_cost.toLocaleString() : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, '');
                          setFormData({...formData, additional_cost: value ? parseInt(value) : null});
                        }}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="매출에 추가될 금액 (예: 500,000)"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                        추가설치비 (원)
                        <span className="ml-1 text-[9px] sm:text-[10px] text-gray-500">(설치팀 요청 추가 비용)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.installation_extra_cost ? formData.installation_extra_cost.toLocaleString() : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, '');
                          setFormData({...formData, installation_extra_cost: value ? parseInt(value) : null});
                        }}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="순이익에서 차감될 금액 (예: 300,000)"
                      />
                      <p className="mt-0.5 sm:mt-1 text-[8px] sm:text-[9px] md:text-[10px] text-orange-600">
                        💡 기본 공사비로 충당 불가능한 추가 설치 비용
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">협의사항 (할인 금액, 원)</label>
                      <input
                        type="text"
                        value={formData.negotiation ? parseInt(formData.negotiation).toLocaleString() : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, '');
                          setFormData({...formData, negotiation: value});
                        }}
                        className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded text-[10px] sm:text-xs md:text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="매출에서 차감될 금액 (예: 100,000)"
                      />
                    </div>
                    </div>
                  </div>
                </div>

                {/* 계산서 및 입금 정보 - 진행구분에 따라 동적 표시 */}
                {formData.progress_status && (() => {
                  // 진행구분을 보조금/자비로 매핑 (모든 진행구분 허용)
                  const mappedCategory = mapCategoryToInvoiceType(formData.progress_status);

                  return (
                    <div>
                      <div className="flex items-center mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-purple-600 rounded-lg mr-2 sm:mr-3">
                          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h3 className="text-[10px] sm:text-xs md:text-sm lg:text-base font-semibold text-gray-800">
                          계산서 및 입금 정보 ({formData.progress_status})
                        </h3>
                      </div>

                      {/* 보조금: 1차/2차/추가공사비 */}
                      {mappedCategory === '보조금' && (
                      <div className="space-y-4 sm:space-y-6">
                        {/* 1차 계산서 */}
                        <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                          <h4 className="text-xs sm:text-sm font-semibold text-blue-900 mb-3">1차 계산서</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">계산서 발행일</label>
                              <input
                                type="date"
                                value={formData.invoice_1st_date || ''}
                                onChange={(e) => setFormData({...formData, invoice_1st_date: e.target.value || null})}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">계산서 금액 (원)</label>
                              <input
                                type="text"
                                value={formData.invoice_1st_amount ? formData.invoice_1st_amount.toLocaleString() : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/,/g, '');
                                  setFormData({...formData, invoice_1st_amount: value ? parseInt(value) : null});
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-blue-500"
                                placeholder="예: 10,000,000"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">입금일</label>
                              <input
                                type="date"
                                value={formData.payment_1st_date || ''}
                                onChange={(e) => setFormData({...formData, payment_1st_date: e.target.value || null})}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">입금 금액 (원)</label>
                              <input
                                type="text"
                                value={formData.payment_1st_amount ? formData.payment_1st_amount.toLocaleString() : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/,/g, '');
                                  setFormData({...formData, payment_1st_amount: value ? parseInt(value) : null});
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-blue-500"
                                placeholder="예: 10,000,000"
                              />
                            </div>
                          </div>
                          {formData.invoice_1st_date && formData.invoice_1st_amount && formData.invoice_1st_amount > 0 && (
                            <div className="mt-2 p-2 bg-white rounded border border-blue-200">
                              <div className="flex justify-between text-[10px] sm:text-xs">
                                <span className="text-gray-600">미수금:</span>
                                <span className={`font-bold ${
                                  ((formData.invoice_1st_amount || 0) - (formData.payment_1st_amount || 0)) === 0
                                    ? 'text-green-600' : 'text-orange-600'
                                }`}>
                                  {((formData.invoice_1st_amount || 0) - (formData.payment_1st_amount || 0)).toLocaleString()}원
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 2차 계산서 */}
                        <div className="p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                          <h4 className="text-xs sm:text-sm font-semibold text-green-900 mb-3">2차 계산서</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">계산서 발행일</label>
                              <input
                                type="date"
                                value={formData.invoice_2nd_date || ''}
                                onChange={(e) => setFormData({...formData, invoice_2nd_date: e.target.value || null})}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-green-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">계산서 금액 (원)</label>
                              <input
                                type="text"
                                value={formData.invoice_2nd_amount ? formData.invoice_2nd_amount.toLocaleString() : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/,/g, '');
                                  setFormData({...formData, invoice_2nd_amount: value ? parseInt(value) : null});
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-green-500"
                                placeholder="예: 5,000,000"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">입금일</label>
                              <input
                                type="date"
                                value={formData.payment_2nd_date || ''}
                                onChange={(e) => setFormData({...formData, payment_2nd_date: e.target.value || null})}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-green-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">입금 금액 (원)</label>
                              <input
                                type="text"
                                value={formData.payment_2nd_amount ? formData.payment_2nd_amount.toLocaleString() : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/,/g, '');
                                  setFormData({...formData, payment_2nd_amount: value ? parseInt(value) : null});
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-green-500"
                                placeholder="예: 5,000,000"
                              />
                            </div>
                          </div>
                          {formData.invoice_2nd_date && formData.invoice_2nd_amount && formData.invoice_2nd_amount > 0 && (
                            <div className="mt-2 p-2 bg-white rounded border border-green-200">
                              <div className="flex justify-between text-[10px] sm:text-xs">
                                <span className="text-gray-600">미수금:</span>
                                <span className={`font-bold ${
                                  ((formData.invoice_2nd_amount || 0) - (formData.payment_2nd_amount || 0)) === 0
                                    ? 'text-green-600' : 'text-orange-600'
                                }`}>
                                  {((formData.invoice_2nd_amount || 0) - (formData.payment_2nd_amount || 0)).toLocaleString()}원
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 추가공사비 계산서 */}
                        {formData.additional_cost && formData.additional_cost > 0 && (
                          <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
                            <h4 className="text-xs sm:text-sm font-semibold text-amber-900 mb-3">추가공사비 계산서</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">계산서 발행일</label>
                                <input
                                  type="date"
                                  value={formData.invoice_additional_date || ''}
                                  onChange={(e) => setFormData({...formData, invoice_additional_date: e.target.value || null})}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">계산서 금액 (원)</label>
                                <input
                                  type="text"
                                  value={Math.round(formData.additional_cost * 1.1).toLocaleString()}
                                  disabled
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs bg-gray-100 cursor-not-allowed"
                                />
                                <p className="text-[9px] text-gray-500 mt-1">※ 추가공사비 + 부가세 10% (공급가액: {formData.additional_cost.toLocaleString()}원)</p>
                              </div>
                              <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">입금일</label>
                                <input
                                  type="date"
                                  value={formData.payment_additional_date || ''}
                                  onChange={(e) => setFormData({...formData, payment_additional_date: e.target.value || null})}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">입금 금액 (원)</label>
                                <input
                                  type="text"
                                  value={formData.payment_additional_amount ? formData.payment_additional_amount.toLocaleString() : ''}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/,/g, '');
                                    setFormData({...formData, payment_additional_amount: value ? parseInt(value) : null});
                                  }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-amber-500"
                                  placeholder="예: 500,000"
                                />
                              </div>
                            </div>
                            {formData.invoice_additional_date && (
                              <div className="mt-2 p-2 bg-white rounded border border-amber-200">
                                <div className="flex justify-between text-[10px] sm:text-xs">
                                  <span className="text-gray-600">미수금:</span>
                                  <span className={`font-bold ${
                                    (Math.round((formData.additional_cost || 0) * 1.1) - (formData.payment_additional_amount || 0)) === 0
                                      ? 'text-green-600' : 'text-orange-600'
                                  }`}>
                                    {(Math.round((formData.additional_cost || 0) * 1.1) - (formData.payment_additional_amount || 0)).toLocaleString()}원
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 전체 미수금 요약 */}
                        <div className="p-3 sm:p-4 bg-gradient-to-r from-slate-100 to-gray-100 rounded-lg border-2 border-slate-300">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-2">전체 미수금 요약</h4>
                          <div className="space-y-1 text-[10px] sm:text-xs">
                            {formData.invoice_1st_date && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">1차 미수금:</span>
                                <span className="font-medium">{((formData.invoice_1st_amount || 0) - (formData.payment_1st_amount || 0)).toLocaleString()}원</span>
                              </div>
                            )}
                            {formData.invoice_2nd_date && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">2차 미수금:</span>
                                <span className="font-medium">{((formData.invoice_2nd_amount || 0) - (formData.payment_2nd_amount || 0)).toLocaleString()}원</span>
                              </div>
                            )}
                            {formData.invoice_additional_date && formData.additional_cost && formData.additional_cost > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">추가공사비 미수금:</span>
                                <span className="font-medium">{(Math.round((formData.additional_cost || 0) * 1.1) - (formData.payment_additional_amount || 0)).toLocaleString()}원</span>
                              </div>
                            )}
                            <div className="flex justify-between pt-2 mt-2 border-t-2 border-slate-300">
                              <span className="font-bold text-gray-900">총 미수금:</span>
                              <span className={`font-bold text-base ${
                                (() => {
                                  // 추가공사비는 계산서가 발행된 경우에만 미수금 계산 (부가세 10% 포함)
                                  const additionalCostInvoice = formData.invoice_additional_date ? Math.round((formData.additional_cost || 0) * 1.1) : 0;
                                  // 총액 방식: 전체 계산서 합계 - 전체 입금 합계
                                  const totalInvoices = (formData.invoice_1st_amount || 0) +
                                                       (formData.invoice_2nd_amount || 0) +
                                                       additionalCostInvoice;
                                  const totalPayments = (formData.payment_1st_amount || 0) +
                                                       (formData.payment_2nd_amount || 0) +
                                                       (formData.payment_additional_amount || 0);
                                  return totalInvoices - totalPayments;
                                })() === 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {(() => {
                                  // 추가공사비는 계산서가 발행된 경우에만 미수금 계산 (부가세 10% 포함)
                                  const additionalCostInvoice = formData.invoice_additional_date ? Math.round((formData.additional_cost || 0) * 1.1) : 0;
                                  const totalInvoices = (formData.invoice_1st_amount || 0) +
                                                       (formData.invoice_2nd_amount || 0) +
                                                       additionalCostInvoice;
                                  const totalPayments = (formData.payment_1st_amount || 0) +
                                                       (formData.payment_2nd_amount || 0) +
                                                       (formData.payment_additional_amount || 0);
                                  return (totalInvoices - totalPayments).toLocaleString();
                                })()}원
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                      {/* 자비: 선금/잔금 */}
                      {mappedCategory === '자비' && (
                      <div className="space-y-4 sm:space-y-6">
                        {/* 선금 계산서 */}
                        <div className="p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                          <h4 className="text-xs sm:text-sm font-semibold text-purple-900 mb-3">선금 계산서</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">계산서 발행일</label>
                              <input
                                type="date"
                                value={formData.invoice_advance_date || ''}
                                onChange={(e) => setFormData({...formData, invoice_advance_date: e.target.value || null})}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">계산서 금액 (원)</label>
                              <input
                                type="text"
                                value={formData.invoice_advance_amount ? formData.invoice_advance_amount.toLocaleString() : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/,/g, '');
                                  setFormData({...formData, invoice_advance_amount: value ? parseInt(value) : null});
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-purple-500"
                                placeholder="예: 15,000,000 (기본 50%)"
                              />
                              <p className="text-[9px] text-gray-500 mt-1">※ 기본 50%, 사업장에 따라 100%도 가능</p>
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">입금일</label>
                              <input
                                type="date"
                                value={formData.payment_advance_date || ''}
                                onChange={(e) => setFormData({...formData, payment_advance_date: e.target.value || null})}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">입금 금액 (원)</label>
                              <input
                                type="text"
                                value={formData.payment_advance_amount ? formData.payment_advance_amount.toLocaleString() : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/,/g, '');
                                  setFormData({...formData, payment_advance_amount: value ? parseInt(value) : null});
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-purple-500"
                                placeholder="예: 15,000,000"
                              />
                            </div>
                          </div>
                          {formData.invoice_advance_date && formData.invoice_advance_amount && formData.invoice_advance_amount > 0 && (
                            <div className="mt-2 p-2 bg-white rounded border border-purple-200">
                              <div className="flex justify-between text-[10px] sm:text-xs">
                                <span className="text-gray-600">미수금:</span>
                                <span className={`font-bold ${
                                  ((formData.invoice_advance_amount || 0) - (formData.payment_advance_amount || 0)) === 0
                                    ? 'text-green-600' : 'text-orange-600'
                                }`}>
                                  {((formData.invoice_advance_amount || 0) - (formData.payment_advance_amount || 0)).toLocaleString()}원
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 잔금 계산서 */}
                        <div className="p-3 sm:p-4 bg-gradient-to-r from-cyan-50 to-teal-50 rounded-lg border border-cyan-200">
                          <h4 className="text-xs sm:text-sm font-semibold text-cyan-900 mb-3">잔금 계산서</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">계산서 발행일</label>
                              <input
                                type="date"
                                value={formData.invoice_balance_date || ''}
                                onChange={(e) => setFormData({...formData, invoice_balance_date: e.target.value || null})}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">계산서 금액 (원)</label>
                              <input
                                type="text"
                                value={formData.invoice_balance_amount ? formData.invoice_balance_amount.toLocaleString() : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/,/g, '');
                                  setFormData({...formData, invoice_balance_amount: value ? parseInt(value) : null});
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-cyan-500"
                                placeholder="예: 15,000,000 (기본 50%)"
                              />
                              <p className="text-[9px] text-gray-500 mt-1">※ 선금 100% 경우 0원 가능</p>
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">입금일</label>
                              <input
                                type="date"
                                value={formData.payment_balance_date || ''}
                                onChange={(e) => setFormData({...formData, payment_balance_date: e.target.value || null})}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">입금 금액 (원)</label>
                              <input
                                type="text"
                                value={formData.payment_balance_amount ? formData.payment_balance_amount.toLocaleString() : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/,/g, '');
                                  setFormData({...formData, payment_balance_amount: value ? parseInt(value) : null});
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[10px] sm:text-xs focus:ring-1 focus:ring-cyan-500"
                                placeholder="예: 15,000,000"
                              />
                            </div>
                          </div>
                          {formData.invoice_balance_date && formData.invoice_balance_amount && formData.invoice_balance_amount > 0 && (
                            <div className="mt-2 p-2 bg-white rounded border border-cyan-200">
                              <div className="flex justify-between text-[10px] sm:text-xs">
                                <span className="text-gray-600">미수금:</span>
                                <span className={`font-bold ${
                                  ((formData.invoice_balance_amount || 0) - (formData.payment_balance_amount || 0)) === 0
                                    ? 'text-green-600' : 'text-orange-600'
                                }`}>
                                  {((formData.invoice_balance_amount || 0) - (formData.payment_balance_amount || 0)).toLocaleString()}원
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 전체 미수금 요약 */}
                        <div className="p-3 sm:p-4 bg-gradient-to-r from-slate-100 to-gray-100 rounded-lg border-2 border-slate-300">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-2">전체 미수금 요약</h4>
                          <div className="space-y-1 text-[10px] sm:text-xs">
                            {formData.invoice_advance_date && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">선금 미수금:</span>
                                <span className="font-medium">{((formData.invoice_advance_amount || 0) - (formData.payment_advance_amount || 0)).toLocaleString()}원</span>
                              </div>
                            )}
                            {formData.invoice_balance_date && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">잔금 미수금:</span>
                                <span className="font-medium">{((formData.invoice_balance_amount || 0) - (formData.payment_balance_amount || 0)).toLocaleString()}원</span>
                              </div>
                            )}
                            <div className="flex justify-between pt-2 mt-2 border-t-2 border-slate-300">
                              <span className="font-bold text-gray-900">총 미수금:</span>
                              <span className={`font-bold text-base ${
                                (() => {
                                  // 총액 방식: 전체 계산서 합계 - 전체 입금 합계
                                  const totalInvoices = (formData.invoice_advance_amount || 0) +
                                                       (formData.invoice_balance_amount || 0);
                                  const totalPayments = (formData.payment_advance_amount || 0) +
                                                       (formData.payment_balance_amount || 0);
                                  return totalInvoices - totalPayments;
                                })() === 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {(() => {
                                  const totalInvoices = (formData.invoice_advance_amount || 0) +
                                                       (formData.invoice_balance_amount || 0);
                                  const totalPayments = (formData.payment_advance_amount || 0) +
                                                       (formData.payment_balance_amount || 0);
                                  return (totalInvoices - totalPayments).toLocaleString();
                                })()}원
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    </div>
                  );
                })()}

                {/* 상태 설정 */}
                <div>
                  <div className="flex items-center mb-3 sm:mb-4">
                    <div className="p-1.5 sm:p-2 bg-green-600 rounded-lg mr-2 sm:mr-3">
                      <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <h3 className="text-[10px] sm:text-xs md:text-sm lg:text-base font-semibold text-gray-800">상태 설정</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1 sm:mb-2">활성 상태</label>
                      <select
                        value={formData.is_active ? 'true' : 'false'}
                        onChange={(e) => setFormData({...formData, is_active: e.target.value === 'true'})}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs md:text-sm"
                      >
                        <option value="true">활성</option>
                        <option value="false">비활성</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false)
          setBusinessToDelete(null)
        }}
        onConfirm={handleDelete}
        title="사업장 삭제 확인"
        message={`'${businessToDelete?.business_name}' 사업장을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
        variant="danger"
      />

      {/* Excel Upload Modal */}
      {isUploadModalOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUploading) {
              setIsUploadModalOpen(false)
              setUploadFile(null)
              setUploadResults(null)
              setUploadProgress(0)
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">엑셀 파일 업로드</h2>
            </div>
            
            <div className="p-6">
              {!uploadResults ? (
                <div className="space-y-6">
                  {/* 파일 업로드 영역 */}
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <div className="space-y-2">
                      <p className="text-lg font-medium text-gray-900">엑셀 파일을 선택하세요</p>
                      <p className="text-sm text-gray-500">CSV, XLSX 파일을 지원합니다 (최대 10MB)</p>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadFile(file)
                        }
                      }}
                      className="mt-4"
                      disabled={isUploading}
                    />
                  </div>

                  {/* 선택된 파일 정보 */}
                  {uploadFile && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">선택된 파일</h4>
                      <p className="text-sm text-blue-700">
                        📄 {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>
                  )}

                  {/* 템플릿 다운로드 버튼 */}
                  <div className="mb-4">
                    <button
                      onClick={downloadExcelTemplate}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors border-2 border-green-600 hover:border-green-700"
                    >
                      <Download className="w-5 h-5" />
                      엑셀 템플릿 다운로드
                    </button>
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      표준 형식의 엑셀 파일을 다운로드하여 작성 후 업로드하세요
                    </p>
                  </div>

                  {/* 파일 형식 안내 */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">주요 필드 안내</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                      <div className="font-semibold text-blue-700">사업장명 * (필수)</div>
                      <div>지자체, 주소, 대표자명</div>
                      <div>사업장담당자, 직급, 연락처</div>
                      <div>사업장연락처, 이메일, 팩스</div>
                      <div>PH센서, 차압계, 온도계</div>
                      <div>배출/송풍/펌프 전류계(CT)</div>
                      <div>게이트웨이, VPN(유/무선)</div>
                      <div>방폭차압계, 방폭온도계</div>
                      <div>확장디바이스, 중계기</div>
                      <div>메인보드교체, 복수굴뚝</div>
                      <div>제조사, 진행구분, 사업연도</div>
                      <div>영업점, 담당부서, 설치팀</div>
                      <div className="font-semibold text-green-700">일정관리: 발주/출고/설치</div>
                      <div className="font-semibold text-green-700">실사관리: 견적/착공/준공</div>
                      <div className="font-semibold text-purple-700">계산서/입금: 보조금(1차/2차/추가)</div>
                      <div className="font-semibold text-purple-700">계산서/입금: 자비(선금/잔금)</div>
                      <div>비용: 추가공사비, 네고</div>
                      <div>그린링크ID/PW, 사업장코드</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3 space-y-1">
                      <span className="block">• <strong>기존 사업장</strong>: 사업장명 매칭하여 자동 업데이트</span>
                      <span className="block">• <strong>신규 사업장</strong>: 자동 생성</span>
                      <span className="block">• <strong>날짜 형식</strong>: YYYY-MM-DD (예: 2025-01-15)</span>
                      <span className="block">• <strong>금액</strong>: 숫자만 입력 (예: 5000000)</span>
                      <span className="block">• <strong>VPN타입</strong>: "유선" 또는 "무선" 입력</span>
                      <span className="block">• <strong>보조금/자비</strong>: 진행구분에 따라 해당 계산서 항목 입력</span>
                      <span className="block">• 템플릿 다운로드로 정확한 형식 및 가이드 확인</span>
                    </p>
                  </div>

                  {/* 진행률 표시 */}
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>업로드 진행률</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* 업로드 결과 */
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">업로드 완료</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
                      <div className="bg-blue-50 rounded-lg p-2 sm:p-3 md:p-4">
                        <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-blue-600">{uploadResults.total}</div>
                        <div className="text-[10px] sm:text-xs md:text-sm text-blue-700">총 처리</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2 sm:p-3 md:p-4">
                        <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-green-600">{uploadResults.created || 0}</div>
                        <div className="text-[10px] sm:text-xs md:text-sm text-green-700">신규 생성</div>
                      </div>
                      <div className="bg-cyan-50 rounded-lg p-2 sm:p-3 md:p-4">
                        <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-cyan-600">{uploadResults.updated || 0}</div>
                        <div className="text-[10px] sm:text-xs md:text-sm text-cyan-700">업데이트</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2 sm:p-3 md:p-4">
                        <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-red-600">{uploadResults.failed}</div>
                        <div className="text-[10px] sm:text-xs md:text-sm text-red-700">실패</div>
                      </div>
                    </div>
                  </div>

                  {/* 오류 목록 */}
                  {uploadResults.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-medium text-red-900 mb-2">오류 목록</h4>
                      <div className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                        {uploadResults.errors.map((error, index) => (
                          <div key={index}>• {typeof error === 'object' ? `${(error as any).business}: ${(error as any).error}` : error}</div>
                        ))}
                        {uploadResults.failed > 10 && (
                          <div className="text-red-600 font-medium">
                            ... 외 {uploadResults.failed - 10}개 오류
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false)
                    setUploadFile(null)
                    setUploadResults(null)
                    setUploadProgress(0)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={isUploading}
                >
                  {uploadResults ? '닫기' : '취소'}
                </button>
                {!uploadResults && uploadFile && (
                  <button
                    type="button"
                    onClick={() => handleFileUpload(uploadFile)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isUploading}
                  >
                    {isUploading ? `업로드 중... ${uploadProgress}%` : '업로드 시작'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Detail Modal */}
      <BusinessRevenueModal
        business={selectedRevenueBusiness}
        isOpen={showRevenueModal}
        onClose={() => {
          setShowRevenueModal(false)
          setSelectedRevenueBusiness(null)
        }}
        userPermission={userPermission}
      />
    </AdminLayout>
  )
}

export default withAuth(BusinessManagementPage, undefined, 1)