// app/admin/air-permit/page.tsx - 대기필증 관리 페이지
'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { BusinessInfo, AirPermitInfo } from '@/lib/database-service'
import { AirPermitWithOutlets } from '@/types/database'
import AdminLayout from '@/components/ui/AdminLayout'
import { withAuth } from '@/contexts/AuthContext'
import { ConfirmModal } from '@/components/ui/Modal'
import { generateFacilityNumbering, generateOutletFacilitySummary, type FacilityNumberingResult } from '@/utils/facility-numbering'
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


function AirPermitManagementPage() {
  const [businessesWithPermits, setBusinessesWithPermits] = useState<BusinessInfo[]>([])
  const [businessListSearchTerm, setBusinessListSearchTerm] = useState('')
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessInfo | null>(null)
  const [airPermits, setAirPermits] = useState<AirPermitInfo[]>([])
  const [selectedPermit, setSelectedPermit] = useState<AirPermitInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [permitToDelete, setPermitToDelete] = useState<AirPermitInfo | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [allBusinesses, setAllBusinesses] = useState<BusinessInfo[]>([])
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false)
  const [selectedBusinessName, setSelectedBusinessName] = useState('')
  const [newPermitData, setNewPermitData] = useState({
    business_id: '',
    business_type: '',
    category: '',
    first_report_date: '',
    operation_start_date: '',
    facility_number: '',
    green_link_code: '',
    memo: '',
    outlets: [
      {
        outlet_number: 1,
        outlet_name: '배출구 1',
        discharge_facilities: [{ name: '', capacity: '', quantity: 1 }],
        prevention_facilities: [{ name: '', capacity: '', quantity: 1 }]
      }
    ]
  })
  
  // 대기필증 검색 상태
  const [filteredAirPermits, setFilteredAirPermits] = useState<AirPermitInfo[]>([])
  const [permitSearchQuery, setPermitSearchQuery] = useState('')
  const [facilityNumberingMap, setFacilityNumberingMap] = useState<Map<string, FacilityNumberingResult>>(new Map())

  // 대기필증이 등록된 사업장만 필터링 (선택 리스트용)
  const filteredBusinessesWithPermits = useMemo(() => {
    if (!businessListSearchTerm.trim()) return businessesWithPermits
    const searchLower = businessListSearchTerm.toLowerCase()
    return businessesWithPermits.filter(business =>
      business.business_name.toLowerCase().includes(searchLower) ||
      business.local_government?.toLowerCase().includes(searchLower) ||
      business.manager_name?.toLowerCase().includes(searchLower) ||
      business.manager_contact?.toLowerCase().includes(searchLower) ||
      business.address?.toLowerCase().includes(searchLower)
    )
  }, [businessListSearchTerm, businessesWithPermits])
  

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
        
        // 시설 번호 생성 및 캐싱
        const newFacilityNumberingMap = new Map<string, FacilityNumberingResult>()
        normalizedPermits.forEach((permit: AirPermitWithOutlets) => {
          if (permit.outlets && permit.outlets.length > 0) {
            const facilityNumbering = generateFacilityNumbering(permit as AirPermitWithOutlets)
            newFacilityNumberingMap.set(permit.id, facilityNumbering)
          }
        })
        setFacilityNumberingMap(newFacilityNumberingMap)
        
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

  // 모든 사업장 목록 로드 (모달용)
  const loadAllBusinesses = async () => {
    setIsLoadingBusinesses(true)
    try {
      const response = await fetch('/api/business-list')
      const result = await response.json()
      
      if (response.ok) {
        // API에서 문자열 배열을 반환하므로 객체로 변환
        const businessNames = Array.isArray(result.data?.businesses) ? result.data.businesses : []
        const businesses = businessNames.map((name: string, index: number) => ({
          id: name, // 사업장명을 ID로 사용 (백엔드에서 사업장명으로 조회)
          business_name: name,
          local_government: result.data?.details?.[name]?.local_government || '', // 기본값
          business_registration_number: '', // 기본값
          business_type: '' // 기본값
        }))
        
        console.log('✅ 사업장 목록 로드 완료:', businesses.length, '개')
        setAllBusinesses(businesses)
      } else {
        console.error('❌ 사업장 목록 로드 실패:', result.error)
        setAllBusinesses([]) // Ensure it's always an array
        alert('사업장 목록을 불러오는데 실패했습니다: ' + result.error)
      }
    } catch (error) {
      console.error('❌ 사업장 목록 로드 오류:', error)
      setAllBusinesses([]) // Ensure it's always an array
      alert('사업장 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoadingBusinesses(false)
    }
  }

  // 배출구 추가
  const addOutlet = () => {
    const newOutletNumber = newPermitData.outlets.length + 1
    setNewPermitData(prev => ({
      ...prev,
      outlets: [
        ...prev.outlets,
        {
          outlet_number: newOutletNumber,
          outlet_name: `배출구 ${newOutletNumber}`,
          discharge_facilities: [{ name: '', capacity: '', quantity: 1 }],
          prevention_facilities: [{ name: '', capacity: '', quantity: 1 }]
        }
      ]
    }))
  }

  // 배출구 삭제
  const removeOutlet = (outletIndex: number) => {
    if (newPermitData.outlets.length > 1) {
      setNewPermitData(prev => ({
        ...prev,
        outlets: prev.outlets.filter((_, index) => index !== outletIndex)
      }))
    }
  }

  // 배출시설 추가
  const addDischargeFacility = (outletIndex: number) => {
    setNewPermitData(prev => ({
      ...prev,
      outlets: prev.outlets.map((outlet, index) => 
        index === outletIndex
          ? {
              ...outlet,
              discharge_facilities: [
                ...outlet.discharge_facilities,
                { name: '', capacity: '', quantity: 1 }
              ]
            }
          : outlet
      )
    }))
  }

  // 배출시설 삭제
  const removeDischargeFacility = (outletIndex: number, facilityIndex: number) => {
    setNewPermitData(prev => ({
      ...prev,
      outlets: prev.outlets.map((outlet, index) => 
        index === outletIndex
          ? {
              ...outlet,
              discharge_facilities: outlet.discharge_facilities.filter((_, fIndex) => fIndex !== facilityIndex)
            }
          : outlet
      )
    }))
  }

  // 방지시설 추가
  const addPreventionFacility = (outletIndex: number) => {
    setNewPermitData(prev => ({
      ...prev,
      outlets: prev.outlets.map((outlet, index) => 
        index === outletIndex
          ? {
              ...outlet,
              prevention_facilities: [
                ...outlet.prevention_facilities,
                { name: '', capacity: '', quantity: 1 }
              ]
            }
          : outlet
      )
    }))
  }

  // 방지시설 삭제
  const removePreventionFacility = (outletIndex: number, facilityIndex: number) => {
    setNewPermitData(prev => ({
      ...prev,
      outlets: prev.outlets.map((outlet, index) => 
        index === outletIndex
          ? {
              ...outlet,
              prevention_facilities: outlet.prevention_facilities.filter((_, fIndex) => fIndex !== facilityIndex)
            }
          : outlet
      )
    }))
  }

  // 시설 정보 업데이트
  const updateFacility = (outletIndex: number, facilityType: 'discharge' | 'prevention', facilityIndex: number, field: string, value: any) => {
    setNewPermitData(prev => ({
      ...prev,
      outlets: prev.outlets.map((outlet, oIndex) => 
        oIndex === outletIndex
          ? {
              ...outlet,
              [`${facilityType}_facilities`]: outlet[`${facilityType}_facilities`].map((facility: any, fIndex: number) => 
                fIndex === facilityIndex
                  ? { ...facility, [field]: value }
                  : facility
              )
            }
          : outlet
      )
    }))
  }

  // 대기필증 추가 모달 열기
  // 사업장 필터링 로직 (실시간 검색 최적화)
  const filteredBusinesses = useMemo(() => {
    if (!Array.isArray(allBusinesses)) return []
    if (!searchTerm || searchTerm.length < 1) return allBusinesses.slice(0, 100) // 초기에는 100개만 표시
    
    const searchLower = searchTerm.toLowerCase()
    return allBusinesses.filter(business => {
      return (
        business.business_name?.toLowerCase().includes(searchLower) ||
        business.local_government?.toLowerCase().includes(searchLower) ||
        business.business_registration_number?.includes(searchTerm)
      )
    }).slice(0, 50) // 검색시에는 50개만 표시
  }, [allBusinesses, searchTerm])

  const openAddModal = () => {
    setNewPermitData({
      business_id: '',
      business_type: '',
      category: '',
      first_report_date: '',
      operation_start_date: '',
      facility_number: '',
      green_link_code: '',
      memo: '',
      outlets: [
        {
          outlet_number: 1,
          outlet_name: '배출구 1',
          discharge_facilities: [{ name: '', capacity: '', quantity: 1 }],
          prevention_facilities: [{ name: '', capacity: '', quantity: 1 }]
        }
      ]
    })
    // 검색 상태 리셋
    setSearchTerm('')
    setSelectedBusinessName('')
    setShowBusinessDropdown(false)
    
    setIsAddModalOpen(true)
    // 모달이 열릴 때만 사업장 데이터 로드 (지연 로딩)
    if (allBusinesses.length === 0) {
      loadAllBusinesses()
    }
  }

  // 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showBusinessDropdown) {
        const target = event.target as HTMLElement
        if (!target.closest('.business-dropdown-container')) {
          setShowBusinessDropdown(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBusinessDropdown])

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


  // 대기필증 생성 함수 (실시간 업데이트 적용)
  const handleCreatePermit = async () => {
    try {
      if (!newPermitData.business_id) {
        alert('사업장을 선택해주세요.')
        return
      }

      const selectedBusiness = Array.isArray(allBusinesses) ? allBusinesses.find(b => b.id === newPermitData.business_id) : null
      
      // API 호출용 데이터 구성
      const permitData = {
        business_id: newPermitData.business_id,
        business_type: newPermitData.business_type || selectedBusiness?.business_type || '',
        category: newPermitData.category,
        business_name: selectedBusiness?.business_name || '',
        first_report_date: newPermitData.first_report_date || null,
        operation_start_date: newPermitData.operation_start_date || null,
        additional_info: {
          facility_number: newPermitData.facility_number,
          green_link_code: newPermitData.green_link_code,
          memo: newPermitData.memo
        },
        outlets: newPermitData.outlets.map(outlet => ({
          outlet_number: outlet.outlet_number,
          outlet_name: outlet.outlet_name,
          discharge_facilities: outlet.discharge_facilities.filter(f => f.name.trim()),
          prevention_facilities: outlet.prevention_facilities.filter(f => f.name.trim()),
          additional_info: {
            gateway: ''
          }
        }))
      }

      // 낙관적 업데이트: 임시 ID로 즉시 UI 업데이트
      const tempPermit = {
        id: `temp-${Date.now()}`,
        ...permitData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        is_deleted: false
      }

      // 즉시 UI 업데이트
      setAirPermits(prev => [...prev, tempPermit as any])
      setIsAddModalOpen(false)

      const response = await fetch('/api/air-permit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(permitData)
      })

      const result = await response.json()

      if (response.ok) {
        // 실제 데이터로 교체
        setAirPermits(prev => prev.map(permit => 
          permit.id === tempPermit.id ? result.data : permit
        ))
        
        // 대기필증이 등록된 사업장 목록 업데이트
        await loadBusinessesWithPermits()
        
        alert('대기필증이 성공적으로 생성되었습니다.')
        console.log('✅ 대기필증 생성 성공:', result.data)
      } else {
        // 실패 시 롤백
        setAirPermits(prev => prev.filter(permit => permit.id !== tempPermit.id))
        console.error('❌ 대기필증 생성 실패:', result)
        alert(result.error || '대기필증 생성에 실패했습니다.')
      }

    } catch (error) {
      console.error('💥 대기필증 생성 중 예외 발생:', error)
      // 오류 시 롤백
      setAirPermits(prev => prev.filter(permit => !permit.id.toString().startsWith('temp-')))
      alert('대기필증 생성 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
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
      // 낙관적 업데이트: 즉시 UI에서 제거
      const deletedPermit = permitToDelete
      setAirPermits(prev => prev.filter(permit => permit.id !== permitToDelete.id))
      setDeleteConfirmOpen(false)
      setPermitToDelete(null)

      // 사업장 목록의 필증 카운트 업데이트 (삭제 성공 후 처리)
      // loadBusinessesWithPermits()를 호출하지 않고 UI만 즉시 업데이트

      const response = await fetch(`/api/air-permit?id=${deletedPermit.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok) {
        // 실패 시 롤백
        setAirPermits(prev => [...prev, deletedPermit])
        console.error('❌ 대기필증 삭제 실패:', result)
        alert(result.error || '대기필증 삭제에 실패했습니다')
      } else {
        console.log('✅ 대기필증 삭제 성공:', deletedPermit.id)
      }
    } catch (error) {
      console.error('💥 대기필증 삭제 중 예외 발생:', error)
      // 오류 시 롤백
      if (permitToDelete) {
        setAirPermits(prev => [...prev, permitToDelete])
      }
      alert('대기필증 삭제 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <AdminLayout 
      title="대기필증 관리"
      description="대기배출시설 허가증 관리 시스템"
      actions={
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          title="새 대기필증 추가"
        >
          <Plus className="w-4 h-4" />
          대기필증 추가
        </button>
      }
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
                {searchTerm ? (
                  `${Math.min(filteredBusinessesWithPermits.length, 8)}개 표시 (검색결과 ${filteredBusinessesWithPermits.length}개 중)`
                ) : (
                  `${Math.min(filteredBusinessesWithPermits.length, 8)}개 표시 (전체 ${filteredBusinessesWithPermits.length}개 중)`
                )}
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
                value={businessListSearchTerm}
                onChange={(e) => setBusinessListSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {businessListSearchTerm && (
                <button
                  onClick={() => setBusinessListSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {filteredBusinessesWithPermits.slice(0, 8).map((business) => (
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
                    {businessListSearchTerm ? highlightBusinessSearchTerm(business.business_name, businessListSearchTerm) : business.business_name}
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
                    className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => setSelectedPermit(permit)}
                      >
                        <h3 className="font-medium text-gray-900">
                          {permitSearchQuery ? (
                            <>
                              대기필증 #{highlightPermitSearchTerm(permit.id || '', permitSearchQuery)}
                            </>
                          ) : (
                            `대기필증 #${permit.id}`
                          )}
                        </h3>
                        <div className="text-sm text-gray-600 mt-1 space-y-1">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium">업종: </span>
                              {permitSearchQuery ? 
                                highlightPermitSearchTerm(permit.business_type || '미지정', permitSearchQuery) : 
                                (permit.business_type || '미지정')
                              }
                            </div>
                            <div>
                              <span className="font-medium">종별: </span>
                              {permitSearchQuery ? 
                                highlightPermitSearchTerm(permit.additional_info?.category || '미지정', permitSearchQuery) : 
                                (permit.additional_info?.category || '미지정')
                              }
                            </div>
                          </div>
                          
                          {/* 시설 번호 정보 표시 */}
                          {(() => {
                            const facilityNumbering = facilityNumberingMap.get(permit.id)
                            if (!facilityNumbering || facilityNumbering.outlets.length === 0) return null
                            
                            return (
                              <div className="mt-2 p-2 bg-gray-50 rounded border">
                                <div className="text-xs font-medium text-gray-600 mb-1">시설 번호 현황</div>
                                <div className="space-y-1">
                                  {facilityNumbering.outlets.map(outlet => {
                                    const summary = generateOutletFacilitySummary(outlet)
                                    if (!summary) return null
                                    
                                    return (
                                      <div key={outlet.outletId} className="text-xs text-gray-700">
                                        <span className="font-medium">배출구 {outlet.outletNumber}:</span> {summary}
                                      </div>
                                    )
                                  })}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  배출시설 {facilityNumbering.totalDischargeFacilities}개, 
                                  방지시설 {facilityNumbering.totalPreventionFacilities}개
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedPermit(permit)
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="상세보기"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            window.location.href = `/admin/air-permit-detail?permitId=${permit.id}`
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="편집"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            confirmDelete(permit)
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
                      onClick={() => window.location.href = `/admin/air-permit-detail?permitId=${selectedPermit.id}`}
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
                      <label className="block text-sm font-medium text-gray-700">종별</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedPermit.additional_info?.category || '미지정'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">최초신고일</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {(selectedPermit as any).first_report_date || '미지정'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">가동개시일</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {(selectedPermit as any).operation_start_date || '미지정'}
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
                                    <th className="px-3 py-2 text-center font-medium text-red-700 border-r">시설번호</th>
                                    <th className="px-3 py-2 text-left font-medium text-blue-700 border-r">방지시설</th>
                                    <th className="px-3 py-2 text-center font-medium text-blue-700 border-r">용량</th>
                                    <th className="px-3 py-2 text-center font-medium text-blue-700 border-r">수량</th>
                                    <th className="px-3 py-2 text-center font-medium text-blue-700">시설번호</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const maxRows = Math.max(
                                      outlet.discharge_facilities?.length || 0,
                                      outlet.prevention_facilities?.length || 0,
                                      1
                                    )
                                    
                                    // 시설 번호 정보 가져오기
                                    const facilityNumbering = facilityNumberingMap.get(selectedPermit.id)
                                    const outletNumbering = facilityNumbering?.outlets.find(o => o.outletId === outlet.id)
                                    
                                    return Array.from({ length: maxRows }, (_, rowIndex) => {
                                      const dischargeFacility = outlet.discharge_facilities?.[rowIndex]
                                      const preventionFacility = outlet.prevention_facilities?.[rowIndex]
                                      
                                      // 시설별 번호 표시 로직
                                      const getDischargeFacilityNumbers = () => {
                                        if (!dischargeFacility || !outletNumbering) return '-'
                                        const facilityNumbers = outletNumbering.dischargeFacilities
                                          .filter(f => f.facilityId === dischargeFacility.id)
                                          .map(f => f.displayNumber)
                                        
                                        if (facilityNumbers.length === 0) return '-'
                                        if (facilityNumbers.length === 1) return facilityNumbers[0]
                                        return `${facilityNumbers[0]}-${facilityNumbers[facilityNumbers.length - 1]}`
                                      }
                                      
                                      const getPreventionFacilityNumbers = () => {
                                        if (!preventionFacility || !outletNumbering) return '-'
                                        const facilityNumbers = outletNumbering.preventionFacilities
                                          .filter(f => f.facilityId === preventionFacility.id)
                                          .map(f => f.displayNumber)
                                        
                                        if (facilityNumbers.length === 0) return '-'
                                        if (facilityNumbers.length === 1) return facilityNumbers[0]
                                        return `${facilityNumbers[0]}-${facilityNumbers[facilityNumbers.length - 1]}`
                                      }
                                      
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
                                          <td className="px-3 py-2 text-center border-r">
                                            <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                                              {getDischargeFacilityNumbers()}
                                            </span>
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
                                          <td className="px-3 py-2 text-center border-r font-medium">
                                            {preventionFacility?.quantity || '-'}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                              {getPreventionFacilityNumbers()}
                                            </span>
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

              </div>
            </div>
          )}
        </div>
      </div>

      {/* 대기필증 추가 모달 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-7xl w-full mx-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">새 대기필증 추가</h2>
                <p className="text-gray-600">새로운 대기필증 정보를 입력하고 등록하세요.</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleCreatePermit(); }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* 사업장 선택 */}
              <div className="relative business-dropdown-container">
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  사업장 선택 <span className="text-red-500">*</span>
                </label>
                {isLoadingBusinesses ? (
                  <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 flex items-center">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                    사업장 목록을 불러오는 중...
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={newPermitData.business_id ? selectedBusinessName : searchTerm}
                      onChange={(e) => {
                        const value = e.target.value
                        setSearchTerm(value)
                        setShowBusinessDropdown(true)
                        
                        // 사업장이 선택된 상태에서 수정하는 경우 선택 해제
                        if (newPermitData.business_id) {
                          setSelectedBusinessName('')
                          setNewPermitData(prev => ({
                            ...prev, 
                            business_id: '',
                            business_type: ''
                          }))
                        }
                      }}
                      onFocus={() => {
                        setShowBusinessDropdown(true)
                        // 포커스시 선택된 사업장이 있다면 검색어를 비워서 다시 검색할 수 있게 함
                        if (newPermitData.business_id) {
                          setSearchTerm('')
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                      placeholder="사업장명 또는 지자체명으로 검색..."
                      required={!newPermitData.business_id}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    
                    {showBusinessDropdown && (!newPermitData.business_id || searchTerm) && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredBusinesses.length > 0 ? (
                          <>
                            <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                              {searchTerm ? 
                                `검색 결과: ${filteredBusinesses.length}개 사업장 ${filteredBusinesses.length === 50 ? '(최대 50개 표시)' : ''}` :
                                `전체: ${filteredBusinesses.length}개 사업장 ${filteredBusinesses.length === 100 ? '(처음 100개 표시)' : ''}`
                              }
                            </div>
                            {filteredBusinesses.map(business => (
                              <div
                                key={business.id}
                                onClick={() => {
                                  setSelectedBusinessName(`${business.business_name} - ${business.local_government}`)
                                  setSearchTerm('')
                                  setShowBusinessDropdown(false)
                                  setNewPermitData(prev => ({
                                    ...prev, 
                                    business_id: business.id,
                                    business_type: business.business_type || ''
                                  }))
                                }}
                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{business.business_name}</div>
                                <div className="text-sm text-gray-500">{business.local_government}</div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="px-3 py-4 text-gray-500 text-center">
                            {isLoadingBusinesses ? (
                              <div className="flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                                사업장 목록을 불러오는 중...
                              </div>
                            ) : (
                              searchTerm ? `"${searchTerm}"에 대한 검색 결과가 없습니다.` : '사업장 목록이 없습니다.'
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* 선택된 사업장 표시 */}
                {newPermitData.business_id && !showBusinessDropdown && (
                  <div className="mt-2 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <div>
                      <div className="font-medium text-blue-900">{selectedBusinessName.split(' - ')[0]}</div>
                      <div className="text-sm text-blue-700">{selectedBusinessName.split(' - ')[1]}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBusinessName('')
                        setSearchTerm('')
                        setNewPermitData(prev => ({
                          ...prev, 
                          business_id: '',
                          business_type: ''
                        }))
                      }}
                      className="text-blue-600 hover:text-blue-800 ml-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* 업종 */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  업종
                </label>
                <input
                  type="text"
                  value={newPermitData.business_type}
                  onChange={(e) => setNewPermitData(prev => ({...prev, business_type: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="업종을 입력하세요"
                />
              </div>

              {/* 종별 */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  종별
                </label>
                <input
                  type="text"
                  value={newPermitData.category}
                  onChange={(e) => setNewPermitData(prev => ({...prev, category: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="종별을 입력하세요"
                />
              </div>

              {/* 최초 신고일 */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  최초 신고일
                </label>
                <DateInput
                  value={newPermitData.first_report_date}
                  onChange={(value) => setNewPermitData(prev => ({...prev, first_report_date: value}))}
                  placeholder="YYYY-MM-DD"
                />
              </div>

              {/* 가동 개시일 */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  가동 개시일
                </label>
                <DateInput
                  value={newPermitData.operation_start_date}
                  onChange={(value) => setNewPermitData(prev => ({...prev, operation_start_date: value}))}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              </div>


              {/* 배출구 및 시설 정보 섹션 */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    배출구 및 시설 정보
                  </h3>
                  <button
                    type="button"
                    onClick={addOutlet}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    배출구 추가
                  </button>
                </div>
                
                <div className="space-y-4 max-h-60 overflow-y-auto">
                  {newPermitData.outlets.map((outlet, outletIndex) => (
                    <div key={outletIndex} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">
                          배출구 {outlet.outlet_number}
                        </h4>
                        {newPermitData.outlets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOutlet(outletIndex)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* 배출구명 */}
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          배출구명
                        </label>
                        <input
                          type="text"
                          value={outlet.outlet_name}
                          onChange={(e) => setNewPermitData(prev => ({
                            ...prev,
                            outlets: prev.outlets.map((o, i) => 
                              i === outletIndex ? {...o, outlet_name: e.target.value} : o
                            )
                          }))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* 배출시설 */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-600">
                            배출시설
                          </label>
                          <button
                            type="button"
                            onClick={() => addDischargeFacility(outletIndex)}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            + 추가
                          </button>
                        </div>
                        <div className="space-y-2">
                          {outlet.discharge_facilities.map((facility, facilityIndex) => (
                            <div key={facilityIndex} className="flex gap-2 items-start">
                              <input
                                type="text"
                                value={facility.name}
                                onChange={(e) => updateFacility(outletIndex, 'discharge', facilityIndex, 'name', e.target.value)}
                                placeholder="시설명"
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                              <input
                                type="text"
                                value={facility.capacity}
                                onChange={(e) => updateFacility(outletIndex, 'discharge', facilityIndex, 'capacity', e.target.value)}
                                placeholder="용량"
                                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                              <input
                                type="number"
                                value={facility.quantity}
                                onChange={(e) => updateFacility(outletIndex, 'discharge', facilityIndex, 'quantity', parseInt(e.target.value) || 1)}
                                placeholder="수량"
                                min="1"
                                className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                              {outlet.discharge_facilities.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeDischargeFacility(outletIndex, facilityIndex)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 방지시설 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-600">
                            방지시설
                          </label>
                          <button
                            type="button"
                            onClick={() => addPreventionFacility(outletIndex)}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            + 추가
                          </button>
                        </div>
                        <div className="space-y-2">
                          {outlet.prevention_facilities.map((facility, facilityIndex) => (
                            <div key={facilityIndex} className="flex gap-2 items-start">
                              <input
                                type="text"
                                value={facility.name}
                                onChange={(e) => updateFacility(outletIndex, 'prevention', facilityIndex, 'name', e.target.value)}
                                placeholder="시설명"
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                              <input
                                type="text"
                                value={facility.capacity}
                                onChange={(e) => updateFacility(outletIndex, 'prevention', facilityIndex, 'capacity', e.target.value)}
                                placeholder="용량"
                                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                              <input
                                type="number"
                                value={facility.quantity}
                                onChange={(e) => updateFacility(outletIndex, 'prevention', facilityIndex, 'quantity', parseInt(e.target.value) || 1)}
                                placeholder="수량"
                                min="1"
                                className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                              {outlet.prevention_facilities.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removePreventionFacility(outletIndex, facilityIndex)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 버튼들 */}
              <div className="flex justify-end gap-4 pt-8 mt-8 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  <span className="flex items-center gap-2">
                    대기필증 생성
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="대기필증 삭제"
        message={`정말로 대기필증 "${permitToDelete?.id}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
      />
    </AdminLayout>
  );
}

export default withAuth(AirPermitManagementPage, 'canAccessAdminPages')