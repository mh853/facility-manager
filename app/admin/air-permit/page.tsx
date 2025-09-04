// app/admin/air-permit/page.tsx - 대기필증 관리 페이지
'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { BusinessInfo, AirPermitInfo, AirPermitWithOutlets } from '@/lib/database-service'
import AdminLayout from '@/components/ui/AdminLayout'
import { ConfirmModal } from '@/components/ui/Modal'
import { 
  FileText, 
  Plus,
  Building2,
  Trash2,
  Edit,
  Eye,
  Factory,
  Search,
  X
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
  const [selectedPermit, setSelectedPermit] = useState<AirPermitInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPermit, setEditingPermit] = useState<AirPermitInfo | null>(null)
  const [formData, setFormData] = useState<Partial<AirPermitInfo>>({})
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [permitToDelete, setPermitToDelete] = useState<AirPermitInfo | null>(null)
  
  // 대기필증 검색 상태
  const [filteredAirPermits, setFilteredAirPermits] = useState<AirPermitInfo[]>([])
  const [permitSearchQuery, setPermitSearchQuery] = useState('')

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

  // 대기필증 필터링 함수
  const filterAirPermits = useCallback((query: string) => {
    if (!query.trim()) {
      setFilteredAirPermits(airPermits)
      return
    }
    
    const searchLower = query.toLowerCase()
    const filtered = airPermits.filter(permit => {
      return (
        permit.id?.toLowerCase().includes(searchLower) ||
        permit.business_type?.toLowerCase().includes(searchLower) ||
        permit.business_name?.toLowerCase().includes(searchLower)
      )
    })
    
    setFilteredAirPermits(filtered)
  }, [airPermits])

  // 대기필증 검색어 하이라이팅 함수
  const highlightPermitSearchTerm = useCallback((text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return (
      <>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark key={index} className="bg-yellow-200 px-1 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    )
  }, [])

  // 사업장 검색어 하이라이팅 함수
  const highlightBusinessSearchTerm = useCallback((text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return (
      <>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark key={index} className="bg-yellow-200 px-1 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    )
  }, [])


  // 대기필증이 등록된 사업장만 로드하는 함수 (필터링 적용)
  const loadBusinessesWithPermits = useCallback(async () => {
    let timeoutId: NodeJS.Timeout | undefined
    const abortController = new AbortController()
    
    try {
      setIsLoading(true)
      console.log('🔄 대기필증 보유 사업장 로드 시작')
      
      // 10초 타임아웃 설정
      timeoutId = setTimeout(() => {
        console.error('⏰ 대기필증 로드 타임아웃 (10초)')
        abortController.abort()
        setIsLoading(false)
      }, 10000)
      
      // 1. 모든 대기필증 조회 (사업장 정보 포함)
      const airPermitResponse = await fetch('/api/air-permit', {
        signal: abortController.signal
      })
      
      if (abortController.signal.aborted) {
        console.log('❌ 요청이 중단되었습니다.')
        return
      }
      
      const airPermitResult = await airPermitResponse.json()
      
      if (airPermitResponse.ok && airPermitResult.data) {
        const permits = airPermitResult.data
        console.log(`✅ 대기필증 ${permits.length}개 조회 완료`)
        
        if (permits.length === 0) {
          console.log('ℹ️ 등록된 대기필증이 없습니다.')
          setBusinessesWithPermits([])
          // 타임아웃 클리어
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          setIsLoading(false)
          return
        }
        
        // 2. 대기필증에서 유니크한 사업장 ID 추출 - FIX: 타입 명시
        const uniqueBusinessIds = [...new Set(permits.map((permit: any) => permit.business_id as string))].filter(Boolean) as string[]
        console.log(`✅ 대기필증 보유 사업장 ${uniqueBusinessIds.length}개 발견`)
        
        if (uniqueBusinessIds.length === 0) {
          console.warn('⚠️ 대기필증이 있지만 유효한 사업장 ID가 없습니다.')
          setBusinessesWithPermits([])
          // 타임아웃 클리어
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          setIsLoading(false)
          return
        }
        
        // 3. 사업장 ID별로 실제 사업장 정보 조회
        const businessesWithPermitsMap = new Map()
        
        // 대기필증 데이터에서 직접 사업장 정보 추출 (더 안정적)
        for (const businessId of uniqueBusinessIds) {
          if (abortController.signal.aborted) {
            console.log('❌ 사업장 정보 로드 중단됨')
            return
          }
          
          // 해당 사업장 ID의 첫 번째 대기필증에서 사업장 정보 가져오기
          const permitForBusiness = permits.find((p: any) => p.business_id === businessId)
          
          if (permitForBusiness && permitForBusiness.business) {
            // 대기필증에 연결된 사업장 정보 사용 (이미 join되어 있음)
            businessesWithPermitsMap.set(businessId, {
              id: businessId,
              business_name: permitForBusiness.business.business_name || '(사업장명 없음)',
              local_government: permitForBusiness.business.local_government || '',
              address: '',
              manager_name: '',
              manager_contact: '',
              is_active: true,
              created_at: new Date().toISOString()
            })
            console.log(`✅ 사업장 "${permitForBusiness.business.business_name}" 정보 로드 완료`)
          } else {
            // 사업장 정보가 없는 경우 대기필증 ID로 기본 정보 생성
            console.warn(`⚠️ 사업장 ID ${businessId}의 사업장 정보가 없습니다.`)
            businessesWithPermitsMap.set(businessId, {
              id: businessId,
              business_name: `사업장-${businessId.slice(0, 8)}`,
              local_government: '',
              address: '',
              manager_name: '',
              manager_contact: '',
              is_active: true,
              created_at: new Date().toISOString()
            })
          }
        }
        
        const businessesWithPermits = Array.from(businessesWithPermitsMap.values())
        setBusinessesWithPermits(businessesWithPermits)
        console.log(`✅ 대기필증 보유 사업장 ${businessesWithPermits.length}개 로드 완료`)
        
        if (businessesWithPermits.length === 0) {
          console.warn('⚠️ 대기필증은 있지만 사업장 정보를 찾을 수 없습니다. uniqueBusinessIds:', uniqueBusinessIds)
        }
      } else {
        console.error('❌ 대기필증 데이터 로드 실패:', airPermitResult.error)
        setBusinessesWithPermits([])
        // 타임아웃 클리어
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
      
      // 4. 전체 사업장 목록은 새 대기필증 추가용으로만 로드 (별도 요청)
      try {
        const businessResponse = await fetch('/api/business-list')
        const businessResult = await businessResponse.json()
        
        if (businessResponse.ok && businessResult.data?.businesses) {
          const allBusinesses = businessResult.data.businesses.map((name: string, index: number) => ({
            id: `business-${index}`,
            business_name: name,
            local_government: '',
            address: '',
            manager_name: '',
            manager_contact: '',
            is_active: true,
            created_at: new Date().toISOString()
          }))
          
          setAllBusinesses(allBusinesses)
          console.log(`✅ 전체 사업장 ${allBusinesses.length}개 로드 완료 (새 대기필증 추가용)`)
        }
      } catch (businessError) {
        console.error('⚠️ 전체 사업장 목록 로드 실패 (새 대기필증 추가에만 영향):', businessError)
        // 이 에러는 기존 대기필증 목록 표시에는 영향을 주지 않음
      }
    } catch (error) {
      console.error('Error loading businesses with permits:', error)
      alert('대기필증 사업장 목록을 불러오는데 실패했습니다')
    } finally {
      // 타임아웃 클리어
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      setIsLoading(false)
    }
  }, [])

  // 선택된 사업장의 대기필증 목록 로드
  const loadAirPermits = async (businessId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/air-permit?businessId=${businessId}&details=true`)
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
        
        // 🎯 첫 번째 대기필증 자동 선택하여 상세페이지 바로 표시
        if (normalizedPermits.length > 0) {
          console.log('✅ 첫 번째 대기필증 자동 선택:', normalizedPermits[0])
          console.log('🔍 첫 번째 대기필증의 outlets 정보:', normalizedPermits[0].outlets)
          setSelectedPermit(normalizedPermits[0])
        }
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

  // 대기필증 검색어 변경 시 필터링
  useEffect(() => {
    filterAirPermits(permitSearchQuery)
  }, [permitSearchQuery, filterAirPermits])

  // 대기필증 목록 변경 시 필터링 초기화
  useEffect(() => {
    setFilteredAirPermits(airPermits)
    if (permitSearchQuery) {
      filterAirPermits(permitSearchQuery)
    }
  }, [airPermits, filterAirPermits, permitSearchQuery])

  // 페이지 로드 시 대기필증이 등록된 사업장만 로드
  useEffect(() => {
    loadBusinessesWithPermits()
  }, [])

  // 사업장 선택 시 대기필증 목록 로드
  const handleBusinessSelect = (business: BusinessInfo) => {
    setSelectedBusiness(business)
    setSelectedPermit(null) // 사업장 변경시 선택된 필증 초기화
    loadAirPermits(business.id)
  }

  // 필증 선택 핸들러
  const handlePermitSelect = (permit: AirPermitInfo) => {
    setSelectedPermit(permit)
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

  return (
    <AdminLayout 
      title="대기필증 관리"
      description="대기배출시설 허가증 관리 시스템"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Business Selection Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                대기필증 보유 사업장
              </div>
              <span className="text-sm font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {searchTerm ? `${filteredBusinessesWithPermits.length}개 검색 결과 (전체 ${businessesWithPermits.length}개)` : `총 ${filteredBusinessesWithPermits.length}개`}
              </span>
            </h2>
            
            {/* 사업장 검색 입력 */}
            <div className="mb-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="사업장명, 지역, 담당자명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {filteredBusinessesWithPermits.map((business) => (
                <div 
                  key={business.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedBusiness?.id === business.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleBusinessSelect(business)}
                >
                  <h3 className="font-medium text-gray-900">
                    {searchTerm ? highlightBusinessSearchTerm(business.business_name, searchTerm) : business.business_name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {business.business_registration_number || '등록번호 미등록'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Air Permit Detail Panel */}
        <div className="lg:col-span-2">
          {!selectedBusiness ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
              <div className="text-center text-gray-500">
                <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">사업장을 선택해주세요</h3>
                <p>좌측에서 사업장을 선택하면 해당 대기필증 정보가 표시됩니다.</p>
              </div>
            </div>
          ) : !selectedPermit ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  {selectedBusiness.business_name} - 대기필증 목록
                </span>
                <span className="text-sm font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {permitSearchQuery ? `${filteredAirPermits.length}개 검색 결과 (전체 ${airPermits.length}개)` : `${airPermits.length}개 대기필증`}
                </span>
              </h2>
              
              {/* 대기필증 검색 입력 */}
              <div className="mb-4 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="대기필증 번호, 업종, 시설명, 설치장소, 오염물질로 검색..."
                  value={permitSearchQuery}
                  onChange={(e) => setPermitSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {permitSearchQuery && (
                  <button
                    onClick={() => setPermitSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                {filteredAirPermits.map((permit) => (
                  <div 
                    key={permit.id}
                    className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
                    onClick={() => setSelectedPermit(permit)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {permitSearchQuery ? (
                            <>
                              대기필증 #{highlightPermitSearchTerm(permit.id || '', permitSearchQuery)}
                            </>
                          ) : (
                            `대기필증 #${permit.id}`
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {permitSearchQuery ? 
                            highlightPermitSearchTerm(permit.business_type || '업종 미지정', permitSearchQuery) : 
                            (permit.business_type || '업종 미지정')
                          }
                        </p>
                      </div>
                      <Eye className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Permit Detail View */
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        대기필증 상세정보
                      </h2>
                      <p className="text-sm text-gray-600">
                        {selectedBusiness.business_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.open(`/admin/air-permit-detail?permitId=${selectedPermit.id}`, '_blank')}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      상세관리
                    </button>
                    <button
                      onClick={() => setSelectedPermit(null)}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Factory className="w-5 h-5 text-blue-600" />
                    기본 정보
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">업종</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedPermit.business_type || '미지정'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">최초신고일</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedPermit.first_report_date || '미지정'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">가동개시일</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedPermit.operation_start_date || '미지정'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Outlets and Facilities Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Factory className="w-5 h-5 text-green-600" />
                    배출구별 시설 현황
                  </h3>
                  
                  {(() => {
                    console.log('🔍 현재 selectedPermit:', selectedPermit)
                    console.log('🔍 selectedPermit.outlets:', selectedPermit.outlets)
                    return selectedPermit.outlets && selectedPermit.outlets.length > 0
                  })() ? (
                    <div className="space-y-4">
                      {selectedPermit.outlets?.map((outlet: any, index: number) => {
                        // 게이트웨이 색상 결정
                        const gateway = outlet.additional_info?.gateway || ''
                        const gatewayColors = {
                          'gateway1': 'bg-blue-100 border-blue-300 text-blue-800',
                          'gateway2': 'bg-green-100 border-green-300 text-green-800',
                          'gateway3': 'bg-yellow-100 border-yellow-300 text-yellow-800',
                          'gateway4': 'bg-red-100 border-red-300 text-red-800',
                          'gateway5': 'bg-purple-100 border-purple-300 text-purple-800',
                          'gateway6': 'bg-pink-100 border-pink-300 text-pink-800',
                          '': 'bg-gray-100 border-gray-300 text-gray-800'
                        }
                        const colorClass = gatewayColors[gateway as keyof typeof gatewayColors] || gatewayColors['']
                        
                        return (
                          <div key={index} className={`border-2 rounded-lg p-4 ${colorClass}`}>
                            {/* 배출구 헤더 */}
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex items-center gap-3">
                                <h4 className="text-lg font-semibold">
                                  배출구 #{outlet.outlet_number || index + 1}
                                </h4>
                                {outlet.outlet_name && (
                                  <span className="text-sm text-gray-600">({outlet.outlet_name})</span>
                                )}
                                {gateway && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-70">
                                    Gateway {gateway.replace('gateway', '')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 시설 정보 테이블 */}
                            <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-r">구분</th>
                                    <th className="px-3 py-2 text-left font-medium text-red-700 border-r">배출시설</th>
                                    <th className="px-3 py-2 text-center font-medium text-red-700 border-r">용량</th>
                                    <th className="px-3 py-2 text-center font-medium text-red-700 border-r">수량</th>
                                    <th className="px-3 py-2 text-left font-medium text-blue-700 border-r">방지시설</th>
                                    <th className="px-3 py-2 text-center font-medium text-blue-700 border-r">용량</th>
                                    <th className="px-3 py-2 text-center font-medium text-blue-700">수량</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const maxRows = Math.max(
                                      outlet.discharge_facilities?.length || 0,
                                      outlet.prevention_facilities?.length || 0,
                                      1
                                    )
                                    
                                    return Array.from({ length: maxRows }, (_, rowIndex) => {
                                      const dischargeFacility = outlet.discharge_facilities?.[rowIndex]
                                      const preventionFacility = outlet.prevention_facilities?.[rowIndex]
                                      
                                      return (
                                        <tr key={rowIndex} className="border-t hover:bg-gray-50">
                                          <td className="px-3 py-2 text-center text-gray-500 border-r font-medium">
                                            {rowIndex + 1}
                                          </td>
                                          
                                          {/* 배출시설 정보 */}
                                          <td className="px-3 py-2 border-r">
                                            <div className="font-medium text-gray-900">
                                              {dischargeFacility?.facility_name || '-'}
                                            </div>
                                            {dischargeFacility?.additional_info?.facility_number && (
                                              <div className="text-xs text-gray-500 mt-1">
                                                #{dischargeFacility.additional_info.facility_number}
                                              </div>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-center border-r text-gray-700">
                                            {dischargeFacility?.capacity || '-'}
                                          </td>
                                          <td className="px-3 py-2 text-center border-r font-medium">
                                            {dischargeFacility?.quantity || '-'}
                                          </td>
                                          
                                          {/* 방지시설 정보 */}
                                          <td className="px-3 py-2 border-r">
                                            <div className="font-medium text-gray-900">
                                              {preventionFacility?.facility_name || '-'}
                                            </div>
                                            {preventionFacility?.additional_info?.facility_number && (
                                              <div className="text-xs text-gray-500 mt-1">
                                                #{preventionFacility.additional_info.facility_number}
                                              </div>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-center border-r text-gray-700">
                                            {preventionFacility?.capacity || '-'}
                                          </td>
                                          <td className="px-3 py-2 text-center font-medium">
                                            {preventionFacility?.quantity || '-'}
                                          </td>
                                        </tr>
                                      )
                                    })
                                  })()}
                                </tbody>
                              </table>
                            </div>
                            
                            {/* 추가 정보 (시설코드가 있는 경우) */}
                            {(outlet.discharge_facilities?.some((f: any) => f.additional_info?.green_link_code) ||
                              outlet.prevention_facilities?.some((f: any) => f.additional_info?.green_link_code)) && (
                              <div className="mt-3 p-3 bg-white bg-opacity-70 rounded-lg">
                                <h5 className="text-sm font-medium text-gray-700 mb-2">시설코드 정보</h5>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="font-medium text-red-700">배출시설:</span>
                                    {outlet.discharge_facilities?.map((facility: any, fIndex: number) => (
                                      facility.additional_info?.green_link_code && (
                                        <div key={fIndex} className="ml-2">
                                          {facility.facility_name}: {facility.additional_info.green_link_code}
                                        </div>
                                      )
                                    ))}
                                  </div>
                                  <div>
                                    <span className="font-medium text-blue-700">방지시설:</span>
                                    {outlet.prevention_facilities?.map((facility: any, fIndex: number) => (
                                      facility.additional_info?.green_link_code && (
                                        <div key={fIndex} className="ml-2">
                                          {facility.facility_name}: {facility.additional_info.green_link_code}
                                        </div>
                                      )
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Factory className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500">등록된 배출구 정보가 없습니다</p>
                      <p className="text-sm text-gray-400 mt-1">상세관리 버튼을 클릭하여 배출구 정보를 추가해보세요</p>
                    </div>
                  )}
                </div>

                {/* Additional Information */}
                {selectedPermit.additional_info && Object.keys(selectedPermit.additional_info).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-600" />
                      추가 정보
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      {selectedPermit.additional_info.pollutants && selectedPermit.additional_info.pollutants.length > 0 && (
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">배출 오염물질</label>
                          <div className="flex flex-wrap gap-2">
                            {selectedPermit.additional_info.pollutants.map((pollutant: string, index: number) => (
                              <span key={index} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                                {pollutant}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {Object.entries(selectedPermit.additional_info).map(([key, value]) => {
                          if (key === 'pollutants' || key === 'outlets') return null
                          return (
                            <div key={key}>
                              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">{key}</label>
                              <p className="mt-1 text-gray-900">{JSON.stringify(value)}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}