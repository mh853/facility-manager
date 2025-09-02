// app/admin/air-permit/page.tsx - 대기필증 관리 페이지
'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { BusinessInfo, AirPermitInfo, AirPermitWithOutlets } from '@/lib/database-service'
import AdminLayout from '@/components/ui/AdminLayout'
import StatsCard from '@/components/ui/StatsCard'
import DataTable, { commonActions } from '@/components/ui/DataTable'
import { ConfirmModal } from '@/components/ui/Modal'
import GoogleSheetsImporter from '@/components/ui/GoogleSheetsImporter'
import { 
  Users, 
  FileText, 
  Database, 
  History, 
  RefreshCw, 
  Plus,
  Building2,
  ClipboardList,
  Calendar,
  Trash2,
  Edit,
  Eye,
  Factory,
  Search,
  X,
  Upload
} from 'lucide-react'

// 커스텀 날짜 입력 컴포넌트 (yyyy-mm-dd 형태, 백스페이스 네비게이션)
const DateInput = ({ value, onChange, placeholder = "YYYY-MM-DD" }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) => {
  const yearRef = useRef<HTMLInputElement>(null)
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)
  
  const parts = value ? value.split('-') : ['', '', '']
  const [year, month, day] = parts

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.length <= 4 && /^\d*$/.test(val)) {
      const newValue = `${val}-${month}-${day}`
      onChange(newValue)
      if (val.length === 4) {
        monthRef.current?.focus()
      }
    }
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.length <= 2 && /^\d*$/.test(val)) {
      let monthVal = val
      if (val !== '' && val !== '0') {
        const numVal = parseInt(val)
        if (numVal > 12) {
          monthVal = '12'
        } else if (val.length === 2) {
          monthVal = numVal.toString().padStart(2, '0')
        }
      }
      const newValue = `${year}-${monthVal}-${day}`
      onChange(newValue)
      if (monthVal.length === 2) {
        dayRef.current?.focus()
      }
    }
  }

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.length <= 2 && /^\d*$/.test(val)) {
      const dayVal = val === '' ? '' : Math.min(parseInt(val) || 1, 31).toString().padStart(val.length === 2 ? 2 : 1, '0')
      const newValue = `${year}-${month}-${dayVal}`
      onChange(newValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, type: 'year' | 'month' | 'day') => {
    if (e.key === 'Backspace') {
      const target = e.target as HTMLInputElement
      if (target.selectionStart === 0 && target.selectionEnd === 0) {
        e.preventDefault()
        if (type === 'month') {
          yearRef.current?.focus()
          yearRef.current?.setSelectionRange(yearRef.current.value.length, yearRef.current.value.length)
        } else if (type === 'day') {
          monthRef.current?.focus()
          monthRef.current?.setSelectionRange(monthRef.current.value.length, monthRef.current.value.length)
        }
      }
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={yearRef}
        type="text"
        value={year}
        onChange={handleYearChange}
        onKeyDown={(e) => handleKeyDown(e, 'year')}
        placeholder="YYYY"
        className="w-16 px-2 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-center"
      />
      <span>-</span>
      <input
        ref={monthRef}
        type="text"
        value={month}
        onChange={handleMonthChange}
        onKeyDown={(e) => handleKeyDown(e, 'month')}
        placeholder="MM"
        className="w-12 px-2 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-center"
      />
      <span>-</span>
      <input
        ref={dayRef}
        type="text"
        value={day}
        onChange={handleDayChange}
        onKeyDown={(e) => handleKeyDown(e, 'day')}
        placeholder="DD"
        className="w-12 px-2 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-center"
      />
    </div>
  )
}


export default function AirPermitManagementPage() {
  const [businessesWithPermits, setBusinessesWithPermits] = useState<BusinessInfo[]>([])
  const [allBusinesses, setAllBusinesses] = useState<BusinessInfo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [businessSearchTerm, setBusinessSearchTerm] = useState('')
  const [showBusinessSuggestions, setShowBusinessSuggestions] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessInfo | null>(null)
  const [airPermits, setAirPermits] = useState<AirPermitInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPermit, setEditingPermit] = useState<AirPermitInfo | null>(null)
  const [formData, setFormData] = useState<Partial<AirPermitInfo>>({})
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [permitToDelete, setPermitToDelete] = useState<AirPermitInfo | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSettings, setImportSettings] = useState({
    spreadsheetId: '1XXumtd7tl8w17FUgbJj5XzW1Mi04Rq4vlH9OYGNmM3U',
    sheetName: '대기필증 DB',
    startRow: 3
  })
  
  // Stats calculation for air permits
  const stats = useMemo(() => {
    const total = airPermits.length
    const withOutlets = airPermits.filter(p => p.additional_info?.outlets?.length > 0).length
    const withPollutants = airPermits.filter(p => p.additional_info?.pollutants?.length > 0).length
    const recentlyAdded = airPermits.filter(p => {
      const createdDate = new Date(p.created_at)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return createdDate >= thirtyDaysAgo
    }).length
    
    return {
      total,
      withOutlets,
      withPollutants,
      recentlyAdded
    }
  }, [airPermits])

  // 대기필증이 등록된 사업장만 필터링 (선택 리스트용)
  const filteredBusinessesWithPermits = useMemo(() => {
    if (!searchTerm.trim()) return businessesWithPermits
    const searchLower = searchTerm.toLowerCase()
    return businessesWithPermits.filter(business =>
      business.business_name.toLowerCase().includes(searchLower) ||
      business.local_government?.toLowerCase().includes(searchLower) ||
      business.manager_name?.toLowerCase().includes(searchLower) ||
      business.manager_contact?.toLowerCase().includes(searchLower) ||
      business.address?.toLowerCase().includes(searchLower)
    )
  }, [searchTerm, businessesWithPermits])
  
  // 전체 사업장 목록 검색 (새 대기필증 추가용)
  const filteredAllBusinesses = useMemo(() => {
    if (!businessSearchTerm.trim()) return []
    const searchLower = businessSearchTerm.toLowerCase()
    return allBusinesses.filter(business =>
      business.business_name.toLowerCase().includes(searchLower) ||
      business.local_government?.toLowerCase().includes(searchLower) ||
      business.manager_name?.toLowerCase().includes(searchLower)
    ).slice(0, 10) // 최대 10개만 표시
  }, [businessSearchTerm, allBusinesses])


  // 대기필증이 있는 사업장만 로드하는 최적화된 함수
  const loadBusinessesWithPermitsOptimized = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // 모든 활성 대기필증 조회
      const response = await fetch('/api/air-permit-management')
      const result = await response.json()
      
      if (response.ok && result.data) {
        // 대기필증에서 고유한 사업장 ID 추출
        const uniqueBusinessIds = [...new Set(result.data.map((permit: AirPermitInfo) => permit.business_id))]
        
        // 해당 사업장들의 정보 조회
        const businessResponse = await fetch('/api/business-management')
        const businessResult = await businessResponse.json()
        
        if (businessResponse.ok) {
          setAllBusinesses(businessResult.data)
          
          // 대기필증이 있는 사업장만 필터링
          const businessesWithPermits = businessResult.data.filter((business: BusinessInfo) =>
            uniqueBusinessIds.includes(business.id)
          )
          
          setBusinessesWithPermits(businessesWithPermits)
          console.log(`✅ 대기필증이 있는 사업장: ${businessesWithPermits.length}개`)
        }
      }
    } catch (error) {
      console.error('Error loading businesses with permits:', error)
      alert('사업장 목록을 불러오는데 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 선택된 사업장의 대기필증 목록 로드
  const loadAirPermits = async (businessId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/air-permit?businessId=${businessId}`)
      const result = await response.json()
      
      if (response.ok) {
        console.log('📋 로드된 대기필증 목록:', result.data)
        
        // 데이터 구조 정규화 - additional_info가 문자열인 경우 파싱
        const normalizedPermits = result.data.map((permit: any) => {
          let additionalInfo = permit.additional_info || {}
          
          // additional_info가 문자열인 경우 JSON 파싱
          if (typeof additionalInfo === 'string') {
            try {
              additionalInfo = JSON.parse(additionalInfo)
            } catch (e) {
              console.warn('additional_info 파싱 실패:', e)
              additionalInfo = {}
            }
          }
          
          return {
            ...permit,
            additional_info: additionalInfo
          }
        })
        
        setAirPermits(normalizedPermits)
      } else {
        alert('대기필증 목록을 불러오는데 실패했습니다: ' + result.error)
      }
    } catch (error) {
      console.error('Error loading air permits:', error)
      alert('대기필증 목록을 불러오는데 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  // 페이지 로드 시 대기필증이 있는 사업장 목록 로드 (최적화됨)
  useEffect(() => {
    loadBusinessesWithPermitsOptimized()
  }, [loadBusinessesWithPermitsOptimized])

  // 사업장 선택 시 대기필증 목록 로드
  const handleBusinessSelect = (business: BusinessInfo) => {
    setSelectedBusiness(business)
    loadAirPermits(business.id)
  }

  // 새 대기필증 추가 모달 열기
  const openAddModal = () => {
    setEditingPermit(null)
    setFormData({
      business_id: '',
      business_type: '',
      category: '',
      business_name: '',
      pollutants: [],
      first_report_date: '',
      operation_start_date: '',
      outlets: [],
      additional_info: {},
      is_active: true,
      is_deleted: false
    })
    setBusinessSearchTerm('')
    setShowBusinessSuggestions(false)
    setIsModalOpen(true)
  }

  // 대기필증 편집 모달 열기 (상세 정보 로드)
  const openEditModal = async (permit: AirPermitInfo) => {
    console.log('🔍 편집할 대기필증 데이터:', permit)
    
    setEditingPermit(permit)
    
    try {
      // 상세 정보 로드 (배출구 및 시설 정보 포함)
      const detailResponse = await fetch(`/api/air-permit?id=${permit.id}&details=true`)
      const detailResult = await detailResponse.json()
      
      let permitWithDetails = permit
      if (detailResponse.ok && detailResult.data) {
        permitWithDetails = detailResult.data
        console.log('📋 상세 정보 로드 성공:', permitWithDetails)
      } else {
        console.warn('⚠️ 상세 정보 로드 실패, 기본 정보만 사용')
      }
      
      // additional_info에서 모든 데이터 추출 (안전한 방식으로)
      const additionalInfo = permitWithDetails.additional_info || {}
      
      const formDataToSet = {
        ...permitWithDetails,
        // 실제 필드 우선, 없으면 additional_info에서 추출
        business_type: additionalInfo.business_type || permitWithDetails.business_type || '',
        category: additionalInfo.category || permitWithDetails.category || '',
        business_name: additionalInfo.business_name || permitWithDetails.business_name || '',
        first_report_date: permitWithDetails.first_report_date || additionalInfo.first_report_date || '',
        operation_start_date: permitWithDetails.operation_start_date || additionalInfo.operation_start_date || '',
        pollutants: additionalInfo.pollutants || [],
        outlets: permitWithDetails.outlets || additionalInfo.outlets || []
      }
      
      // 기본 outlet이 없으면 빈 배출구를 하나 추가
      if (formDataToSet.outlets.length === 0) {
        formDataToSet.outlets = [{
          outlet_number: 1,
          outlet_name: '',
          discharge_facilities: additionalInfo.discharge_facilities || [],
          prevention_facilities: additionalInfo.prevention_facilities || []
        }]
      }
      
      // 시설 데이터 필드명 정규화 (facility_name -> name, capacity, quantity 유지)
      formDataToSet.outlets = formDataToSet.outlets.map((outlet: any) => ({
        ...outlet,
        discharge_facilities: (outlet.discharge_facilities || []).map((facility: any) => ({
          name: facility.name || facility.facility_name || '',
          capacity: facility.capacity || '',
          quantity: facility.quantity || 1
        })),
        prevention_facilities: (outlet.prevention_facilities || []).map((facility: any) => ({
          name: facility.name || facility.facility_name || '',
          capacity: facility.capacity || '',
          quantity: facility.quantity || 1
        }))
      }))
      
      console.log('🔍 편집 폼에 설정할 데이터:', formDataToSet)
      
      setFormData(formDataToSet)
      setIsModalOpen(true)
      
    } catch (error) {
      console.error('❌ 상세 정보 로드 오류:', error)
      // 오류 발생 시 기본 정보로 폴백
      const additionalInfo = permit.additional_info || {}
      const formDataToSet = {
        ...permit,
        business_type: additionalInfo.business_type || permit.business_type || '',
        category: additionalInfo.category || permit.category || '',
        business_name: additionalInfo.business_name || permit.business_name || '',
        first_report_date: permit.first_report_date || additionalInfo.first_report_date || '',
        operation_start_date: permit.operation_start_date || additionalInfo.operation_start_date || '',
        pollutants: additionalInfo.pollutants || [],
        outlets: additionalInfo.outlets || [{
          outlet_number: 1,
          outlet_name: '',
          discharge_facilities: additionalInfo.discharge_facilities || [],
          prevention_facilities: additionalInfo.prevention_facilities || []
        }]
      }
      setFormData(formDataToSet)
      setIsModalOpen(true)
    }
  }

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const method = editingPermit ? 'PUT' : 'POST'
      const url = '/api/air-permit'
      const body = editingPermit 
        ? { id: editingPermit.id, ...formData }
        : formData

      console.log('🚀 프론트엔드에서 전송하는 데이터:', {
        method,
        url,
        body
      })

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      console.log('📥 서버 응답 상태:', response.status, response.statusText)
      
      let result
      const responseText = await response.text()
      console.log('📥 원시 응답:', responseText)
      
      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch (parseError) {
        console.error('❌ JSON 파싱 오류:', parseError)
        console.error('❌ 원시 응답 텍스트:', responseText)
        throw new Error(`서버 응답을 파싱할 수 없습니다: ${responseText}`)
      }
      
      console.log('📥 파싱된 응답:', result)

      if (response.ok) {
        alert(result.message || '저장이 완료되었습니다')
        setIsModalOpen(false)
        if (selectedBusiness) {
          loadAirPermits(selectedBusiness.id)
        }
      } else {
        console.error('❌ 저장 실패:', result)
        alert(result.error || `서버 오류: ${response.status}`)
      }
    } catch (error) {
      console.error('❌ 네트워크 오류:', error)
      alert('대기필증 저장에 실패했습니다')
    }
  }

  // 대기필증 삭제 확인
  const confirmDelete = (permit: AirPermitInfo) => {
    setPermitToDelete(permit)
    setDeleteConfirmOpen(true)
  }

  // 대기필증 삭제
  const handleDelete = async () => {
    if (!permitToDelete) return

    try {
      const response = await fetch(`/api/air-permit?id=${permitToDelete.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        setDeleteConfirmOpen(false)
        setPermitToDelete(null)
        if (selectedBusiness) {
          loadAirPermits(selectedBusiness.id)
        }
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error deleting air permit:', error)
      alert('대기필증 삭제에 실패했습니다')
    }
  }

  // 구글시트 가져오기 처리
  const handleImportFromSheet = async () => {
    if (!importSettings.spreadsheetId.trim()) {
      alert('스프레드시트 ID를 입력해주세요.')
      return
    }

    try {
      setIsImporting(true)
      
      const response = await fetch('/api/air-permit-management', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: importSettings.spreadsheetId,
          sheetName: importSettings.sheetName,
          startRow: importSettings.startRow
        })
      })

      const result = await response.json()

      if (response.ok) {
        const summary = result.summary || {}
        alert(`구글시트에서 ${summary.successCount || 0}개의 대기필증 데이터를 가져왔습니다. (중복 스킵: ${summary.skipCount || 0}개, 오류: ${summary.errorCount || 0}개)`)
        setIsImportModalOpen(false)
        // 현재 선택된 사업장의 데이터 새로고침
        if (selectedBusiness) {
          await loadAirPermits(selectedBusiness.id)
        }
        // 대기필증이 있는 사업장 목록도 새로고침
        await loadBusinessesWithPermitsOptimized()
      } else {
        alert(result.error || '구글시트 가져오기에 실패했습니다.')
      }
    } catch (error) {
      console.error('구글시트 가져오기 오류:', error)
      alert('구글시트 가져오기에 실패했습니다.')
    } finally {
      setIsImporting(false)
    }
  }

  // Air permits with ID for DataTable
  const airPermitsWithId = useMemo(() => 
    airPermits.map(permit => ({
      ...permit,
      id: permit.id || `permit-${permit.business_name}`
    }))
  , [airPermits])

  // Table columns for air permits
  const airPermitColumns = [
    {
      key: 'business_type',
      title: '업종',
      render: (item: AirPermitInfo) => (
        <span className="text-sm">{item.business_type || '-'}</span>
      )
    },
    {
      key: 'category',
      title: '종별',
      render: (item: AirPermitInfo) => (
        <span className="text-sm">{item.category || item.additional_info?.category || '-'}</span>
      )
    },
    {
      key: 'pollutants',
      title: '오염물질',
      render: (item: AirPermitInfo) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {item.additional_info?.pollutants?.length > 0 
              ? `${item.additional_info.pollutants.length}개`
              : '0개'
            }
          </span>
          {item.additional_info?.pollutants?.length > 0 && (
            <span className="text-xs text-gray-500">
              {item.additional_info.pollutants.slice(0, 2).map((p: any) => p.type).join(', ')}
              {item.additional_info.pollutants.length > 2 && '...'}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'first_report_date',
      title: '최초신고일',
      render: (item: AirPermitInfo) => {
        const date = item.first_report_date || item.additional_info?.first_report_date
        return (
          <span className="text-sm">
            {date ? new Date(date).toLocaleDateString('ko-KR') : '-'}
          </span>
        )
      }
    },
    {
      key: 'operation_start_date',
      title: '가동개시일',
      render: (item: AirPermitInfo) => {
        const date = item.operation_start_date || item.additional_info?.operation_start_date
        return (
          <span className="text-sm">
            {date ? new Date(date).toLocaleDateString('ko-KR') : '-'}
          </span>
        )
      }
    }
  ]

  // Table actions for air permits
  const airPermitActions = [
    {
      label: '필증보기',
      icon: Eye,
      onClick: (item: AirPermitInfo) => {
        window.location.href = `/admin/air-permit-detail?permitId=${item.id}`
      },
      variant: 'secondary' as const,
      show: () => true
    },
    {
      ...commonActions.edit((item: AirPermitInfo) => openEditModal(item)),
      show: () => true
    },
    {
      label: '삭제',
      icon: Trash2,
      onClick: (item: AirPermitInfo) => confirmDelete(item),
      variant: 'danger' as const,
      show: () => true
    }
  ]

  return (
    <AdminLayout
      title="대기필증 관리"
      description="대기배출시설 허가증 관리 시스템"
      actions={(
        <div className="flex items-center gap-3">
          <GoogleSheetsImporter />
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            기존 가져오기
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 대기필증 추가
          </button>
        </div>
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Business Selection Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              사업장 선택
              <span className="ml-auto text-sm text-gray-500">
                {filteredBusinessesWithPermits.length}개 사업장
              </span>
            </h2>
            
            {/* 검색 입력 필드 */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                lang="ko"
                inputMode="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="사업장명, 지자체, 담당자 검색..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredBusinessesWithPermits.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <div className="text-sm">
                    {searchTerm ? `"${searchTerm}"에 대한 검색 결과가 없습니다.` : '대기필증이 등록된 사업장이 없습니다.'}
                  </div>
                </div>
              ) : (
                filteredBusinessesWithPermits.map((business) => (
                <button
                  key={business.id}
                  onClick={() => handleBusinessSelect(business)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                    selectedBusiness?.id === business.id
                      ? 'bg-blue-50 text-blue-800 border border-blue-200 shadow-sm'
                      : 'hover:bg-gray-50 border border-transparent hover:border-gray-200'
                  }`}
                >
                  <div className="font-medium">{business.business_name}</div>
                  <div className="text-sm text-gray-500">{business.local_government || '-'}</div>
                </button>
              )))}
            </div>
          </div>
        </div>

        {/* Air Permits Panel */}
        <div className="lg:col-span-2">
          {!selectedBusiness ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <div className="text-gray-500 mb-2 font-medium">사업장을 선택하세요</div>
              <div className="text-sm text-gray-400">
                왼쪽에서 사업장을 선택하면 해당 사업장의 대기필증 목록을 확인할 수 있습니다
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Cards for selected business */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  title="총 대기필증"
                  value={stats.total}
                  icon={ClipboardList}
                  color="blue"
                  description="등록된 대기필증 수"
                />
                
                <StatsCard
                  title="배출구 설정"
                  value={stats.withOutlets}
                  icon={Factory}
                  color="green"
                  trend={{
                    value: stats.total > 0 ? Math.round((stats.withOutlets / stats.total) * 100) : 0,
                    direction: 'up',
                    label: '설정 완료율'
                  }}
                />
                
                <StatsCard
                  title="오염물질 등록"
                  value={stats.withPollutants}
                  icon={FileText}
                  color="purple"
                  trend={{
                    value: stats.total > 0 ? Math.round((stats.withPollutants / stats.total) * 100) : 0,
                    direction: 'up',
                    label: '등록 완료율'
                  }}
                />
                
                <StatsCard
                  title="최근 추가"
                  value={stats.recentlyAdded}
                  icon={Calendar}
                  color="yellow"
                  description="30일 이내 추가된 대기필증"
                />
              </div>

              {/* Air Permits Data Table */}
              <DataTable
                data={airPermitsWithId}
                columns={airPermitColumns}
                actions={airPermitActions}
                loading={isLoading}
                emptyMessage="등록된 대기필증이 없습니다. 새 대기필증을 추가해보세요."
                pageSize={10}
              />
            </div>
          )}
        </div>
      </div>

      {/* 대기필증 추가/편집 모달 */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false)
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingPermit ? '대기필증 정보 편집' : '새 대기필증 추가'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6" onClick={() => setShowBusinessSuggestions(false)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    업종
                  </label>
                  <input
                    type="text"
                    lang="ko"
                    inputMode="text"
                    value={formData.business_type || ''}
                    onChange={(e) => setFormData({...formData, business_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    종별
                  </label>
                  <input
                    type="text"
                    lang="ko"
                    inputMode="text"
                    value={formData.category || ''}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사업장명 *
                  </label>
                  {editingPermit ? (
                    // 편집 모드: 사업장명은 읽기 전용으로 표시
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                      {formData.business_name || editingPermit?.additional_info?.business_name || '-'}
                    </div>
                  ) : (
                    // 새 추가 모드: 검색 입력 필드
                    <input
                      type="text"
                      lang="ko"
                      inputMode="text"
                      value={businessSearchTerm}
                      onChange={(e) => {
                        setBusinessSearchTerm(e.target.value)
                        setShowBusinessSuggestions(true)
                      }}
                      onFocus={() => setShowBusinessSuggestions(true)}
                      placeholder="사업장명을 검색하세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  )}
                  
                  {/* 사업장 검색 결과 */}
                  {showBusinessSuggestions && filteredAllBusinesses.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredAllBusinesses.map((business) => (
                        <button
                          key={business.id}
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              business_id: business.id,
                              business_name: business.business_name
                            })
                            setBusinessSearchTerm(business.business_name)
                            setShowBusinessSuggestions(false)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                        >
                          <div className="font-medium">{business.business_name}</div>
                          <div className="text-sm text-gray-500">{business.local_government}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* 검색 결과가 없을 때 */}
                  {showBusinessSuggestions && businessSearchTerm && filteredAllBusinesses.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 text-sm text-gray-500">
                      검색 결과가 없습니다.
                    </div>
                  )}
                </div>

                {/* 오염물질 종류와 발생량 */}
                <div className="md:col-span-2">
                  <h4 className="text-lg font-medium text-gray-800 mb-4">오염물질 정보</h4>
                  <div className="space-y-4">
                    {(formData.pollutants || []).map((pollutant: any, index: number) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              오염물질종류
                            </label>
                            <input
                              type="text"
                              lang="ko"
                              inputMode="text"
                              value={pollutant.type || ''}
                              onChange={(e) => {
                                const newPollutants = [...(formData.pollutants || [])]
                                newPollutants[index] = { ...pollutant, type: e.target.value }
                                setFormData({...formData, pollutants: newPollutants})
                              }}
                              placeholder="예: 먼지, 황산화물, 질소산화물"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              오염물질발생량 (톤/년)
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={pollutant.amount !== null && pollutant.amount !== undefined ? pollutant.amount : ''}
                              onChange={(e) => {
                                const newPollutants = [...(formData.pollutants || [])]
                                const value = e.target.value
                                newPollutants[index] = { 
                                  ...pollutant, 
                                  amount: value === '' ? null : parseFloat(value) 
                                }
                                setFormData({...formData, pollutants: newPollutants})
                              }}
                              placeholder="0.012"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => {
                                const newPollutants = (formData.pollutants || []).filter((_: any, i: number) => i !== index)
                                setFormData({...formData, pollutants: newPollutants})
                              }}
                              className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const newPollutants = [...(formData.pollutants || []), { type: '', amount: null }]
                        setFormData({...formData, pollutants: newPollutants})
                      }}
                      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800"
                    >
                      + 오염물질 추가
                    </button>
                  </div>
                </div>


                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    최초신고일
                  </label>
                  <DateInput
                    value={formData.first_report_date || ''}
                    onChange={(value) => setFormData({...formData, first_report_date: value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    가동개시일
                  </label>
                  <DateInput
                    value={formData.operation_start_date || ''}
                    onChange={(value) => setFormData({...formData, operation_start_date: value})}
                  />
                </div>
              </div>

              {/* 배출구별 시설 관리 */}
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-800 mb-4">배출구별 시설 관리</h3>
                <div className="space-y-6">
                  {(formData.outlets || []).map((outlet: any, outletIndex: number) => (
                    <div key={outletIndex} className="p-6 border-2 border-gray-200 rounded-lg bg-gray-50">
                      {/* 배출구 정보 */}
                      <div className="mb-6">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-md font-semibold text-gray-800">
                            배출구 #{outletIndex + 1}
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              const newOutlets = (formData.outlets || []).filter((_: any, i: number) => i !== outletIndex)
                              setFormData({...formData, outlets: newOutlets})
                            }}
                            className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                          >
                            배출구 삭제
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              배출구번호
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={outlet.outlet_number || outletIndex + 1}
                              onChange={(e) => {
                                const newOutlets = [...(formData.outlets || [])]
                                newOutlets[outletIndex] = { ...outlet, outlet_number: parseInt(e.target.value) || 1 }
                                setFormData({...formData, outlets: newOutlets})
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              배출구명
                            </label>
                            <input
                              type="text"
                              lang="ko"
                              inputMode="text"
                              value={outlet.outlet_name || ''}
                              onChange={(e) => {
                                const newOutlets = [...(formData.outlets || [])]
                                newOutlets[outletIndex] = { ...outlet, outlet_name: e.target.value }
                                setFormData({...formData, outlets: newOutlets})
                              }}
                              placeholder="예: 보일러 배출구"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 배출시설 */}
                      <div className="mb-6">
                        <h5 className="text-sm font-medium text-gray-800 mb-3">배출시설</h5>
                        <div className="space-y-3">
                          {(outlet.discharge_facilities || []).map((facility: any, facilityIndex: number) => (
                            <div key={facilityIndex} className="p-3 bg-white border border-gray-200 rounded-lg">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                  <input
                                    type="text"
                                    lang="ko"
                                    inputMode="text"
                                    value={facility.name || ''}
                                    onChange={(e) => {
                                      const newOutlets = [...(formData.outlets || [])]
                                      const newFacilities = [...(outlet.discharge_facilities || [])]
                                      newFacilities[facilityIndex] = { ...facility, name: e.target.value }
                                      newOutlets[outletIndex] = { ...outlet, discharge_facilities: newFacilities }
                                      setFormData({...formData, outlets: newOutlets})
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Tab' && !e.shiftKey) {
                                        e.preventDefault()
                                        const nextInput = e.currentTarget.parentElement?.nextElementSibling?.querySelector('input')
                                        nextInput?.focus()
                                      }
                                    }}
                                    placeholder="배출시설명"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    lang="ko"
                                    inputMode="text"
                                    value={facility.capacity || ''}
                                    onChange={(e) => {
                                      const newOutlets = [...(formData.outlets || [])]
                                      const newFacilities = [...(outlet.discharge_facilities || [])]
                                      newFacilities[facilityIndex] = { ...facility, capacity: e.target.value }
                                      newOutlets[outletIndex] = { ...outlet, discharge_facilities: newFacilities }
                                      setFormData({...formData, outlets: newOutlets})
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Tab' && !e.shiftKey) {
                                        e.preventDefault()
                                        const nextInput = e.currentTarget.parentElement?.nextElementSibling?.querySelector('input')
                                        nextInput?.focus()
                                      }
                                    }}
                                    placeholder="용량"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <input
                                    type="number"
                                    min="1"
                                    value={facility.quantity || 1}
                                    onChange={(e) => {
                                      const newOutlets = [...(formData.outlets || [])]
                                      const newFacilities = [...(outlet.discharge_facilities || [])]
                                      newFacilities[facilityIndex] = { ...facility, quantity: parseInt(e.target.value) || 1 }
                                      newOutlets[outletIndex] = { ...outlet, discharge_facilities: newFacilities }
                                      setFormData({...formData, outlets: newOutlets})
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Tab' && !e.shiftKey) {
                                        e.preventDefault()
                                        const copyButton = e.currentTarget.parentElement?.nextElementSibling?.querySelector('button')
                                        copyButton?.focus()
                                      }
                                    }}
                                    placeholder="수량"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newOutlets = [...(formData.outlets || [])]
                                      const newFacilities = [...(outlet.discharge_facilities || [])]
                                      // 현재 시설을 복사하여 추가
                                      const facilityToCopy = { ...facility }
                                      newFacilities.splice(facilityIndex + 1, 0, facilityToCopy)
                                      newOutlets[outletIndex] = { ...outlet, discharge_facilities: newFacilities }
                                      setFormData({...formData, outlets: newOutlets})
                                    }}
                                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                    title="복제"
                                  >
                                    복제
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newOutlets = [...(formData.outlets || [])]
                                      const newFacilities = (outlet.discharge_facilities || []).filter((_: any, i: number) => i !== facilityIndex)
                                      newOutlets[outletIndex] = { ...outlet, discharge_facilities: newFacilities }
                                      setFormData({...formData, outlets: newOutlets})
                                    }}
                                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                    title="삭제"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newOutlets = [...(formData.outlets || [])]
                              const newFacilities = [...(outlet.discharge_facilities || []), { name: '', capacity: '', quantity: 1 }]
                              newOutlets[outletIndex] = { ...outlet, discharge_facilities: newFacilities }
                              setFormData({...formData, outlets: newOutlets})
                            }}
                            className="w-full px-3 py-2 border border-dashed border-gray-300 rounded text-gray-600 hover:border-gray-400 text-sm"
                          >
                            + 배출시설 추가
                          </button>
                        </div>
                      </div>

                      {/* 방지시설 */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-800 mb-3">방지시설</h5>
                        <div className="space-y-3">
                          {(outlet.prevention_facilities || []).map((facility: any, facilityIndex: number) => (
                            <div key={facilityIndex} className="p-3 bg-white border border-gray-200 rounded-lg">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                  <input
                                    type="text"
                                    lang="ko"
                                    inputMode="text"
                                    value={facility.name || ''}
                                    onChange={(e) => {
                                      const newOutlets = [...(formData.outlets || [])]
                                      const newFacilities = [...(outlet.prevention_facilities || [])]
                                      newFacilities[facilityIndex] = { ...facility, name: e.target.value }
                                      newOutlets[outletIndex] = { ...outlet, prevention_facilities: newFacilities }
                                      setFormData({...formData, outlets: newOutlets})
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Tab' && !e.shiftKey) {
                                        e.preventDefault()
                                        const nextInput = e.currentTarget.parentElement?.nextElementSibling?.querySelector('input')
                                        nextInput?.focus()
                                      }
                                    }}
                                    placeholder="방지시설명"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    lang="ko"
                                    inputMode="text"
                                    value={facility.capacity || ''}
                                    onChange={(e) => {
                                      const newOutlets = [...(formData.outlets || [])]
                                      const newFacilities = [...(outlet.prevention_facilities || [])]
                                      newFacilities[facilityIndex] = { ...facility, capacity: e.target.value }
                                      newOutlets[outletIndex] = { ...outlet, prevention_facilities: newFacilities }
                                      setFormData({...formData, outlets: newOutlets})
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Tab' && !e.shiftKey) {
                                        e.preventDefault()
                                        const nextInput = e.currentTarget.parentElement?.nextElementSibling?.querySelector('input')
                                        nextInput?.focus()
                                      }
                                    }}
                                    placeholder="용량"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <input
                                    type="number"
                                    min="1"
                                    value={facility.quantity || 1}
                                    onChange={(e) => {
                                      const newOutlets = [...(formData.outlets || [])]
                                      const newFacilities = [...(outlet.prevention_facilities || [])]
                                      newFacilities[facilityIndex] = { ...facility, quantity: parseInt(e.target.value) || 1 }
                                      newOutlets[outletIndex] = { ...outlet, prevention_facilities: newFacilities }
                                      setFormData({...formData, outlets: newOutlets})
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Tab' && !e.shiftKey) {
                                        e.preventDefault()
                                        const copyButton = e.currentTarget.parentElement?.nextElementSibling?.querySelector('button')
                                        copyButton?.focus()
                                      }
                                    }}
                                    placeholder="수량"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newOutlets = [...(formData.outlets || [])]
                                      const newFacilities = [...(outlet.prevention_facilities || [])]
                                      // 현재 시설을 복사하여 추가
                                      const facilityToCopy = { ...facility }
                                      newFacilities.splice(facilityIndex + 1, 0, facilityToCopy)
                                      newOutlets[outletIndex] = { ...outlet, prevention_facilities: newFacilities }
                                      setFormData({...formData, outlets: newOutlets})
                                    }}
                                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                    title="복제"
                                  >
                                    복제
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newOutlets = [...(formData.outlets || [])]
                                      const newFacilities = (outlet.prevention_facilities || []).filter((_: any, i: number) => i !== facilityIndex)
                                      newOutlets[outletIndex] = { ...outlet, prevention_facilities: newFacilities }
                                      setFormData({...formData, outlets: newOutlets})
                                    }}
                                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                    title="삭제"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newOutlets = [...(formData.outlets || [])]
                              const newFacilities = [...(outlet.prevention_facilities || []), { name: '', capacity: '', quantity: 1 }]
                              newOutlets[outletIndex] = { ...outlet, prevention_facilities: newFacilities }
                              setFormData({...formData, outlets: newOutlets})
                            }}
                            className="w-full px-3 py-2 border border-dashed border-gray-300 rounded text-gray-600 hover:border-gray-400 text-sm"
                          >
                            + 방지시설 추가
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const newOutlets = [...(formData.outlets || []), { 
                        outlet_number: (formData.outlets || []).length + 1,
                        outlet_name: '',
                        discharge_facilities: [],
                        prevention_facilities: []
                      }]
                      setFormData({...formData, outlets: newOutlets})
                    }}
                    className="w-full px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:border-blue-400 hover:text-blue-800 bg-blue-50 hover:bg-blue-100"
                  >
                    + 새 배출구 추가
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingPermit ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Sheets Import Modal */}
      {isImportModalOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsImportModalOpen(false)
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                구글시트에서 대기필증 가져오기
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                대기필증 DB 시트에서 사업장별 배출구 및 시설 데이터를 일괄 가져옵니다.
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  스프레드시트 ID
                </label>
                <input
                  type="text"
                  value={importSettings.spreadsheetId}
                  onChange={(e) => setImportSettings({...importSettings, spreadsheetId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="1ABC123...xyz"
                  disabled={isImporting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  구글시트 URL에서 /d/ 뒤의 ID 부분만 입력하세요
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시트명
                  </label>
                  <input
                    type="text"
                    lang="ko"
                    inputMode="text"
                    value={importSettings.sheetName}
                    onChange={(e) => setImportSettings({...importSettings, sheetName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    disabled={isImporting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시작 행
                  </label>
                  <input
                    type="number"
                    value={importSettings.startRow}
                    onChange={(e) => setImportSettings({...importSettings, startRow: parseInt(e.target.value) || 2})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    min="1"
                    disabled={isImporting}
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">시트 구조 안내</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• A열: 연번, B열: 사업장명, C열: 배출구</li>
                  <li>• D~DD열: 배출시설 35개 (시설명/용량/수량 3열씩)</li>
                  <li>• DE~HE열: 방지시설 35개 (시설명/용량/수량 3열씩)</li>
                  <li>• 동일 사업장의 여러 배출구는 C열에 1,2,3... 형태로 구분</li>
                </ul>
              </div>
            </div>
            
            <div className="flex justify-end gap-4 px-6 py-4 bg-gray-50 rounded-b-lg">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isImporting}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleImportFromSheet}
                disabled={isImporting || !importSettings.spreadsheetId.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    가져오는 중...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    가져오기 시작
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false)
          setPermitToDelete(null)
        }}
        onConfirm={handleDelete}
        title="대기필증 삭제 확인"
        message={`대기필증을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
        variant="danger"
      />
    </AdminLayout>
  )
}