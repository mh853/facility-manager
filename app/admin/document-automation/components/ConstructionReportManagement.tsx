// app/admin/document-automation/components/ConstructionReportManagement.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  Download,
  Eye,
  Search,
  Calendar,
  Building2,
  Loader2,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import dynamic from 'next/dynamic'
import DateInput from './DateInput'

// 템플릿 컴포넌트 동적 import (미리보기용)
const ConstructionReportTemplate = dynamic(
  () => import('./construction-report/ConstructionReportTemplate'),
  { ssr: false }
)
const ContractGovernmentTemplate = dynamic(
  () => import('./construction-report/ContractGovernmentTemplate'),
  { ssr: false }
)
const ContractBusinessTemplate = dynamic(
  () => import('./construction-report/ContractBusinessTemplate'),
  { ssr: false }
)
const ImprovementPlanTemplate = dynamic(
  () => import('./construction-report/ImprovementPlanTemplate'),
  { ssr: false }
)

interface Business {
  id: string
  business_name: string
  address?: string
  business_contact?: string
  fax_number?: string
  representative_name?: string
  business_registration_number?: string
  local_government?: string
  gateway: number
  vpn: 'wired' | 'wireless'
  discharge_current_meter: number
  fan_current_meter: number
  differential_pressure_meter: number
  temperature_meter: number
  ph_meter: number
  additional_cost?: number // 추가공사비
  negotiation?: number // 협의사항 (할인)
}

interface PreventionFacility {
  id: string
  facility_name: string
  capacity?: string
  quantity: number
}

interface ConstructionReportData {
  // 기본 정보
  business_id: string
  business_name: string
  address: string
  business_contact: string
  fax_number: string
  representative_name: string
  business_registration_number: string
  local_government_head: string

  // 보조금 정보
  subsidy_approval_date: string // 보조금 승인일
  government_notice_price: number // 환경부고시가
  subsidy_amount: number // 보조금 승인액
  self_payment: number // 자부담 (환경부고시가 - 보조금 승인액)
  deposit_amount: number // 입금액

  // 방지시설 정보
  prevention_facilities: PreventionFacility[] // 방지시설 전체 정보 배열

  // 측정기기 정보
  gateway: number
  vpn_type: string // 'wired' 또는 'wireless'
  discharge_current_meter: number // 배출CT
  prevention_current_meter: number // 방지CT (fan_current_meter)
  differential_pressure_meter: number
  temperature_meter: number
  ph_meter: number

  // 추가 비용 (사업장 보관용 계약서에만 사용)
  additional_cost: number // 추가비용
  negotiation_cost: number // 네고금액

  // 계약 조건
  contract_bond_rate?: string // 계약이행보증보험 비율 (5% 또는 10%)

  // 작성 날짜
  report_date: string // 신고서 작성일
}

interface ConstructionReportHistory {
  id: string
  business_id: string
  business_name: string
  report_number: string
  report_date: string
  subsidy_amount: number
  created_at: string
  pdf_file_url?: string
  report_data?: ConstructionReportData // 전체 신고서 데이터
}

interface ConstructionReportManagementProps {
  onDocumentCreated?: () => void
}

