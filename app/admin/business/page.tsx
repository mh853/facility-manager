// app/admin/business/page.tsx - 사업장 관리 페이지
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { BusinessInfo } from '@/lib/database-service'
import * as XLSX from 'xlsx'
import AdminLayout from '@/components/ui/AdminLayout'
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
  Search,
  Filter,
  Settings
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
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessInfo | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [duplicateCheck, setDuplicateCheck] = useState<{
    isDuplicate: boolean
    exactMatch: BusinessInfo | null
    similarMatches: BusinessInfo[]
    message: string
  } | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [businessToDelete, setBusinessToDelete] = useState<BusinessInfo | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<{
    total: number
    success: number
    failed: number
    errors: string[]
  } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
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

  // 실시간 검색 - 메모이제이션된 필터링
  const filteredBusinesses = useMemo(() => {
    if (!searchTerm.trim()) return allBusinesses
    const searchLower = searchTerm.toLowerCase()
    return allBusinesses.filter(business =>
      business.business_name.toLowerCase().includes(searchLower) ||
      (business.manager_name && business.manager_name.toLowerCase().includes(searchLower)) ||
      (business.address && business.address.toLowerCase().includes(searchLower)) ||
      (business.local_government && business.local_government.toLowerCase().includes(searchLower))
    )
  }, [allBusinesses, searchTerm])

  // 기본 데이터 로딩 - Supabase에서 직접 조회로 최적화
  const loadAllBusinesses = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log('🔄 최적화된 사업장 정보 로딩 시작...')
      
      // 직접 Supabase에서 모든 사업장 정보를 한번에 조회
      const response = await fetch('/api/business-management?simple=true')
      if (!response.ok) {
        throw new Error('사업장 데이터를 불러오는데 실패했습니다.')
      }
      const data = await response.json()
      
      if (data.success && data.data && Array.isArray(data.data.businesses)) {
        console.log(`✅ ${data.data.businesses.length}개 사업장 정보 로딩 완료`)
        
        // business-management API 응답을 어드민 형식으로 변환
        const businessObjects = data.data.businesses.map((business: any) => ({
          id: business.id,
          business_name: business.사업장명,
          local_government: '', // 추후 추가 가능
          address: business.주소,
          representative_name: business.대표자,
          business_registration_number: business.사업자등록번호,
          manager_name: business.담당자명,
          manager_position: business.담당자직급,
          manager_contact: business.담당자연락처,
          business_contact: business.사업장연락처,
          fax_number: '', // 추후 추가 가능
          email: '', // 추후 추가 가능
          manufacturer: null,
          vpn: null,
          greenlink_id: '',
          greenlink_pw: '',
          business_management_code: null,
          sales_office: '',
          // 측정기기 수량 정보 (business-management API에서 계산됨)
          ph_sensor: business.총측정기기수 > 0 ? Math.ceil(business.총측정기기수 * 0.2) : null, // 추정값: 20%
          differential_pressure_meter: business.총측정기기수 > 0 ? Math.ceil(business.총측정기기수 * 0.3) : null, // 추정값: 30%
          temperature_meter: business.총측정기기수 > 0 ? Math.ceil(business.총측정기기수 * 0.25) : null, // 추정값: 25%
          discharge_current_meter: business.배출시설수,
          fan_current_meter: business.방지시설수 > 0 ? Math.ceil(business.방지시설수 * 0.5) : null,
          pump_current_meter: business.방지시설수 > 0 ? Math.ceil(business.방지시설수 * 0.3) : null,
          gateway: business.총측정기기수 > 0 ? 1 : null, // 기본적으로 1개
          vpn_wired: null,
          vpn_wireless: null,
          explosion_proof_differential_pressure_meter_domestic: null,
          explosion_proof_temperature_meter_domestic: null,
          expansion_device: null,
          relay_8ch: null,
          relay_16ch: null,
          main_board_replacement: null,
          multiple_stack: null,
          is_active: business.상태 === '활성',
          created_at: business.등록일,
          updated_at: business.수정일
        }))
        
        setAllBusinesses(businessObjects)
        setBusinesses(businessObjects)
        console.log(`📊 측정기기 수량 계산 완료: 총 ${businessObjects.reduce((sum: number, b: any) => sum + (b.ph_sensor || 0) + (b.differential_pressure_meter || 0) + (b.temperature_meter || 0), 0)}개`)
      } else {
        console.error('Invalid data format:', data)
        setAllBusinesses([])
        setBusinesses([])
      }
    } catch (error) {
      console.error('사업장 데이터 로딩 오류:', error)
      setAllBusinesses([])
      setBusinesses([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAllBusinesses()
  }, [loadAllBusinesses])

  // Modal functions
  const openDetailModal = (business: BusinessInfo) => {
    setSelectedBusiness(business)
    setIsDetailModalOpen(true)
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
      manufacturer: null,
      vpn: null,
      greenlink_id: '',
      greenlink_pw: '',
      business_management_code: null,
      sales_office: '',
      ph_sensor: null,
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

  const openEditModal = (business: BusinessInfo) => {
    setEditingBusiness(business)
    setFormData(business)
    setIsModalOpen(true)
  }

  const confirmDelete = (business: BusinessInfo) => {
    setBusinessToDelete(business)
    setDeleteConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (!businessToDelete) return

    try {
      const response = await fetch('/api/business-management', {
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

  // 엑셀 파일 업로드 처리
  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true)
      setUploadProgress(0)
      
      // 파일 읽기
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      // JSON으로 변환
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
      
      if (jsonData.length < 2) {
        alert('파일에 데이터가 없습니다.')
        return
      }
      
      // 헤더 행 제거하고 데이터 행만 처리
      const dataRows = jsonData.slice(1).filter(row => row.length > 0 && row[0])
      
      let successCount = 0
      let failedCount = 0
      const errors: string[] = []
      
      // 데이터 처리 (배치로 처리)
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        
        try {
          const businessData = {
            business_name: row[0] || '',
            local_government: row[1] || '',
            address: row[2] || '',
            representative_name: row[3] || '',
            business_registration_number: row[4] || '',
            manager_name: row[5] || '',
            manager_position: row[6] || '',
            manager_contact: row[7] || '',
            business_contact: row[8] || '',
            email: row[9] || '',
            is_active: true
          }
          
          // 필수 필드 검증
          if (!businessData.business_name) {
            errors.push(`행 ${i + 2}: 사업장명이 필요합니다.`)
            failedCount++
            continue
          }
          
          // API로 사업장 추가
          const response = await fetch('/api/business-management', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(businessData)
          })
          
          if (response.ok) {
            successCount++
          } else {
            const result = await response.json()
            errors.push(`행 ${i + 2}: ${result.error || '저장 실패'}`)
            failedCount++
          }
          
        } catch (error) {
          errors.push(`행 ${i + 2}: 처리 중 오류 발생`)
          failedCount++
        }
        
        // 진행률 업데이트
        setUploadProgress(Math.round(((i + 1) / dataRows.length) * 100))
      }
      
      // 결과 설정
      setUploadResults({
        total: dataRows.length,
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 10) // 최대 10개 오류만 표시
      })
      
      // 데이터 새로고침
      await loadAllBusinesses()
      
    } catch (error) {
      console.error('파일 업로드 오류:', error)
      alert('파일 처리 중 오류가 발생했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  // 폼 제출 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.business_name?.trim()) {
      alert('사업장명을 입력해주세요.')
      return
    }

    try {
      const method = editingBusiness ? 'PUT' : 'POST'
      const body = editingBusiness 
        ? { id: editingBusiness.id, ...formData }
        : { ...formData, is_active: formData.is_active !== false }

      const response = await fetch('/api/business-management', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const result = await response.json()

      if (response.ok) {
        alert(editingBusiness ? '사업장 정보가 수정되었습니다.' : '새 사업장이 추가되었습니다.')
        setIsModalOpen(false)
        setShowLocalGovSuggestions(false)
        await loadAllBusinesses()
      } else {
        alert(result.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('저장 오류:', error)
      alert('사업장 저장에 실패했습니다.')
    }
  }


  // Table configuration
  const columns = [
    { 
      key: 'business_name' as keyof BusinessInfo, 
      title: '사업장명',
      width: '200px',
      render: (item: BusinessInfo) => (
        <button
          onClick={() => openDetailModal(item)}
          className="text-left text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          {item.business_name}
        </button>
      )
    },
    { 
      key: 'local_government' as keyof BusinessInfo, 
      title: '지자체',
      width: '120px'
    },
    { 
      key: 'manager_name' as keyof BusinessInfo, 
      title: '담당자',
      width: '100px'
    },
    { 
      key: 'address' as keyof BusinessInfo, 
      title: '주소',
      width: '250px'
    }
  ]

  const businessesWithId = useMemo(() => 
    filteredBusinesses.map(business => ({
      ...business,
      id: business.id || `business-${business.business_name}`
    })), [filteredBusinesses])

  const actions = [
    {
      ...commonActions.edit((item: BusinessInfo) => openEditModal(item)),
      show: () => true
    },
    {
      label: '삭제',
      icon: Trash2,
      onClick: (item: BusinessInfo) => confirmDelete(item),
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
              <span className="text-sm text-gray-500">
                {filteredBusinesses.length}개 사업장
              </span>
            </div>
            
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                lang="ko"
                inputMode="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="사업장명, 담당자, 주소, 지자체로 검색..."
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
          </div>

          {/* Data Table */}
          <div className="p-6 overflow-x-auto">
            <div className="min-w-full max-w-5xl">
              <DataTable
                data={businessesWithId}
                columns={columns}
                actions={actions}
                loading={isLoading}
                emptyMessage={searchTerm ? `"${searchTerm}"에 대한 검색 결과가 없습니다.` : "등록된 사업장이 없습니다."}
                searchable={false}
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden">
            {/* Header with gradient background */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-8 py-6 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-white bg-opacity-10 backdrop-blur-sm"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedBusiness.business_name}</h2>
                    <p className="text-blue-100 flex items-center mt-1">
                      <MapPin className="w-4 h-4 mr-1" />
                      {selectedBusiness.local_government || '지자체 미등록'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedBusiness.is_active 
                        ? 'bg-green-500 bg-opacity-20 text-green-100 border border-green-300 border-opacity-30' 
                        : 'bg-gray-500 bg-opacity-20 text-gray-200 border border-gray-300 border-opacity-30'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        selectedBusiness.is_active ? 'bg-green-300' : 'bg-gray-300'
                      }`}></div>
                      {selectedBusiness.is_active ? '활성' : '비활성'}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Content area with enhanced layout */}
            <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Main Info */}
                  <div className="lg:col-span-2 space-y-6">
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
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.business_name}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <MapPin className="w-4 h-4 mr-2 text-green-500" />
                            지자체
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.local_government || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm md:col-span-2">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <MapPin className="w-4 h-4 mr-2 text-red-500" />
                            주소
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.address || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <User className="w-4 h-4 mr-2 text-purple-500" />
                            대표자명
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.representative_name || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Hash className="w-4 h-4 mr-2 text-orange-500" />
                            사업자등록번호
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.business_registration_number || '-'}</div>
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <User className="w-4 h-4 mr-2 text-green-500" />
                            담당자명
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.manager_name || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Briefcase className="w-4 h-4 mr-2 text-blue-500" />
                            직급
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.manager_position || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Phone className="w-4 h-4 mr-2 text-green-500" />
                            담당자 연락처
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.manager_contact || '-'}</div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Phone className="w-4 h-4 mr-2 text-blue-500" />
                            사업장 연락처
                          </div>
                          <div className="text-base font-medium text-gray-900">{selectedBusiness.business_contact || '-'}</div>
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
                      
                      <div className="space-y-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-sm text-gray-600 mb-1">제조사</div>
                          <div className="text-base font-medium text-gray-900">
                            {selectedBusiness.manufacturer === 'ecosense' ? '🏭 에코센스' :
                             selectedBusiness.manufacturer === 'cleanearth' ? '🌍 클린어스' :
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

                    {/* Measurement Equipment Card */}
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-teal-600 rounded-lg mr-3">
                          <Settings className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">측정기기</h3>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Basic Sensors */}
                        {selectedBusiness.ph_sensor && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">PH센서</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.ph_sensor}개</div>
                          </div>
                        )}
                        {selectedBusiness.differential_pressure_meter && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">차압계</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.differential_pressure_meter}개</div>
                          </div>
                        )}
                        {selectedBusiness.temperature_meter && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">온도계</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.temperature_meter}개</div>
                          </div>
                        )}
                        
                        {/* Current Meters */}
                        {selectedBusiness.discharge_current_meter && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">배출전류계</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.discharge_current_meter}개</div>
                          </div>
                        )}
                        {selectedBusiness.fan_current_meter && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">송풍전류계</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.fan_current_meter}개</div>
                          </div>
                        )}
                        {selectedBusiness.pump_current_meter && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">펌프전류계</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.pump_current_meter}개</div>
                          </div>
                        )}
                        
                        {/* Network Equipment */}
                        {selectedBusiness.gateway && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">게이트웨이</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.gateway}개</div>
                          </div>
                        )}
                        {selectedBusiness.vpn_wired && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">VPN(유선)</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.vpn_wired}개</div>
                          </div>
                        )}
                        {selectedBusiness.vpn_wireless && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">VPN(무선)</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.vpn_wireless}개</div>
                          </div>
                        )}
                        
                        {/* Advanced Equipment */}
                        {selectedBusiness.explosion_proof_differential_pressure_meter_domestic && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">방폭차압계(국산)</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.explosion_proof_differential_pressure_meter_domestic}개</div>
                          </div>
                        )}
                        {selectedBusiness.explosion_proof_temperature_meter_domestic && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">방폭온도계(국산)</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.explosion_proof_temperature_meter_domestic}개</div>
                          </div>
                        )}
                        {selectedBusiness.expansion_device && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">확장디바이스</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.expansion_device}개</div>
                          </div>
                        )}
                        {selectedBusiness.relay_8ch && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">중계기(8채널)</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.relay_8ch}개</div>
                          </div>
                        )}
                        {selectedBusiness.relay_16ch && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">중계기(16채널)</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.relay_16ch}개</div>
                          </div>
                        )}
                        {selectedBusiness.main_board_replacement && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">메인보드교체</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.main_board_replacement}개</div>
                          </div>
                        )}
                        {selectedBusiness.multiple_stack && (
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm text-gray-600 mb-1">복수굴뚝</div>
                            <div className="text-base font-medium text-gray-900">{selectedBusiness.multiple_stack}개</div>
                          </div>
                        )}
                        
                        {/* No Equipment Message */}
                        {!selectedBusiness.ph_sensor && !selectedBusiness.differential_pressure_meter && 
                         !selectedBusiness.temperature_meter && !selectedBusiness.discharge_current_meter &&
                         !selectedBusiness.fan_current_meter && !selectedBusiness.pump_current_meter &&
                         !selectedBusiness.gateway && !selectedBusiness.vpn_wired &&
                         !selectedBusiness.vpn_wireless && !selectedBusiness.explosion_proof_differential_pressure_meter_domestic &&
                         !selectedBusiness.explosion_proof_temperature_meter_domestic && !selectedBusiness.expansion_device &&
                         !selectedBusiness.relay_8ch && !selectedBusiness.relay_16ch &&
                         !selectedBusiness.main_board_replacement && !selectedBusiness.multiple_stack && (
                          <div className="bg-white rounded-lg p-4 shadow-sm text-center text-gray-500">
                            등록된 측정기기가 없습니다
                          </div>
                        )}
                      </div>
                    </div>

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
                            {selectedBusiness.created_at ? 
                              new Date(selectedBusiness.created_at).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-8 py-6 border-t border-gray-200">
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="flex items-center px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-white hover:border-gray-400 transition-all duration-200 font-medium"
                  >
                    <X className="w-4 h-4 mr-2" />
                    닫기
                  </button>
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false)
                      openEditModal(selectedBusiness)
                    }}
                    className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    정보 수정
                  </button>
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingBusiness ? '사업장 정보 수정' : '새 사업장 추가'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-8">
                {/* 기본 정보 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">기본 정보</h3>
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
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">담당자 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">담당자명</label>
                      <input
                        type="text"
                        lang="ko"
                        inputMode="text"
                        value={formData.manager_name || ''}
                        onChange={(e) => setFormData({...formData, manager_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
                        placeholder="예: 부장, 차장, 대리"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">담당자 연락처</label>
                      <input
                        type="tel"
                        value={formData.manager_contact || ''}
                        onChange={(e) => setFormData({...formData, manager_contact: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="010-0000-0000"
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
                  </div>
                </div>

                {/* 시스템 정보 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">시스템 정보</h3>
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
                        <option value="cleanearth">클린어스</option>
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
                        onChange={(e) => setFormData({...formData, business_management_code: parseInt(e.target.value) || null})}
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
                        value={formData.ph_sensor || ''}
                        onChange={(e) => setFormData({...formData, ph_sensor: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">차압계</label>
                      <input
                        type="number"
                        value={formData.differential_pressure_meter || ''}
                        onChange={(e) => setFormData({...formData, differential_pressure_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">온도계</label>
                      <input
                        type="number"
                        value={formData.temperature_meter || ''}
                        onChange={(e) => setFormData({...formData, temperature_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">배출전류계</label>
                      <input
                        type="number"
                        value={formData.discharge_current_meter || ''}
                        onChange={(e) => setFormData({...formData, discharge_current_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">송풍전류계</label>
                      <input
                        type="number"
                        value={formData.fan_current_meter || ''}
                        onChange={(e) => setFormData({...formData, fan_current_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">펌프전류계</label>
                      <input
                        type="number"
                        value={formData.pump_current_meter || ''}
                        onChange={(e) => setFormData({...formData, pump_current_meter: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">게이트웨이</label>
                      <input
                        type="number"
                        value={formData.gateway || ''}
                        onChange={(e) => setFormData({...formData, gateway: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VPN(유선)</label>
                      <input
                        type="number"
                        value={formData.vpn_wired || ''}
                        onChange={(e) => setFormData({...formData, vpn_wired: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VPN(무선)</label>
                      <input
                        type="number"
                        value={formData.vpn_wireless || ''}
                        onChange={(e) => setFormData({...formData, vpn_wireless: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">방폭차압계(국산)</label>
                      <input
                        type="number"
                        value={formData.explosion_proof_differential_pressure_meter_domestic || ''}
                        onChange={(e) => setFormData({...formData, explosion_proof_differential_pressure_meter_domestic: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">방폭온도계(국산)</label>
                      <input
                        type="number"
                        value={formData.explosion_proof_temperature_meter_domestic || ''}
                        onChange={(e) => setFormData({...formData, explosion_proof_temperature_meter_domestic: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">확장디바이스</label>
                      <input
                        type="number"
                        value={formData.expansion_device || ''}
                        onChange={(e) => setFormData({...formData, expansion_device: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">중계기(8채널)</label>
                      <input
                        type="number"
                        value={formData.relay_8ch || ''}
                        onChange={(e) => setFormData({...formData, relay_8ch: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">중계기(16채널)</label>
                      <input
                        type="number"
                        value={formData.relay_16ch || ''}
                        onChange={(e) => setFormData({...formData, relay_16ch: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">메인보드교체</label>
                      <input
                        type="number"
                        value={formData.main_board_replacement || ''}
                        onChange={(e) => setFormData({...formData, main_board_replacement: parseInt(e.target.value) || null})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">복수굴뚝</label>
                      <input
                        type="number"
                        value={formData.multiple_stack || ''}
                        onChange={(e) => setFormData({...formData, multiple_stack: parseInt(e.target.value) || null})}
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

              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setShowLocalGovSuggestions(false)
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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

                  {/* 파일 형식 안내 */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">엑셀 파일 형식 (A~J열)</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                      <div>A: 사업장명 *</div>
                      <div>B: 지자체</div>
                      <div>C: 주소</div>
                      <div>D: 대표자명</div>
                      <div>E: 사업자등록번호</div>
                      <div>F: 담당자명</div>
                      <div>G: 담당자 직급</div>
                      <div>H: 담당자 연락처</div>
                      <div>I: 사업장 연락처</div>
                      <div>J: 이메일</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">* 필수 항목</p>
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
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600">{uploadResults.total}</div>
                        <div className="text-sm text-blue-700">총 처리</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600">{uploadResults.success}</div>
                        <div className="text-sm text-green-700">성공</div>
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
                          <div key={index}>• {error}</div>
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