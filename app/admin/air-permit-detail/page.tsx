// app/admin/air-permit-detail/page.tsx - 대기필증 상세보기 페이지
'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { AirPermitWithOutlets, DischargeOutlet } from '@/lib/database-service'
import AdminLayout from '@/components/ui/AdminLayout'
import { 
  Factory, 
  ArrowLeft,
  Settings,
  Edit,
  Save,
  X,
  Plus
} from 'lucide-react'

// 게이트웨이 색상 팔레트
const gatewayColors = [
  { name: '미할당', color: 'bg-gray-200 text-gray-800', value: '' },
  { name: 'Gateway 1', color: 'bg-blue-200 text-blue-800', value: 'gateway1' },
  { name: 'Gateway 2', color: 'bg-green-200 text-green-800', value: 'gateway2' },
  { name: 'Gateway 3', color: 'bg-yellow-200 text-yellow-800', value: 'gateway3' },
  { name: 'Gateway 4', color: 'bg-red-200 text-red-800', value: 'gateway4' },
  { name: 'Gateway 5', color: 'bg-purple-200 text-purple-800', value: 'gateway5' },
  { name: 'Gateway 6', color: 'bg-pink-200 text-pink-800', value: 'gateway6' }
]

function AirPermitDetailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const permitId = searchParams.get('permitId')
  
  const [permitDetail, setPermitDetail] = useState<AirPermitWithOutlets | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editedFacilities, setEditedFacilities] = useState<{[key: string]: any}>({})
  const [gatewayAssignments, setGatewayAssignments] = useState<{[outletId: string]: string}>({})
  const [isSaving, setIsSaving] = useState(false)

  // 대기필증 상세 정보 로드
  const loadPermitDetail = useCallback(async () => {
    if (!permitId) return

    try {
      setLoading(true)
      const response = await fetch(`/api/air-permit?id=${permitId}&details=true`)
      const result = await response.json()
      
      if (response.ok && result.data) {
        console.log('📋 대기필증 상세 정보:', result.data)
        setPermitDetail(result.data)
        
        // 게이트웨이 할당 정보 초기화
        const assignments: {[outletId: string]: string} = {}
        if (result.data.outlets) {
          result.data.outlets.forEach((outlet: DischargeOutlet) => {
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
    }
  }, [permitId, router])

  useEffect(() => {
    loadPermitDetail()
  }, [loadPermitDetail])

  // 시설 정보 편집
  const handleFacilityEdit = (outletId: string, facilityType: 'discharge' | 'prevention', facilityId: string, field: string, value: any) => {
    const key = `${outletId}_${facilityType}_${facilityId}`
    setEditedFacilities(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }))
  }

  // 게이트웨이 할당 변경
  const handleGatewayChange = (outletId: string, gateway: string) => {
    setGatewayAssignments(prev => ({
      ...prev,
      [outletId]: gateway
    }))
  }

  // 변경사항 저장
  const handleSave = async () => {
    try {
      setIsSaving(true)
      
      // 시설 정보 업데이트
      for (const [key, updates] of Object.entries(editedFacilities)) {
        const [outletId, facilityType, facilityId] = key.split('_')
        
        // API 호출로 시설 정보 업데이트
        await fetch(`/api/facility-detail`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facilityId,
            facilityType,
            updates
          })
        })
      }
      
      // 게이트웨이 할당 업데이트
      for (const [outletId, gateway] of Object.entries(gatewayAssignments)) {
        await fetch(`/api/outlet-gateway`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outletId,
            gateway
          })
        })
      }
      
      alert('변경사항이 저장되었습니다')
      setIsEditing(false)
      setEditedFacilities({})
      await loadPermitDetail()
      
    } catch (error) {
      console.error('Error saving changes:', error)
      alert('저장에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout title="대기필증 상세보기" description="로딩 중...">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </AdminLayout>
    )
  }

  if (!permitDetail) {
    return (
      <AdminLayout title="대기필증 상세보기" description="대기필증을 찾을 수 없습니다">
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

  const getGatewayColorClass = (gateway: string) => {
    const gatewayColor = gatewayColors.find(g => g.value === gateway)
    return gatewayColor ? gatewayColor.color : gatewayColors[0].color
  }

  return (
    <AdminLayout
      title={`필증보기 - ${permitDetail.business?.business_name || '대기필증'}`}
      description={`업종: ${permitDetail.business_type || '-'} | 배출구 ${permitDetail.outlets?.length || 0}개`}
      actions={(
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/admin/air-permit')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <span className="text-sm text-gray-500">사업장명</span>
            <div className="font-medium">
              {permitDetail.business?.business_name || 
               permitDetail.additional_info?.business_name || '-'}
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">업종</span>
            <div className="font-medium">{permitDetail.business_type || '-'}</div>
          </div>
          <div>
            <span className="text-sm text-gray-500">최초신고일</span>
            <div className="font-medium">
              {permitDetail.first_report_date ? 
                new Date(permitDetail.first_report_date).toLocaleDateString('ko-KR') : '-'}
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">가동개시일</span>
            <div className="font-medium">
              {permitDetail.operation_start_date ? 
                new Date(permitDetail.operation_start_date).toLocaleDateString('ko-KR') : '-'}
            </div>
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
                      <span className="text-gray-600">({outlet.outlet_name})</span>
                    )}
                    {/* 게이트웨이 정보 항상 표시 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">게이트웨이:</span>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${gatewayColor}`}>
                        {gatewayColors.find(g => g.value === gatewayAssignments[outlet.id])?.name || '미할당'}
                      </span>
                    </div>
                  </div>
                  
                  {/* 게이트웨이 할당 */}
                  {isEditing && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">게이트웨이:</span>
                      <select
                        value={gatewayAssignments[outlet.id] || ''}
                        onChange={(e) => handleGatewayChange(outlet.id, e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        {gatewayColors.map((gw) => (
                          <option key={gw.value} value={gw.value}>
                            {gw.name}
                          </option>
                        ))}
                      </select>
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
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">방지시설</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">용량</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">수량</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">시설번호</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">그린링크코드</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">측정기기</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">메모</th>
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
                                {dischargeFacility && isEditing ? (
                                  <input
                                    type="text"
                                    value={editedFacilities[`${outlet.id}_discharge_${dischargeFacility.id}`]?.facility_number ?? (dischargeFacility.additional_info?.facility_number || '')}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'discharge', dischargeFacility.id, 'facility_number', e.target.value)}
                                    placeholder="시설번호"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="text-sm">{dischargeFacility?.additional_info?.facility_number || '-'}</span>
                                )}
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
                                {preventionFacility && isEditing ? (
                                  <input
                                    type="text"
                                    value={editedFacilities[`${outlet.id}_prevention_${preventionFacility.id}`]?.facility_number ?? (preventionFacility.additional_info?.facility_number || '')}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'facility_number', e.target.value)}
                                    placeholder="시설번호"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="text-sm">{preventionFacility?.additional_info?.facility_number || '-'}</span>
                                )}
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
                                  <input
                                    type="text"
                                    value={editedFacilities[`${outlet.id}_prevention_${preventionFacility.id}`]?.measurement_device ?? (preventionFacility.additional_info?.measurement_device || '')}
                                    onChange={(e) => handleFacilityEdit(outlet.id, 'prevention', preventionFacility.id, 'measurement_device', e.target.value)}
                                    placeholder="측정기기"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="text-sm">{preventionFacility?.additional_info?.measurement_device || '-'}</span>
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
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      배출시설 추가
                    </button>
                    <button
                      type="button"
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