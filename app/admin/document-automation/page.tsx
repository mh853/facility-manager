// app/admin/document-automation/page.tsx - 문서 자동화 관리 페이지
'use client'

import { useState, useEffect } from 'react'
import { BusinessInfo } from '@/lib/database-service'
import Link from 'next/link'
import { ArrowLeft, FileText, Eye, Download, Settings, Loader2, CheckCircle, XCircle, Users, Database, History, RefreshCw } from 'lucide-react'

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
  const [isLoading, setIsLoading] = useState(false)
  const [previewData, setPreviewData] = useState<Record<string, string>>({})
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [generationResults, setGenerationResults] = useState<{
    successful: GenerationResult[]
    failed: Array<{ businessId: string; error: string }>
  } | null>(null)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)

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

  // 일괄 문서 생성
  const handleGenerateBulk = async () => {
    if (selectedBusinesses.length === 0) {
      alert('문서를 생성할 사업장을 선택하세요')
      return
    }

    if (!selectedTemplate) {
      alert('템플릿을 선택하세요')
      return
    }

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
        <div className="flex items-center gap-4 mb-4">
          <Link href="/admin" className="flex items-center text-blue-600 hover:text-blue-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            관리자 홈으로
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">문서 자동화 관리</h1>
        
        {/* 템플릿 선택 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">템플릿 선택</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map(template => (
              <div
                key={template.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedTemplate === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold">{template.name}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                <div className="text-xs text-gray-500">
                  {template.placeholders.length}개 플레이스홀더
                </div>
              </div>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <div>사용 가능한 템플릿이 없습니다</div>
              <div className="text-sm">환경변수에서 템플릿 ID를 설정하세요</div>
            </div>
          )}
        </div>

        {/* 작업 버튼 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handlePreview}
            disabled={selectedBusinesses.length === 0 || isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            미리보기
          </button>
          <button
            onClick={handleGenerateBulk}
            disabled={selectedBusinesses.length === 0 || !selectedTemplate || isLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            일괄 생성 ({selectedBusinesses.length}개)
          </button>
        </div>
      </div>

      {/* 사업장 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">사업장 목록</h2>
          <button
            onClick={handleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {selectedBusinesses.length === businesses.length ? '전체 해제' : '전체 선택'}
          </button>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                선택
              </th>
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
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {businesses.map(business => (
              <tr key={business.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedBusinesses.includes(business.id)}
                    onChange={() => handleBusinessSelect(business.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {business.business_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {business.local_government || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {business.manager_name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => handleGenerateSingle(business.id)}
                    disabled={!selectedTemplate || isLoading}
                    className="text-blue-600 hover:text-blue-900 disabled:text-gray-400"
                  >
                    단일 생성
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {businesses.length === 0 && (
          <div className="p-12 text-center text-gray-500">등록된 사업장이 없습니다</div>
        )}
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
    </div>
  )
}