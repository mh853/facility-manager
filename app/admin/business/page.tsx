// app/admin/business/page.tsx - 사업장 관리 페이지
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { BusinessInfo } from '@/lib/database-service'
import Link from 'next/link'
import { Users, FileText, Database, History, RefreshCw, Download, Upload, X } from 'lucide-react'

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
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([])
  const [allBusinesses, setAllBusinesses] = useState<BusinessInfo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<BusinessInfo | null>(null)
  const [formData, setFormData] = useState<Partial<BusinessInfo>>({})
  const [localGovSuggestions, setLocalGovSuggestions] = useState<string[]>([])
  const [showLocalGovSuggestions, setShowLocalGovSuggestions] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSettings, setImportSettings] = useState({
    spreadsheetId: '',
    sheetName: '사업장 정보',
    startRow: 2
  })
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessInfo | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [duplicateCheck, setDuplicateCheck] = useState<{
    isDuplicate: boolean
    exactMatch: BusinessInfo | null
    similarMatches: BusinessInfo[]
    message: string
  } | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)

  // 실시간 검색 - 메모이제이션된 필터링
  const filteredBusinesses = useMemo(() => {
    if (!searchTerm.trim()) return allBusinesses
    const searchLower = searchTerm.toLowerCase()
    return allBusinesses.filter(business =>
      business.business_name.toLowerCase().includes(searchLower) ||
      business.local_government?.toLowerCase().includes(searchLower) ||
      business.manager_name?.toLowerCase().includes(searchLower) ||
      business.manager_contact?.toLowerCase().includes(searchLower) ||
      business.address?.toLowerCase().includes(searchLower)
    )
  }, [searchTerm, allBusinesses])

  // 전체 사업장 목록 로드 (한 번만 실행)
  const loadAllBusinesses = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/business-management')
      const result = await response.json()
      
      if (response.ok) {
        setAllBusinesses(result.data)
      } else {
        alert('사업장 목록을 불러오는데 실패했습니다: ' + result.error)
      }
    } catch (error) {
      console.error('Error loading businesses:', error)
      alert('사업장 목록을 불러오는데 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 페이지 로드 시 전체 사업장 목록 로드
  useEffect(() => {
    loadAllBusinesses()
  }, [loadAllBusinesses])

  // 검색은 실시간으로 처리되므로 별도 함수 불필요

  // 사업장 상세보기
  const openDetailModal = (business: BusinessInfo) => {
    setSelectedBusiness(business)
    setIsDetailModalOpen(true)
  }

  // 중복 체크 함수
  const checkDuplicate = async (businessName: string, excludeId?: string) => {
    if (!businessName.trim()) {
      setDuplicateCheck(null)
      setShowDuplicateWarning(false)
      return
    }

    try {
      const response = await fetch('/api/business-management/duplicate-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_name: businessName.trim(),
          exclude_id: excludeId
        })
      })

      if (response.ok) {
        const result = await response.json()
        setDuplicateCheck(result)
        setShowDuplicateWarning(result.isDuplicate || result.similarMatches.length > 0)
      }
    } catch (error) {
      console.error('중복 체크 오류:', error)
    }
  }

  // 새 사업장 추가 모달 열기
  const openAddModal = () => {
    setEditingBusiness(null)
    setDuplicateCheck(null)
    setShowDuplicateWarning(false)
    setFormData({
      business_name: '',
      local_government: '',
      address: '',
      manager_name: '',
      manager_position: '',
      manager_contact: '',
      business_contact: '',
      fax_number: '',
      email: '',
      representative_name: '',
      representative_birth_date: '',
      business_registration_number: '',
      manufacturer: '',
      ph_meter: 0,
      differential_pressure_meter: 0,
      temperature_meter: 0,
      discharge_ct: '',
      fan_ct: 0,
      pump_ct: 0,
      gateway: '',
      multiple_stack: 0,
      vpn_wired: 0,
      vpn_wireless: 0,
      additional_info: {},
      is_active: true,
      is_deleted: false
    })
    setIsModalOpen(true)
  }

  // 사업장 편집 모달 열기
  const openEditModal = (business: BusinessInfo) => {
    setEditingBusiness(business)
    setDuplicateCheck(null)
    setShowDuplicateWarning(false)
    
    // additional_info에서 데이터를 가져오고 누락된 필드들을 기본값으로 채움
    const additionalInfo = business.additional_info || {}
    const safeFormData = {
      ...business,
      // additional_info에서 측정기기 정보 로드
      ph_meter: additionalInfo.ph_meter || business.ph_meter || 0,
      differential_pressure_meter: additionalInfo.differential_pressure_meter || business.differential_pressure_meter || 0,
      temperature_meter: additionalInfo.temperature_meter || business.temperature_meter || 0,
      // CT 정보
      discharge_ct: additionalInfo.discharge_ct || business.discharge_ct || '',
      fan_ct: additionalInfo.fan_ct || business.fan_ct || 0,
      pump_ct: additionalInfo.pump_ct || business.pump_ct || 0,
      gateway: additionalInfo.gateway || business.gateway || '',
      // 네트워크 설정
      multiple_stack: additionalInfo.multiple_stack || business.multiple_stack || 0,
      vpn_wired: additionalInfo.vpn_wired || business.vpn_wired || 0,
      vpn_wireless: additionalInfo.vpn_wireless || business.vpn_wireless || 0,
      // 기타 정보
      fax_number: additionalInfo.fax_number || business.fax_number || '',
      manufacturer: additionalInfo.manufacturer || business.manufacturer || '',
      additional_info: additionalInfo
    }
    
    console.log('🔍 편집 모달 폼 데이터:', safeFormData)
    setFormData(safeFormData)
    setIsModalOpen(true)
  }

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 중복 체크 (새 사업장 등록 시에만)
    if (!editingBusiness) {
      if (!formData.business_name?.trim()) {
        alert('사업장명을 입력해주세요.')
        return
      }

      // 중복 체크 실행
      await checkDuplicate(formData.business_name, editingBusiness?.id)
      
      // 중복 확인 후 결과 체크
      if (duplicateCheck?.isDuplicate) {
        alert('이미 동일한 사업장명이 존재합니다. 다른 이름을 사용해주세요.')
        return
      }

      // 유사한 사업장이 있을 때 확인 요청
      if (duplicateCheck?.similarMatches.length > 0) {
        const confirmed = confirm(
          `유사한 사업장명이 ${duplicateCheck.similarMatches.length}개 발견되었습니다:\n\n` +
          duplicateCheck.similarMatches.slice(0, 3).map(b => 
            `• ${b.business_name} (담당자: ${b.manager_name || '-'})`
          ).join('\n') +
          (duplicateCheck.similarMatches.length > 3 ? `\n외 ${duplicateCheck.similarMatches.length - 3}개 더...` : '') +
          '\n\n정말로 등록하시겠습니까?'
        )
        
        if (!confirmed) {
          return
        }
      }
    }
    
    try {
      const method = editingBusiness ? 'PUT' : 'POST'
      const url = '/api/business-management'
      
      // additional_info에 새로운 필드들 저장
      const additionalInfo = {
        pump_ct: formData.pump_ct || 0,
        ...formData.additional_info
      }
      
      const body = editingBusiness 
        ? { id: editingBusiness.id, ...formData, additional_info: additionalInfo }
        : { ...formData, additional_info: additionalInfo }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const result = await response.json()

      if (response.ok) {
        alert(result.message)
        setIsModalOpen(false)
        setDuplicateCheck(null)
        setShowDuplicateWarning(false)
        loadAllBusinesses()
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error saving business:', error)
      alert('사업장 저장에 실패했습니다')
    }
  }

  // 사업장 삭제
  const handleDelete = async (business: BusinessInfo) => {
    if (!confirm(`'${business.business_name}' 사업장을 삭제하시겠습니까?`)) {
      return
    }

    try {
      const response = await fetch(`/api/business-management?id=${business.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        alert(result.message)
        loadAllBusinesses()
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error deleting business:', error)
      alert('사업장 삭제에 실패했습니다')
    }
  }

  // 지자체 자동완성 처리
  const handleLocalGovChange = (value: string) => {
    setFormData({...formData, local_government: value})
    
    if (value.trim()) {
      const filtered = KOREAN_LOCAL_GOVERNMENTS.filter(gov =>
        gov.toLowerCase().includes(value.toLowerCase())
      )
      setLocalGovSuggestions(filtered.slice(0, 10))
      setShowLocalGovSuggestions(true)
    } else {
      setShowLocalGovSuggestions(false)
    }
  }

  const selectLocalGov = (gov: string) => {
    setFormData({...formData, local_government: gov})
    setShowLocalGovSuggestions(false)
  }

  // 구글시트에서 사업장 정보 일괄 가져오기
  const handleImportFromSpreadsheet = async () => {
    if (!importSettings.spreadsheetId && !process.env.NEXT_PUBLIC_DATA_COLLECTION_SPREADSHEET_ID) {
      alert('스프레드시트 ID를 입력하거나 환경변수를 설정해주세요')
      return
    }

    setIsImporting(true)
    
    try {
      const response = await fetch('/api/business-management', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importSettings)
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        const { summary, errors } = result
        
        let message = `✅ 가져오기 완료!\n\n`
        message += `📊 총 ${summary.totalRows}행 처리\n`
        message += `✅ 성공: ${summary.successCount}개\n`
        message += `⚠️ 중복 스킵: ${summary.skipCount}개\n`
        message += `❌ 오류: ${summary.errorCount}개`

        if (errors && errors.length > 0) {
          message += `\n\n❌ 오류 내용:\n`
          errors.slice(0, 5).forEach((error: any) => {
            if (error.businessName) {
              message += `- ${error.businessName}: ${error.error}\n`
            } else {
              message += `- ${error.row}행: ${error.error}\n`
            }
          })
          if (errors.length > 5) {
            message += `... 및 ${errors.length - 5}개 추가 오류`
          }
        }

        alert(message)
        setIsImportModalOpen(false)
        loadAllBusinesses() // 목록 새로고침
      } else {
        alert(`가져오기 실패: ${result.error}\n상세: ${result.details || ''}`)
      }
    } catch (error) {
      console.error('Import error:', error)
      alert(`가져오기 중 오류가 발생했습니다: ${error}`)
    } finally {
      setIsImporting(false)
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
        <h1 className="text-3xl font-bold text-gray-800 mb-4">사업장 관리</h1>
        
        <nav className="text-sm mb-6">
          <Link href="/admin" className="text-blue-600 hover:underline">관리자 홈</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-500">사업장 관리</span>
        </nav>
        
        {/* 검색 및 추가 버튼 */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="사업장명, 지자체, 담당자, 연락처, 주소로 검색..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
              title="검색 초기화"
            >
              <X className="w-4 h-4" />
              초기화
            </button>
          )}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            구글시트에서 가져오기
          </button>
          <button
            onClick={openAddModal}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            새 사업장 추가
          </button>
        </div>
      </div>

      {/* 검색 결과 표시 */}
      {!isLoading && (
        <div className="mb-4 text-sm text-gray-600">
          {searchTerm 
            ? `"${searchTerm}" 검색 결과: ${filteredBusinesses.length}개 / 전체: ${allBusinesses.length}개`
            : `전체 사업장: ${allBusinesses.length}개`
          }
        </div>
      )}

      {/* 사업장 목록 */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500">
            {searchTerm ? `"${searchTerm}"에 대한 검색 결과가 없습니다` : '등록된 사업장이 없습니다'}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사업장명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  지자체
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  담당자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  연락처
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  등록일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBusinesses.map((business) => (
                <tr key={business.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <button 
                      onClick={() => openDetailModal(business)}
                      className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                    >
                      {business.business_name}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {business.local_government || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {business.manager_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {business.manager_contact || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(business.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(business)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => handleDelete(business)}
                        className="text-red-600 hover:text-red-900"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 사업장 추가/편집 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingBusiness ? '사업장 정보 편집' : '새 사업장 추가'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 기본 정보 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사업장명 *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.business_name || ''}
                    onChange={(e) => {
                      const newValue = e.target.value
                      setFormData({...formData, business_name: newValue})
                      
                      // 실시간 중복 체크 (debounce 적용)
                      if (newValue.trim()) {
                        setTimeout(() => {
                          if (formData.business_name === newValue) {
                            checkDuplicate(newValue, editingBusiness?.id)
                          }
                        }, 500)
                      } else {
                        setDuplicateCheck(null)
                        setShowDuplicateWarning(false)
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      duplicateCheck?.isDuplicate 
                        ? 'border-red-300 bg-red-50' 
                        : duplicateCheck?.similarMatches.length > 0 
                        ? 'border-yellow-300 bg-yellow-50' 
                        : 'border-gray-300'
                    }`}
                  />
                  
                  {/* 중복 체크 결과 표시 */}
                  {duplicateCheck && (
                    <div className={`mt-2 p-3 rounded-md text-sm ${
                      duplicateCheck.isDuplicate 
                        ? 'bg-red-100 text-red-800 border border-red-200' 
                        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {duplicateCheck.isDuplicate ? '⚠️ 중복 사업장명' : '⚠️ 유사한 사업장명 발견'}
                        </span>
                      </div>
                      <div className="mt-2 text-xs">{duplicateCheck.message}</div>
                      
                      {duplicateCheck.exactMatch && (
                        <div className="mt-2 p-2 bg-white rounded border text-xs">
                          <div className="font-medium">동일한 사업장:</div>
                          <div>{duplicateCheck.exactMatch.business_name}</div>
                          <div className="text-gray-600">
                            담당자: {duplicateCheck.exactMatch.manager_name || '-'} | 
                            연락처: {duplicateCheck.exactMatch.manager_contact || '-'}
                          </div>
                        </div>
                      )}
                      
                      {duplicateCheck.similarMatches.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="font-medium text-xs">유사한 사업장들:</div>
                          {duplicateCheck.similarMatches.slice(0, 3).map((business) => (
                            <div key={business.id} className="p-2 bg-white rounded border text-xs">
                              <div className="font-medium">{business.business_name}</div>
                              <div className="text-gray-600">
                                담당자: {business.manager_name || '-'} | 
                                연락처: {business.manager_contact || '-'}
                              </div>
                            </div>
                          ))}
                          {duplicateCheck.similarMatches.length > 3 && (
                            <div className="text-xs text-gray-600">
                              외 {duplicateCheck.similarMatches.length - 3}개 더...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    지자체
                  </label>
                  <input
                    type="text"
                    value={formData.local_government || ''}
                    onChange={(e) => handleLocalGovChange(e.target.value)}
                    onFocus={() => {
                      if (formData.local_government) {
                        handleLocalGovChange(formData.local_government)
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowLocalGovSuggestions(false), 200)
                    }}
                    placeholder="지자체를 입력하세요..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                  />
                  {showLocalGovSuggestions && localGovSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {localGovSuggestions.map((gov, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => selectLocalGov(gov)}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 text-sm"
                        >
                          {gov}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    주소
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 담당자 정보 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사업장담당자
                  </label>
                  <input
                    type="text"
                    value={formData.manager_name || ''}
                    onChange={(e) => setFormData({...formData, manager_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    직급
                  </label>
                  <input
                    type="text"
                    value={formData.manager_position || ''}
                    onChange={(e) => setFormData({...formData, manager_position: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    담당자연락처
                  </label>
                  <input
                    type="tel"
                    value={formData.manager_contact || ''}
                    onChange={(e) => setFormData({...formData, manager_contact: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사업장연락처
                  </label>
                  <input
                    type="tel"
                    value={formData.business_contact || ''}
                    onChange={(e) => setFormData({...formData, business_contact: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    팩스번호
                  </label>
                  <input
                    type="tel"
                    value={formData.fax_number || ''}
                    onChange={(e) => setFormData({...formData, fax_number: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제조사
                  </label>
                  <select
                    value={formData.manufacturer || ''}
                    onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">선택하세요</option>
                    <option value="에코센스">에코센스</option>
                    <option value="크린어스">크린어스</option>
                    <option value="가이아씨앤에스">가이아씨앤에스</option>
                    <option value="이브이에스">이브이에스</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    대표자성명
                  </label>
                  <input
                    type="text"
                    value={formData.representative_name || ''}
                    onChange={(e) => setFormData({...formData, representative_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사업자등록번호 (000-00-00000)
                  </label>
                  <input
                    type="text"
                    placeholder="000-00-00000"
                    maxLength={12}
                    value={formData.business_registration_number || ''}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^0-9]/g, '');
                      if (value.length >= 3) {
                        value = value.slice(0,3) + '-' + value.slice(3);
                      }
                      if (value.length >= 6) {
                        value = value.slice(0,6) + '-' + value.slice(6,11);
                      }
                      setFormData({...formData, business_registration_number: value});
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    대표자생년월일(보조금) (YYYY-MM-DD)
                  </label>
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    maxLength={10}
                    value={formData.representative_birth_date || ''}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^0-9]/g, '');
                      if (value.length >= 4) {
                        value = value.slice(0,4) + '-' + value.slice(4);
                      }
                      if (value.length >= 7) {
                        value = value.slice(0,7) + '-' + value.slice(7,9);
                      }
                      setFormData({...formData, representative_birth_date: value});
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 측정기기 정보 */}
                <div className="md:col-span-2">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">측정기기 정보</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        PH계 (개)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.ph_meter || 0}
                        onChange={(e) => setFormData({...formData, ph_meter: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        차압계 (개)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.differential_pressure_meter || 0}
                        onChange={(e) => setFormData({...formData, differential_pressure_meter: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        온도계 (개)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.temperature_meter || 0}
                        onChange={(e) => setFormData({...formData, temperature_meter: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        배출CT (개)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.discharge_ct || ''}
                        onChange={(e) => setFormData({...formData, discharge_ct: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        송풍CT (개)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.fan_ct || 0}
                        onChange={(e) => setFormData({...formData, fan_ct: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        펌프CT (개)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.pump_ct || 0}
                        onChange={(e) => setFormData({...formData, pump_ct: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        게이트웨이 (개)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.gateway || ''}
                        onChange={(e) => setFormData({...formData, gateway: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        복수굴뚝 (개)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.multiple_stack || 0}
                        onChange={(e) => setFormData({...formData, multiple_stack: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VPN유선 (개)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.vpn_wired || 0}
                        onChange={(e) => setFormData({...formData, vpn_wired: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VPN무선 (개)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.vpn_wireless || 0}
                        onChange={(e) => setFormData({...formData, vpn_wireless: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setDuplicateCheck(null)
                    setShowDuplicateWarning(false)
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

      {/* 구글시트 가져오기 모달 */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                구글시트에서 사업장 정보 가져오기
              </h2>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    스프레드시트 ID
                  </label>
                  <input
                    type="text"
                    value={importSettings.spreadsheetId}
                    onChange={(e) => setImportSettings({...importSettings, spreadsheetId: e.target.value})}
                    placeholder="환경변수 사용하려면 비워두세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    비워두면 환경변수의 기본 스프레드시트를 사용합니다
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시트 이름
                  </label>
                  <input
                    type="text"
                    value={importSettings.sheetName}
                    onChange={(e) => setImportSettings({...importSettings, sheetName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시작 행 (헤더 제외)
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={importSettings.startRow}
                    onChange={(e) => setImportSettings({...importSettings, startRow: parseInt(e.target.value) || 2})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    1행은 헤더로 간주되며, 데이터는 지정된 행부터 읽습니다
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">📋 지원하는 헤더</h4>
                  <div className="text-xs text-blue-700 space-y-1">
                    <div>• <strong>필수:</strong> 사업장명</div>
                    <div>• <strong>선택:</strong> 지자체, 주소, 담당자명, 담당자직급, 담당자연락처</div>
                    <div>• <strong>선택:</strong> 사업장연락처, 팩스번호, 이메일, 대표자성명, 사업자등록번호</div>
                    <div>• <strong>기타:</strong> 인식되지 않는 헤더는 추가정보로 저장됩니다</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={isImporting}
                >
                  취소
                </button>
                <button
                  onClick={handleImportFromSpreadsheet}
                  disabled={isImporting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      가져오는 중...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      가져오기
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 사업장 상세보기 모달 */}
      {isDetailModalOpen && selectedBusiness && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                사업장 상세정보
              </h2>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 기본 정보 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2">기본 정보</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">사업장명</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.business_name}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">지자체</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.local_government || '-'}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">주소</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.address || '-'}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">사업자등록번호</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.business_registration_number || '-'}</p>
                  </div>
                </div>

                {/* 담당자 정보 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2">담당자 정보</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">담당자명</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.manager_name || '-'}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">담당자 직급</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.manager_position || '-'}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">담당자 연락처</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.manager_contact || '-'}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">사업장 연락처</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.business_contact || '-'}</p>
                  </div>
                </div>

                {/* 대표자 정보 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2">대표자 정보</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">대표자명</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.representative_name || '-'}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">대표자 생년월일</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.representative_birth_date || '-'}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">이메일</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBusiness.email || '-'}</p>
                  </div>
                </div>

                {/* 추가 정보 */}
                {selectedBusiness.additional_info && Object.keys(selectedBusiness.additional_info).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2">추가 정보</h3>
                    
                    {Object.entries(selectedBusiness.additional_info).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700">{key}</label>
                        <p className="mt-1 text-sm text-gray-900">{String(value) || '-'}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 시스템 정보 */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2">시스템 정보</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">등록일</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {new Date(selectedBusiness.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">수정일</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {new Date(selectedBusiness.updated_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  닫기
                </button>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    openEditModal(selectedBusiness)
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  편집
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}