export default function ConstructionReportManagement({ onDocumentCreated }: ConstructionReportManagementProps) {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [reports, setReports] = useState<ConstructionReportHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // 폼 데이터
  const [formData, setFormData] = useState<Partial<ConstructionReportData>>({
    subsidy_approval_date: '',
    government_notice_price: 0,
    subsidy_amount: 0,
    self_payment: 0,
    deposit_amount: 0,
    additional_cost: 0,
    negotiation_cost: 0,
    report_date: new Date().toISOString().split('T')[0],
    local_government_head: '', // 지자체장 입력 필드
    contract_bond_rate: '10' // 계약이행보증보험 비율 기본값 10%
  })

  // 보조금 비율 (퍼센트)
  const [subsidyPercentage, setSubsidyPercentage] = useState<number>(0)

  const [preventionFacilities, setPreventionFacilities] = useState<PreventionFacility[]>([])
  const [selectedReport, setSelectedReport] = useState<ConstructionReportHistory | null>(null)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)

  const { user } = useAuth()
  const userPermissionLevel = user?.permission_level || 0

  const canView = userPermissionLevel >= 1
  const canCreate = userPermissionLevel >= 1
  const canEdit = userPermissionLevel >= 1
  const canDelete = userPermissionLevel >= 4

  // 숫자 포맷팅 헬퍼 함수 (콤마 추가)
  const formatNumber = (value: number | string | undefined): string => {
    if (!value && value !== 0) return ''
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return ''
    return num.toLocaleString('ko-KR')
  }

  // 포맷된 문자열을 숫자로 변환
  const parseFormattedNumber = (value: string): number => {
    const cleaned = value.replace(/,/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  useEffect(() => {
    loadBusinesses()
  }, [])

  useEffect(() => {
    if (selectedBusiness) {
      loadReports(selectedBusiness.id)
    } else {
      loadReports()
    }
  }, [selectedBusiness])

  const loadBusinesses = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/business-info-direct', {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await response.json()
      if (data.success) {
        setBusinesses(data.data || [])
      }
    } catch (error) {
      console.error('사업장 로드 오류:', error)
    }
  }

  const loadReports = async (businessId?: string) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      const url = businessId
        ? `/api/construction-reports?business_id=${businessId}`
        : '/api/construction-reports'

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Cache-Control': 'no-cache'
        }
      })
      const data = await response.json()

      if (data.success) {
        setReports(data.data || [])
      }
    } catch (error) {
      console.error('착공신고서 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPreventionFacilities = async (businessId: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      // 대기필증 정보 조회 API 호출 (details=true로 배출구/시설 정보 포함)
      const response = await fetch(`/api/air-permit?businessId=${businessId}&details=true`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await response.json()

      console.log('[착공신고서] 대기필증 응답:', data)

      // data.data는 permits 배열
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const permit = data.data[0] // 첫 번째 대기필증 사용

        // 모든 배출구의 방지시설을 수집
        const allPreventionFacilities: PreventionFacility[] = []
        if (permit.outlets && Array.isArray(permit.outlets)) {
          permit.outlets.forEach((outlet: any) => {
            if (outlet.prevention_facilities && Array.isArray(outlet.prevention_facilities)) {
              allPreventionFacilities.push(...outlet.prevention_facilities)
            }
          })
        }

        console.log('[착공신고서] 추출된 방지시설:', allPreventionFacilities)
        setPreventionFacilities(allPreventionFacilities)
      } else {
        console.log('[착공신고서] 대기필증 정보 없음')
        setPreventionFacilities([])
      }
    } catch (error) {
      console.error('방지시설 로드 오류:', error)
      setPreventionFacilities([])
    }
  }

  const openFormModal = async (business: Business) => {
    setSelectedBusiness(business)

    // 방지시설 정보 로드
    await loadPreventionFacilities(business.id)

    // 매출 계산 정보 로드 (환경부고시가)
    let governmentNoticePrice = 0
    let additionalCost = 0
    let negotiationCost = 0

    try {
      const token = localStorage.getItem('auth_token')

      // 매출관리 API에서 환경부고시가 조회
      const revenueResponse = await fetch('/api/revenue/calculate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          business_id: business.id,
          save_result: false
        })
      })

      const revenueData = await revenueResponse.json()

      if (revenueData.success && revenueData.data && revenueData.data.calculation) {
        const calculation = revenueData.data.calculation
        // 환경부고시가 = 기본 매출 (추가공사비/협의사항 제외)
        governmentNoticePrice = calculation.base_revenue || calculation.total_revenue || 0
      }

      // 사업장관리에서 추가공사비 조회
      const businessResponse = await fetch(`/api/business-info-direct?id=${business.id}`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      const businessData = await businessResponse.json()

      if (businessData.success && businessData.data && businessData.data.length > 0) {
        const businessInfo = businessData.data[0]
        additionalCost = businessInfo.additional_cost || 0
        negotiationCost = businessInfo.negotiation || 0
      }
    } catch (error) {
      console.error('매출/비용 정보 로드 오류:', error)
      // 실패해도 계속 진행 (사용자가 수동으로 입력 가능)
    }

    // 폼 데이터 초기화
    setFormData({
      business_id: business.id,
      business_name: business.business_name,
      address: business.address || '',
      business_contact: business.business_contact || '',
      fax_number: business.fax_number || '',
      representative_name: business.representative_name || '',
      business_registration_number: business.business_registration_number || '',
      local_government_head: business.local_government ? `${business.local_government}장` : '',
      gateway: business.gateway,
      vpn_type: business.vpn,
      discharge_current_meter: business.discharge_current_meter,
      prevention_current_meter: business.fan_current_meter,
      differential_pressure_meter: business.differential_pressure_meter,
      temperature_meter: business.temperature_meter,
      ph_meter: business.ph_meter,
      subsidy_approval_date: '',
      government_notice_price: governmentNoticePrice, // 자동 입력
      subsidy_amount: 0,
      self_payment: governmentNoticePrice, // 초기값 = 환경부고시가 (보조금 0 가정)
      deposit_amount: 0,
      additional_cost: additionalCost, // 자동 입력
      negotiation_cost: negotiationCost, // 자동 입력
      report_date: new Date().toISOString().split('T')[0],
      contract_bond_rate: '10' // 기본값 10%
    })

    // 보조금 비율 초기화
    setSubsidyPercentage(0)

    setIsFormModalOpen(true)
  }

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }

      // 자부담 자동 계산
      if (field === 'government_notice_price' || field === 'subsidy_amount') {
        const govPrice = field === 'government_notice_price' ? value : (prev.government_notice_price || 0)
        const subsidy = field === 'subsidy_amount' ? value : (prev.subsidy_amount || 0)
        updated.self_payment = govPrice - subsidy
      }

      return updated
    })
  }

  // 보조금 비율로 보조금 승인액 자동 계산
  const handlePercentageChange = (percentage: number) => {
    setSubsidyPercentage(percentage)

    if (formData.government_notice_price && percentage > 0) {
      const calculatedSubsidy = Math.round(formData.government_notice_price * (percentage / 100))
      handleFormChange('subsidy_amount', calculatedSubsidy)
    }
  }

  const generateConstructionReport = async () => {
    if (!selectedBusiness || !formData.subsidy_approval_date || !formData.government_notice_price || !formData.local_government_head) {
      alert('필수 정보를 모두 입력해주세요. (보조금 승인일, 환경부고시가, 지자체장)')
      return
    }

    try {
      setGeneratingReport(true)
      const token = localStorage.getItem('auth_token')

      // 입금액 자동 계산 (사업비의 부가세 + 자부담)
      const businessVat = Math.round((formData.government_notice_price || 0) * 0.1)
      const depositAmountIot = (formData.self_payment || 0) + businessVat

      // 필수 필드를 포함한 완전한 reportData 구성
      const reportData: ConstructionReportData = {
        // 사업장 기본 정보 (selectedBusiness에서)
        business_id: selectedBusiness.id,
        business_name: selectedBusiness.business_name,
        address: selectedBusiness.address || '',
        business_contact: selectedBusiness.business_contact || '',
        fax_number: selectedBusiness.fax_number || '',
        representative_name: selectedBusiness.representative_name || '',
        business_registration_number: selectedBusiness.business_registration_number || '',
        local_government_head: formData.local_government_head || '',

        // 측정기기 정보 (selectedBusiness에서)
        gateway: selectedBusiness.gateway,
        vpn_type: selectedBusiness.vpn,
        discharge_current_meter: selectedBusiness.discharge_current_meter,
        prevention_current_meter: selectedBusiness.fan_current_meter,
        differential_pressure_meter: selectedBusiness.differential_pressure_meter,
        temperature_meter: selectedBusiness.temperature_meter,
        ph_meter: selectedBusiness.ph_meter,

        // 폼 입력 데이터
        subsidy_approval_date: formData.subsidy_approval_date || '',
        government_notice_price: formData.government_notice_price || 0,
        subsidy_amount: formData.subsidy_amount || 0,
        self_payment: formData.self_payment || 0,
        deposit_amount: depositAmountIot,
        additional_cost: formData.additional_cost || 0,
        negotiation_cost: formData.negotiation_cost || 0,
        report_date: formData.report_date || new Date().toISOString().split('T')[0],

        // 계약 조건
        contract_bond_rate: formData.contract_bond_rate || '10',

        // 방지시설 정보
        prevention_facilities: preventionFacilities
      }

      const response = await fetch('/api/construction-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(reportData)
      })

      // HTTP 상태 코드 체크
      if (!response.ok) {
        let errorMessage = '착공신고서 저장 실패'

        if (response.status === 403) {
          errorMessage = '접근 권한이 없습니다. 관리자에게 문의하세요.'
        } else if (response.status === 401) {
          errorMessage = '로그인이 필요합니다.'
        } else if (response.status === 400) {
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || '잘못된 요청입니다.'
          } catch {
            errorMessage = '잘못된 요청입니다.'
          }
        } else if (response.status === 500) {
          errorMessage = '서버 오류가 발생했습니다.'
        }

        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (result.success) {
        alert('착공신고서가 저장되었습니다.')
        setIsFormModalOpen(false)
        loadReports(selectedBusiness.id)
        onDocumentCreated?.()
      } else {
        throw new Error(result.error || '착공신고서 저장 실패')
      }
    } catch (error) {
      console.error('착공신고서 저장 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '착공신고서 저장 중 오류가 발생했습니다.'
      alert(errorMessage)
    } finally {
      setGeneratingReport(false)
    }
  }

  const deleteConstructionReport = async (reportId: string, reportName: string) => {
    if (!canDelete) {
      alert('삭제 권한이 없습니다.')
      return
    }

    if (!confirm(`"${reportName}" 착공신고서를 삭제하시겠습니까?`)) {
      return
    }

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/construction-reports?id=${reportId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      const result = await response.json()

      if (result.success) {
        alert('착공신고서가 삭제되었습니다.')
        loadReports(selectedBusiness?.id)
        onDocumentCreated?.()
      } else {
        throw new Error(result.error || '삭제 실패')
      }
    } catch (error) {
      console.error('착공신고서 삭제 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '착공신고서 삭제 중 오류가 발생했습니다.'
      alert(errorMessage)
    }
  }

  // PDF 다운로드 함수 (각 페이지를 개별적으로 생성하여 페이지 구분 명확화)
  const downloadPDF = async () => {
    if (!selectedReport) return

    try {
      const jsPDF = (await import('jspdf')).default
      const html2canvas = (await import('html2canvas')).default

      // 미리보기 모달의 내용을 찾기
      const previewContainer = document.querySelector('.preview-container')

      if (!previewContainer) {
        alert('미리보기 내용을 찾을 수 없습니다.')
        return
      }

      // 각 페이지 섹션 찾기 (색상 헤더가 있는 섹션들)
      const pageSections = previewContainer.querySelectorAll('.bg-white.rounded-lg.shadow-sm')

      if (pageSections.length === 0) {
        alert('페이지 섹션을 찾을 수 없습니다.')
        return
      }

      // PDF 생성
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      })

      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const margin = 10 // 상하좌우 여백 (mm)

      // 각 섹션을 개별 페이지로 변환
      for (let i = 0; i < pageSections.length; i++) {
        const section = pageSections[i] as HTMLElement

        // 콘텐츠 부분만 선택 (색상 헤더 제외)
        const contentDiv = section.querySelector('div:last-child') as HTMLElement

        if (!contentDiv) continue

        // 임시로 색상 헤더 숨기기
        const headerDiv = section.querySelector('div:first-child') as HTMLElement
        const originalHeaderDisplay = headerDiv ? headerDiv.style.display : ''
        if (headerDiv) {
          headerDiv.style.display = 'none'
        }

        // 미리보기 scale(0.85) 임시 제거 - 실제 크기로 캡처
        const originalTransform = contentDiv.style.transform
        const originalPadding = contentDiv.style.padding
        contentDiv.style.transform = 'scale(1)'
        contentDiv.style.transformOrigin = 'top center'
        contentDiv.style.padding = '0'

        // 실제 컨텐츠 너비를 측정하여 windowWidth 설정
        const contentWidth = contentDiv.scrollWidth || 800

        // Canvas로 변환 (scale 2로 고해상도, 실제 크기로 캡처)
        const canvas = await html2canvas(contentDiv, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: contentWidth,
          width: contentWidth
        })

        // 원래 스타일 복원
        contentDiv.style.transform = originalTransform
        contentDiv.style.padding = originalPadding

        // 헤더 복원
        if (headerDiv) {
          headerDiv.style.display = originalHeaderDisplay
        }

        // 이미지 데이터 생성
        const imgData = canvas.toDataURL('image/jpeg', 0.95)

        // 여백을 고려한 사용 가능한 영역
        const availableWidth = imgWidth - (margin * 2)
        const availableHeight = pageHeight - (margin * 2)

        // 원본 비율 유지하면서 사용 가능한 영역에 맞게 스케일 계산
        const imgHeight = (canvas.height * availableWidth) / canvas.width

        // 첫 페이지가 아니면 새 페이지 추가
        if (i > 0) {
          pdf.addPage()
        }

        // 이미지를 PDF에 추가 (여백 포함, 비율 유지)
        if (imgHeight > availableHeight) {
          // 높이가 너무 크면 높이 기준으로 스케일 조정
          const scale = availableHeight / imgHeight
          const scaledWidth = availableWidth * scale
          const scaledHeight = availableHeight
          const xOffset = margin + (availableWidth - scaledWidth) / 2
          pdf.addImage(imgData, 'JPEG', xOffset, margin, scaledWidth, scaledHeight, undefined, 'FAST')
        } else {
          // 높이가 적당하면 상단 여백만 추가
          pdf.addImage(imgData, 'JPEG', margin, margin, availableWidth, imgHeight, undefined, 'FAST')
        }
      }

      // 파일명 생성
      const dateStr = new Date(selectedReport.report_date).toISOString().split('T')[0]
      const fileName = `${dateStr}_${selectedReport.business_name}_착공신고서.pdf`

      // PDF 다운로드
      pdf.save(fileName)
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('PDF 생성 중 오류가 발생했습니다.')
    }
  }

  const filteredBusinesses = businesses.filter(b =>
    !searchTerm || b.business_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const paginatedBusinesses = filteredBusinesses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(filteredBusinesses.length / itemsPerPage)

  return (
    <div className="space-y-4">
      {/* 검색 및 필터 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="사업장명으로 검색..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {selectedBusiness && (
          <button
            onClick={() => {
              setSelectedBusiness(null)
              setCurrentPage(1)
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <X className="w-4 h-4" />
            필터 해제
          </button>
        )}
      </div>

      {/* 생성된 착공신고서 목록 */}
      {reports.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            생성된 착공신고서 ({reports.length}개)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-all group relative"
              >
                <button
                  onClick={() => {
                    setSelectedReport(report)
                    setIsPreviewModalOpen(true)
                  }}
                  className="text-left w-full hover:bg-blue-50 rounded transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm text-gray-900 group-hover:text-blue-700 truncate">
                      {report.business_name}
                    </h4>
                    <Eye className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600 truncate">
                      신고번호: {report.report_number}
                    </p>
                    <p className="text-xs text-gray-500">
                      보조금: {report.subsidy_amount?.toLocaleString()}원
                    </p>
                    <p className="text-xs text-gray-500">
                      작성일: {new Date(report.report_date).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </button>

                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConstructionReport(report.id, report.business_name)
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1 text-sm">착공신고서 자동 생성</h4>
            <p className="text-xs text-blue-700 leading-relaxed">
              사업장을 선택하고 보조금 정보를 입력하면 착공신고서, 계약서(지자체 제출용/사업장 보관용), 개선계획서를 자동으로 생성합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 사업장 카드 그리드 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : paginatedBusinesses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">사업장이 없습니다</h3>
          <p className="text-base text-gray-500">사업장을 먼저 등록해주세요.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedBusinesses.map((business) => (
              <button
                key={business.id}
                onClick={() => openFormModal(business)}
                className="text-left bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:shadow-md hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-base text-gray-900 group-hover:text-blue-700 mb-1 truncate">
                    {business.business_name}
                  </h3>
                  <Plus className="w-5 h-5 text-blue-600 shrink-0" />
                </div>
                {business.address && (
                  <p className="text-xs text-gray-600 truncate">
                    📍 {business.address}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* 착공신고서 작성 모달 - 2열 레이아웃 */}
      {isFormModalOpen && selectedBusiness && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-full sm:max-w-[98vw] md:max-w-[95vw] lg:max-w-[85vw] xl:max-w-[80vw] h-[98vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                착공신고서 작성 - {selectedBusiness.business_name}
              </h2>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2열 컨텐츠 영역 */}
            <div className="flex-1 overflow-hidden min-h-0">
              <div className="flex flex-col md:flex-row h-full gap-3 sm:gap-4 p-3 sm:p-4">

                {/* 왼쪽: 입력 폼 */}
                <div className="w-full md:w-96 md:flex-shrink-0 overflow-y-auto space-y-4 sm:space-y-6">
                  {/* 보조금 정보 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">보조금 정보</h3>
                    <div className="space-y-3">
                      <DateInput
                        label="보조금 승인일"
                        value={formData.subsidy_approval_date || ''}
                        onChange={(value) => handleFormChange('subsidy_approval_date', value)}
                        required
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          환경부고시가 *
                        </label>
                        <input
                          type="text"
                          value={formatNumber(formData.government_notice_price)}
                          onChange={(e) => {
                            const value = parseFormattedNumber(e.target.value)
                            handleFormChange('government_notice_price', value)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          보조금 승인액 *
                        </label>
                        <input
                          type="text"
                          value={formatNumber(formData.subsidy_amount)}
                          onChange={(e) => {
                            const value = parseFormattedNumber(e.target.value)
                            handleFormChange('subsidy_amount', value)
                            // 직접 입력 시 비율 초기화
                            setSubsidyPercentage(0)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          보조금 비율 (%)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={subsidyPercentage || ''}
                            onChange={(e) => {
                              const percentage = parseFloat(e.target.value) || 0
                              handlePercentageChange(percentage)
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="예: 90, 60"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                          <button
                            type="button"
                            onClick={() => handlePercentageChange(90)}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            90%
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePercentageChange(60)}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            60%
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          비율 입력 시 환경부고시가 기준으로 자동 계산됩니다
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          자부담 (자동계산)
                        </label>
                        <input
                          type="text"
                          value={formatNumber(formData.self_payment)}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 추가 비용 (사업장 보관용 계약서) */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">추가 비용 (선택사항)</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          추가비용
                        </label>
                        <input
                          type="text"
                          value={formatNumber(formData.additional_cost)}
                          onChange={(e) => {
                            const value = parseFormattedNumber(e.target.value)
                            handleFormChange('additional_cost', value)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          네고금액
                        </label>
                        <input
                          type="text"
                          value={formatNumber(formData.negotiation_cost)}
                          onChange={(e) => {
                            const value = parseFormattedNumber(e.target.value)
                            handleFormChange('negotiation_cost', value)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 방지시설 정보 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">방지시설 정보</h3>
                    {preventionFacilities.length > 0 ? (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <ul className="text-sm text-gray-700 space-y-1">
                          {preventionFacilities.map((facility, idx) => (
                            <li key={facility.id}>
                              {idx + 1}. {facility.facility_name}
                              {facility.capacity && ` (${facility.capacity})`}
                              {facility.quantity > 1 && ` x${facility.quantity}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800">
                          ⚠️ 대기필증 관리에서 방지시설을 등록해주세요.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 지자체장 정보 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">지자체 정보</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          지자체장 *
                        </label>
                        <input
                          type="text"
                          value={formData.local_government_head || ''}
                          onChange={(e) => handleFormChange('local_government_head', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="예: 성동구청장"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          개선계획서에 사용됩니다 (예: 성동구청장, 강남구청장)
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          품질보증 비율 *
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleFormChange('contract_bond_rate', '5')}
                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              formData.contract_bond_rate === '5'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            5%
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFormChange('contract_bond_rate', '10')}
                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              formData.contract_bond_rate === '10'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            10%
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          지자체에 따라 5% 또는 10%를 선택하세요
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 작성일 */}
                  <DateInput
                    label="신고서 작성일"
                    value={formData.report_date || ''}
                    onChange={(value) => handleFormChange('report_date', value)}
                  />

                  {/* 버튼 - 모바일에서는 왼쪽 하단 */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t md:border-0">
                    <button
                      onClick={() => setIsFormModalOpen(false)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={generateConstructionReport}
                      disabled={generatingReport || !formData.subsidy_approval_date || !formData.government_notice_price}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {generatingReport ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        <>저장</>
                      )}
                    </button>
                  </div>
                </div>

                {/* 오른쪽: 미리보기 */}
                <div className="flex-1 overflow-y-auto bg-gray-100 rounded-lg p-4">
                  {selectedBusiness && formData.subsidy_approval_date && formData.government_notice_price ? (
                    <div className="space-y-6">
                      {/* Page 1: 착공신고서 */}
                      <div className="bg-white rounded-lg shadow-sm">
                        <div className="sticky top-0 bg-blue-600 text-white px-4 py-2 rounded-t-lg flex items-center justify-between z-10">
                          <h3 className="text-sm font-semibold">Page 1: 착공신고서</h3>
                          <span className="text-xs opacity-90">1 / 4</span>
                        </div>
                        <div className="p-4" style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                          <ConstructionReportTemplate
                            data={{
                              business_name: selectedBusiness.business_name,
                              representative_name: selectedBusiness.representative_name || '',
                              address: selectedBusiness.address || '',
                              business_contact: selectedBusiness.business_contact || '',
                              fax_number: selectedBusiness.fax_number || '',
                              local_government_head: formData.local_government_head || '',
                              subsidy_approval_date: formData.subsidy_approval_date || '',
                              government_notice_price: formData.government_notice_price || 0,
                              subsidy_amount: formData.subsidy_amount || 0,
                              self_payment: formData.self_payment || 0,
                              report_date: formData.report_date || new Date().toISOString().split('T')[0],
                              contract_bond_rate: formData.contract_bond_rate || '10'
                            }}
                          />
                        </div>
                      </div>

                      {/* Page 2: 계약서 (지자체 제출용) */}
                      <div className="bg-white rounded-lg shadow-sm">
                        <div className="sticky top-0 bg-green-600 text-white px-4 py-2 rounded-t-lg flex items-center justify-between z-10">
                          <h3 className="text-sm font-semibold">Page 2: 계약서 (지자체 제출용)</h3>
                          <span className="text-xs opacity-90">2 / 4</span>
                        </div>
                        <div className="p-4" style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                          <ContractGovernmentTemplate
                            data={{
                              business_name: selectedBusiness.business_name,
                              representative_name: selectedBusiness.representative_name || '',
                              address: selectedBusiness.address || '',
                              business_registration_number: selectedBusiness.business_registration_number || '',
                              subsidy_approval_date: formData.subsidy_approval_date || '',
                              government_notice_price: formData.government_notice_price || 0,
                              subsidy_amount: formData.subsidy_amount || 0,
                              self_payment: formData.self_payment || 0,
                              deposit_amount: formData.deposit_amount || 0,
                              prevention_facilities: preventionFacilities,
                              gateway: selectedBusiness.gateway,
                              vpn_type: selectedBusiness.vpn === 'wired' ? '유선' : '무선',
                              discharge_current_meter: selectedBusiness.discharge_current_meter,
                              prevention_current_meter: selectedBusiness.fan_current_meter,
                              differential_pressure_meter: selectedBusiness.differential_pressure_meter,
                              temperature_meter: selectedBusiness.temperature_meter,
                              ph_meter: selectedBusiness.ph_meter,
                              report_date: formData.report_date || new Date().toISOString().split('T')[0],
                              contract_bond_rate: formData.contract_bond_rate || '10'
                            }}
                          />
                        </div>
                      </div>

                      {/* Page 3: 계약서 (사업장 보관용) */}
                      <div className="bg-white rounded-lg shadow-sm">
                        <div className="sticky top-0 bg-purple-600 text-white px-4 py-2 rounded-t-lg flex items-center justify-between z-10">
                          <h3 className="text-sm font-semibold">Page 3: 계약서 (사업장 보관용)</h3>
                          <span className="text-xs opacity-90">3 / 4</span>
                        </div>
                        <div className="p-4" style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                          <ContractBusinessTemplate
                            data={{
                              business_name: selectedBusiness.business_name,
                              representative_name: selectedBusiness.representative_name || '',
                              address: selectedBusiness.address || '',
                              business_registration_number: selectedBusiness.business_registration_number || '',
                              subsidy_approval_date: formData.subsidy_approval_date || '',
                              government_notice_price: formData.government_notice_price || 0,
                              subsidy_amount: formData.subsidy_amount || 0,
                              self_payment: formData.self_payment || 0,
                              deposit_amount: formData.deposit_amount || 0,
                              additional_cost: formData.additional_cost || 0,
                              negotiation_cost: formData.negotiation_cost || 0,
                              prevention_facilities: preventionFacilities,
                              gateway: selectedBusiness.gateway,
                              vpn_type: selectedBusiness.vpn === 'wired' ? '유선' : '무선',
                              discharge_current_meter: selectedBusiness.discharge_current_meter,
                              prevention_current_meter: selectedBusiness.fan_current_meter,
                              differential_pressure_meter: selectedBusiness.differential_pressure_meter,
                              temperature_meter: selectedBusiness.temperature_meter,
                              ph_meter: selectedBusiness.ph_meter,
                              report_date: formData.report_date || new Date().toISOString().split('T')[0],
                              contract_bond_rate: formData.contract_bond_rate || '10'
                            }}
                          />
                        </div>
                      </div>

                      {/* Page 4: 개선계획서 */}
                      <div className="bg-white rounded-lg shadow-sm">
                        <div className="sticky top-0 bg-orange-600 text-white px-4 py-2 rounded-t-lg flex items-center justify-between z-10">
                          <h3 className="text-sm font-semibold">Page 4: 개선계획서</h3>
                          <span className="text-xs opacity-90">4 / 4</span>
                        </div>
                        <div className="p-4" style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                          <ImprovementPlanTemplate
                            data={{
                              business_name: selectedBusiness.business_name,
                              representative_name: selectedBusiness.representative_name || '',
                              local_government_head: formData.local_government_head || '',
                              government_notice_price: formData.government_notice_price || 0,
                              subsidy_amount: formData.subsidy_amount || 0,
                              report_date: formData.report_date || new Date().toISOString().split('T')[0]
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg shadow-sm">
                      <div className="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200 rounded-t-lg">
                        <h3 className="text-sm font-semibold text-gray-700">착공신고서 미리보기</h3>
                      </div>
                      <div className="p-4" style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}>
                        <div className="text-center py-12 text-gray-400">
                          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">필수 정보를 입력하면<br />미리보기가 표시됩니다</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {isPreviewModalOpen && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  착공신고서 미리보기
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  {selectedReport.business_name} - {selectedReport.report_number}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsPreviewModalOpen(false)
                  setSelectedReport(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 미리보기 컨텐츠 */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {selectedReport.report_data ? (
                <div className="preview-container space-y-6">
                  {/* Page 1: 착공신고서 */}
                  <div className="bg-white rounded-lg shadow-sm">
                    <div className="sticky top-0 bg-blue-600 text-white px-4 py-2 rounded-t-lg flex items-center justify-between z-10">
                      <h3 className="text-sm font-semibold">Page 1: 착공신고서</h3>
                      <span className="text-xs opacity-90">1 / 4</span>
                    </div>
                    <div className="p-4" style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                      <ConstructionReportTemplate data={selectedReport.report_data} />
                    </div>
                  </div>

                  {/* Page 2: 계약서 (지자체 제출용) */}
                  <div className="bg-white rounded-lg shadow-sm">
                    <div className="sticky top-0 bg-green-600 text-white px-4 py-2 rounded-t-lg flex items-center justify-between z-10">
                      <h3 className="text-sm font-semibold">Page 2: 계약서 (지자체 제출용)</h3>
                      <span className="text-xs opacity-90">2 / 4</span>
                    </div>
                    <div className="p-4" style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                      <ContractGovernmentTemplate data={selectedReport.report_data} />
                    </div>
                  </div>

                  {/* Page 3: 계약서 (사업장 보관용) */}
                  <div className="bg-white rounded-lg shadow-sm">
                    <div className="sticky top-0 bg-purple-600 text-white px-4 py-2 rounded-t-lg flex items-center justify-between z-10">
                      <h3 className="text-sm font-semibold">Page 3: 계약서 (사업장 보관용)</h3>
                      <span className="text-xs opacity-90">3 / 4</span>
                    </div>
                    <div className="p-4" style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                      <ContractBusinessTemplate data={selectedReport.report_data} />
                    </div>
                  </div>

                  {/* Page 4: 개선계획서 */}
                  <div className="bg-white rounded-lg shadow-sm">
                    <div className="sticky top-0 bg-orange-600 text-white px-4 py-2 rounded-t-lg flex items-center justify-between z-10">
                      <h3 className="text-sm font-semibold">Page 4: 개선계획서</h3>
                      <span className="text-xs opacity-90">4 / 4</span>
                    </div>
                    <div className="p-4" style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                      <ImprovementPlanTemplate data={selectedReport.report_data} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">미리보기 데이터 없음</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    이 신고서는 미리보기 데이터가 없습니다.<br />
                    PDF 파일을 다운로드하여 확인하세요.
                  </p>
                  {selectedReport.pdf_file_url && (
                    <a
                      href={selectedReport.pdf_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      PDF 다운로드
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* 푸터 버튼 */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setIsPreviewModalOpen(false)
                  setSelectedReport(null)
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                닫기
              </button>
              <button
                onClick={downloadPDF}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                PDF 다운로드
              </button>
              <button
                onClick={() => {
                  window.open(`/api/construction-reports/download?id=${selectedReport.id}`, '_blank')
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                DOCX 다운로드
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
