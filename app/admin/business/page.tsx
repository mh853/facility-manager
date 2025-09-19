// app/admin/business/page.tsx - 사업장 관리 페이지
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { BusinessInfo } from '@/lib/database-service'
import type { BusinessMemo, CreateBusinessMemoInput, UpdateBusinessMemoInput } from '@/types/database'

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
  Save
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

function BusinessManagementPage() {
  // 권한 확인 훅
  const { canDeleteAutoMemos } = usePermission()

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
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)

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

    // 최신순으로 정렬 (created_at 기준)
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
      const response = await fetch(`/api/facility-tasks?businessName=${encodeURIComponent(businessName)}`)
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
        await loadBusinessMemos(selectedBusiness.id)
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

    if (searchTerms.length === 0) {
      console.log('📋 검색어 없음 - 전체 목록 표시:', allBusinesses.length)
      return allBusinesses
    }

    const filtered = allBusinesses.filter(business => {
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
  }, [searchTerms, allBusinesses])

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
          console.log('🔄 모달용 최신 데이터 조회 완료:', refreshedBusiness.사업장명)
          setSelectedBusiness(refreshedBusiness)
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
      business_type: airPermitData?.business_type || business.업종,
      business_category: airPermitData?.category || business.business_category,
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
      
      // VPN 및 네트워크 관련 필드들
      vpn_wired: business.VPN유선,
      vpn_wireless: business.VPN무선,
      multiple_stack: business.복수굴뚝,
      
      // 추가 측정기기 필드들
      explosion_proof_differential_pressure_meter_domestic: business.방폭차압계국산,
      explosion_proof_temperature_meter_domestic: business.방폭온도계국산,
      expansion_device: business.확장디바이스,
      relay_8ch: business.중계기8채널,
      relay_16ch: business.중계기16채널,
      main_board_replacement: business.메인보드교체,
      
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
        
        // 3. API 응답으로 정확한 데이터 동기화
        if (result.success && result.data) {
          console.log('✅ API 응답에서 받은 업데이트된 데이터:', result.data)
          
          if (editingBusiness) {
            // 편집의 경우: 서버에서 받은 정확한 데이터로 교체
            const serverData = result.data
            const updatedBusiness = {
              id: serverData.id,
              사업장명: serverData.business_name || '',
              지자체: serverData.local_government || '',
              주소: serverData.address || '',
              대표자명: serverData.representative_name || '',
              사업자등록번호: serverData.business_registration_number || '',
              업종: serverData.business_type || '',
              사업장전화번호: serverData.business_contact || '',
              담당자명: serverData.manager_name || '',
              담당자연락처: serverData.manager_contact || '',
              담당자직급: serverData.manager_position || '',
              팩스번호: serverData.fax_number || '',
              이메일: serverData.email || '',
              생성일: serverData.created_at,
              수정일: serverData.updated_at,
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
        alert(result.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('저장 오류:', error)
      // 에러 발생 시 상태 롤백
      if (editingBusiness) {
        await loadAllBusinesses()
      }
      alert('사업장 저장에 실패했습니다.')
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
              <span className="text-sm font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {searchQuery ? (
                  `검색결과 ${filteredBusinesses.length}개 (전체 ${allBusinesses.length}개 중)`
                ) : (
                  `전체 ${allBusinesses.length}개 사업장`
                )}
              </span>
            </div>
            
            {/* 실시간 검색창 */}
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="콤마로 구분하여 다중 검색: 청주, 보조금, 에코센스 (사업장명, 주소, 담당자, 제조사, 진행상태 등)"
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

              {/* 검색 태그 표시 */}
              {searchTerms.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-sm text-gray-600 font-medium">활성 필터:</span>
                  {searchTerms.map((term, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-blue-700 bg-blue-100 border border-blue-200"
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
                  <span className="text-sm text-gray-500">
                    총 {filteredBusinesses.length}개 사업장
                  </span>
                </div>
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
                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setIsDetailModalOpen(false)
                        openEditModal(selectedBusiness)
                      }}
                      className="flex items-center px-3 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200 text-sm font-medium border border-white border-opacity-30 hover:border-opacity-50"
                    >
                      <Edit className="w-4 h-4 mr-1.5" />
                      정보수정
                    </button>
                    <button
                      onClick={() => setIsDetailModalOpen(false)}
                      className="flex items-center px-3 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200 text-sm font-medium border border-white border-opacity-30 hover:border-opacity-50"
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      닫기
                    </button>
                  </div>
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
                          onClick={() => setIsAddingMemo(true)}
                          className="flex items-center px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors"
                        >
                          <MessageSquarePlus className="w-3 h-3 mr-1" />
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

                        {/* 메모 및 업무 통합 섹션 (최신순 정렬) */}
                        {(businessMemos.length > 0 || businessTasks.length > 0) && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="flex items-center text-sm text-gray-600 mb-3">
                              <MessageSquare className="w-4 h-4 mr-2 text-indigo-500" />
                              메모 및 업무 ({businessMemos.length + businessTasks.length}개, 최신순)
                            </div>
                            <div className="space-y-3">
                              {getIntegratedItems().map((item, index) => {
                                if (item.type === 'memo') {
                                  const memo = item.data
                                  const isAutoMemo = item.title?.startsWith('[자동]')
                                  return (
                                    <div key={`memo-${item.id}-${index}`} className={`${isAutoMemo ? 'bg-gray-50 border-gray-300' : 'bg-gray-50 border-indigo-400'} rounded-lg p-3 border-l-4`}>
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <MessageSquare className={`w-4 h-4 ${isAutoMemo ? 'text-gray-400' : 'text-indigo-500'}`} />
                                        <h4 className={`${isAutoMemo ? 'font-normal text-gray-600 text-sm' : 'font-medium text-gray-900'}`}>{item.title}</h4>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${isAutoMemo ? 'bg-gray-100 text-gray-600' : 'bg-indigo-100 text-indigo-700'}`}>
                                          {isAutoMemo ? '자동' : '메모'}
                                        </span>
                                      </div>
                                      <p className={`text-sm ${isAutoMemo ? 'text-gray-500' : 'text-gray-700'}`}>{item.content}</p>
                                    </div>
                                    {(!isAutoMemo || (isAutoMemo && canDeleteAutoMemos)) && (
                                      <div className="flex items-center space-x-1 ml-2">
                                        {!isAutoMemo && (
                                          <button
                                            onClick={() => startEditMemo(memo)}
                                            disabled={!memo.id}
                                            className={`p-1.5 rounded transition-colors ${
                                              memo.id
                                                ? 'text-gray-400 hover:text-indigo-600'
                                                : 'text-gray-300 cursor-not-allowed'
                                            }`}
                                            title={memo.id ? "메모 수정" : "메모 ID가 없어 수정할 수 없습니다"}
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDeleteMemo(memo)}
                                          disabled={!memo.id}
                                          className={`p-1.5 rounded transition-colors ${
                                            memo.id
                                              ? 'text-gray-400 hover:text-red-600'
                                              : 'text-gray-300 cursor-not-allowed'
                                          }`}
                                          title={memo.id ?
                                            (isAutoMemo ? "자동 메모 삭제 (슈퍼 관리자 전용)" : "메모 삭제") :
                                            "메모 ID가 없어 삭제할 수 없습니다"
                                          }
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-gray-500">
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
                                    <div key={`task-${item.id}-${index}`} className={`${statusColors.bg} rounded-lg p-4 border-l-4 ${statusColors.border} hover:shadow-md transition-shadow`}>
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-2 mb-2">
                                            <ClipboardList className="w-4 h-4 text-blue-500" />
                                            <h4 className="font-semibold text-gray-900">{item.title}</h4>
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors.badge} ${statusColors.text}`}>
                                              {getStatusDisplayName(item.status || '')}
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-700 mb-3 leading-relaxed">{item.description}</p>
                                          <div className="flex items-center space-x-4 text-xs">
                                            <span className="flex items-center space-x-1">
                                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                              <span className="text-gray-600">
                                                {item.task_type === 'subsidy' ? '지원사업' : '자체사업'}
                                              </span>
                                            </span>
                                            <span className="flex items-center space-x-1">
                                              <User className="w-3 h-3 text-gray-500" />
                                              <span className="text-gray-600">{item.assignee}</span>
                                            </span>
                                            <span className="flex items-center space-x-1">
                                              <Calendar className="w-3 h-3 text-gray-500" />
                                              <span className="text-gray-600">
                                                {task.deadline ? new Date(task.deadline).toLocaleDateString('ko-KR', {
                                                  month: 'short', day: 'numeric'
                                                }) : '미정'}
                                              </span>
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
                                        <span className="flex items-center space-x-1">
                                          <Calendar className="w-3 h-3" />
                                          <span>생성: {new Date(item.created_at).toLocaleDateString('ko-KR', {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                          })}</span>
                                        </span>
                                        {task.updated_at !== task.created_at && (
                                          <span className="flex items-center space-x-1">
                                            <Clock className="w-3 h-3" />
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
                          <div className="bg-white rounded-lg p-4 shadow-sm border border-indigo-200">
                            <div className="flex items-center text-sm text-indigo-600 mb-3">
                              <MessageSquarePlus className="w-4 h-4 mr-2" />
                              {editingMemo ? '메모 수정' : '새 메모 추가'}
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">제목</label>
                                <input
                                  type="text"
                                  value={memoForm.title}
                                  onChange={(e) => setMemoForm(prev => ({ ...prev, title: e.target.value }))}
                                  placeholder="메모 제목을 입력하세요"
                                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">내용</label>
                                <textarea
                                  value={memoForm.content}
                                  onChange={(e) => setMemoForm(prev => ({ ...prev, content: e.target.value }))}
                                  placeholder="메모 내용을 입력하세요"
                                  rows={3}
                                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
                                />
                              </div>
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setIsAddingMemo(false)
                                    setEditingMemo(null)
                                    setMemoForm({ title: '', content: '' })
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                  취소
                                </button>
                                <button
                                  onClick={editingMemo ? handleEditMemo : handleAddMemo}
                                  disabled={!memoForm.title?.trim() || !memoForm.content?.trim()}
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
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

                    {/* Equipment and Network Card */}
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-teal-600 rounded-lg mr-3">
                          <Settings className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">측정기기 및 네트워크</h3>
                      </div>
                      
                      {/* Equipment Quantities with Facility Management Comparison */}
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm font-semibold text-purple-700">측정기기 수량</div>
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
                            className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                          >
                            시설관리 연동
                          </button>
                        </div>
                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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
                                <div key={`${device.facilityKey}-${device.key}-${index}`} className="bg-white rounded-lg p-3 shadow-sm">
                                  <div className="text-xs text-gray-600 mb-1">{device.key}</div>
                                  <div className="flex items-center justify-between">
                                    <div className="text-lg font-bold text-gray-900">{device.value}</div>
                                    {facilityDeviceCounts?.[device.facilityKey as keyof typeof facilityDeviceCounts] !== undefined && (
                                      <div className={`text-sm ${
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
                        <div className="bg-white rounded-lg p-6 text-center text-gray-500">
                          <Settings className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <div className="text-sm">시설 정보를 불러오는 중...</div>
                        </div>
                      ) : facilityData ? (
                        <>
                          {/* Facility Summary Card */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 mb-4">
                            <div className="text-sm font-semibold text-blue-700 mb-3">시설 정보 (대기필증 기준)</div>
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <div className="text-sm text-blue-600 mb-1">배출시설</div>
                                <div className="text-xl font-bold text-blue-800">{facilityData.summary.discharge_count}</div>
                              </div>
                              <div>
                                <div className="text-sm text-blue-600 mb-1">방지시설</div>
                                <div className="text-xl font-bold text-blue-800">{facilityData.summary.prevention_count}</div>
                              </div>
                              <div>
                                <div className="text-sm text-blue-600 mb-1">배출구</div>
                                <div className="text-xl font-bold text-blue-900">
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
                        <div className="bg-white rounded-lg p-6 text-center text-gray-500">
                          <Settings className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <div className="text-sm">등록된 대기필증 정보가 없습니다</div>
                          <div className="text-xs text-gray-400 mt-1">시설 정보를 확인하려면 먼저 대기필증을 등록하세요</div>
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
                        
                        {/* 업종 - 대기필증 데이터 우선 표시 */}
                        {(airPermitData?.business_type || selectedBusiness.업종) && (
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                              업종
                              {airPermitData?.business_type && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  대기필증 연동
                                </span>
                              )}
                            </div>
                            <div className="text-base font-medium text-gray-900">
                              {airPermitData?.business_type || selectedBusiness.업종}
                            </div>
                            {airPermitData?.business_type && selectedBusiness.업종 && 
                             airPermitData.business_type !== selectedBusiness.업종 && (
                              <div className="text-xs text-amber-600 mt-1">
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mr-4">
                    <Edit className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">
                    {editingBusiness ? '사업장 정보 수정' : '새 사업장 추가'}
                  </h2>
                </div>
                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    type="submit"
                    form="business-form"
                    className="flex items-center px-3 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200 text-sm font-medium border border-white border-opacity-30 hover:border-opacity-50"
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    {editingBusiness ? '수정완료' : '추가완료'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
                      setShowLocalGovSuggestions(false)
                    }}
                    className="flex items-center px-3 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200 text-sm font-medium border border-white border-opacity-30 hover:border-opacity-50"
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    취소
                  </button>
                </div>
              </div>
            </div>
            
            <form id="business-form" onSubmit={handleSubmit} className="p-8 max-h-[80vh] overflow-y-auto">
              <div className="space-y-8">
                {/* 기본 정보 */}
                <div>
                  <div className="flex items-center mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3">
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">기본 정보</h3>
                  </div>
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
                  <div className="flex items-center mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-3">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">담당자 정보</h3>
                  </div>
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">대표자생년월일</label>
                      <input
                        type="date"
                        value={formData.representative_birth_date || ''}
                        onChange={(e) => setFormData({...formData, representative_birth_date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 사업장 정보 */}
                <div>
                  <div className="flex items-center mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center mr-3">
                      <Briefcase className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">사업장 정보</h3>
                  </div>
                  
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="사업 종별"
                      />
                      {airPermitData?.category && airPermitData.category !== (formData.business_category || '') && (
                        <div className="text-xs text-blue-600 mt-1">
                          대기필증 정보: {airPermitData.category}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">담당부서</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.department || ''}
                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="담당부서명"
                      />
                    </div>

                  </div>
                </div>

                {/* 프로젝트 관리 */}
                <div>
                  <div className="flex items-center mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
                      <ClipboardList className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">프로젝트 관리</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">진행구분</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.progress_status || ''}
                        onChange={(e) => setFormData({...formData, progress_status: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="예: 설치 대기, 진행중, 완료"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">설치팀</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.installation_team || ''}
                        onChange={(e) => setFormData({...formData, installation_team: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="설치 담당팀"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">발주담당</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.order_manager || ''}
                        onChange={(e) => setFormData({...formData, order_manager: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="발주 담당자명"
                      />
                    </div>
                  </div>
                </div>

                {/* 일정 관리 */}
                <div>
                  <div className="flex items-center mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mr-3">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">일정 관리</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">발주요청일</label>
                      <input
                        type="date"
                        value={formData.order_request_date || ''}
                        onChange={(e) => setFormData({...formData, order_request_date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">발주일</label>
                      <input
                        type="date"
                        value={formData.order_date || ''}
                        onChange={(e) => setFormData({...formData, order_date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">출고일</label>
                      <input
                        type="date"
                        value={formData.shipment_date || ''}
                        onChange={(e) => setFormData({...formData, shipment_date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">설치일</label>
                      <input
                        type="date"
                        value={formData.installation_date || ''}
                        onChange={(e) => setFormData({...formData, installation_date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                  </div>
                </div>

                {/* 시스템 정보 */}
                <div>
                  <div className="flex items-center mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
                      <Settings className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">시스템 정보</h3>
                  </div>
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
                        onChange={(e) => setFormData({...formData, business_management_code: parseInt(e.target.value) || 0})}
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
                        onChange={(e) => setFormData({...formData, ph_meter: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">차압계</label>
                      <input
                        type="number"
                        value={formData.differential_pressure_meter || ''}
                        onChange={(e) => setFormData({...formData, differential_pressure_meter: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">온도계</label>
                      <input
                        type="number"
                        value={formData.temperature_meter || ''}
                        onChange={(e) => setFormData({...formData, temperature_meter: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">배출전류계</label>
                      <input
                        type="number"
                        value={formData.discharge_current_meter || ''}
                        onChange={(e) => setFormData({...formData, discharge_current_meter: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">송풍전류계</label>
                      <input
                        type="number"
                        value={formData.fan_current_meter || ''}
                        onChange={(e) => setFormData({...formData, fan_current_meter: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">펌프전류계</label>
                      <input
                        type="number"
                        value={formData.pump_current_meter || ''}
                        onChange={(e) => setFormData({...formData, pump_current_meter: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">게이트웨이</label>
                      <input
                        type="number"
                        value={formData.gateway || ''}
                        onChange={(e) => setFormData({...formData, gateway: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VPN(유선)</label>
                      <input
                        type="number"
                        value={formData.vpn_wired || ''}
                        onChange={(e) => setFormData({...formData, vpn_wired: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VPN(무선)</label>
                      <input
                        type="number"
                        value={formData.vpn_wireless || ''}
                        onChange={(e) => setFormData({...formData, vpn_wireless: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">방폭차압계(국산)</label>
                      <input
                        type="number"
                        value={formData.explosion_proof_differential_pressure_meter_domestic || ''}
                        onChange={(e) => setFormData({...formData, explosion_proof_differential_pressure_meter_domestic: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">방폭온도계(국산)</label>
                      <input
                        type="number"
                        value={formData.explosion_proof_temperature_meter_domestic || ''}
                        onChange={(e) => setFormData({...formData, explosion_proof_temperature_meter_domestic: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">확장디바이스</label>
                      <input
                        type="number"
                        value={formData.expansion_device || ''}
                        onChange={(e) => setFormData({...formData, expansion_device: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">중계기(8채널)</label>
                      <input
                        type="number"
                        value={formData.relay_8ch || ''}
                        onChange={(e) => setFormData({...formData, relay_8ch: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">중계기(16채널)</label>
                      <input
                        type="number"
                        value={formData.relay_16ch || ''}
                        onChange={(e) => setFormData({...formData, relay_16ch: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">메인보드교체</label>
                      <input
                        type="number"
                        value={formData.main_board_replacement || ''}
                        onChange={(e) => setFormData({...formData, main_board_replacement: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">복수굴뚝</label>
                      <input
                        type="number"
                        value={formData.multiple_stack || ''}
                        onChange={(e) => setFormData({...formData, multiple_stack: parseInt(e.target.value) || 0})}
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

export default withAuth(BusinessManagementPage, 'canAccessAdminPages')