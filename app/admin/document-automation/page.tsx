// app/admin/document-automation/page.tsx - 문서 자동화 관리 페이지
'use client'

import { useState, useEffect, useMemo } from 'react'
import { BusinessInfo } from '@/lib/database-service'
import AdminLayout from '@/components/ui/AdminLayout'
import StatsCard from '@/components/ui/StatsCard'
import DataTable, { commonActions } from '@/components/ui/DataTable'
import { ConfirmModal } from '@/components/ui/Modal'
import { 
  ArrowLeft, 
  FileText, 
  Eye, 
  Download, 
  Settings, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Users, 
  Database, 
  History, 
  RefreshCw,
  Play,
  BookTemplate,
  Building2,
  Archive,
  Search,
  X
} from 'lucide-react'

interface DocumentTemplate {
  id: string
  name: string
  templateId: string
  description: string
  placeholders: string[]
}

interface GenerationResult {
  businessId: string
  documentId: string
  documentUrl: string
}

export default function DocumentAutomationPage() {
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([])
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [selectedBusinesses, setSelectedBusinesses] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [previewData, setPreviewData] = useState<Record<string, string>>({})
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [generationResults, setGenerationResults] = useState<{
    successful: GenerationResult[]
    failed: Array<{ businessId: string; error: string }>
  } | null>(null)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  
  // 실시간 검색 - 메모이제이션된 필터링
  const filteredBusinesses = useMemo(() => {
    if (!searchTerm.trim()) return businesses
    const searchLower = searchTerm.toLowerCase()
    return businesses.filter(business =>
      business.business_name.toLowerCase().includes(searchLower) ||
      business.local_government?.toLowerCase().includes(searchLower) ||
      business.manager_name?.toLowerCase().includes(searchLower) ||
      business.manager_contact?.toLowerCase().includes(searchLower) ||
      business.address?.toLowerCase().includes(searchLower)
    )
  }, [searchTerm, businesses])

  // Stats calculation
  const stats = useMemo(() => {
    const totalBusinesses = businesses.length
    const selectedCount = selectedBusinesses.length
    const templatesCount = templates.length
    const readyToGenerate = selectedCount > 0 && selectedTemplate
    
    return {
      totalBusinesses,
      selectedCount,
      templatesCount,
      readyToGenerate: readyToGenerate ? 1 : 0
    }
  }, [businesses.length, selectedBusinesses.length, templates.length, selectedTemplate])

  // 데이터 로드
  useEffect(() => {
    loadBusinesses()
    loadTemplates()
  }, [])

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

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/document-automation?action=templates')
      const result = await response.json()
      
      if (response.ok) {
        setTemplates(result.data)
      } else {
        alert('템플릿 목록을 불러오는데 실패했습니다: ' + result.error)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
      alert('템플릿 목록을 불러오는데 실패했습니다')
    }
  }

  // 사업장 선택 핸들러
  const handleBusinessSelect = (businessId: string) => {
    setSelectedBusinesses(prev => 
      prev.includes(businessId)
        ? prev.filter(id => id !== businessId)
        : [...prev, businessId]
    )
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    setSelectedBusinesses(
      selectedBusinesses.length === businesses.length
        ? []
        : businesses.map(b => b.id)
    )
  }

  // 플레이스홀더 데이터 미리보기
  const handlePreview = async () => {
    if (selectedBusinesses.length === 0) {
      alert('미리보기할 사업장을 선택하세요')
      return
    }

    try {
      const response = await fetch(`/api/document-automation?action=preview&businessId=${selectedBusinesses[0]}`)
      const result = await response.json()
      
      if (response.ok) {
        setPreviewData(result.data)
        setIsPreviewModalOpen(true)
      } else {
        alert('미리보기 데이터 생성에 실패했습니다: ' + result.error)
      }
    } catch (error) {
      console.error('Error loading preview:', error)
      alert('미리보기 데이터 생성에 실패했습니다')
    }
  }

  // 단일 문서 생성
  const handleGenerateSingle = async (businessId: string) => {
    if (!selectedTemplate) {
      alert('템플릿을 선택하세요')
      return
    }

    setIsLoading(true)
    try {
      const business = businesses.find(b => b.id === businessId)
      const template = templates.find(t => t.id === selectedTemplate)
      
      const response = await fetch('/api/document-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          templateId: template?.templateId,
          businessId,
          outputFileName: `${template?.name} - ${business?.business_name} - ${new Date().toISOString().split('T')[0]}`
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert('문서가 성공적으로 생성되었습니다')
        window.open(result.data.documentUrl, '_blank')
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error generating document:', error)
      alert('문서 생성에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  // 일괄 문서 생성 확인
  const confirmBulkGenerate = () => {
    if (selectedBusinesses.length === 0) {
      alert('문서를 생성할 사업장을 선택하세요')
      return
    }

    if (!selectedTemplate) {
      alert('템플릿을 선택하세요')
      return
    }

    handleGenerateBulk()
  }

  // 일괄 문서 생성
  const handleGenerateBulk = async () => {
    setIsLoading(true)
    try {
      const template = templates.find(t => t.id === selectedTemplate)
      const requests = selectedBusinesses.map(businessId => {
        const business = businesses.find(b => b.id === businessId)
        return {
          templateId: template?.templateId,
          businessId,
          outputFileName: `${template?.name} - ${business?.business_name} - ${new Date().toISOString().split('T')[0]}`
        }
      })

      const response = await fetch('/api/document-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk',
          requests
        })
      })

      const result = await response.json()

      if (response.ok) {
        setGenerationResults(result.data)
        setIsResultModalOpen(true)
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error generating bulk documents:', error)
      alert('일괄 문서 생성에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  // Business data with ID for DataTable - using filteredBusinesses
  const businessesWithId = useMemo(() => 
    filteredBusinesses.map(business => ({
      ...business,
      id: business.id || `business-${business.business_name}`,
      isSelected: selectedBusinesses.includes(business.id)
    }))
  , [filteredBusinesses, selectedBusinesses])

  // Table columns for businesses
  const businessColumns = [
    {
      key: 'selection',
      title: '선택',
      width: '60px',
      render: (item: BusinessInfo & { isSelected: boolean }) => (
        <input
          type="checkbox"
          checked={item.isSelected}
          onChange={() => handleBusinessSelect(item.id)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      )
    },
    {
      key: 'business_name',
      title: '사업장명',
      render: (item: BusinessInfo) => (
        <span className="font-medium">{item.business_name}</span>
      )
    },
    {
      key: 'local_government',
      title: '지자체',
      render: (item: BusinessInfo) => (
        <span className="text-sm">{item.local_government || '-'}</span>
      )
    },
    {
      key: 'manager_name',
      title: '담당자',
      render: (item: BusinessInfo) => (
        <span className="text-sm">{item.manager_name || '-'}</span>
      )
    }
  ]

  // Table actions for businesses
  const businessActions = [
    {
      label: '단일 생성',
      icon: Play,
      onClick: (item: BusinessInfo) => handleGenerateSingle(item.id),
      variant: 'primary' as const,
      show: () => !!selectedTemplate && !isLoading
    }
  ]

  return (
    <AdminLayout
      title="문서 자동화 관리"
      description="문서 템플릿 기반 자동 생성 시스템"
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={selectedBusinesses.length === 0 || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            <Eye className="w-4 h-4" />
            미리보기
          </button>
          <button
            onClick={confirmBulkGenerate}
            disabled={selectedBusinesses.length === 0 || !selectedTemplate || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            일괄 생성 ({selectedBusinesses.length}개)
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel - Template Selection & Business List */}
        <div className="lg:col-span-1 space-y-6">
          {/* Template Selection */}
          <div className="bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 rounded-2xl shadow-sm border border-purple-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BookTemplate className="w-5 h-5 text-purple-600" />
              템플릿 선택
            </h2>
            
            {templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <div className="font-medium mb-1 text-sm">템플릿 없음</div>
                <div className="text-xs">환경변수 설정 필요</div>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedTemplate === template.id
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-300 hover:border-gray-400 hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className={`w-4 h-4 ${
                        selectedTemplate === template.id ? 'text-blue-600' : 'text-gray-600'
                      }`} />
                      <h3 className="font-medium text-sm">{template.name}</h3>
                    </div>
                    <p className="text-xs text-gray-600">{template.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Business List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                사업장 목록
                <span className="ml-auto text-sm text-gray-500">
                  {filteredBusinesses.length}개 사업장
                </span>
              </h2>
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {selectedBusinesses.length === businesses.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            
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
            
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {filteredBusinesses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <div className="text-sm">
                    {searchTerm ? `"${searchTerm}"에 대한 검색 결과가 없습니다.` : '등록된 사업장이 없습니다.'}
                  </div>
                </div>
              ) : (
                filteredBusinesses.map((business) => (
                <div
                  key={business.id}
                  className={`p-3 rounded-lg transition-all duration-200 border ${
                    selectedBusinesses.includes(business.id)
                      ? 'bg-blue-50 text-blue-800 border-blue-200 shadow-sm'
                      : 'hover:bg-gray-50 border-transparent hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedBusinesses.includes(business.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBusinesses([...selectedBusinesses, business.id])
                        } else {
                          setSelectedBusinesses(selectedBusinesses.filter(id => id !== business.id))
                        }
                      }}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{business.business_name}</div>
                      <div className="text-xs text-gray-500 mt-1">{business.local_government || '-'}</div>
                      <div className="text-xs text-gray-500">{business.manager_name || '-'}</div>
                    </div>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </div>

        {/* Right Panel - Stats & Actions */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="전체 사업장"
                value={stats.totalBusinesses}
                icon={Building2}
                color="blue"
                description="등록된 총 사업장 수"
              />
              
              <StatsCard
                title="선택된 사업장"
                value={stats.selectedCount}
                icon={CheckCircle}
                color="green"
                trend={{
                  value: stats.totalBusinesses > 0 ? Math.round((stats.selectedCount / stats.totalBusinesses) * 100) : 0,
                  direction: 'up',
                  label: '선택률'
                }}
              />
              
              <StatsCard
                title="사용 가능한 템플릿"
                value={stats.templatesCount}
                icon={BookTemplate}
                color="purple"
                description="설정된 문서 템플릿 수"
              />
              
              <StatsCard
                title="생성 준비 완료"
                value={stats.readyToGenerate}
                icon={Archive}
                color="yellow"
                description="템플릿 & 사업장 선택 완료"
              />
            </div>

            {/* Action Panel */}
            <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl shadow-sm border border-green-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Archive className="w-6 h-6 text-green-600" />
                </div>
                문서 생성 작업
              </h2>
              
              <div className="bg-white rounded-lg p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.templatesCount}</div>
                    <div className="text-sm text-gray-600">템플릿 준비</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.selectedCount}</div>
                    <div className="text-sm text-gray-600">사업장 선택</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${stats.readyToGenerate ? 'text-green-600' : 'text-gray-400'}`}>
                      {stats.readyToGenerate ? '준비완료' : '대기중'}
                    </div>
                    <div className="text-sm text-gray-600">생성 상태</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handlePreview}
                  disabled={selectedBusinesses.length === 0 || isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  <Eye className="w-5 h-5" />
                  미리보기
                </button>
                <button
                  onClick={confirmBulkGenerate}
                  disabled={selectedBusinesses.length === 0 || !selectedTemplate || isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  일괄 생성 ({selectedBusinesses.length}개)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* 미리보기 모달 */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">플레이스홀더 데이터 미리보기</h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(previewData).map(([key, value]) => (
                  <div key={key} className="border border-gray-200 rounded p-3">
                    <div className="text-sm font-medium text-gray-700 mb-1">{key}</div>
                    <div className="text-sm text-gray-900">{value || '(빈 값)'}</div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-8">
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 생성 결과 모달 */}
      {isResultModalOpen && generationResults && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">일괄 생성 결과</h2>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    성공: {generationResults.successful.length}개
                  </div>
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="w-4 h-4" />
                    실패: {generationResults.failed.length}개
                  </div>
                </div>
              </div>

              {/* 성공 목록 */}
              {generationResults.successful.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">성공한 문서</h3>
                  <div className="space-y-2">
                    {generationResults.successful.map(result => {
                      const business = businesses.find(b => b.id === result.businessId)
                      return (
                        <div key={result.businessId} className="flex items-center justify-between p-3 bg-green-50 rounded">
                          <div>
                            <div className="font-medium">{business?.business_name}</div>
                            <div className="text-sm text-gray-600">문서 ID: {result.documentId}</div>
                          </div>
                          <a
                            href={result.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            열기
                          </a>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 실패 목록 */}
              {generationResults.failed.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">실패한 문서</h3>
                  <div className="space-y-2">
                    {generationResults.failed.map(result => {
                      const business = businesses.find(b => b.id === result.businessId)
                      return (
                        <div key={result.businessId} className="p-3 bg-red-50 rounded">
                          <div className="font-medium">{business?.business_name}</div>
                          <div className="text-sm text-red-600">{result.error}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setIsResultModalOpen(false)
                    setGenerationResults(null)
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}