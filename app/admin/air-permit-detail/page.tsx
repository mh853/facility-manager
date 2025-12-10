// app/admin/air-permit-detail/page.tsx - 대기필증 상세보기 페이지
'use client'

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { useSearchParams, useRouter } from 'next/navigation'
import { AirPermitWithOutlets, DischargeOutlet } from '@/lib/database-service'
import { createDefaultOutlet } from '@/lib/object-factories'
import { generateFacilityNumbering, generateOutletFacilitySummary, getFacilityNumber, type FacilityNumberingResult } from '@/utils/facility-numbering'
import AdminLayout from '@/components/ui/AdminLayout'
import { 
  Factory, 
  ArrowLeft,
  Settings,
  Edit,
  Save,
  X,
  Plus,
  FileDown,
  Trash2
} from 'lucide-react'

// 게이트웨이 색상 팔레트 - 무한 확장 가능한 기본 색상들
const baseGatewayColors = [
  'bg-blue-200 text-blue-800',
  'bg-green-200 text-green-800', 
  'bg-yellow-200 text-yellow-800',
  'bg-red-200 text-red-800',
  'bg-purple-200 text-purple-800',
  'bg-pink-200 text-pink-800',
  'bg-indigo-200 text-indigo-800',
  'bg-cyan-200 text-cyan-800',
  'bg-orange-200 text-orange-800',
  'bg-teal-200 text-teal-800',
  'bg-lime-200 text-lime-800',
  'bg-rose-200 text-rose-800'
]

// 동적 게이트웨이 색상 생성 함수
const generateGatewayInfo = (gatewayValue: string) => {
  if (!gatewayValue) {
    return { name: '미할당', color: 'bg-gray-200 text-gray-800', value: '' }
  }
  
  // gateway1, gateway2 등에서 숫자 추출
  const match = gatewayValue.match(/gateway(\d+)/)
  if (match) {
    const num = parseInt(match[1])
    const colorIndex = (num - 1) % baseGatewayColors.length
    return {
      name: `Gateway ${num}`,
      color: baseGatewayColors[colorIndex],
      value: gatewayValue
    }
  }
  
  // 일반 문자열 게이트웨이의 경우 해시 기반 색상 선택
  const hash = gatewayValue.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colorIndex = hash % baseGatewayColors.length
  return {
    name: gatewayValue,
    color: baseGatewayColors[colorIndex], 
    value: gatewayValue
  }
}

// 사용 가능한 게이트웨이 옵션 생성 (무제한 확장 가능)
const generateGatewayOptions = (currentAssignments: {[key: string]: string} = {}, maxOptions: number = 50) => {
  const options = [{ name: '미할당', color: 'bg-gray-200 text-gray-800', value: '' }]
  
  // 현재 사용중인 게이트웨이들을 먼저 추가
  const usedGateways = new Set(Object.values(currentAssignments).filter(g => g))
  usedGateways.forEach(gateway => {
    options.push(generateGatewayInfo(gateway))
  })
  
  // 추가 게이트웨이 옵션들을 생성 (gateway1부터 maxOptions까지)
  for (let i = 1; i <= maxOptions; i++) {
    const gatewayValue = `gateway${i}`
    if (!usedGateways.has(gatewayValue)) {
      options.push(generateGatewayInfo(gatewayValue))
    }
  }
  
  return options
}

function AirPermitDetailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // URL 파라미터를 useState로 안정화 - 무한 렌더링 방지
  const [urlParams, setUrlParams] = useState(() => ({
    permitId: searchParams?.get('permitId'),
    mode: searchParams?.get('mode'),
    edit: searchParams?.get('edit')
  }))
  
  // console.log('🔧 [DEBUG] AirPermitDetailContent 렌더링:', urlParams)  // 프로덕션에서는 주석 처리
  
  const [permitDetail, setPermitDetail] = useState<AirPermitWithOutlets | null>(null)
  const [originalPermitDetail, setOriginalPermitDetail] = useState<AirPermitWithOutlets | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isEditing, setIsEditing] = useState(true) // 항상 편집모드로 시작
  const [gatewayAssignments, setGatewayAssignments] = useState<{[outletId: string]: string}>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [facilityNumbering, setFacilityNumbering] = useState<FacilityNumberingResult | null>(null)

  // 게이트웨이 색상 메모이제이션 - 동적 무한 게이트웨이 지원
  const getGatewayColorClass = useMemo(() => {
    const colorCache = new Map()
    
    return (gateway: string) => {
      // 캐시된 색상이 있으면 반환
      if (colorCache.has(gateway)) {
        return colorCache.get(gateway)
      }
      
      // 새 게이트웨이의 색상 생성하고 캐시
      const gatewayInfo = generateGatewayInfo(gateway)
      colorCache.set(gateway, gatewayInfo.color)
      return gatewayInfo.color
    }
  }, [])

  // URL 파라미터 변경 감지 (최적화된 버전)
  useEffect(() => {
    const newPermitId = searchParams?.get('permitId')
    const newMode = searchParams?.get('mode')
    const newEdit = searchParams?.get('edit')

    // 실제로 변경된 경우에만 업데이트 (무한 리로드 방지)
    if (newPermitId !== urlParams.permitId || newMode !== urlParams.mode || newEdit !== urlParams.edit) {
      setUrlParams({ permitId: newPermitId, mode: newMode, edit: newEdit })
    }
  }, [searchParams, urlParams.permitId, urlParams.mode, urlParams.edit]) // 의존성 명시적 추가

  // 데이터 로딩 최적화 (디바운싱 및 캐시 적용)
  const loadData = useCallback(async () => {
      // 새 대기필증 생성 모드
      if (urlParams.mode === 'new' || !urlParams.permitId) {
        setPermitDetail({
          id: 'new',
          business_id: '',
          business_type: '',
          annual_emission_amount: null,
          outlets: [
            createDefaultOutlet({
              id: 'new-outlet-1',
              outlet_number: 1,
              outlet_name: '배출구 1'
            })
          ],
          additional_info: {},
          is_active: true,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        setIsEditing(true)
        setLoading(false)
        setIsInitialized(true)
        return
      }
      
      if (!urlParams.permitId) return

      try {
        setLoading(true)
        const response = await fetch(`/api/air-permit?id=${urlParams.permitId}&details=true`)
        const result = await response.json()
        
        if (response.ok && result.data) {
          console.log('📋 대기필증 상세 정보:', result.data)
          let permitData = result.data

          // 배출구가 없는 경우 기본 배출구 자동 생성
          if (!permitData.outlets || permitData.outlets.length === 0) {
            console.log('🔧 배출구가 없어 기본 배출구를 생성합니다')
            try {
              const createOutletResponse = await fetch('/api/outlet-facility', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'outlet',
                  air_permit_id: permitData.id,
                  outlet_number: 1,
                  outlet_name: '배출구 1',
                  additional_info: { gateway: '' }
                })
              })

              if (createOutletResponse.ok) {
                const createResult = await createOutletResponse.json()
                console.log('✅ 기본 배출구 생성 완료:', createResult.data)
                
                // 생성된 배출구를 포함하여 다시 데이터 로드
                const refreshResponse = await fetch(`/api/air-permit?id=${urlParams.permitId}&details=true`)
                const refreshResult = await refreshResponse.json()
                if (refreshResponse.ok && refreshResult.data) {
                  permitData = refreshResult.data
                  console.log('🔄 배출구 생성 후 데이터 새로고침 완료')
                }
              }
            } catch (createError) {
              console.error('배출구 생성 중 오류:', createError)
            }
          }

          setPermitDetail(permitData)
          
          // 시설 번호 생성
          if (permitData.outlets && permitData.outlets.length > 0) {
            const numbering = generateFacilityNumbering(permitData)
            setFacilityNumbering(numbering)
          }
          
          // 게이트웨이 할당 정보 초기화
          const assignments: {[outletId: string]: string} = {}
          if (permitData.outlets) {
            permitData.outlets.forEach((outlet: DischargeOutlet) => {
              assignments[outlet.id] = outlet.additional_info?.gateway || ''
            })
          }
          setGatewayAssignments(assignments)

          // ⭐ originalPermitDetail 초기화 - 변경 감지를 위해 필수!
          setOriginalPermitDetail(permitData)
          console.log('✅ originalPermitDetail 초기화 완료')

        } else {
          alert('대기필증 정보를 불러오는데 실패했습니다')
          router.push('/admin/air-permit')
        }
      } catch (error) {
        console.error('Error loading permit detail:', error)
        alert('대기필증 정보를 불러오는데 실패했습니다')
        router.push('/admin/air-permit')
      } finally {
        setLoading(false)
        setIsInitialized(true)
      }
  }, [urlParams.permitId, urlParams.mode])

  useEffect(() => {
    if (!isInitialized && urlParams.permitId) {
      loadData()
    }
  }, [loadData, isInitialized, urlParams.permitId])

  // 편집모드 자동 활성화 로직 제거 (isEditing이 항상 true이므로 불필요)

  // 시설 정보 편집 - 단일 진실 공급원 (permitDetail만 사용)
  const handleFacilityEdit = useCallback((outletId: string, facilityType: 'discharge' | 'prevention', facilityId: string, field: string, value: any) => {
    console.log('🔧 [handleFacilityEdit] 호출됨:', { outletId, facilityType, facilityId, field, value })

    // additional_info에 들어가야 할 필드들 정의
    const additionalInfoFields = ['green_link_code', 'facility_number', 'memo']

    // permitDetail 즉시 업데이트 (단일 진실 공급원)
    setPermitDetail(prev => {
      if (!prev) return null

      return {
        ...prev,
        outlets: prev.outlets.map(outlet => {
          if (outlet.id === outletId) {
            const facilitiesKey = facilityType === 'discharge' ? 'discharge_facilities' : 'prevention_facilities'
            const updatedFacilities = outlet[facilitiesKey]?.map(facility => {
              if (facility.id === facilityId) {
                // additional_info에 속하는 필드인지 확인
                if (additionalInfoFields.includes(field)) {
                  return {
                    ...facility,
                    additional_info: {
                      ...facility.additional_info,
                      [field]: value
                    }
                  }
                } else {
                  // 일반 필드는 루트 레벨에 저장
                  return {
                    ...facility,
                    [field]: value
                  }
                }
              }
              return facility
            }) || []

            return {
              ...outlet,
              [facilitiesKey]: updatedFacilities
            }
          }
          return outlet
        })
      }
    })

    console.log('✅ [handleFacilityEdit] permitDetail 업데이트 완료')
  }, [])

  // 한글 깨짐 문제 수정 함수
  const fixKoreanText = (text: string) => {
    if (!text) return text
    
    // 깨진 한글 패턴 감지 및 수정
    const corruptedPatterns: Record<string, string> = {
      '���ⱸ 1': '배출구 1',
      '���ⱸ 2': '배출구 2',
      '���ⱸ 3': '배출구 3',
      '���ⱸ 4': '배출구 4',
      '���ⱸ 5': '배출구 5'
    }
    
    for (const [corrupted, fixed] of Object.entries(corruptedPatterns)) {
      if (text.includes(corrupted)) {
        return text.replace(corrupted, fixed)
      }
    }
    
    return text
  }

  // 게이트웨이 할당 변경 (최적화된 버전)
  const handleGatewayChange = useCallback((outletId: string, gateway: string) => {
    console.log('🎯 게이트웨이 변경 감지:', { outletId, gateway })
    
    setGatewayAssignments(prev => {
      if (prev[outletId] === gateway) return prev // 중복 업데이트 방지
      return {
        ...prev,
        [outletId]: gateway
      }
    })
  }, [])

  // 변경된 시설 감지 헬퍼 함수
  const findChangedFacilities = (current: AirPermitWithOutlets, original: AirPermitWithOutlets | null) => {
    const changed: Array<{
      type: 'discharge_facility' | 'prevention_facility'
      id: string
      data: any
    }> = []

    console.log('🔍 [변경 감지] findChangedFacilities 시작')
    console.log('🔍 [변경 감지] original:', original ? '존재' : 'null')
    console.log('🔍 [변경 감지] current outlets:', current.outlets?.length)

    if (!original) {
      console.log('⚠️ [변경 감지] original이 null이므로 변경 감지 스킵')
      return changed
    }

    current.outlets?.forEach(outlet => {
      const originalOutlet = original.outlets?.find(o => o.id === outlet.id)
      if (!originalOutlet) return

      // 배출시설 비교
      outlet.discharge_facilities?.forEach(facility => {
        if (facility.id.startsWith('new-')) return // 새 시설은 별도 처리

        const originalFacility = originalOutlet.discharge_facilities?.find(f => f.id === facility.id)
        if (!originalFacility) return

        // 깊은 비교로 실제 변경 감지
        const nameChanged = facility.facility_name !== originalFacility.facility_name
        const capacityChanged = facility.capacity !== originalFacility.capacity
        const quantityChanged = facility.quantity !== originalFacility.quantity
        const additionalInfoChanged = JSON.stringify(facility.additional_info) !== JSON.stringify(originalFacility.additional_info)

        const hasChanged = nameChanged || capacityChanged || quantityChanged || additionalInfoChanged

        console.log(`🔍 [배출시설] ${facility.facility_name}:`, {
          nameChanged,
          capacityChanged,
          quantityChanged,
          additionalInfoChanged,
          hasChanged,
          current_additional_info: facility.additional_info,
          original_additional_info: originalFacility.additional_info
        })

        if (hasChanged) {
          console.log(`🔄 변경 감지 - 배출시설 ${facility.facility_name} (${facility.id})`)
          changed.push({
            type: 'discharge_facility',
            id: facility.id,
            data: {
              facility_name: facility.facility_name,
              capacity: facility.capacity,
              quantity: facility.quantity,
              additional_info: facility.additional_info
            }
          })
        }
      })

      // 방지시설 비교
      outlet.prevention_facilities?.forEach(facility => {
        if (facility.id.startsWith('new-')) return // 새 시설은 별도 처리

        const originalFacility = originalOutlet.prevention_facilities?.find(f => f.id === facility.id)
        if (!originalFacility) return

        // 깊은 비교로 실제 변경 감지
        const nameChanged = facility.facility_name !== originalFacility.facility_name
        const capacityChanged = facility.capacity !== originalFacility.capacity
        const quantityChanged = facility.quantity !== originalFacility.quantity
        const additionalInfoChanged = JSON.stringify(facility.additional_info) !== JSON.stringify(originalFacility.additional_info)

        const hasChanged = nameChanged || capacityChanged || quantityChanged || additionalInfoChanged

        console.log(`🔍 [방지시설] ${facility.facility_name}:`, {
          nameChanged,
          capacityChanged,
          quantityChanged,
          additionalInfoChanged,
          hasChanged,
          current_additional_info: facility.additional_info,
          original_additional_info: originalFacility.additional_info
        })

        if (hasChanged) {
          console.log(`🔄 변경 감지 - 방지시설 ${facility.facility_name} (${facility.id})`)
          changed.push({
            type: 'prevention_facility',
            id: facility.id,
            data: {
              facility_name: facility.facility_name,
              capacity: facility.capacity,
              quantity: facility.quantity,
              additional_info: facility.additional_info
            }
          })
        }
      })
    })

    console.log(`📊 총 ${changed.length}개 시설 변경 감지됨`)
    return changed
  }

  // 변경사항 저장 - 변경된 시설만 업데이트 (성능 최적화)
  const handleSave = async () => {
    const startTime = performance.now()
    console.log(`⏱️ [TIME] handleSave 시작: 0ms`)

    try {
      console.log('💾 handleSave 함수 시작')
      setIsSaving(true)

      // ✅ 간소화된 로직: 게이트웨이 할당만 업데이트 후 전체 데이터를 PUT
      const updatedPermitDetail = { ...permitDetail }

      if (updatedPermitDetail && updatedPermitDetail.outlets) {
        updatedPermitDetail.outlets = updatedPermitDetail.outlets.map(outlet => {
          // 게이트웨이 할당만 업데이트
          if (gatewayAssignments.hasOwnProperty(outlet.id)) {
            return {
              ...outlet,
              additional_info: {
                ...outlet.additional_info,
                gateway: gatewayAssignments[outlet.id]
              }
            }
          }
          return outlet
        })
      }

      console.log('🔄 outlets 데이터 준비 완료:', {
        outletCount: updatedPermitDetail.outlets?.length,
        outlets: updatedPermitDetail.outlets?.map(o => ({
          id: o.id,
          gateway: o.additional_info?.gateway, // 🎯 게이트웨이 할당 확인
          additional_info: o.additional_info, // 🎯 전체 additional_info 확인
          dischargeCount: o.discharge_facilities?.length,
          preventionCount: o.prevention_facilities?.length
        }))
      })

      console.log('🎯 [DEBUG] 게이트웨이 할당 상태:', gatewayAssignments)

      // ✅ 개별 시설 업데이트 로직 제거 - 이제 모든 시설을 outlets 배열에 포함해서 PUT
      // (아래 대기필증 기본 정보 업데이트에서 outlets 전체를 포함해서 전송)

      // 대기필증 기본 정보 + outlets 전체 업데이트
      let airPermitResponse: Response | null = null

      if (permitDetail?.id && !permitDetail.id.startsWith('new-')) {
        // 기존 대기필증 편집: ✅ 모달과 동일하게 outlets 전체를 포함해서 PUT
        console.log('📝 대기필증 편집 모드: 전체 정보 업데이트 (outlets 포함)')

        const fullUpdateWithOutlets = {
          id: permitDetail.id,
          business_type: updatedPermitDetail.business_type,
          facility_number: updatedPermitDetail.facility_number,
          green_link_code: updatedPermitDetail.green_link_code,
          first_report_date: updatedPermitDetail.first_report_date,
          operation_start_date: updatedPermitDetail.operation_start_date,
          additional_info: {
            ...updatedPermitDetail.additional_info
          },
          // ✅ outlets 전체를 포함 - 모달과 동일한 구조
          outlets: updatedPermitDetail.outlets?.map(outlet => ({
            id: outlet.id.startsWith('new-') ? undefined : outlet.id, // 새 배출구는 id 제외
            outlet_number: outlet.outlet_number,
            outlet_name: outlet.outlet_name,
            discharge_facilities: outlet.discharge_facilities?.map(facility => ({
              id: facility.id.startsWith('new-') ? undefined : facility.id, // 새 시설은 id 제외
              name: facility.facility_name, // ✅ API가 기대하는 필드명: "name"
              capacity: facility.capacity,
              quantity: facility.quantity,
              fuel_type: (facility as any).fuel_type || '',
              installation_date: (facility as any).installation_date || '',
              additional_info: facility.additional_info || {}
            })) || [],
            prevention_facilities: outlet.prevention_facilities?.map(facility => ({
              id: facility.id.startsWith('new-') ? undefined : facility.id, // 새 시설은 id 제외
              name: facility.facility_name, // ✅ API가 기대하는 필드명: "name"
              capacity: facility.capacity,
              quantity: facility.quantity,
              model: (facility as any).model || '',
              installation_date: (facility as any).installation_date || '',
              additional_info: facility.additional_info || {}
            })) || [],
            additional_info: outlet.additional_info || {} // ✅ 게이트웨이 정보 보존
          })) || []
        }

        console.log('🔍 전송할 데이터 (outlets 포함):', {
          outletCount: fullUpdateWithOutlets.outlets?.length,
          outlets: fullUpdateWithOutlets.outlets?.map(o => ({
            id: o.id,
            number: o.outlet_number,
            gateway: o.additional_info?.gateway, // 🎯 게이트웨이 정보 확인
            additional_info: o.additional_info, // 🎯 전체 additional_info 확인
            dischargeCount: o.discharge_facilities?.length,
            preventionCount: o.prevention_facilities?.length
          }))
        })

        // 🚨 CRITICAL DEBUG: 전송 직전 JSON 전체 출력
        console.log('🚨 [CRITICAL] JSON.stringify 직전 fullUpdateWithOutlets 전체:', JSON.stringify(fullUpdateWithOutlets, null, 2))

        airPermitResponse = await fetch('/api/air-permit', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullUpdateWithOutlets) // ✅ outlets 포함!
        })
      } else if (permitDetail?.id === 'new') {
        // 새 대기필증 생성: 배출구/시설 포함 전체 생성
        const newPermitData = {
          business_id: updatedPermitDetail.business_id,
          business_type: updatedPermitDetail.business_type,
          // first_report_date: updatedPermitDetail.first_report_date,
          // operation_start_date: updatedPermitDetail.operation_start_date,
          additional_info: {
            ...updatedPermitDetail.additional_info
          },
          outlets: updatedPermitDetail.outlets?.map(outlet => ({
            outlet_number: outlet.outlet_number,
            outlet_name: outlet.outlet_name,
            discharge_facilities: outlet.discharge_facilities?.map(facility => ({
              name: facility.facility_name, // ✅ API가 기대하는 필드명: "name"
              capacity: facility.capacity,
              quantity: facility.quantity,
              additional_info: facility.additional_info
            })) || [],
            prevention_facilities: outlet.prevention_facilities?.map(facility => ({
              name: facility.facility_name, // ✅ API가 기대하는 필드명: "name"
              capacity: facility.capacity,
              quantity: facility.quantity,
              additional_info: facility.additional_info
            })) || []
          })) || []
        }

        airPermitResponse = await fetch('/api/air-permit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPermitData)
        })

        console.log('🆕 새 대기필증 생성 데이터:', newPermitData)
      }

      // ✅ 단일 PUT/POST로 모든 데이터가 한번에 업데이트됨
      console.log('✅ 대기필증 업데이트 완료 (outlets 포함)')
      console.log(`⏱️ [TIME] 대기필증 업데이트 완료: ${(performance.now() - startTime).toFixed(0)}ms`)

      // 업데이트 완료 후 최신 데이터 다시 조회
      if (airPermitResponse && airPermitResponse.ok) {
        // 대기필증 API 응답 확인
        const airPermitData = await airPermitResponse.json()
        console.log('📄 대기필증 API 응답:', airPermitData.data)

        // 게이트웨이 업데이트가 완료된 후 최신 데이터 다시 조회 (forcePrimary=true로 즉시 반영 보장)
        console.log('🔄 최신 데이터 재조회 시작 (Primary DB 사용)')
        console.log(`⏱️ [TIME] 재조회 시작: ${(performance.now() - startTime).toFixed(0)}ms`)

        // 🔧 READ-AFTER-WRITE 일관성 보장: 짧은 지연 후 재조회 (replica lag 보정)
        await new Promise(resolve => setTimeout(resolve, 500))
        console.log(`⏱️ [TIME] 재조회 지연 완료: ${(performance.now() - startTime).toFixed(0)}ms`)

        const refreshResponse = await fetch(`/api/air-permit?id=${permitDetail?.id}&details=true&forcePrimary=true`)
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          console.log(`⏱️ [TIME] 재조회 완료: ${(performance.now() - startTime).toFixed(0)}ms`)
          console.log('🔄 최신 데이터 재조회 완료:', refreshData.data)

          // 응답 데이터 유효성 검사
          if (refreshData.data && refreshData.data.outlets) {
            // 그린링크 코드 디버깅을 위한 상세 로그
            refreshData.data.outlets.forEach((outlet: any) => {
              console.log(`🔍 [DEBUG] 배출구 ${outlet.outlet_number} 데이터:`)
              outlet.discharge_facilities?.forEach((facility: any) => {
                console.log(`  - 배출시설 ${facility.facility_name}: green_link_code = "${facility.additional_info?.green_link_code}"`)
              })
              outlet.prevention_facilities?.forEach((facility: any) => {
                console.log(`  - 방지시설 ${facility.facility_name}: green_link_code = "${facility.additional_info?.green_link_code}"`)
              })
            })

            // ⚡ 먼저 성공 메시지 표시 (리렌더링 차단 방지)
            // alert()는 모달이므로 UI 업데이트 전에 표시하면 리렌더링이 차단됨
            // 대신 UI 업데이트를 먼저 하고 마지막에 표시

            // 게이트웨이 할당 정보 먼저 준비
            const newAssignments: {[outletId: string]: string} = {}
            refreshData.data.outlets.forEach((outlet: any) => {
              newAssignments[outlet.id] = outlet.additional_info?.gateway || ''
              console.log(`🔍 [RELOAD] 배출구 ${outlet.outlet_number} (ID: ${outlet.id}): gateway = "${outlet.additional_info?.gateway}"`)
            })

            console.log('🔍 [RELOAD] 최종 게이트웨이 할당:', newAssignments)

            // 시설 번호 재생성
            const newNumbering = generateFacilityNumbering(refreshData.data)

            // 최신 데이터로 UI 업데이트 (flushSync로 즉시 동기 업데이트)
            flushSync(() => {
              setPermitDetail(refreshData.data)
              setOriginalPermitDetail(refreshData.data)
              setGatewayAssignments(newAssignments)
              setFacilityNumbering(newNumbering)
            })
            console.log(`⏱️ [TIME] flushSync 완료: ${(performance.now() - startTime).toFixed(0)}ms`)
            console.log('🎯 게이트웨이 할당 정보 재초기화 완료:', newAssignments)
            console.log('✅ UI 업데이트 완료 - permitDetail이 최신 데이터로 업데이트됨')
            console.log(`⏱️ [TIME] UI 업데이트 완료: ${(performance.now() - startTime).toFixed(0)}ms`)

            // ✅ UI 업데이트 완료 후 성공 메시지 표시 (DOM 렌더링 완료 보장)
            // requestAnimationFrame을 두 번 사용하여 브라우저가 실제로 화면을 다시 그린 후에 alert 표시
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                console.log(`⏱️ [TIME] alert 표시: ${(performance.now() - startTime).toFixed(0)}ms`)
                alert('변경사항이 저장되었습니다')
              })
            })
          } else {
            console.error('❌ 응답 데이터가 비어있거나 outlets 정보가 없습니다:', refreshData)
            // 실패 시 대기필증 API 응답으로 업데이트 (fallback)
            if (airPermitData.data) {
              const fallbackAssignments: {[outletId: string]: string} = {}
              airPermitData.data.outlets?.forEach((outlet: any) => {
                fallbackAssignments[outlet.id] = outlet.additional_info?.gateway || ''
              })
              const fallbackNumbering = generateFacilityNumbering(airPermitData.data)

              flushSync(() => {
                setPermitDetail(airPermitData.data)
                setOriginalPermitDetail(airPermitData.data)
                setGatewayAssignments(fallbackAssignments)
                setFacilityNumbering(fallbackNumbering)
              })

              // Fallback에서도 DOM 렌더링 완료 후 alert 표시
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  alert('변경사항이 저장되었습니다')
                })
              })
            }
          }
        } else {
          const errorText = await refreshResponse.text()
          console.error(`❌ 최신 데이터 재조회 실패 (${refreshResponse.status}):`, errorText)
          // 실패 시 대기필증 API 응답으로 업데이트 (fallback)
          if (airPermitData.data) {
            const fallbackAssignments: {[outletId: string]: string} = {}
            airPermitData.data.outlets?.forEach((outlet: any) => {
              fallbackAssignments[outlet.id] = outlet.additional_info?.gateway || ''
            })
            const fallbackNumbering = generateFacilityNumbering(airPermitData.data)

            flushSync(() => {
              setPermitDetail(airPermitData.data)
              setOriginalPermitDetail(airPermitData.data)
              setGatewayAssignments(fallbackAssignments)
              setFacilityNumbering(fallbackNumbering)
            })

            // Fallback 경로에서도 DOM 렌더링 완료 후 alert 표시
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                alert('변경사항이 저장되었습니다')
              })
            })
          }
        }
      }

      // gatewayAssignments는 위에서 재초기화되므로 여기서 초기화하지 않음
      // 항상 편집모드이므로 종료하지 않음
      // alert는 위에서 setTimeout으로 이미 표시됨

    } catch (error) {
      console.error('Error saving changes:', error);
      // 실패 시 롤백 - 원본 데이터로 복원
      if (originalPermitDetail) {
        setPermitDetail(originalPermitDetail);
      }
      setIsEditing(true);
      alert('저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  }

  // 배출시설 추가 함수
  const addDischargeFacility = (outletId: string) => {
    if (!permitDetail) return;

    setPermitDetail(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        outlets: prev.outlets.map(outlet => {
          if (outlet.id === outletId) {
            const newFacility = {
              id: `new-discharge-${Date.now()}`,
              outlet_id: outletId,
              facility_name: '새 배출시설',
              capacity: '',
              quantity: 1,
              fuel_type: '',
              installation_date: '',
              additional_info: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            
            return {
              ...outlet,
              discharge_facilities: [...(outlet.discharge_facilities || []), newFacility]
            }
          }
          return outlet
        })
      }
    })
  }

  // 방지시설 추가 함수
  const addPreventionFacility = (outletId: string) => {
    if (!permitDetail) return

    setPermitDetail(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        outlets: prev.outlets.map(outlet => {
          if (outlet.id === outletId) {
            const newFacility = {
              id: `new-prevention-${Date.now()}`,
              outlet_id: outletId,
              facility_name: '새 방지시설',
              capacity: '',
              quantity: 1,
              model: '',
              installation_date: '',
              additional_info: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            
            return {
              ...outlet,
              prevention_facilities: [...(outlet.prevention_facilities || []), newFacility]
            }
          }
          return outlet
        })
      }
    })
  }

  // 배출구 추가 함수
  const addOutlet = () => {
    if (!permitDetail) return

    const newOutlet = {
      id: `new-outlet-${Date.now()}`,
      air_permit_id: permitDetail.id,
      outlet_number: (permitDetail.outlets?.length || 0) + 1,
      outlet_name: `배출구 ${(permitDetail.outlets?.length || 0) + 1}`,
      discharge_facilities: [],
      prevention_facilities: [],
      additional_info: { gateway: '' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    setPermitDetail(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        outlets: [...(prev.outlets || []), newOutlet]
      }
    })
  }

  // 기본정보 필드 변경 핸들러
  const handleBasicInfoChange = (field: string, value: string) => {
    setPermitDetail(prev => {
      if (!prev) return null;
      
      // additional_info 필드들 처리 (category 등)
      if (field === 'category') {
        return {
          ...prev,
          additional_info: {
            ...prev.additional_info,
            [field]: value
          }
        }
      }
      
      // 직접 필드들 처리
      return {
        ...prev,
        [field]: value
      }
    })
  }

  // 시설 삭제 함수들
  const deleteFacility = async (outletId: string, facilityType: 'discharge' | 'prevention', facilityId: string) => {
    if (!permitDetail) return

    const confirmMessage = facilityType === 'discharge' ? 
      '이 배출시설을 삭제하시겠습니까?' : 
      '이 방지시설을 삭제하시겠습니까?'
    
    if (!confirm(confirmMessage)) return

    // 낙관적 업데이트: 즉시 UI에서 제거
    setPermitDetail(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        outlets: prev.outlets.map(outlet => {
          if (outlet.id === outletId) {
            if (facilityType === 'discharge') {
              return {
                ...outlet,
                discharge_facilities: outlet.discharge_facilities?.filter(f => f.id !== facilityId) || []
              }
            } else {
              return {
                ...outlet,
                prevention_facilities: outlet.prevention_facilities?.filter(f => f.id !== facilityId) || []
              }
            }
          }
          return outlet
        })
      }
    })

    try {
      // 새로 생성된 시설인 경우 API 호출 스킵
      if (facilityId.startsWith('new-')) return

      // API 호출
      const response = await fetch(`/api/outlet-facility?type=${facilityType}_facility&id=${facilityId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('삭제 실패')
      }
    } catch (error) {
      console.error('시설 삭제 오류:', error)
      // 실패 시 롤백 - 원본 데이터로 복원
      const response = await fetch(`/api/air-permit?id=${urlParams.permitId}`)
      if (response.ok) {
        const data = await response.json()
        setPermitDetail(data.data)
      }
      alert('시설 삭제에 실패했습니다')
    }
  }

  // 배출구 삭제 함수
  const deleteOutlet = async (outletId: string) => {
    if (!permitDetail) return

    if (!confirm('이 배출구와 모든 관련 시설을 삭제하시겠습니까?')) return

    // 낙관적 업데이트: 즉시 UI에서 제거
    setPermitDetail(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        outlets: prev.outlets.filter(outlet => outlet.id !== outletId)
      }
    })

    try {
      // 새로 생성된 배출구인 경우 API 호출 스킵
      if (outletId.startsWith('new-')) return

      // API 호출
      const response = await fetch(`/api/outlet-facility?type=outlet&id=${outletId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('삭제 실패')
      }
    } catch (error) {
      console.error('배출구 삭제 오류:', error)
      // 실패 시 롤백 - 원본 데이터로 복원
      const response = await fetch(`/api/air-permit?id=${urlParams.permitId}`)
      if (response.ok) {
        const data = await response.json()
        setPermitDetail(data.data)
      }
      alert('배출구 삭제에 실패했습니다')
    }
  }

  // PDF 생성 함수 (새로운 버전)
  const generatePDF = async () => {
    if (!permitDetail) {
      return
    }

    try {
      setIsGeneratingPdf(true)

      // API에서 PDF 데이터 가져오기
      const response = await fetch('/api/air-permit-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permitId: permitDetail.id }),
      })

      if (!response.ok) {
        throw new Error(`PDF 데이터 조회 실패: ${response.status}`)
      }

      const responseData = await response.json()
      const { data: pdfData } = responseData

      if (!pdfData) {
        throw new Error('PDF 데이터가 없습니다')
      }

      // 한글 지원 PDF 생성 유틸리티 사용
      const { generateKoreanAirPermitPdf } = await import('@/utils/korean-pdf-generator')
      const pdfBlob = await generateKoreanAirPermitPdf(pdfData)

      // PDF 다운로드
      const businessName = pdfData.permitInfo.businessName || '대기필증'
      const fileName = `대기필증_${businessName}_${new Date().toISOString().split('T')[0]}.pdf`

      const url = window.URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      alert('PDF 다운로드가 완료되었습니다.')

    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert(`PDF 생성 중 오류가 발생했습니다.\n${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // 기존 PDF 생성 함수 (백업용)
  const generatePDFOld = async () => {
    if (!permitDetail) return

    try {
      setIsGeneratingPdf(true)
      
      // 동적 import로 jsPDF와 html2canvas 로드
      const [jsPDF, html2canvas] = await Promise.all([
        import('jspdf').then(module => module.default),
        import('html2canvas').then(module => module.default)
      ])

      // PDF 생성
      const pdf = new jsPDF('l', 'mm', 'a4') // 가로 방향, A4
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      let yPosition = 20

      // 제목
      pdf.setFontSize(18)
      pdf.setFont('helvetica', 'bold')
      const businessName = permitDetail.business?.business_name || permitDetail.additional_info?.business_name || '대기필증'
      pdf.text(`배출구 시설정보 - ${businessName}`, 20, yPosition)
      yPosition += 15

      // 기본 정보
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`업종: ${permitDetail.business_type || '-'}`, 20, yPosition)
      yPosition += 8
      // pdf.text(`최초신고일: ${permitDetail.first_report_date ? new Date(permitDetail.first_report_date).toLocaleDateString('ko-KR') : '-'}`, 20, yPosition)
      yPosition += 8
      // pdf.text(`가동개시일: ${permitDetail.operation_start_date ? new Date(permitDetail.operation_start_date).toLocaleDateString('ko-KR') : '-'}`, 20, yPosition)
      yPosition += 15

      // 배출구별 정보
      if (permitDetail.outlets && permitDetail.outlets.length > 0) {
        for (const [outletIndex, outlet] of permitDetail.outlets.entries()) {
          // 페이지 넘김 체크
          if (yPosition > pageHeight - 60) {
            pdf.addPage()
            yPosition = 20
          }

          // 배출구 제목
          pdf.setFontSize(14)
          pdf.setFont('helvetica', 'bold')
          pdf.text(`배출구 #${outlet.outlet_number}${outlet.outlet_name ? ` (${outlet.outlet_name})` : ''}`, 20, yPosition)
          yPosition += 10

          // 게이트웨이 정보
          const gateway = gatewayAssignments[outlet.id]
          const gatewayName = generateGatewayInfo(gateway).name
          pdf.setFontSize(10)
          pdf.setFont('helvetica', 'normal')
          pdf.text(`게이트웨이: ${gatewayName}`, 20, yPosition)
          yPosition += 10

          // 테이블 헤더
          const headers = ['구분', '배출시설', '용량', '수량', '시설번호', '그린링크코드', '메모', '방지시설', '용량', '수량', '시설번호', '그린링크코드', '메모']
          const colWidth = (pageWidth - 40) / headers.length
          
          pdf.setFillColor(240, 240, 240)
          pdf.rect(20, yPosition - 5, pageWidth - 40, 8, 'F')
          
          pdf.setFontSize(8)
          pdf.setFont('helvetica', 'bold')
          headers.forEach((header, index) => {
            pdf.text(header, 22 + (index * colWidth), yPosition)
          })
          yPosition += 8

          // 데이터 행
          const maxRows = Math.max(
            outlet.discharge_facilities?.length || 0,
            outlet.prevention_facilities?.length || 0,
            1
          )

          for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
            if (yPosition > pageHeight - 20) {
              pdf.addPage()
              yPosition = 20
            }

            const dischargeFacility = outlet.discharge_facilities?.[rowIndex]
            const preventionFacility = outlet.prevention_facilities?.[rowIndex]

            pdf.setFontSize(7)
            pdf.setFont('helvetica', 'normal')

            const rowData = [
              (rowIndex + 1).toString(),
              dischargeFacility?.facility_name || '-',
              dischargeFacility?.capacity || '-',
              dischargeFacility?.quantity?.toString() || '-',
              dischargeFacility?.additional_info?.facility_number || '-',
              dischargeFacility?.additional_info?.green_link_code || '-',
              dischargeFacility?.additional_info?.memo || '-',
              preventionFacility?.facility_name || '-',
              preventionFacility?.capacity || '-',
              preventionFacility?.quantity?.toString() || '-',
              preventionFacility?.additional_info?.facility_number || '-',
              preventionFacility?.additional_info?.green_link_code || '-',
              preventionFacility?.additional_info?.memo || '-'
            ]

            rowData.forEach((data, index) => {
              const text = data.length > 10 ? data.substring(0, 10) + '...' : data
              pdf.text(text, 22 + (index * colWidth), yPosition)
            })

            yPosition += 6

            // 구분선
            pdf.setDrawColor(200, 200, 200)
            pdf.line(20, yPosition, pageWidth - 20, yPosition)
            yPosition += 2
          }

          yPosition += 10
        }
      } else {
        pdf.text('등록된 배출구가 없습니다.', 20, yPosition)
      }

      // 생성 시간 추가
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`생성일시: ${new Date().toLocaleString('ko-KR')}`, pageWidth - 80, pageHeight - 10)

      // PDF 다운로드
      const fileName = `배출구정보_${businessName}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)

    } catch (error) {
      console.error('PDF 생성 중 오류:', error)
      alert('PDF 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  if (loading || !isInitialized) {
    return (
      <AdminLayout title={urlParams.mode?.includes('create') ? '새 대기필증 추가' : '대기필증 상세보기'} description="로딩 중...">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </AdminLayout>
    )
  }

  if (!permitDetail) {
    return (
      <AdminLayout title={urlParams.mode?.includes('create') ? '새 대기필증 추가' : '대기필증 상세보기'} description={urlParams.mode?.includes('create') ? '대기필증을 추가합니다' : '대기필증을 찾을 수 없습니다'}>
        <div className="text-center py-12">
          <div className="text-red-500">대기필증을 찾을 수 없습니다</div>
          <button
            onClick={() => router.push('/admin/air-permit')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            목록으로 돌아가기
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title={urlParams.mode?.includes('create') ? '새 대기필증 추가' : `필증보기 - ${permitDetail.business?.business_name || '대기필증'}`}
      description={urlParams.mode?.includes('create') ? '새로운 대기필증을 추가합니다' : `업종: ${permitDetail.business_type || '-'} | 배출구 ${permitDetail.outlets?.length || 0}개`}
      actions={(
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/admin/air-permit')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </button>
          
          {/* PDF 출력 버튼 */}
          <button
            onClick={generatePDF}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
          >
            <FileDown className="w-4 h-4" />
            {isGeneratingPdf ? 'PDF 생성 중...' : 'PDF 출력'}
          </button>

          {/* 항상 편집모드이므로 저장 버튼만 표시 */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}
    >
      {/* 대기필증 기본 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <span className="text-sm text-gray-500">사업장명</span>
            <div className="font-medium">
              {permitDetail.business?.business_name || 
               permitDetail.additional_info?.business_name || '-'}
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">업종</span>
            <input
              type="text"
              value={permitDetail.business_type || ''}
              onChange={(e) => handleBasicInfoChange('business_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              placeholder="업종을 입력하세요"
            />
          </div>
          <div>
            <span className="text-sm text-gray-500">종별</span>
            <input
              type="text"
              value={permitDetail.additional_info?.category || ''}
              onChange={(e) => handleBasicInfoChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              placeholder="종별을 입력하세요"
            />
          </div>
          <div>
            <span className="text-sm text-gray-500">최초신고일</span>
            <input
              type="date"
              value={permitDetail.first_report_date || ''}
              onChange={(e) => handleBasicInfoChange('first_report_date', e.target.value)}
              min="1000-01-01"
              max="9999-12-31"
              onInput={(e) => {
                const input = e.target as HTMLInputElement
                const value = input.value
                if (value) {
                  const year = parseInt(value.split('-')[0])
                  if (year < 1000 || year > 9999) {
                    input.setCustomValidity('연도는 4자리 숫자(1000-9999)로 입력해주세요')
                  } else {
                    input.setCustomValidity('')
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            />
          </div>
          <div>
            <span className="text-sm text-gray-500">가동개시일</span>
            <input
              type="date"
              value={permitDetail.operation_start_date || ''}
              onChange={(e) => handleBasicInfoChange('operation_start_date', e.target.value)}
              min="1000-01-01"
              max="9999-12-31"
              onInput={(e) => {
                const input = e.target as HTMLInputElement
                const value = input.value
                if (value) {
                  const year = parseInt(value.split('-')[0])
                  if (year < 1000 || year > 9999) {
                    input.setCustomValidity('연도는 4자리 숫자(1000-9999)로 입력해주세요')
                  } else {
                    input.setCustomValidity('')
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            />
          </div>
        </div>
      </div>

      {/* 배출구별 시설 정보 테이블 */}
      <div className="space-y-6">
        {permitDetail.outlets?.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Factory className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <div className="text-gray-500 mb-2 font-medium">등록된 배출구가 없습니다</div>
            <div className="text-sm text-gray-400">
              배출구와 시설 정보를 추가해주세요
            </div>
          </div>
        ) : (
          permitDetail.outlets?.map((outlet) => {
            // ✅ 편집 중일 때는 gatewayAssignments state 우선, 저장 후에는 DB 데이터(outlet.additional_info.gateway) 우선
            // ?? (nullish coalescing) 사용으로 빈 문자열('')도 정상 처리
            const currentGateway = isEditing
              ? (gatewayAssignments[outlet.id] ?? outlet.additional_info?.gateway ?? '')
              : (outlet.additional_info?.gateway ?? gatewayAssignments[outlet.id] ?? '')
            const gatewayColor = getGatewayColorClass(currentGateway)

            return (
              <div
                key={outlet.id}
                className={`rounded-xl shadow-sm border-2 p-6 ${gatewayColor} border-opacity-50`}
              >
                {/* 배출구 헤더 */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold">
                      배출구 #{outlet.outlet_number}
                    </h2>
                    {outlet.outlet_name && (
                      <span className="text-gray-600">({fixKoreanText(outlet.outlet_name)})</span>
                    )}
                    {/* 게이트웨이 정보 항상 표시 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">게이트웨이:</span>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${gatewayColor}`}>
                        {generateGatewayInfo(currentGateway).name}
                      </span>
                    </div>
                  </div>

                  {/* 게이트웨이 할당 및 배출구 삭제 버튼 */}
                  {isEditing && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">게이트웨이:</span>
                      <select
                        value={currentGateway}
                        onChange={(e) => handleGatewayChange(outlet.id, e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        {generateGatewayOptions(gatewayAssignments).map((gw) => (
                          <option key={gw.value} value={gw.value}>
                            {gw.name}
                          </option>
                        ))}
                      </select>
                      
                      {/* 배출구 삭제 버튼 */}
                      <button
                        type="button"
                        onClick={() => deleteOutlet(outlet.id)}
                        className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        title="배출구 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 시설 정보 테이블 - 데스크톱 전용 */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 bg-white rounded-lg table-fixed min-w-[1400px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-1.5 py-2 text-center font-semibold text-gray-700 text-xs w-[50px]">구분</th>
                        <th className="border border-gray-300 px-1.5 py-1.5 text-left font-semibold text-gray-700 text-xs w-[140px]">배출시설</th>
                        <th className="border border-gray-300 px-1.5 py-1.5 text-left font-semibold text-gray-700 text-xs w-[100px]">용량</th>
                        <th className="border border-gray-300 px-1.5 py-2 text-center font-semibold text-gray-700 text-xs w-[60px]">수량</th>
                        <th className="border border-gray-300 px-1.5 py-1.5 text-left font-semibold text-gray-700 text-xs w-[100px]">시설번호</th>
                        <th className="border border-gray-300 px-1.5 py-1.5 text-left font-semibold text-gray-700 text-xs w-[120px]">그린링크</th>
                        <th className="border border-gray-300 px-1.5 py-1.5 text-left font-semibold text-gray-700 text-xs w-[120px]">메모</th>
                        {isEditing && <th className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700 text-xs w-[40px]">삭제</th>}
                        <th className="border border-gray-300 px-1.5 py-1.5 text-left font-semibold text-gray-700 text-xs w-[140px]">방지시설</th>
                        <th className="border border-gray-300 px-1.5 py-1.5 text-left font-semibold text-gray-700 text-xs w-[100px]">용량</th>
                        <th className="border border-gray-300 px-1.5 py-2 text-center font-semibold text-gray-700 text-xs w-[60px]">수량</th>
                        <th className="border border-gray-300 px-1.5 py-1.5 text-left font-semibold text-gray-700 text-xs w-[100px]">시설번호</th>
                        <th className="border border-gray-300 px-1.5 py-1.5 text-left font-semibold text-gray-700 text-xs w-[120px]">그린링크</th>
                        <th className="border border-gray-300 px-1.5 py-1.5 text-left font-semibold text-gray-700 text-xs w-[120px]">메모</th>
                        {isEditing && <th className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700 text-xs w-[40px]">삭제</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {/* 배출시설과 방지시설을 한 테이블에 표시 */}
                      {(() => {
                        const maxRows = Math.max(
                          outlet.discharge_facilities?.length || 0,
                          outlet.prevention_facilities?.length || 0,
                          1 // 최소 1행은 표시
                        )
                        
                        return Array.from({ length: maxRows }, (_, rowIndex) => {
                          const dischargeFacility = outlet.discharge_facilities?.[rowIndex]
                          const preventionFacility = outlet.prevention_facilities?.[rowIndex]
                          
                          return (
                            <tr key={rowIndex} className="hover:bg-gray-50">
                              {/* 구분 */}
                              <td className="border border-gray-300 px-1.5 py-1.5 text-center text-xs font-medium text-gray-600">
                                {rowIndex + 1}
                              </td>

                              {/* 배출시설 정보 */}
                              <td className="border border-gray-300 px-1.5 py-1.5">
                                {dischargeFacility ? (
                                  isEditing ? (
                                    <input
                                      type="text"
                                      lang="ko"
                                      inputMode="text"
                                      value={dischargeFacility.facility_name}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'facility_name', e.target.value)}
                                      className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-xs">{dischargeFacility.facility_name}</span>
                                  )
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-1.5 py-1.5">
                                {dischargeFacility ? (
                                  isEditing ? (
                                    <input
                                      type="text"
                                      value={dischargeFacility.capacity || ''}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'capacity', e.target.value)}
                                      className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-xs">{dischargeFacility.capacity || '-'}</span>
                                  )
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-1.5 py-1.5 text-center">
                                {dischargeFacility ? (
                                  isEditing ? (
                                    <input
                                      type="number"
                                      min="1"
                                      value={dischargeFacility.quantity}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'quantity', parseInt(e.target.value) || 1)}
                                      className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-center"
                                    />
                                  ) : (
                                    <span className="text-xs">{dischargeFacility.quantity}</span>
                                  )
                                ) : '-'}
                              </td>
                              
                              {/* 배출시설 추가 정보 */}
                              <td className="border border-gray-300 px-1.5 py-1.5">
                                {dischargeFacility ? (
                                  <div className="flex items-center gap-1">
                                    {/* 자동 생성 시설번호 */}
                                    {(() => {
                                      if (!facilityNumbering) return null
                                      const facilityNumber = getFacilityNumber(facilityNumbering, dischargeFacility.id, 0)
                                      if (!facilityNumber) return null

                                      const facilityNumbers = facilityNumbering.outlets
                                        .find(o => o.outletId === outlet.id)?.dischargeFacilities
                                        .filter(f => f.facilityId === dischargeFacility.id)
                                        .map(f => f.displayNumber) || []

                                      const rangeDisplay = facilityNumbers.length === 1
                                        ? facilityNumbers[0]
                                        : facilityNumbers.length > 1
                                          ? `${facilityNumbers[0]}-${facilityNumbers[facilityNumbers.length - 1]}`
                                          : null

                                      return rangeDisplay ? (
                                        <div className="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded whitespace-nowrap">
                                          {rangeDisplay}
                                        </div>
                                      ) : null
                                    })()}

                                    {/* 수동 입력 시설번호 */}
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={dischargeFacility.additional_info?.facility_number || ''}
                                        onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'facility_number', e.target.value)}
                                        placeholder="시설번호"
                                        className="flex-1 px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                      />
                                    ) : (
                                      dischargeFacility.additional_info?.facility_number && (
                                        <div className="text-xs text-gray-600">
                                          {dischargeFacility.additional_info.facility_number}
                                        </div>
                                      )
                                    )}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-1.5 py-1.5">
                                {dischargeFacility && isEditing ? (
                                  <input
                                    type="text"
                                    value={dischargeFacility.additional_info?.green_link_code ?? ''}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'green_link_code', e.target.value)}
                                    placeholder="그린링크"
                                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="text-xs">{dischargeFacility?.additional_info?.green_link_code || '-'}</span>
                                )}
                              </td>
                              <td className="border border-gray-300 px-1.5 py-1.5">
                                {dischargeFacility && isEditing ? (
                                  <input
                                    type="text"
                                    value={dischargeFacility.additional_info?.memo || ''}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'memo', e.target.value)}
                                    placeholder="메모"
                                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="text-xs truncate block max-w-[100px]" title={dischargeFacility?.additional_info?.memo || ''}>{dischargeFacility?.additional_info?.memo || '-'}</span>
                                )}
                              </td>
                              
                              {/* 배출시설 삭제 버튼 */}
                              {isEditing && (
                                <td className="border border-gray-300 px-1.5 py-1.5 text-center">
                                  {dischargeFacility && (
                                    <button
                                      type="button"
                                      onClick={() => deleteFacility(outlet.id, 'discharge', dischargeFacility.id)}
                                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                      title="배출시설 삭제"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </td>
                              )}

                              {/* 방지시설 정보 */}
                              <td className="border border-gray-300 px-1.5 py-1.5">
                                {preventionFacility ? (
                                  isEditing ? (
                                    <input
                                      type="text"
                                      lang="ko"
                                      inputMode="text"
                                      value={preventionFacility.facility_name}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'facility_name', e.target.value)}
                                      className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-xs">{preventionFacility.facility_name}</span>
                                  )
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-1.5 py-1.5">
                                {preventionFacility ? (
                                  isEditing ? (
                                    <input
                                      type="text"
                                      value={preventionFacility.capacity || ''}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'capacity', e.target.value)}
                                      className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-xs">{preventionFacility.capacity || '-'}</span>
                                  )
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-1.5 py-1.5 text-center">
                                {preventionFacility ? (
                                  isEditing ? (
                                    <input
                                      type="number"
                                      min="1"
                                      value={preventionFacility.quantity}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'quantity', parseInt(e.target.value) || 1)}
                                      className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-center"
                                    />
                                  ) : (
                                    <span className="text-xs">{preventionFacility.quantity}</span>
                                  )
                                ) : '-'}
                              </td>
                              
                              {/* 방지시설 추가 정보 */}
                              <td className="border border-gray-300 px-1.5 py-1.5">
                                {preventionFacility ? (
                                  <div className="flex items-center gap-1">
                                    {/* 자동 생성 시설번호 */}
                                    {(() => {
                                      if (!facilityNumbering) return null
                                      const facilityNumber = getFacilityNumber(facilityNumbering, preventionFacility.id, 0)
                                      if (!facilityNumber) return null

                                      const facilityNumbers = facilityNumbering.outlets
                                        .find(o => o.outletId === outlet.id)?.preventionFacilities
                                        .filter(f => f.facilityId === preventionFacility.id)
                                        .map(f => f.displayNumber) || []

                                      const rangeDisplay = facilityNumbers.length === 1
                                        ? facilityNumbers[0]
                                        : facilityNumbers.length > 1
                                          ? `${facilityNumbers[0]}-${facilityNumbers[facilityNumbers.length - 1]}`
                                          : null

                                      return rangeDisplay ? (
                                        <div className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded whitespace-nowrap">
                                          {rangeDisplay}
                                        </div>
                                      ) : null
                                    })()}

                                    {/* 수동 입력 시설번호 */}
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={preventionFacility.additional_info?.facility_number || ''}
                                        onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'facility_number', e.target.value)}
                                        placeholder="시설번호"
                                        className="flex-1 px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                      />
                                    ) : (
                                      preventionFacility.additional_info?.facility_number && (
                                        <div className="text-xs text-gray-600">
                                          {preventionFacility.additional_info.facility_number}
                                        </div>
                                      )
                                    )}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-1.5 py-1.5">
                                {preventionFacility && isEditing ? (
                                  <input
                                    type="text"
                                    value={preventionFacility.additional_info?.green_link_code ?? ''}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'green_link_code', e.target.value)}
                                    placeholder="그린링크"
                                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="text-xs">{preventionFacility?.additional_info?.green_link_code || '-'}</span>
                                )}
                              </td>
                              <td className="border border-gray-300 px-1.5 py-1.5">
                                {preventionFacility && isEditing ? (
                                  <input
                                    type="text"
                                    value={preventionFacility.additional_info?.memo || ''}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'memo', e.target.value)}
                                    placeholder="메모"
                                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="text-xs truncate block max-w-[100px]" title={preventionFacility?.additional_info?.memo || ''}>{preventionFacility?.additional_info?.memo || '-'}</span>
                                )}
                              </td>
                              
                              {/* 방지시설 삭제 버튼 */}
                              {isEditing && (
                                <td className="border border-gray-300 px-1.5 py-1.5 text-center">
                                  {preventionFacility && (
                                    <button
                                      type="button"
                                      onClick={() => deleteFacility(outlet.id, 'prevention', preventionFacility.id)}
                                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                      title="방지시설 삭제"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* 모바일 카드 레이아웃 */}
                <div className="lg:hidden space-y-4">
                  {/* 배출시설 섹션 */}
                  {outlet.discharge_facilities && outlet.discharge_facilities.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-red-700 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        배출시설
                      </h4>
                      <div className="space-y-3">
                        {outlet.discharge_facilities.map((facility, idx) => (
                          <div key={facility.id} className="bg-white rounded-lg p-3 shadow-sm border border-red-100">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">배{idx + 1}</span>
                                {(() => {
                                  if (!facilityNumbering) return null
                                  const facilityNumbers = facilityNumbering.outlets
                                    .find(o => o.outletId === outlet.id)?.dischargeFacilities
                                    .filter(f => f.facilityId === facility.id)
                                    .map(f => f.displayNumber) || []
                                  const rangeDisplay = facilityNumbers.length === 1
                                    ? facilityNumbers[0]
                                    : facilityNumbers.length > 1
                                      ? `${facilityNumbers[0]}-${facilityNumbers[facilityNumbers.length - 1]}`
                                      : null
                                  return rangeDisplay ? (
                                    <span className="text-xs font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded">{rangeDisplay}</span>
                                  ) : null
                                })()}
                              </div>
                              {isEditing && (
                                <button
                                  type="button"
                                  onClick={() => deleteFacility(outlet.id, 'discharge', facility.id)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={facility.facility_name}
                                  onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', facility.id, 'facility_name', e.target.value)}
                                  placeholder="시설명"
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={facility.capacity || ''}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', facility.id, 'capacity', e.target.value)}
                                    placeholder="용량"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                  />
                                  <input
                                    type="number"
                                    min="1"
                                    value={facility.quantity}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', facility.id, 'quantity', parseInt(e.target.value) || 1)}
                                    placeholder="수량"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded text-center"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={facility.additional_info?.facility_number || ''}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', facility.id, 'facility_number', e.target.value)}
                                    placeholder="시설번호"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                  />
                                  <input
                                    type="text"
                                    value={facility.additional_info?.green_link_code ?? ''}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', facility.id, 'green_link_code', e.target.value)}
                                    placeholder="그린링크"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={facility.additional_info?.memo || ''}
                                  onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', facility.id, 'memo', e.target.value)}
                                  placeholder="메모"
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-900">{facility.facility_name}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                                  <span>용량: {facility.capacity || '-'}</span>
                                  <span>수량: {facility.quantity}</span>
                                </div>
                                {(facility.additional_info?.facility_number || facility.additional_info?.green_link_code) && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                                    {facility.additional_info?.facility_number && <span>시설번호: {facility.additional_info.facility_number}</span>}
                                    {facility.additional_info?.green_link_code && <span>그린링크: {facility.additional_info.green_link_code}</span>}
                                  </div>
                                )}
                                {facility.additional_info?.memo && (
                                  <p className="text-xs text-gray-500 mt-1">메모: {facility.additional_info.memo}</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 방지시설 섹션 */}
                  {outlet.prevention_facilities && outlet.prevention_facilities.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        방지시설
                      </h4>
                      <div className="space-y-3">
                        {outlet.prevention_facilities.map((facility, idx) => (
                          <div key={facility.id} className="bg-white rounded-lg p-3 shadow-sm border border-blue-100">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">방{idx + 1}</span>
                                {(() => {
                                  if (!facilityNumbering) return null
                                  const facilityNumbers = facilityNumbering.outlets
                                    .find(o => o.outletId === outlet.id)?.preventionFacilities
                                    .filter(f => f.facilityId === facility.id)
                                    .map(f => f.displayNumber) || []
                                  const rangeDisplay = facilityNumbers.length === 1
                                    ? facilityNumbers[0]
                                    : facilityNumbers.length > 1
                                      ? `${facilityNumbers[0]}-${facilityNumbers[facilityNumbers.length - 1]}`
                                      : null
                                  return rangeDisplay ? (
                                    <span className="text-xs font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">{rangeDisplay}</span>
                                  ) : null
                                })()}
                              </div>
                              {isEditing && (
                                <button
                                  type="button"
                                  onClick={() => deleteFacility(outlet.id, 'prevention', facility.id)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={facility.facility_name}
                                  onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', facility.id, 'facility_name', e.target.value)}
                                  placeholder="시설명"
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={facility.capacity || ''}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', facility.id, 'capacity', e.target.value)}
                                    placeholder="용량"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                  />
                                  <input
                                    type="number"
                                    min="1"
                                    value={facility.quantity}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', facility.id, 'quantity', parseInt(e.target.value) || 1)}
                                    placeholder="수량"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded text-center"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={facility.additional_info?.facility_number || ''}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', facility.id, 'facility_number', e.target.value)}
                                    placeholder="시설번호"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                  />
                                  <input
                                    type="text"
                                    value={facility.additional_info?.green_link_code ?? ''}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', facility.id, 'green_link_code', e.target.value)}
                                    placeholder="그린링크"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={facility.additional_info?.memo || ''}
                                  onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', facility.id, 'memo', e.target.value)}
                                  placeholder="메모"
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-900">{facility.facility_name}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                                  <span>용량: {facility.capacity || '-'}</span>
                                  <span>수량: {facility.quantity}</span>
                                </div>
                                {(facility.additional_info?.facility_number || facility.additional_info?.green_link_code) && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                                    {facility.additional_info?.facility_number && <span>시설번호: {facility.additional_info.facility_number}</span>}
                                    {facility.additional_info?.green_link_code && <span>그린링크: {facility.additional_info.green_link_code}</span>}
                                  </div>
                                )}
                                {facility.additional_info?.memo && (
                                  <p className="text-xs text-gray-500 mt-1">메모: {facility.additional_info.memo}</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 시설이 없을 때 표시 */}
                  {(!outlet.discharge_facilities || outlet.discharge_facilities.length === 0) &&
                   (!outlet.prevention_facilities || outlet.prevention_facilities.length === 0) && (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      등록된 시설이 없습니다
                    </div>
                  )}
                </div>

                {/* 시설 추가 버튼 (편집모드에서만) */}
                {isEditing && (
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => addDischargeFacility(outlet.id)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      배출시설 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => addPreventionFacility(outlet.id)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      방지시설 추가
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
        
        {/* 배출구 추가 버튼 (편집모드에서만) */}
        {isEditing && (
          <div className="mt-6">
            <button
              type="button"
              onClick={addOutlet}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              배출구 추가
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default function AirPermitDetailPage() {
  return (
    <Suspense fallback={
      <AdminLayout title="대기필증 상세 관리">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">로딩 중...</p>
          </div>
        </div>
      </AdminLayout>
    }>
      <AirPermitDetailContent />
    </Suspense>
  )
}