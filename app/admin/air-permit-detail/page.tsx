// app/admin/air-permit-detail/page.tsx - 대기필증 상세보기 페이지
'use client'

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react'
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
    permitId: searchParams.get('permitId'),
    mode: searchParams.get('mode')
  }))
  
  console.log('🔧 [DEBUG] AirPermitDetailContent 렌더링:', urlParams)
  
  const [permitDetail, setPermitDetail] = useState<AirPermitWithOutlets | null>(null)
  const [originalPermitDetail, setOriginalPermitDetail] = useState<AirPermitWithOutlets | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedFacilities, setEditedFacilities] = useState<{[key: string]: any}>({})
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
    const newPermitId = searchParams.get('permitId')
    const newMode = searchParams.get('mode')
    
    // 실제로 변경된 경우에만 업데이트 (무한 리로드 방지)
    if (newPermitId !== urlParams.permitId || newMode !== urlParams.mode) {
      setUrlParams({ permitId: newPermitId, mode: newMode })
    }
  }, [searchParams, urlParams.permitId, urlParams.mode]) // 의존성 명시적 추가

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

  // 시설 정보 편집 (실시간 반영 최적화)
  const handleFacilityEdit = useCallback((outletId: string, facilityType: 'discharge' | 'prevention', facilityId: string, field: string, value: any) => {
    const key = `${outletId}_${facilityType}_${facilityId}`
    console.log('🔧 [DEBUG] handleFacilityEdit 호출:', { outletId, facilityType, facilityId, field, value, key })
    
    // Optimistic Update: 즈시 UI에 반영
    setPermitDetail(prev => {
      if (!prev) return null
      
      return {
        ...prev,
        outlets: prev.outlets.map(outlet => {
          if (outlet.id === outletId) {
            const facilitiesKey = facilityType === 'discharge' ? 'discharge_facilities' : 'prevention_facilities'
            const updatedFacilities = outlet[facilitiesKey]?.map(facility => {
              if (facility.id === facilityId) {
                return {
                  ...facility,
                  [field]: value
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
    
    // 변경사항 추적
    setEditedFacilities(prev => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value
        }
      }
      console.log('📊 [DEBUG] editedFacilities 업데이트:', updated)
      return updated
    })
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

  // 변경사항 저장
  const handleSave = async () => {
    try {
      console.log('💾 handleSave 함수 시작')
      console.log('📊 현재 gatewayAssignments:', gatewayAssignments)
      
      setIsSaving(true)
      
      // 낙관적 업데이트: 즉시 UI에 변경사항 반영
      const updatedPermitDetail = { ...permitDetail }

      if (updatedPermitDetail && updatedPermitDetail.outlets) {
        updatedPermitDetail.outlets = updatedPermitDetail.outlets.map(outlet => {
          const updatedOutlet = { ...outlet }
          
          // 게이트웨이 할당 업데이트 (빈 문자열도 포함)
          if (gatewayAssignments.hasOwnProperty(outlet.id)) {
            updatedOutlet.additional_info = {
              ...updatedOutlet.additional_info,
              gateway: gatewayAssignments[outlet.id]
            }
          }
          
          // 시설 정보 업데이트
          if (updatedOutlet.discharge_facilities) {
            updatedOutlet.discharge_facilities = updatedOutlet.discharge_facilities.map(facility => {
              const key = `${outlet.id}_discharge_${facility.id}`
              return editedFacilities[key] ? { ...facility, ...editedFacilities[key] } : facility
            })
          }
          
          if (updatedOutlet.prevention_facilities) {
            updatedOutlet.prevention_facilities = updatedOutlet.prevention_facilities.map(facility => {
              const key = `${outlet.id}_prevention_${facility.id}`
              return editedFacilities[key] ? { ...facility, ...editedFacilities[key] } : facility
            })
          }
          
          return updatedOutlet
        })
      }

      // 즉시 UI 업데이트
      if (updatedPermitDetail && updatedPermitDetail.outlets) {
        setPermitDetail(updatedPermitDetail as AirPermitWithOutlets)
      }
      setIsEditing(false)
      
      // API 호출들
      const apiCalls: Promise<any>[] = []
      
      // 편집 모드인지 확인 (기존 대기필증인지 새 대기필증인지 구분)
      const isEditMode = permitDetail?.id && !permitDetail.id.startsWith('new-') && permitDetail.id !== 'new'
      
      // 새로 추가된 배출구가 있으면 생성 (편집 모드에서도 실행)
      const newOutlets = updatedPermitDetail.outlets?.filter(outlet => 
        outlet.id.startsWith('new-outlet-')
      ) || []
      
      if (newOutlets.length > 0) {
        console.log(`🆕 새 배출구 생성 모드 - ${newOutlets.length}개 배출구/시설 생성 시작`)
        
        // 1. 새로 추가된 배출구들을 순차적으로 생성하고 실제 ID 맵핑
        
        const outletIdMapping: Record<string, string> = {} // 임시ID -> 실제ID 맵핑
        
        for (const outlet of newOutlets) {
          try {
            const response = await fetch('/api/outlet-facility', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'outlet',
                air_permit_id: permitDetail?.id,
                outlet_number: outlet.outlet_number,
                outlet_name: outlet.outlet_name,
                additional_info: outlet.additional_info
              })
            })
            
            if (response.ok) {
              const result = await response.json()
              if (result.data?.id) {
                outletIdMapping[outlet.id] = result.data.id
                console.log(`✅ 배출구 생성 완료: ${outlet.id} -> ${result.data.id}`)
              }
            }
          } catch (error) {
            console.error(`❌ 배출구 생성 실패: ${outlet.id}`, error)
          }
        }
        
        // 2. 새로 추가된 시설들 생성
        updatedPermitDetail.outlets?.forEach(outlet => {
          // 새로 추가된 배출시설들
          const newDischargeFacilities = outlet.discharge_facilities?.filter(facility => 
            facility.id.startsWith('new-discharge-')
          ) || []
          
          newDischargeFacilities.forEach(facility => {
            // 실제 배출구 ID 사용 (새 배출구인 경우 맵핑된 ID 사용)
            const actualOutletId = outlet.id.startsWith('new-outlet-') 
              ? outletIdMapping[outlet.id] 
              : outlet.id
              
            // 실제 배출구 ID가 있는 경우에만 시설 생성
            if (actualOutletId) {
              apiCalls.push(
                fetch('/api/outlet-facility', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'discharge_facility',
                    outlet_id: actualOutletId,
                    facility_name: facility.facility_name,
                    capacity: facility.capacity,
                    quantity: facility.quantity,
                    additional_info: facility.additional_info
                  })
                })
              )
            } else {
              console.warn(`⚠️ 배출시설 생성 스킵: 배출구 ID를 찾을 수 없음 (${outlet.id})`)
            }
        })
        
        // 새로 추가된 방지시설들
        const newPreventionFacilities = outlet.prevention_facilities?.filter(facility => 
          facility.id.startsWith('new-prevention-')
        ) || []
        
        newPreventionFacilities.forEach(facility => {
          // 실제 배출구 ID 사용 (새 배출구인 경우 맵핑된 ID 사용)
          const actualOutletId = outlet.id.startsWith('new-outlet-') 
            ? outletIdMapping[outlet.id] 
            : outlet.id
            
          // 실제 배출구 ID가 있는 경우에만 시설 생성
          if (actualOutletId) {
            apiCalls.push(
              fetch('/api/outlet-facility', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'prevention_facility',
                  outlet_id: actualOutletId,
                  facility_name: facility.facility_name,
                  capacity: facility.capacity,
                  quantity: facility.quantity,
                  additional_info: facility.additional_info
                })
              })
            )
          } else {
            console.warn(`⚠️ 방지시설 생성 스킵: 배출구 ID를 찾을 수 없음 (${outlet.id})`)
          }
        })
      })
      }
      
      // 3. 기존 시설 정보 업데이트 (편집 모드에서도 실행)
      console.log('🔧 편집된 시설 정보 업데이트 시작')
      console.log('📊 editedFacilities:', editedFacilities)
      console.log('📊 editedFacilities 항목 수:', Object.keys(editedFacilities).length)
      
      if (Object.keys(editedFacilities).length === 0) {
        console.log('⚠️ [DEBUG] editedFacilities가 비어있습니다 - 시설 편집이 감지되지 않았습니다')
      }
      
      for (const [key, updates] of Object.entries(editedFacilities)) {
        const [outletId, facilityType, facilityId] = key.split('_')
        
        console.log(`🔧 시설 업데이트 처리: ${key}`, { outletId, facilityType, facilityId, updates })
        
        // 새로 생성된 시설은 스킵 (이미 위에서 처리됨)
        if (facilityId.startsWith('new-')) {
          console.log(`⏭️ 새 시설이므로 스킵: ${facilityId}`)
          continue
        }
        
        // 데이터를 적절한 구조로 변환 (additional_info에 들어가야 할 필드들 분리)
        const additionalInfoFields = ['green_link_code', 'facility_number', 'memo']
        const directFields = ['facility_name', 'capacity', 'quantity']
        
        const updateData: any = {}
        const additionalInfo: any = {}
        
        // 기존 additional_info 가져오기 (현재 시설에서)
        const currentFacility = updatedPermitDetail.outlets
          ?.find(o => o.id === outletId)
          ?.[facilityType === 'discharge' ? 'discharge_facilities' : 'prevention_facilities']
          ?.find((f: any) => f.id === facilityId)
        
        if (currentFacility?.additional_info) {
          Object.assign(additionalInfo, currentFacility.additional_info)
        }
        
        // 업데이트된 필드들을 적절한 곳에 배치
        for (const [field, value] of Object.entries(updates)) {
          if (additionalInfoFields.includes(field)) {
            additionalInfo[field] = value
          } else if (directFields.includes(field)) {
            updateData[field] = value
          }
        }
        
        // additional_info가 업데이트된 경우에만 포함
        if (Object.keys(additionalInfo).length > 0) {
          updateData.additional_info = additionalInfo
        }
        
        console.log(`✅ 기존 시설 업데이트 API 호출: ${facilityType} 시설 ${facilityId}`)
        console.log(`🔍 변환된 업데이트 데이터:`, updateData)
        
        apiCalls.push(
          fetch(`/api/outlet-facility`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: facilityType === 'discharge' ? 'discharge_facility' : 'prevention_facility',
              id: facilityId,
              ...updateData
            })
          })
        )
      }
      
      // 4. 기존 배출구 업데이트 (게이트웨이 할당 등) - 편집 모드에서도 실행
      const existingOutlets = updatedPermitDetail.outlets?.filter(outlet => 
        !outlet.id.startsWith('new-outlet-')
      ) || []
      
      console.log('🔧 기존 배출구 업데이트 단계')
      console.log('📋 existingOutlets 개수:', existingOutlets.length)
      console.log('📋 existingOutlets:', existingOutlets.map(o => ({ id: o.id, gateway: o.additional_info?.gateway })))
      
      existingOutlets.forEach(outlet => {
        // 게이트웨이 할당이 실제로 변경된 경우에만 업데이트
        // 원본 데이터에서 현재 게이트웨이 값을 가져와야 함 (updatedPermitDetail이 아닌 permitDetail에서)
        const originalOutlet = permitDetail?.outlets?.find(o => o.id === outlet.id)
        const originalGateway = originalOutlet?.additional_info?.gateway || ''
        const newGateway = gatewayAssignments[outlet.id] || ''
        const hasChanges = gatewayAssignments.hasOwnProperty(outlet.id) && originalGateway !== newGateway
        
        console.log(`🔍 게이트웨이 변경 검사 - 배출구 ${outlet.id}:`, {
          originalOutlet: originalOutlet?.additional_info?.gateway,
          originalGateway,
          newGateway,
          hasProperty: gatewayAssignments.hasOwnProperty(outlet.id),
          hasChanges
        })
        
        if (hasChanges) {
          apiCalls.push(
            fetch('/api/outlet-facility', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'outlet',
                id: outlet.id,
                additional_info: {
                  ...outlet.additional_info,
                  gateway: gatewayAssignments[outlet.id]
                }
              })
            })
          )
        }
      })
      
      // 5. 기본 정보 업데이트 또는 새 대기필증 생성
      if (permitDetail?.id && !permitDetail.id.startsWith('new-')) {
        // 기존 대기필증 편집: 기본 정보만 업데이트
        const basicInfoUpdate = {
          id: permitDetail.id,
          business_type: updatedPermitDetail.business_type,
          additional_info: {
            ...updatedPermitDetail.additional_info
          }
          // outlets 필드를 전송하지 않음 - 기존 배출구 데이터 보존
        }
        
        apiCalls.push(
          fetch('/api/air-permit', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(basicInfoUpdate)
          })
        )
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
              facility_name: facility.facility_name,
              capacity: facility.capacity,
              quantity: facility.quantity,
              additional_info: facility.additional_info
            })) || [],
            prevention_facilities: outlet.prevention_facilities?.map(facility => ({
              facility_name: facility.facility_name,
              capacity: facility.capacity,
              quantity: facility.quantity,
              additional_info: facility.additional_info
            })) || []
          })) || []
        }
        
        apiCalls.push(
          fetch('/api/air-permit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPermitData)
          })
        )
        
        console.log('🆕 새 대기필증 생성 데이터:', newPermitData)
      }
      
      // 모든 API 호출 완료 대기
      await Promise.all(apiCalls);
      
      // 성공 시 최신 데이터 다시 로드 (details=true로 시설 정보도 포함)
      const response = await fetch(`/api/air-permit?id=${urlParams.permitId}&details=true`);
      if (response.ok) {
        const data = await response.json();
        setPermitDetail(data.data);
        setOriginalPermitDetail(data.data);
      }
      
      // 상태 정리
      setEditedFacilities({});
      setGatewayAssignments({});
      setIsEditing(false); // 편집 모드 종료
      alert('변경사항이 저장되었습니다');
      
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
    if (!permitDetail) return

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
        throw new Error('PDF 데이터 조회 실패')
      }

      const { data: pdfData } = await response.json()
      
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

      console.log('✅ PDF 생성 및 다운로드 완료')

    } catch (error) {
      console.error('💥 PDF 생성 중 오류:', error)
      alert('PDF 생성 중 오류가 발생했습니다.')
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
          
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditedFacilities({})
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isSaving}
              >
                <X className="w-4 h-4" />
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                <Save className="w-4 h-4" />
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              편집모드
            </button>
          )}
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
            {isEditing ? (
              <input
                type="text"
                value={permitDetail.business_type || ''}
                onChange={(e) => handleBasicInfoChange('business_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="업종을 입력하세요"
              />
            ) : (
              <div className="font-medium">{permitDetail.business_type || '-'}</div>
            )}
          </div>
          <div>
            <span className="text-sm text-gray-500">종별</span>
            {isEditing ? (
              <input
                type="text"
                value={permitDetail.additional_info?.category || ''}
                onChange={(e) => handleBasicInfoChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="종별을 입력하세요"
              />
            ) : (
              <div className="font-medium">{permitDetail.additional_info?.category || '-'}</div>
            )}
          </div>
          {/* 
          <div>
            <span className="text-sm text-gray-500">최초신고일</span>
            {isEditing ? (
              <input
                type="date"
                value={permitDetail.first_report_date || ''}
                onChange={(e) => handleBasicInfoChange('first_report_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            ) : (
              <div className="font-medium">
                {permitDetail.first_report_date ? 
                  new Date(permitDetail.first_report_date).toLocaleDateString('ko-KR') : '-'}
              </div>
            )}
          </div>
          <div>
            <span className="text-sm text-gray-500">가동개시일</span>
            {isEditing ? (
              <input
                type="date"
                value={permitDetail.operation_start_date || ''}
                onChange={(e) => handleBasicInfoChange('operation_start_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            ) : (
              <div className="font-medium">
                {permitDetail.operation_start_date ? 
                  new Date(permitDetail.operation_start_date).toLocaleDateString('ko-KR') : '-'}
              </div>
            )}
          </div>
          */}
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
            const gatewayColor = getGatewayColorClass(gatewayAssignments[outlet.id])
            
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
                      <span className="text-sm text-gray-500">게이트웨이:</span>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${gatewayColor}`}>
                        {generateGatewayInfo(gatewayAssignments[outlet.id]).name}
                      </span>
                    </div>
                  </div>
                  
                  {/* 게이트웨이 할당 및 배출구 삭제 버튼 */}
                  {isEditing && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">게이트웨이:</span>
                      <select
                        value={gatewayAssignments[outlet.id] || ''}
                        onChange={(e) => handleGatewayChange(outlet.id, e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
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

                {/* 시설 정보 테이블 */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 bg-white rounded-lg">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">구분</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">배출시설</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">용량</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">수량</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">시설번호</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">그린링크코드</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">메모</th>
                        {isEditing && <th className="border border-gray-300 px-2 py-3 text-center font-medium text-gray-700">삭제</th>}
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">방지시설</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">용량</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">수량</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">시설번호</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">그린링크코드</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">메모</th>
                        {isEditing && <th className="border border-gray-300 px-2 py-3 text-center font-medium text-gray-700">삭제</th>}
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
                              <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-600">
                                {rowIndex + 1}
                              </td>
                              
                              {/* 배출시설 정보 */}
                              <td className="border border-gray-300 px-2 py-2">
                                {dischargeFacility ? (
                                  isEditing ? (
                                    <input
                                      type="text"
                                      lang="ko"
                                      inputMode="text"
                                      value={editedFacilities[`${outlet.id}_discharge_${dischargeFacility.id}`]?.facility_name ?? dischargeFacility.facility_name}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'facility_name', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-sm">{dischargeFacility.facility_name}</span>
                                  )
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-2 py-2">
                                {dischargeFacility ? (
                                  isEditing ? (
                                    <input
                                      type="text"
                                      value={editedFacilities[`${outlet.id}_discharge_${dischargeFacility.id}`]?.capacity ?? (dischargeFacility.capacity || '')}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'capacity', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-sm">{dischargeFacility.capacity || '-'}</span>
                                  )
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-2 py-2">
                                {dischargeFacility ? (
                                  isEditing ? (
                                    <input
                                      type="number"
                                      min="1"
                                      value={editedFacilities[`${outlet.id}_discharge_${dischargeFacility.id}`]?.quantity ?? dischargeFacility.quantity}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'quantity', parseInt(e.target.value) || 1)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-sm">{dischargeFacility.quantity}</span>
                                  )
                                ) : '-'}
                              </td>
                              
                              {/* 배출시설 추가 정보 */}
                              <td className="border border-gray-300 px-2 py-2">
                                {dischargeFacility ? (
                                  <div className="space-y-1">
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
                                        <div className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                          {rangeDisplay}
                                        </div>
                                      ) : null
                                    })()}
                                    
                                    {/* 수동 입력 시설번호 */}
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={editedFacilities[`${outlet.id}_discharge_${dischargeFacility.id}`]?.facility_number ?? (dischargeFacility.additional_info?.facility_number || '')}
                                        onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'facility_number', e.target.value)}
                                        placeholder="수동 시설번호"
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                      />
                                    ) : (
                                      dischargeFacility.additional_info?.facility_number && (
                                        <div className="text-xs text-gray-600">
                                          수동: {dischargeFacility.additional_info.facility_number}
                                        </div>
                                      )
                                    )}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-2 py-2">
                                {dischargeFacility && isEditing ? (
                                  <input
                                    type="text"
                                    value={editedFacilities[`${outlet.id}_discharge_${dischargeFacility.id}`]?.green_link_code ?? (dischargeFacility.additional_info?.green_link_code || '')}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'green_link_code', e.target.value)}
                                    placeholder="그린링크코드"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="text-sm">{dischargeFacility?.additional_info?.green_link_code || '-'}</span>
                                )}
                              </td>
                              <td className="border border-gray-300 px-2 py-2">
                                {dischargeFacility && isEditing ? (
                                  <textarea
                                    value={editedFacilities[`${outlet.id}_discharge_${dischargeFacility.id}`]?.memo ?? (dischargeFacility.additional_info?.memo || '')}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'memo', e.target.value)}
                                    placeholder="메모"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 resize-none"
                                    rows={1}
                                  />
                                ) : (
                                  <span className="text-sm">{dischargeFacility?.additional_info?.memo || '-'}</span>
                                )}
                              </td>
                              
                              {/* 배출시설 삭제 버튼 */}
                              {isEditing && (
                                <td className="border border-gray-300 px-2 py-2 text-center">
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
                              <td className="border border-gray-300 px-2 py-2">
                                {preventionFacility ? (
                                  isEditing ? (
                                    <input
                                      type="text"
                                      lang="ko"
                                      inputMode="text"
                                      value={editedFacilities[`${outlet.id}_prevention_${preventionFacility.id}`]?.facility_name ?? preventionFacility.facility_name}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'facility_name', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-sm">{preventionFacility.facility_name}</span>
                                  )
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-2 py-2">
                                {preventionFacility ? (
                                  isEditing ? (
                                    <input
                                      type="text"
                                      value={editedFacilities[`${outlet.id}_prevention_${preventionFacility.id}`]?.capacity ?? (preventionFacility.capacity || '')}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'capacity', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-sm">{preventionFacility.capacity || '-'}</span>
                                  )
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-2 py-2">
                                {preventionFacility ? (
                                  isEditing ? (
                                    <input
                                      type="number"
                                      min="1"
                                      value={editedFacilities[`${outlet.id}_prevention_${preventionFacility.id}`]?.quantity ?? preventionFacility.quantity}
                                      onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'quantity', parseInt(e.target.value) || 1)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-sm">{preventionFacility.quantity}</span>
                                  )
                                ) : '-'}
                              </td>
                              
                              {/* 방지시설 추가 정보 */}
                              <td className="border border-gray-300 px-2 py-2">
                                {preventionFacility ? (
                                  <div className="space-y-1">
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
                                        <div className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                          {rangeDisplay}
                                        </div>
                                      ) : null
                                    })()}
                                    
                                    {/* 수동 입력 시설번호 */}
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={editedFacilities[`${outlet.id}_prevention_${preventionFacility.id}`]?.facility_number ?? (preventionFacility.additional_info?.facility_number || '')}
                                        onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'facility_number', e.target.value)}
                                        placeholder="수동 시설번호"
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                      />
                                    ) : (
                                      preventionFacility.additional_info?.facility_number && (
                                        <div className="text-xs text-gray-600">
                                          수동: {preventionFacility.additional_info.facility_number}
                                        </div>
                                      )
                                    )}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="border border-gray-300 px-2 py-2">
                                {preventionFacility && isEditing ? (
                                  <input
                                    type="text"
                                    value={editedFacilities[`${outlet.id}_prevention_${preventionFacility.id}`]?.green_link_code ?? (preventionFacility.additional_info?.green_link_code || '')}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'green_link_code', e.target.value)}
                                    placeholder="그린링크코드"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="text-sm">{preventionFacility?.additional_info?.green_link_code || '-'}</span>
                                )}
                              </td>
                              <td className="border border-gray-300 px-2 py-2">
                                {preventionFacility && isEditing ? (
                                  <textarea
                                    value={editedFacilities[`${outlet.id}_prevention_${preventionFacility.id}`]?.memo ?? (preventionFacility.additional_info?.memo || '')}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'memo', e.target.value)}
                                    placeholder="메모"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 resize-none"
                                    rows={1}
                                  />
                                ) : (
                                  <span className="text-sm">{preventionFacility?.additional_info?.memo || '-'}</span>
                                )}
                              </td>
                              
                              {/* 방지시설 삭제 버튼 */}
                              {isEditing && (
                                <td className="border border-gray-300 px-2 py-2 text-center">
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

                {/* 시설 추가 버튼 (편집모드에서만) */}
                {isEditing && (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => addDischargeFacility(outlet.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      배출시설 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => addPreventionFacility(outlet.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
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