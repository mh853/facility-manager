// app/admin/air-permit/page.tsx - 대기필증 관리 페이지
'use client'

import { useState, useEffect, useRef } from 'react'
import { BusinessInfo, AirPermitInfo, AirPermitWithOutlets } from '@/lib/database-service'
import Link from 'next/link'
import { Users, FileText, Database, History, RefreshCw } from 'lucide-react'

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
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessInfo | null>(null)
  const [airPermits, setAirPermits] = useState<AirPermitInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPermit, setEditingPermit] = useState<AirPermitInfo | null>(null)
  const [formData, setFormData] = useState<Partial<AirPermitInfo>>({})

  // 사업장 목록 로드
  const loadBusinesses = async () => {
    try {
      const response = await fetch('/api/business-management')
      const result = await response.json()
      
      if (response.ok) {
        setBusinesses(result.data)
      } else {
        alert('사업장 목록을 불러오는데 실패했습니다: ' + result.error)
      }
    } catch (error) {
      console.error('Error loading businesses:', error)
      alert('사업장 목록을 불러오는데 실패했습니다')
    }
  }

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

  // 페이지 로드 시 사업장 목록 로드
  useEffect(() => {
    loadBusinesses()
  }, [])

  // 사업장 선택 시 대기필증 목록 로드
  const handleBusinessSelect = (business: BusinessInfo) => {
    setSelectedBusiness(business)
    loadAirPermits(business.id)
  }

  // 새 대기필증 추가 모달 열기
  const openAddModal = () => {
    if (!selectedBusiness) return
    
    setEditingPermit(null)
    setFormData({
      business_id: selectedBusiness.id,
      business_type: '',
      category: '',
      business_name: selectedBusiness.business_name,
      pollutants: [],
      first_report_date: '',
      operation_start_date: '',
      outlets: [],
      additional_info: {},
      is_active: true,
      is_deleted: false
    })
    setIsModalOpen(true)
  }

  // 대기필증 편집 모달 열기
  const openEditModal = (permit: AirPermitInfo) => {
    console.log('🔍 편집할 대기필증 데이터:', permit)
    
    setEditingPermit(permit)
    
    // additional_info에서 모든 데이터 추출 (안전한 방식으로)
    const additionalInfo = permit.additional_info || {}
    
    const formDataToSet = {
      ...permit,
      // 실제 필드 우선, 없으면 additional_info에서 추출
      business_type: additionalInfo.business_type || permit.business_type || '',
      category: additionalInfo.category || permit.category || '',
      business_name: additionalInfo.business_name || permit.business_name || '',
      first_report_date: permit.first_report_date || additionalInfo.first_report_date || '',
      operation_start_date: permit.operation_start_date || additionalInfo.operation_start_date || '',
      pollutants: additionalInfo.pollutants || [],
      outlets: additionalInfo.outlets || []
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
    
    console.log('🔍 편집 폼에 설정할 데이터:', formDataToSet)
    
    setFormData(formDataToSet)
    setIsModalOpen(true)
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

  // 대기필증 삭제
  const handleDelete = async (permit: AirPermitInfo) => {
    if (!confirm(`대기필증을 삭제하시겠습니까?`)) {
      return
    }

    try {
      const response = await fetch(`/api/air-permit?id=${permit.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        alert(result.message)
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
    <div className="container mx-auto px-4 py-8">
      {/* 네비게이션 메뉴 */}
      <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            실사관리
          </Link>
          <Link
            href="/admin/business"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Users className="w-4 h-4" />
            사업장 관리
          </Link>
          <Link
            href="/admin/air-permit"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            대기필증 관리
          </Link>
          <Link
            href="/admin/data-history"
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <History className="w-4 h-4" />
            데이터 이력
          </Link>
          <Link
            href="/admin/document-automation"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            문서 자동화
          </Link>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">대기필증 관리</h1>
        
        <nav className="text-sm mb-6">
          <Link href="/admin" className="text-blue-600 hover:underline">관리자 홈</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-500">대기필증 관리</span>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 사업장 목록 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">사업장 목록</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {businesses.map((business) => (
                <button
                  key={business.id}
                  onClick={() => handleBusinessSelect(business)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedBusiness?.id === business.id
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                      : 'hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="font-medium">{business.business_name}</div>
                  <div className="text-sm text-gray-500">{business.local_government}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 대기필증 목록 */}
        <div className="lg:col-span-2">
          {!selectedBusiness ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-gray-500 mb-4">사업장을 선택하세요</div>
              <div className="text-sm text-gray-400">
                왼쪽에서 사업장을 선택하면 해당 사업장의 대기필증 목록을 확인할 수 있습니다
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">
                  {selectedBusiness.business_name} - 대기필증 목록
                </h2>
                <button
                  onClick={openAddModal}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  새 대기필증 추가
                </button>
              </div>

              {isLoading ? (
                <div className="p-12 text-center text-gray-500">로딩 중...</div>
              ) : airPermits.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  등록된 대기필증이 없습니다
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {airPermits.map((permit) => (
                    <div key={permit.id} className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-500">업종</label>
                              <div className="text-gray-900">{permit.business_type || '-'}</div>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">종별</label>
                              <div className="text-gray-900">
                                {permit.category || permit.additional_info?.category || '-'}
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">사업장명</label>
                              <div className="text-gray-900">{permit.business_name || selectedBusiness.business_name}</div>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">
                                오염물질정보
                              </label>
                              <div className="text-gray-900">
                                {permit.additional_info?.pollutants?.length > 0 
                                  ? `${permit.additional_info.pollutants.length}개 오염물질`
                                  : '-'
                                }
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">최초신고일</label>
                              <div className="text-gray-900">
                                {permit.first_report_date
                                  ? new Date(permit.first_report_date).toLocaleDateString('ko-KR')
                                  : (permit.additional_info?.first_report_date
                                      ? new Date(permit.additional_info.first_report_date).toLocaleDateString('ko-KR')
                                      : '-')
                                }
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">가동개시일</label>
                              <div className="text-gray-900">
                                {permit.operation_start_date
                                  ? new Date(permit.operation_start_date).toLocaleDateString('ko-KR')
                                  : (permit.additional_info?.operation_start_date
                                      ? new Date(permit.additional_info.operation_start_date).toLocaleDateString('ko-KR')
                                      : '-')
                                }
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 text-sm text-gray-500">
                            등록일: {new Date(permit.created_at).toLocaleDateString('ko-KR')}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Link
                            href={`/admin/outlet-facility?permitId=${permit.id}`}
                            className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                          >
                            배출구/시설관리
                          </Link>
                          <button
                            onClick={() => openEditModal(permit)}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-900"
                          >
                            편집
                          </button>
                          <button
                            onClick={() => handleDelete(permit)}
                            className="px-3 py-1 text-sm text-red-600 hover:text-red-900"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 대기필증 추가/편집 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingPermit ? '대기필증 정보 편집' : '새 대기필증 추가'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    업종
                  </label>
                  <input
                    type="text"
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
                    value={formData.category || ''}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사업장명 (자동기입)
                  </label>
                  <input
                    type="text"
                    value={selectedBusiness?.business_name || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
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
    </div>
  )
}