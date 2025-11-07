// app/admin/document-automation/components/EstimateManagement.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  Download,
  Eye,
  Search,
  Calendar,
  DollarSign,
  Building2,
  Loader2,
  X,
  Settings
} from 'lucide-react'

interface Business {
  id: string
  business_name: string
  address?: string
}

interface EstimateHistory {
  id: string
  business_id: string
  business_name: string
  estimate_number: string
  estimate_date: string
  total_amount: number
  subtotal: number
  vat_amount: number
  estimate_items: any[]
  created_at: string
  pdf_file_url?: string
}

interface EstimateTemplate {
  id: string
  terms_and_conditions: string
  supplier_company_name: string
}

export default function EstimateManagement() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [estimates, setEstimates] = useState<EstimateHistory[]>([])
  const [template, setTemplate] = useState<EstimateTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [generatingEstimate, setGeneratingEstimate] = useState(false)
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateHistory | null>(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [editingTerms, setEditingTerms] = useState('')

  // 사업장 목록 로드
  useEffect(() => {
    loadBusinesses()
    loadTemplate()
  }, [])

  // 견적서 이력 로드
  useEffect(() => {
    if (selectedBusiness) {
      loadEstimates(selectedBusiness.id)
    } else {
      loadEstimates()
    }
  }, [selectedBusiness])

  const loadBusinesses = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/business-info-direct', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await response.json()
      if (data.success) {
        setBusinesses(data.data || [])
      }
    } catch (error) {
      console.error('사업장 로드 오류:', error)
    }
  }

  const loadEstimates = async (businessId?: string) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      const url = businessId
        ? `/api/estimates?business_id=${businessId}`
        : '/api/estimates'

      const response = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await response.json()

      if (data.success) {
        setEstimates(data.data || [])
      }
    } catch (error) {
      console.error('견적서 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTemplate = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/estimates/template', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await response.json()

      if (data.success && data.data) {
        setTemplate(data.data)
        setEditingTerms(data.data.terms_and_conditions || '')
      }
    } catch (error) {
      console.error('템플릿 로드 오류:', error)
    }
  }

  const generateEstimate = async (businessId: string) => {
    try {
      setGeneratingEstimate(true)
      const token = localStorage.getItem('auth_token')
      const userId = localStorage.getItem('user_id')

      const response = await fetch('/api/estimates/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          business_id: businessId,
          created_by: userId
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('견적서가 생성되었습니다.')
        loadEstimates(selectedBusiness?.id)
      } else {
        alert(`견적서 생성 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('견적서 생성 오류:', error)
      alert('견적서 생성 중 오류가 발생했습니다.')
    } finally {
      setGeneratingEstimate(false)
    }
  }

  const downloadPDF = async (estimateId: string, estimateNumber: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/estimates/${estimateId}/pdf`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${estimateNumber}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('PDF 다운로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('PDF 다운로드 오류:', error)
      alert('PDF 다운로드 중 오류가 발생했습니다.')
    }
  }

  const updateTemplate = async () => {
    try {
      if (!template) return

      const token = localStorage.getItem('auth_token')
      const userId = localStorage.getItem('user_id')

      const response = await fetch('/api/estimates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          template_id: template.id,
          terms_and_conditions: editingTerms,
          updated_by: userId
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('템플릿이 업데이트되었습니다.')
        setTemplate(data.data)
        setIsTemplateModalOpen(false)
      } else {
        alert(`템플릿 업데이트 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('템플릿 업데이트 오류:', error)
      alert('템플릿 업데이트 중 오류가 발생했습니다.')
    }
  }

  const filteredBusinesses = businesses.filter(b =>
    b.business_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">견적서 관리</h2>
        <button
          onClick={() => setIsTemplateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          템플릿 설정
        </button>
      </div>

      {/* 사업장 선택 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">사업장 선택</h3>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="사업장명 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {filteredBusinesses.map((business) => (
            <div
              key={business.id}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedBusiness?.id === business.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => setSelectedBusiness(business)}
            >
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{business.business_name}</p>
                  {business.address && (
                    <p className="text-xs text-gray-500 truncate mt-1">{business.address}</p>
                  )}
                </div>
              </div>
              {selectedBusiness?.id === business.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    generateEstimate(business.id)
                  }}
                  disabled={generatingEstimate}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {generatingEstimate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      견적서 생성
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 견적서 이력 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          견적서 이력 {selectedBusiness && `- ${selectedBusiness.business_name}`}
        </h3>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : estimates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>생성된 견적서가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">견적서 번호</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">사업장명</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">견적일자</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">공급가액</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">부가세</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">합계</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">작업</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((estimate) => (
                  <tr key={estimate.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{estimate.estimate_number}</td>
                    <td className="py-3 px-4 text-sm">{estimate.business_name}</td>
                    <td className="py-3 px-4 text-sm">{estimate.estimate_date}</td>
                    <td className="py-3 px-4 text-sm text-right">
                      ₩{estimate.subtotal.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      ₩{estimate.vat_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-semibold">
                      ₩{estimate.total_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedEstimate(estimate)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="상세보기"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadPDF(estimate.id, estimate.estimate_number)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded"
                          title="PDF 다운로드"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 템플릿 설정 모달 */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">견적서 템플릿 설정</h3>
                <button
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    안내사항
                  </label>
                  <textarea
                    value={editingTerms}
                    onChange={(e) => setEditingTerms(e.target.value)}
                    rows={15}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="견적서 하단에 표시될 안내사항을 입력하세요..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsTemplateModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={updateTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 견적서 상세보기 모달 */}
      {selectedEstimate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">
                  견적서 상세 - {selectedEstimate.estimate_number}
                </h3>
                <button
                  onClick={() => setSelectedEstimate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* 기본 정보 */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm text-gray-600">사업장명:</span>
                    <p className="font-medium">{selectedEstimate.business_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">견적일자:</span>
                    <p className="font-medium">{selectedEstimate.estimate_date}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">공급가액:</span>
                    <p className="font-medium">₩{selectedEstimate.subtotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">총 금액:</span>
                    <p className="font-medium text-lg text-blue-600">
                      ₩{selectedEstimate.total_amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* 견적 항목 */}
                <div>
                  <h4 className="font-semibold mb-3">견적 항목</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-3 py-2 text-sm">No</th>
                          <th className="border px-3 py-2 text-sm">품명</th>
                          <th className="border px-3 py-2 text-sm">규격</th>
                          <th className="border px-3 py-2 text-sm">수량</th>
                          <th className="border px-3 py-2 text-sm">단가</th>
                          <th className="border px-3 py-2 text-sm">공급가액</th>
                          <th className="border px-3 py-2 text-sm">세액</th>
                          <th className="border px-3 py-2 text-sm">비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEstimate.estimate_items.map((item: any) => (
                          <tr key={item.no}>
                            <td className="border px-3 py-2 text-sm text-center">{item.no}</td>
                            <td className="border px-3 py-2 text-sm">{item.name}</td>
                            <td className="border px-3 py-2 text-sm text-center">{item.spec}</td>
                            <td className="border px-3 py-2 text-sm text-center">{item.quantity}</td>
                            <td className="border px-3 py-2 text-sm text-right">
                              {item.unit_price.toLocaleString()}
                            </td>
                            <td className="border px-3 py-2 text-sm text-right">
                              {item.supply_amount.toLocaleString()}
                            </td>
                            <td className="border px-3 py-2 text-sm text-right">
                              {item.vat_amount.toLocaleString()}
                            </td>
                            <td className="border px-3 py-2 text-sm">{item.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => downloadPDF(selectedEstimate.id, selectedEstimate.estimate_number)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4" />
                    PDF 다운로드
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
