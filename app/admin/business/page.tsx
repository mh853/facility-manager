// app/admin/business/page.tsx - 사업장 관리 페이지
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { BusinessInfo } from '@/lib/database-service'

interface Contact {
  name: string;
  position: string;
  phone: string;
  role: string;
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
  negotiation?: string | null;
  multiple_stack_cost?: number | null;
  representative_birth_date?: string | null;
  
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
import StatsCard from '@/components/ui/StatsCard'
import DataTable, { commonActions } from '@/components/ui/DataTable'
import { ConfirmModal } from '@/components/ui/Modal'
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
  Search
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

export default function BusinessManagementPage() {
  const [businesses, setBusinesses] = useState<UnifiedBusinessInfo[]>([])
  const [allBusinesses, setAllBusinesses] = useState<UnifiedBusinessInfo[]>([])
  const [filteredBusinesses, setFilteredBusinesses] = useState<UnifiedBusinessInfo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<UnifiedBusinessInfo | null>(null)
  const [formData, setFormData] = useState<Partial<UnifiedBusinessInfo>>({})
  const [localGovSuggestions, setLocalGovSuggestions] = useState<string[]>([])
  const [showLocalGovSuggestions, setShowLocalGovSuggestions] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<UnifiedBusinessInfo | null>(null)
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
  
  // Stats calculation
  const stats = useMemo(() => {
    const total = allBusinesses.length
    const active = allBusinesses.filter(b => b.is_active).length
    const inactive = total - active
    const withManager = allBusinesses.filter(b => b.manager_name).length
    
    return {
      total,
      active,
      inactive,
      withManager
    }
  }, [allBusinesses])


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
          manufacturer: business.manufacturer || '',
          negotiation: business.negotiation || '',
          // 한국어 센서/장비 필드명 매핑
          PH센서: business.ph_meter || 0,
          차압계: business.differential_pressure_meter || 0,
          온도계: business.temperature_meter || 0,
          배출전류계: business.discharge_current_meter || 0,
          송풍전류계: business.fan_current_meter || 0,
          펌프전류계: business.pump_current_meter || 0,
          게이트웨이: business.gateway || 0,
          VPN유선: business.vpn_wired || 0,
          VPN무선: business.vpn_wireless || 0,
          복수굴뚝: business.multiple_stack || 0,
          // 추가 한국어 필드
          지자체: business.local_government || '',
          팩스번호: business.fax_number || '',
          이메일: business.email || '',
          // 시스템 정보 필드
          사업장관리코드: business.business_management_code || null,
          그린링크ID: business.greenlink_id || '',
          그린링크PW: business.greenlink_pw || '',
          영업점: business.sales_office || '',
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
          } : null
        }))
        
        setAllBusinesses(businessObjects)
        setBusinesses(businessObjects)
        setFilteredBusinesses(businessObjects)
        
        // selectedBusiness가 있다면 업데이트된 데이터로 동기화 (useEffect에서 처리)
        
        console.log(`📊 사업장 데이터 로딩 완료: 총 ${businessObjects.length}개`)
      } else {
        console.error('Invalid data format:', data)
        setAllBusinesses([])
        setBusinesses([])
        setFilteredBusinesses([])
      }
    } catch (error) {
      console.error('사업장 데이터 로딩 오류:', error)
      setAllBusinesses([])
      setBusinesses([])
      setFilteredBusinesses([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 검색 필터링 함수
  const filterBusinesses = useCallback((query: string) => {
    if (!query.trim()) {
      setFilteredBusinesses(allBusinesses)
      return
    }

    const filtered = allBusinesses.filter(business => {
      const searchTerm = query.toLowerCase()
      const businessName = (business.사업장명 || business.business_name || '').toLowerCase()
      const address = (business.주소 || business.local_government || '').toLowerCase()
      const contactName = (business.담당자명 || business.manager_name || '').toLowerCase()
      const phone = (business.담당자연락처 || business.manager_contact || '').toLowerCase()
      const businessType = (business.업종 || business.business_type || '').toLowerCase()

      return businessName.includes(searchTerm) ||
             address.includes(searchTerm) ||
             contactName.includes(searchTerm) ||
             phone.includes(searchTerm) ||
             businessType.includes(searchTerm)
    })

    setFilteredBusinesses(filtered)
  }, [allBusinesses])

  // 검색어 하이라이팅 함수
  const highlightSearchTerm = useCallback((text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text
    
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    )
  }, [])

  // 검색어 변경 시 필터링
  useEffect(() => {
    filterBusinesses(searchQuery)
  }, [searchQuery, filterBusinesses])

  // 초기 데이터 로딩 - 의존성 제거하여 무한루프 방지
  useEffect(() => {
    loadAllBusinesses()
  }, [])

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
        담당자명: data.data?.[0]?.manager_name,
        담당자직급: data.data?.[0]?.manager_position,
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
          vpn_wired: business.vpn_wired,
          vpn_wireless: business.vpn_wireless,
          explosion_proof_differential_pressure_meter_domestic: business.explosion_proof_differential_pressure_meter_domestic,
          explosion_proof_temperature_meter_domestic: business.explosion_proof_temperature_meter_domestic,
          expansion_device: business.expansion_device,
          relay_8ch: business.relay_8ch,
          relay_16ch: business.relay_16ch,
          main_board_replacement: business.main_board_replacement,
          multiple_stack: business.multiple_stack,
          
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
          VPN유선: business.vpn_wired || 0,
          VPN무선: business.vpn_wireless || 0,
          복수굴뚝: business.multiple_stack || 0,
          
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
      
      // 백그라운드에서 최신 데이터 조회
      if (business.id && business.사업장명) {
        const refreshedBusiness = await refreshBusinessData(business.id, business.사업장명)
        if (refreshedBusiness) {
          console.log('🔄 모달용 최신 데이터 조회 완료:', refreshedBusiness.사업장명)
          setSelectedBusiness(refreshedBusiness)
        }
      }
    } catch (error) {
      console.error('❌ 모달 열기 오류:', error)
      // 기본 데이터라도 표시
      setSelectedBusiness(business)
      setIsDetailModalOpen(true)
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
      is_active: true
    })
    setIsModalOpen(true)
  }

  const openEditModal = (business: UnifiedBusinessInfo) => {
    setEditingBusiness(business)
    
    setFormData({
      id: business.id,
      business_name: business.사업장명,
      local_government: business.지자체,
      address: business.주소,
      manager_name: business.담당자명,
      manager_position: business.담당자직급,
      manager_contact: business.담당자연락처,
      representative_name: business.대표자,
      business_registration_number: business.사업자등록번호,
      business_type: business.업종,
      business_contact: business.사업장연락처,
      fax_number: business.팩스번호,
      email: business.이메일,
      business_management_code: business.사업장관리코드 ? Number(business.사업장관리코드) : null,
      greenlink_id: business.그린링크ID,
      greenlink_pw: business.그린링크PW,
      sales_office: business.영업점,
      ph_meter: business.PH센서,
      differential_pressure_meter: business.차압계,
      temperature_meter: business.온도계,
      discharge_current_meter: business.배출전류계,
      fan_current_meter: business.송풍전류계,
      pump_current_meter: business.펌프전류계,
      gateway: business.게이트웨이,
      contacts: business.contacts || [],
      manufacturer: business.manufacturer,
      is_active: business.상태 === '활성'
    })
    setIsModalOpen(true)
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

      if (response.ok) {
        await loadAllBusinesses()
        setDeleteConfirmOpen(false)
        setBusinessToDelete(null)
      } else {
        throw new Error('삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('삭제 오류:', error)
      alert('삭제에 실패했습니다.')
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
        ph_meter: parseInt(row['PH센서'] || '0') || 0,
        differential_pressure_meter: parseInt(row['차압계'] || '0') || 0,
        temperature_meter: parseInt(row['온도계'] || '0') || 0,
        discharge_current_meter: parseInt(row['배출전류계'] || '0') || 0,
        fan_current_meter: parseInt(row['송풍전류계'] || '0') || 0,
        pump_current_meter: parseInt(row['펌프전류계'] || '0') || 0,
        gateway: parseInt(row['게이트웨이'] || '0') || 0,
        vpn_wired: parseInt(row['VPN(유선)'] || '0') || 0,
        vpn_wireless: parseInt(row['VPN(무선)'] || '0') || 0,
        multiple_stack: parseInt(row['복수굴뚝(설치비)'] || '0') || 0,
        negotiation: row['네고'] || ''
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

  // 폼 제출 처리
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

    try {
      const method = editingBusiness ? 'PUT' : 'POST'
      
      // 담당자 정보는 개별 필드로 직접 사용
      let processedFormData = { ...finalFormData };

      const body = editingBusiness 
        ? { id: editingBusiness.id, updateData: processedFormData }
        : processedFormData

      console.log('📤 [FRONTEND] 전송할 데이터:', JSON.stringify(body, null, 2));

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
        alert(editingBusiness ? '사업장 정보가 수정되었습니다.' : '새 사업장이 추가되었습니다.')
        setIsModalOpen(false)
        setShowLocalGovSuggestions(false)
        await loadAllBusinesses()
        
        // 수정된 사업장이 현재 선택된 사업장이면 새로고침으로 모달 업데이트
        if (editingBusiness && selectedBusiness && editingBusiness.id === selectedBusiness.id) {
          // 간단한 새로고침 패턴 - 직접 API에서 최신 데이터 조회
          const refreshedBusiness = await refreshBusinessData(editingBusiness.id, editingBusiness.사업장명)
          if (refreshedBusiness) {
            console.log('✅ 수정 후 데이터 새로고침 완료:', refreshedBusiness.담당자명)
            setSelectedBusiness(refreshedBusiness)
          }
        }
      } else {
        alert(result.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('저장 오류:', error)
      alert('사업장 저장에 실패했습니다.')
    }
  }


  // Table configuration - 시설관리 시스템에 맞게 수정
  const columns = [
    { 
      key: '사업장명' as string, 
      title: '사업장명',
      width: '180px',
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
      width: '120px',
      render: (item: any) => (
        searchQuery ? highlightSearchTerm(item.담당자연락처 || '-', searchQuery) : (item.담당자연락처 || '-')
      )
    },
    { 
      key: '주소' as string, 
      title: '주소',
      width: '200px',
      render: (item: any) => (
        <div className="truncate" title={item.주소 || item.local_government || '-'}>
          {searchQuery ? highlightSearchTerm(item.주소 || item.local_government || '-', searchQuery) : (item.주소 || item.local_government || '-')}
        </div>
      )
    },
    { 
      key: '현재단계', 
      title: '현재 단계',
      width: '120px',
      render: (item: any) => (
        <div className="text-center">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            준비 중
          </span>
          <div className="text-xs text-gray-500 mt-1">
            향후 구현
          </div>
        </div>
      )
    }
  ]

  const businessesWithId = useMemo(() => 
    filteredBusinesses.map(business => ({
      ...business,
      id: business.id
    })), [filteredBusinesses])

  const actions = [
    {
      ...commonActions.edit((item: UnifiedBusinessInfo) => openEditModal(item)),
      show: () => true
    },
    {
      label: '삭제',
      icon: Trash2,
      onClick: (item: UnifiedBusinessInfo) => confirmDelete(item),
      variant: 'danger' as const,
      show: () => true
    }
  ]

  return (
    <AdminLayout
      title="사업장 관리"
      description="사업장 정보 등록 및 관리 시스템"
      actions={
        <>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            엑셀 업로드
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 사업장 추가
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="전체 사업장"
            value={stats.total.toString()}
            icon={Building2}
            color="blue"
            description="등록된 사업장 수"
          />
          <StatsCard
            title="활성 사업장"
            value={stats.active.toString()}
            icon={UserCheck}
            color="green"
            trend={{
              value: stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0,
              direction: 'up',
              label: '활성 비율'
            }}
          />
          <StatsCard
            title="비활성 사업장"
            value={stats.inactive.toString()}
            icon={Clock}
            color="orange"
            trend={{
              value: stats.total > 0 ? Math.round((stats.inactive / stats.total) * 100) : 0,
              direction: 'neutral',
              label: '비활성 비율'
            }}
          />
          <StatsCard
            title="담당자 등록"
            value={stats.withManager.toString()}
            icon={Users}
            color="purple"
            description="담당자 정보가 등록된 사업장"
          />
        </div>

        {/* Business List Panel - Single Column Layout */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-full overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                사업장 목록
              </h2>
              <span className="text-sm text-gray-500">
                {searchQuery ? `${filteredBusinesses.length}개 검색 결과 (전체 ${allBusinesses.length}개)` : `${allBusinesses.length}개 사업장`}
              </span>
            </div>
            
            {/* 실시간 검색창 */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="사업장명, 주소, 담당자명, 연락처, 업종으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            
          </div>

          {/* Data Table */}
          <div className="p-6 overflow-x-auto">
            <div className="min-w-full max-w-7xl">
              <DataTable
                data={businessesWithId}
                columns={columns}
                actions={actions}
                loading={isLoading}
                emptyMessage="등록된 사업장이 없습니다."
                searchable={false}
                pageSize={100}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Business Detail Modal - Enhanced Design */}
      {isDetailModalOpen && selectedBusiness && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDetailModalOpen(false)
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
            {/* Header with gradient background */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-8 py-6 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-white bg-opacity-10 backdrop-blur-sm"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedBusiness?.사업장명 || selectedBusiness?.business_name || '사업장명 없음'}</h2>
                    <p className="text-blue-100 flex items-center mt-1">
                      <MapPin className="w-4 h-4 mr-1" />
                      {selectedBusiness?.주소 || selectedBusiness?.local_government || '주소 미등록'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
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
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Content area with balanced layout */}
            <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
              <div className="p-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Left Column - Basic Info */}
                  <div className="space-y-6">
                    {/* Basic Information Card */}
                    <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-blue-600 rounded-lg mr-3">
                          <Building className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">기본 정보</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Factory className="w-4 h-4 mr-2 text-blue-500" />
                            사업장명
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.사업장명}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <MapPin className="w-4 h-4 mr-2 text-green-500" />
                            지자체
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.지자체 || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm md:col-span-2">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <MapPin className="w-4 h-4 mr-2 text-red-500" />
                            주소
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.주소 || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <User className="w-4 h-4 mr-2 text-purple-500" />
                            대표자명
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.대표자 || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Hash className="w-4 h-4 mr-2 text-orange-500" />
                            사업자등록번호
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.사업자등록번호 || '-'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information Card */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-green-600 rounded-lg mr-3">
                          <Contact className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">담당자 정보</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <User className="w-4 h-4 mr-2 text-green-500" />
                            담당자명
                          </div>
                          <div className="text-base font-medium text-gray-900">
                            {selectedBusiness.담당자명 || '-'}
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Briefcase className="w-4 h-4 mr-2 text-blue-500" />
                            직급
                          </div>
                          <div className="text-base font-medium text-gray-900">
                            {selectedBusiness.담당자직급 || '-'}
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Phone className="w-4 h-4 mr-2 text-green-500" />
                            담당자 연락처
                          </div>
                          <div className="text-base font-medium text-gray-900">
                            {selectedBusiness.담당자연락처 || '-'}
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Phone className="w-4 h-4 mr-2 text-blue-500" />
                            사업장 연락처
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.사업장연락처 || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <FileText className="w-4 h-4 mr-2 text-gray-500" />
                            팩스번호
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.fax_number || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Mail className="w-4 h-4 mr-2 text-red-500" />
                            이메일
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.email || '-'}</div>
                        </div>
                        
                        
                        {selectedBusiness.representative_birth_date && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="flex items-center text-sm text-gray-600 mb-1">
                              <Calendar className="w-4 h-4 mr-2 text-purple-500" />
                              대표자생년월일
                            </div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.representative_birth_date}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Work Progress & Communication Area */}
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-orange-600 rounded-lg mr-3">
                            <ClipboardList className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-800">업무 진행 현황</h3>
                        </div>
                        <button
                          onClick={() => {/* TODO: Add note functionality */}}
                          className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors"
                        >
                          메모 추가
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Current Status */}
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-2">
                            <Clock className="w-4 h-4 mr-2 text-orange-500" />
                            현재 진행 단계
                          </div>
                          <div className="text-base font-medium text-gray-900">
                            {selectedBusiness.progress_status || '설치 대기'}
                          </div>
                        </div>

                        {/* Team Communication */}
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-2">
                            <Users className="w-4 h-4 mr-2 text-blue-500" />
                            팀 공유 사항
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm text-gray-700 p-3 bg-gray-50 rounded-lg">
                              • 설치 담당자: {selectedBusiness.installation_team || '미배정'}
                            </div>
                            <div className="text-sm text-gray-700 p-3 bg-blue-50 rounded-lg">
                              • 주문 담당자: {selectedBusiness.order_manager || '미배정'}
                            </div>
                            {selectedBusiness.installation_date && (
                              <div className="text-sm text-gray-700 p-3 bg-green-50 rounded-lg">
                                • 설치 예정일: {selectedBusiness.installation_date}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Important Notes */}
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-2">
                            <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                            확인 필요 사항
                          </div>
                          <div className="space-y-2">
                            {!selectedBusiness.manager_contact && (
                              <div className="text-sm text-red-600 p-2 bg-red-50 rounded-lg flex items-center">
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                담당자 연락처 확인 필요
                              </div>
                            )}
                            {!selectedBusiness.installation_support && (
                              <div className="text-sm text-yellow-600 p-2 bg-yellow-50 rounded-lg flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                설치 지원 여부 확인 필요
                              </div>
                            )}
                            {selectedBusiness.additional_cost && selectedBusiness.additional_cost > 0 && (
                              <div className="text-sm text-blue-600 p-2 bg-blue-50 rounded-lg flex items-center">
                                <FileText className="w-4 h-4 mr-2" />
                                추가 비용 협의: {selectedBusiness.additional_cost?.toLocaleString()}원
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - System Info & Status */}
                  <div className="space-y-6">
                    {/* System Information Card */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-purple-600 rounded-lg mr-3">
                          <Database className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">시스템 정보</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-sm text-gray-600 mb-1">제조사</div>
                          <div className="text-base font-medium text-gray-900">
                            {selectedBusiness.manufacturer === 'ecosense' ? '🏭 에코센스' :
                             selectedBusiness.manufacturer === 'cleanearth' ? '🌍 크린어스' :
                             selectedBusiness.manufacturer === 'gaia_cns' ? '🌿 가이아씨앤에스' :
                             selectedBusiness.manufacturer === 'evs' ? '⚡ 이브이에스' :
                             selectedBusiness.manufacturer || '-'}
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-sm text-gray-600 mb-1">VPN 연결</div>
                          <div className="text-base font-medium text-gray-900">
                            {selectedBusiness.vpn === 'wired' ? '🔗 유선' :
                             selectedBusiness.vpn === 'wireless' ? '📶 무선' :
                             selectedBusiness.vpn || '-'}
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-sm text-gray-600 mb-1">그린링크 ID</div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.greenlink_id || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-sm text-gray-600 mb-1">그린링크 PW</div>
                          <div className="text-base font-medium text-gray-900 flex items-center">
                            {selectedBusiness.greenlink_pw ? (
                              <>
                                <Shield className="w-4 h-4 mr-2 text-green-500" />
                                설정됨
                              </>
                            ) : '-'}
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-sm text-gray-600 mb-1">사업장관리코드</div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.business_management_code || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-sm text-gray-600 mb-1">영업점</div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.sales_office || '-'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Measurement Equipment Card */}
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-teal-600 rounded-lg mr-3">
                          <Settings className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">측정기기 및 네트워크</h3>
                      </div>
                      
                      {/* Equipment Grid - Compact 3x3 Layout */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        {/* Measurement Instruments */}
                        {(selectedBusiness.PH센서 || selectedBusiness.PH센서 === 0) && (
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-xs text-teal-600 mb-1">PH센서</div>
                            <div className="text-lg font-bold text-gray-900">{selectedBusiness.PH센서 || 0}<span className="text-xs text-gray-500 ml-1">개</span></div>
                          </div>
                        )}
                        {(selectedBusiness.차압계 || selectedBusiness.차압계 === 0) && (
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-xs text-teal-600 mb-1">차압계</div>
                            <div className="text-lg font-bold text-gray-900">{selectedBusiness.차압계 || 0}<span className="text-xs text-gray-500 ml-1">개</span></div>
                          </div>
                        )}
                        {(selectedBusiness.온도계 || selectedBusiness.온도계 === 0) && (
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-xs text-teal-600 mb-1">온도계</div>
                            <div className="text-lg font-bold text-gray-900">{selectedBusiness.온도계 || 0}<span className="text-xs text-gray-500 ml-1">개</span></div>
                          </div>
                        )}
                        
                        {/* Current Meters */}
                        {(selectedBusiness.배출전류계 || selectedBusiness.배출전류계 === 0) && (
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-xs text-orange-600 mb-1">배출전류계</div>
                            <div className="text-lg font-bold text-gray-900">{selectedBusiness.배출전류계 || 0}<span className="text-xs text-gray-500 ml-1">개</span></div>
                          </div>
                        )}
                        {(selectedBusiness.송풍전류계 || selectedBusiness.송풍전류계 === 0) && (
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-xs text-orange-600 mb-1">송풍전류계</div>
                            <div className="text-lg font-bold text-gray-900">{selectedBusiness.송풍전류계 || 0}<span className="text-xs text-gray-500 ml-1">개</span></div>
                          </div>
                        )}
                        {(selectedBusiness.펌프전류계 || selectedBusiness.펌프전류계 === 0) && (
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-xs text-orange-600 mb-1">펌프전류계</div>
                            <div className="text-lg font-bold text-gray-900">{selectedBusiness.펌프전류계 || 0}<span className="text-xs text-gray-500 ml-1">개</span></div>
                          </div>
                        )}
                        
                        {/* Network Equipment */}
                        {(selectedBusiness.게이트웨이 || selectedBusiness.게이트웨이 === 0) && (
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-xs text-purple-600 mb-1">게이트웨이</div>
                            <div className="text-lg font-bold text-gray-900">{selectedBusiness.게이트웨이 || 0}<span className="text-xs text-gray-500 ml-1">개</span></div>
                          </div>
                        )}
                        {(selectedBusiness.VPN유선 || selectedBusiness.VPN유선 === 0) && (
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-xs text-purple-600 mb-1">VPN유선</div>
                            <div className="text-lg font-bold text-gray-900">{selectedBusiness.VPN유선 || 0}<span className="text-xs text-gray-500 ml-1">개</span></div>
                          </div>
                        )}
                        {(selectedBusiness.VPN무선 || selectedBusiness.VPN무선 === 0) && (
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-xs text-purple-600 mb-1">VPN무선</div>
                            <div className="text-lg font-bold text-gray-900">{selectedBusiness.VPN무선 || 0}<span className="text-xs text-gray-500 ml-1">개</span></div>
                          </div>
                        )}
                        {(selectedBusiness.복수굴뚝 || selectedBusiness.복수굴뚝 === 0) && (
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-xs text-red-600 mb-1">복수굴뚝</div>
                            <div className="text-lg font-bold text-gray-900">{selectedBusiness.복수굴뚝 || 0}<span className="text-xs text-gray-500 ml-1">개</span></div>
                          </div>
                        )}
                      </div>
                        
                      {/* Summary Card */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-sm text-blue-600 mb-1">배출시설</div>
                            <div className="text-xl font-bold text-blue-800">0</div>
                          </div>
                          <div>
                            <div className="text-sm text-blue-600 mb-1">방지시설</div>
                            <div className="text-xl font-bold text-blue-800">0</div>
                          </div>
                          <div>
                            <div className="text-sm text-blue-600 mb-1">총 측정기기</div>
                            <div className="text-xl font-bold text-blue-900">0</div>
                          </div>
                        </div>
                      </div>
                        
                      {/* Empty State */}
                      {(!selectedBusiness.PH센서 || selectedBusiness.PH센서 === 0) && 
                       (!selectedBusiness.차압계 || selectedBusiness.차압계 === 0) && 
                       (!selectedBusiness.온도계 || selectedBusiness.온도계 === 0) && 
                       (!selectedBusiness.배출전류계 || selectedBusiness.배출전류계 === 0) &&
                       (!selectedBusiness.송풍전류계 || selectedBusiness.송풍전류계 === 0) && 
                       (!selectedBusiness.펌프전류계 || selectedBusiness.펌프전류계 === 0) &&
                       (!selectedBusiness.게이트웨이 || selectedBusiness.게이트웨이 === 0) && (
                        <div className="bg-white rounded-lg p-6 text-center text-gray-500">
                          <Settings className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <div className="text-sm">측정기기 정보를 불러오는 중...</div>
                        </div>
                      )}
                    </div>

                    {/* Project Information Card */}
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-orange-600 rounded-lg mr-3">
                          <Briefcase className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">프로젝트 정보</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedBusiness.department && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">담당부서</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.department}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.progress_status && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">진행구분</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.progress_status}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.업종 && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">업종</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.업종}</div>
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
                        
                        {selectedBusiness.business_category && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">종별</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.business_category}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.order_manager && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">발주담당</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.order_manager}</div>
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
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-blue-600 rounded-lg mr-3">
                          <Calendar className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">일정 정보</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedBusiness.order_request_date && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">발주요청일</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.order_request_date}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.order_date && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">발주일</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.order_date}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.shipment_date && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">출고일</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.shipment_date}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.installation_date && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">설치일</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.installation_date}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.first_report_date && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">최초신고일</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.first_report_date}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.operation_start_date && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">가동개시일</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.operation_start_date}</div>
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

                    {/* Environmental Information Card */}
                    <div className="bg-gradient-to-br from-green-50 to-lime-50 rounded-xl p-6 border border-green-200">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-green-600 rounded-lg mr-3">
                          <Factory className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">환경 정보</h3>
                      </div>
                      
                      <div className="space-y-4">
                        {selectedBusiness.pollutants && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">오염물질</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.pollutants}</div>
                          </div>
                        )}
                        
                        {selectedBusiness.annual_emission_amount && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">발생량(톤/년)</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.annual_emission_amount}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financial Information Card */}
                    {(selectedBusiness.additional_cost || selectedBusiness.negotiation || selectedBusiness.multiple_stack_cost) && (
                      <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-200">
                        <div className="flex items-center mb-4">
                          <div className="p-2 bg-yellow-600 rounded-lg mr-3">
                            <Database className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-800">비용 정보</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedBusiness.additional_cost && (
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <div className="text-sm text-gray-600 mb-1">추가공사비</div>
                              <div className="text-base font-medium text-gray-900">{selectedBusiness.additional_cost?.toLocaleString()}원</div>
                            </div>
                          )}
                          
                          {selectedBusiness.multiple_stack_cost && (
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <div className="text-sm text-gray-600 mb-1">복수굴뚝(설치비)</div>
                              <div className="text-base font-medium text-gray-900">{selectedBusiness.multiple_stack_cost?.toLocaleString()}원</div>
                            </div>
                          )}
                          
                          {selectedBusiness.negotiation && (
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <div className="text-sm text-gray-600 mb-1">네고</div>
                              <div className="text-base font-medium text-gray-900">{selectedBusiness.negotiation}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Document Information Card */}
                    {(selectedBusiness.contract_document || selectedBusiness.wireless_document || selectedBusiness.installation_support || selectedBusiness.other_equipment || selectedBusiness.inventory_check) && (
                      <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
                        <div className="flex items-center mb-4">
                          <div className="p-2 bg-gray-600 rounded-lg mr-3">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-800">문서 및 기타 정보</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedBusiness.contract_document && (
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <div className="text-sm text-gray-600 mb-1">계약서</div>
                              <div className="text-base font-medium text-gray-900">{selectedBusiness.contract_document}</div>
                            </div>
                          )}
                          
                          {selectedBusiness.wireless_document && (
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <div className="text-sm text-gray-600 mb-1">무선서류</div>
                              <div className="text-base font-medium text-gray-900">{selectedBusiness.wireless_document}</div>
                            </div>
                          )}
                          
                          {selectedBusiness.installation_support && (
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <div className="text-sm text-gray-600 mb-1">설치업무지원</div>
                              <div className="text-base font-medium text-gray-900">{selectedBusiness.installation_support}</div>
                            </div>
                          )}
                          
                          {selectedBusiness.inventory_check && (
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <div className="text-sm text-gray-600 mb-1">재고파악</div>
                              <div className="text-base font-medium text-gray-900">{selectedBusiness.inventory_check}</div>
                            </div>
                          )}
                          
                          {selectedBusiness.other_equipment && (
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <div className="text-sm text-gray-600 mb-1">기타</div>
                              <div className="text-base font-medium text-gray-900">{selectedBusiness.other_equipment}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Status Information Card */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-amber-600 rounded-lg mr-3">
                          <Clock className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">상태 정보</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-sm text-gray-600 mb-2">활성 상태</div>
                          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                            selectedBusiness.is_active 
                              ? 'bg-green-100 text-green-800 border-2 border-green-200' 
                              : 'bg-gray-100 text-gray-800 border-2 border-gray-200'
                          }`}>
                            <div className={`w-3 h-3 rounded-full mr-2 ${
                              selectedBusiness.is_active ? 'bg-green-500' : 'bg-gray-400'
                            }`}></div>
                            {selectedBusiness.is_active ? '활성' : '비활성'}
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                            등록일
                          </div>
                          <div className="text-base font-medium text-gray-900">
                            {selectedBusiness.등록일 ? 
                              selectedBusiness.등록일 : (selectedBusiness.created_at ? 
                              new Date(selectedBusiness.created_at).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) : '-')}
                          </div>
                        </div>
                        
                        {selectedBusiness.수정일 && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="flex items-center text-sm text-gray-600 mb-1">
                              <Calendar className="w-4 h-4 mr-2 text-green-500" />
                              수정일
                            </div>
                            <div className="text-base font-medium text-gray-900">
                              {selectedBusiness.수정일}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-8 py-6 border-t border-gray-200">
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="flex items-center px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-white hover:border-gray-400 transition-all duration-200 font-medium"
                  >
                    <X className="w-4 h-4 mr-2" />
                    닫기
                  </button>
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false)
                      openEditModal(selectedBusiness)
                    }}
                    className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    정보 수정
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Business Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false)
              setShowLocalGovSuggestions(false)
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingBusiness ? '사업장 정보 수정' : '새 사업장 추가'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-8">
                {/* 기본 정보 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">기본 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">사업장명 *</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.business_name || ''}
                        onChange={(e) => setFormData({...formData, business_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">지자체</label>
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">주소</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.address || ''}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">대표자명</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.representative_name || ''}
                        onChange={(e) => setFormData({...formData, representative_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">사업자등록번호</label>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="000-00-00000"
                        maxLength={12}
                      />
                    </div>
                  </div>
                </div>

                {/* 담당자 정보 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">담당자 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">담당자명</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.manager_name || ''}
                        onChange={(e) => setFormData({...formData, manager_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="김태훈"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">직급</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.manager_position || ''}
                        onChange={(e) => setFormData({...formData, manager_position: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="팀장"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">담당자 연락처</label>
                      <input
                        type="tel"
                        value={formData.manager_contact || ''}
                        onChange={(e) => setFormData({...formData, manager_contact: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="010-1234-5678"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">사업장 연락처</label>
                      <input
                        type="tel"
                        value={formData.business_contact || ''}
                        onChange={(e) => setFormData({...formData, business_contact: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="02-0000-0000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">팩스번호</label>
                      <input
                        type="tel"
                        value={formData.fax_number || ''}
                        onChange={(e) => setFormData({...formData, fax_number: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="02-0000-0000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="example@company.com"
                      />
                    </div>
                  </div>
                </div>

                {/* 시스템 정보 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">시스템 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">제조사</label>
                      <select
                        value={formData.manufacturer || ''}
                        onChange={(e) => setFormData({...formData, manufacturer: (e.target.value || null) as 'ecosense' | 'cleanearth' | 'gaia_cns' | 'evs' | null})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">선택하세요</option>
                        <option value="ecosense">에코센스</option>
                        <option value="cleanearth">크린어스</option>
                        <option value="gaia_cns">가이아씨앤에스</option>
                        <option value="evs">이브이에스</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">VPN</label>
                      <select
                        value={formData.vpn || ''}
                        onChange={(e) => setFormData({...formData, vpn: (e.target.value || null) as 'wired' | 'wireless' | null})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">선택하세요</option>
                        <option value="wired">유선</option>
                        <option value="wireless">무선</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">그린링크 ID</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.greenlink_id || ''}
                        onChange={(e) => setFormData({...formData, greenlink_id: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">그린링크 PW</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.greenlink_pw || ''}
                        onChange={(e) => setFormData({...formData, greenlink_pw: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">사업장관리코드</label>
                      <input
                        type="number"
                        value={formData.business_management_code || ''}
                        onChange={(e) => setFormData({...formData, business_management_code: parseInt(e.target.value) || null})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">영업점</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.sales_office || ''}
                        onChange={(e) => setFormData({...formData, sales_office: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 장비 수량 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">측정기기</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PH센서</label>
                      <input
                        type="number"
                        value={formData.ph_meter || ''}
                        onChange={(e) => setFormData({...formData, ph_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">차압계</label>
                      <input
                        type="number"
                        value={formData.differential_pressure_meter || ''}
                        onChange={(e) => setFormData({...formData, differential_pressure_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">온도계</label>
                      <input
                        type="number"
                        value={formData.temperature_meter || ''}
                        onChange={(e) => setFormData({...formData, temperature_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">배출전류계</label>
                      <input
                        type="number"
                        value={formData.discharge_current_meter || ''}
                        onChange={(e) => setFormData({...formData, discharge_current_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">송풍전류계</label>
                      <input
                        type="number"
                        value={formData.fan_current_meter || ''}
                        onChange={(e) => setFormData({...formData, fan_current_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">펌프전류계</label>
                      <input
                        type="number"
                        value={formData.pump_current_meter || ''}
                        onChange={(e) => setFormData({...formData, pump_current_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">게이트웨이</label>
                      <input
                        type="number"
                        value={formData.gateway || ''}
                        onChange={(e) => setFormData({...formData, gateway: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VPN(유선)</label>
                      <input
                        type="number"
                        value={formData.vpn_wired || ''}
                        onChange={(e) => setFormData({...formData, vpn_wired: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VPN(무선)</label>
                      <input
                        type="number"
                        value={formData.vpn_wireless || ''}
                        onChange={(e) => setFormData({...formData, vpn_wireless: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">방폭차압계(국산)</label>
                      <input
                        type="number"
                        value={formData.explosion_proof_differential_pressure_meter_domestic || ''}
                        onChange={(e) => setFormData({...formData, explosion_proof_differential_pressure_meter_domestic: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">방폭온도계(국산)</label>
                      <input
                        type="number"
                        value={formData.explosion_proof_temperature_meter_domestic || ''}
                        onChange={(e) => setFormData({...formData, explosion_proof_temperature_meter_domestic: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">확장디바이스</label>
                      <input
                        type="number"
                        value={formData.expansion_device || ''}
                        onChange={(e) => setFormData({...formData, expansion_device: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">중계기(8채널)</label>
                      <input
                        type="number"
                        value={formData.relay_8ch || ''}
                        onChange={(e) => setFormData({...formData, relay_8ch: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">중계기(16채널)</label>
                      <input
                        type="number"
                        value={formData.relay_16ch || ''}
                        onChange={(e) => setFormData({...formData, relay_16ch: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">메인보드교체</label>
                      <input
                        type="number"
                        value={formData.main_board_replacement || ''}
                        onChange={(e) => setFormData({...formData, main_board_replacement: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">복수굴뚝</label>
                      <input
                        type="number"
                        value={formData.multiple_stack || ''}
                        onChange={(e) => setFormData({...formData, multiple_stack: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* 상태 설정 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">상태 설정</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">활성 상태</label>
                      <select
                        value={formData.is_active ? 'true' : 'false'}
                        onChange={(e) => setFormData({...formData, is_active: e.target.value === 'true'})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="true">활성</option>
                        <option value="false">비활성</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setShowLocalGovSuggestions(false)
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingBusiness ? '수정' : '추가'}
                </button>
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
                      <div>사업장명 * (필수)</div>
                      <div>지자체, 주소, 대표자명</div>
                      <div>사업장담당자, 직급, 연락처</div>
                      <div>사업장연락처, 이메일</div>
                      <div>제조사 (1. 에코센스 등)</div>
                      <div>VPN (1. 무선, 2. 유선)</div>
                      <div>그린링크ID, 그린링크PW</div>
                      <div>사업장관리코드</div>
                      <div>PH센서, 차압계, 온도계</div>
                      <div>배출전류계(CT), 송풍전류계(CT), 펌프전류계(CT)</div>
                      <div>게이트웨이 (통합 수량)</div>
                      <div>VPN(유선), VPN(무선)</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      • 기존 사업장은 자동 업데이트, 새 사업장은 자동 생성<br/>
                      • CT = 전류계 (Current Transformer)<br/>
                      • 템플릿 다운로드로 정확한 형식 확인 가능
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
                    <div className="grid grid-cols-4 gap-3 mb-6">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600">{uploadResults.total}</div>
                        <div className="text-sm text-blue-700">총 처리</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600">{uploadResults.created || 0}</div>
                        <div className="text-sm text-green-700">신규 생성</div>
                      </div>
                      <div className="bg-cyan-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-cyan-600">{uploadResults.updated || 0}</div>
                        <div className="text-sm text-cyan-700">업데이트</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-red-600">{uploadResults.failed}</div>
                        <div className="text-sm text-red-700">실패</div>
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
    </AdminLayout>
  )
}