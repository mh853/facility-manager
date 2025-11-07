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
  Settings,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import EstimatePreviewModal from './EstimatePreviewModal'
import { useAuth } from '@/contexts/AuthContext'

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
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12 // 3행 × 4열

  // AuthContext에서 사용자 정보 및 권한 가져오기
  const { user } = useAuth()
  const userPermissionLevel = user?.permission_level || 0

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
        credentials: 'include',
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
        credentials: 'include',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Cache-Control': 'no-cache'
        }
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
        credentials: 'include',
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
        credentials: 'include',
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
      setLoading(true)

      // 1. 견적서 데이터 조회
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/estimates/${estimateId}/pdf`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (!response.ok) {
        alert('견적서 데이터 조회에 실패했습니다.')
        return
      }

      const { data: estimateData } = await response.json()

      // 2. 미리보기 양식으로 PDF 생성 (최적화된 방식)
      const pdf = await generatePDFFromPreview(estimateData)

      // 3. 파일명 생성: YYYYMMDD_사업장명_IoT설치견적서
      const dateStr = estimateData.estimate_date.replace(/-/g, '')
      const fileName = `${dateStr}_${estimateData.business_name}_IoT설치견적서.pdf`

      // 4. PDF 다운로드
      pdf.save(fileName)
    } catch (error) {
      console.error('PDF 다운로드 오류:', error)
      alert('PDF 다운로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 미리보기 HTML을 PDF로 변환 (최적화된 버전)
  const generatePDFFromPreview = async (estimateData: any) => {
    try {
      const jsPDF = (await import('jspdf')).default
      const html2canvas = (await import('html2canvas')).default

      // PDF용 HTML 생성 (미리보기와 동일한 구조)
      const pdfContainer = document.createElement('div')
      pdfContainer.style.position = 'absolute'
      pdfContainer.style.left = '-9999px'
      pdfContainer.style.width = '210mm' // A4 width
      pdfContainer.style.padding = '20mm'
      pdfContainer.style.backgroundColor = 'white'
      pdfContainer.style.fontFamily = 'Arial, sans-serif'

      pdfContainer.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto;">
          <h1 style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 30px;">IoT 설치 견적서</h1>

          <!-- 공급받는자 / 공급자 -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <!-- 공급받는자 -->
            <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
              <div style="background: #e3f2fd; padding: 8px 12px; border-bottom: 1px solid #ddd;">
                <h3 style="font-weight: bold; font-size: 13px; margin: 0;">공급받는자</h3>
              </div>
              <div style="padding: 10px 12px; font-size: 11px;">
                <div style="margin-bottom: 6px;"><span style="color: #666;">상호:</span> <strong>${estimateData.business_name || estimateData.customer_name || ''}</strong></div>
                <div style="margin-bottom: 6px;"><span style="color: #666;">사업장주소:</span> ${estimateData.customer_address || ''}</div>
                <div style="margin-bottom: 6px;"><span style="color: #666;">전화:</span> ${estimateData.customer_phone || ''}</div>
                <div style="margin-bottom: 6px;"><span style="color: #666;">담당자:</span> ${estimateData.customer_manager || ''}</div>
                <div style="margin-bottom: 6px;"><span style="color: #666;">담당자연락처:</span> ${estimateData.customer_manager_contact || ''}</div>
              </div>
            </div>

            <!-- 공급자 -->
            <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
              <div style="background: #e8f5e9; padding: 8px 12px; border-bottom: 1px solid #ddd;">
                <h3 style="font-weight: bold; font-size: 13px; margin: 0;">공급자</h3>
              </div>
              <div style="padding: 10px 12px; font-size: 11px;">
                <div style="margin-bottom: 6px;"><span style="color: #666;">상호:</span> <strong>${estimateData.supplier_info.company_name}</strong></div>
                <div style="margin-bottom: 6px;"><span style="color: #666;">사업자번호:</span> ${estimateData.supplier_info.registration_number}</div>
                <div style="margin-bottom: 6px;"><span style="color: #666;">대표자:</span> ${estimateData.supplier_info.representative}</div>
                <div style="margin-bottom: 6px;"><span style="color: #666;">주소:</span> ${estimateData.supplier_info.address}</div>
                <div style="margin-bottom: 6px;"><span style="color: #666;">전화:</span> ${estimateData.supplier_info.phone}</div>
              </div>
            </div>
          </div>

          <!-- 품목 테이블 -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="border: 1px solid #ddd; padding: 8px; width: 40px; vertical-align: middle;">No</th>
                <th style="border: 1px solid #ddd; padding: 8px; vertical-align: middle;">품명</th>
                <th style="border: 1px solid #ddd; padding: 8px; width: 60px; vertical-align: middle;">규격</th>
                <th style="border: 1px solid #ddd; padding: 8px; width: 50px; vertical-align: middle;">수량</th>
                <th style="border: 1px solid #ddd; padding: 8px; width: 80px; vertical-align: middle;">단가</th>
                <th style="border: 1px solid #ddd; padding: 8px; width: 90px; vertical-align: middle;">공급가액</th>
                <th style="border: 1px solid #ddd; padding: 8px; width: 70px; vertical-align: middle;">부가세</th>
              </tr>
            </thead>
            <tbody>
              ${estimateData.estimate_items.map((item: any) => `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 6px; text-align: center; vertical-align: middle;">${item.no}</td>
                  <td style="border: 1px solid #ddd; padding: 6px; vertical-align: middle;">${item.name}</td>
                  <td style="border: 1px solid #ddd; padding: 6px; text-align: center; vertical-align: middle;">${item.spec}</td>
                  <td style="border: 1px solid #ddd; padding: 6px; text-align: right; vertical-align: middle;">${item.quantity}</td>
                  <td style="border: 1px solid #ddd; padding: 6px; text-align: right; vertical-align: middle;">${item.unit_price.toLocaleString()}</td>
                  <td style="border: 1px solid #ddd; padding: 6px; text-align: right; vertical-align: middle;">${item.supply_amount.toLocaleString()}</td>
                  <td style="border: 1px solid #ddd; padding: 6px; text-align: right; vertical-align: middle;">${item.vat_amount.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${estimateData.reference_notes ? `
            <!-- 참고사항 -->
            <div style="background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
              <h3 style="font-weight: bold; font-size: 13px; margin-bottom: 10px;">참고사항</h3>
              <div style="font-size: 12px; white-space: pre-wrap; line-height: 1.6;">${estimateData.reference_notes}</div>
            </div>
          ` : ''}

          <!-- 합계 -->
          <div style="background: #fffde7; border: 2px solid #fbc02d; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; font-size: 13px;">
              <div>
                <div style="color: #666; margin-bottom: 8px;">공급가액</div>
                <div style="font-size: 18px; font-weight: bold;">₩${estimateData.subtotal.toLocaleString()}</div>
              </div>
              <div>
                <div style="color: #666; margin-bottom: 8px;">부가세</div>
                <div style="font-size: 18px; font-weight: bold;">₩${estimateData.vat_amount.toLocaleString()}</div>
              </div>
              <div>
                <div style="color: #666; margin-bottom: 8px;">합계금액</div>
                <div style="font-size: 20px; font-weight: bold; color: #1976d2;">₩${estimateData.total_amount.toLocaleString()}</div>
              </div>
            </div>
          </div>

          ${estimateData.terms_and_conditions ? `
            <!-- 안내사항 -->
            <div style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px;">
              <h3 style="font-weight: bold; font-size: 13px; margin-bottom: 10px;">안내사항</h3>
              <div style="font-size: 11px; color: #555; white-space: pre-wrap; line-height: 1.5;">${estimateData.terms_and_conditions}</div>
            </div>
          ` : ''}
        </div>
      `

      document.body.appendChild(pdfContainer)

      // HTML을 Canvas로 변환 (scale 1.5로 최적화, 파일 크기 대폭 감소)
      const canvas = await html2canvas(pdfContainer, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      // Canvas를 PDF로 변환 (JPEG 압축 사용, 품질 0.85로 최적화)
      const imgData = canvas.toDataURL('image/jpeg', 0.85)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      })

      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
        heightLeft -= pageHeight
      }

      // 정리
      document.body.removeChild(pdfContainer)

      return pdf
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      throw error
    }
  }

  const updateTemplate = async () => {
    try {
      if (!template) return

      const token = localStorage.getItem('auth_token')
      const userId = localStorage.getItem('user_id')

      const response = await fetch('/api/estimates', {
        method: 'PUT',
        credentials: 'include',
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


  const deleteEstimate = async (estimateId: string) => {
    if (!confirm('견적서를 삭제하시겠습니까?')) return

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/estimates/${estimateId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      const data = await response.json()

      if (data.success) {
        alert('견적서가 삭제되었습니다.')
        loadEstimates(selectedBusiness?.id)
      } else {
        alert(`삭제 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('견적서 삭제 오류:', error)
      alert('견적서 삭제 중 오류가 발생했습니다.')
    }
  }

  const filteredBusinesses = businesses.filter(b =>
    b.business_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredBusinesses.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedBusinesses = filteredBusinesses.slice(startIndex, endIndex)

  // 검색어 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

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

        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="사업장명 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="text-sm text-gray-600 whitespace-nowrap">
            총 {filteredBusinesses.length}개
          </div>
        </div>

        {/* 사업장 카드 그리드 - 4열 레이아웃 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 min-h-[320px]">
          {paginatedBusinesses.map((business) => (
            <div
              key={business.id}
              className="p-3 border rounded-lg cursor-pointer transition-all border-gray-200 hover:border-blue-300 hover:bg-blue-50"
              onClick={() => {
                setSelectedBusiness(business)
                setIsPreviewModalOpen(true)
              }}
            >
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{business.business_name}</p>
                  {business.address && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{business.address}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="이전 페이지"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // 현재 페이지 주변 페이지만 표시
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[40px] px-3 py-2 rounded-lg border transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                } else if (
                  page === currentPage - 2 ||
                  page === currentPage + 2
                ) {
                  return <span key={page} className="px-2 text-gray-400">...</span>
                }
                return null
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="다음 페이지"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <span className="ml-4 text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
          </div>
        )}
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
                  <tr
                    key={estimate.id}
                    className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedEstimate(estimate)}
                  >
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
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => downloadPDF(estimate.id, estimate.estimate_number)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded"
                          title="PDF 다운로드"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {userPermissionLevel >= 4 && (
                          <button
                            onClick={() => deleteEstimate(estimate.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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

      {/* 견적서 상세보기 모달 - 새로운 미리보기 형식 */}
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
                {/* 견적서 미리보기 - 새로운 형식 */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow">
                    <h1 className="text-2xl font-bold text-center mb-6">IoT 설치 견적서</h1>

                    {/* 공급받는자 / 공급자 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* 공급받는자 */}
                      <div className="border border-gray-300 rounded">
                        <div className="bg-blue-50 px-3 py-2 border-b border-gray-300">
                          <h3 className="font-bold text-sm">공급받는자</h3>
                        </div>
                        <div className="p-3 space-y-1 text-xs">
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">상호:</span>
                            <span className="col-span-2 font-medium">{selectedEstimate.business_name}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">사업장주소:</span>
                            <span className="col-span-2">{(selectedEstimate as any).customer_address || ''}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">전화:</span>
                            <span className="col-span-2">{(selectedEstimate as any).customer_phone || ''}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">담당자:</span>
                            <span className="col-span-2">{(selectedEstimate as any).customer_manager || ''}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">담당자연락처:</span>
                            <span className="col-span-2">{(selectedEstimate as any).customer_manager_contact || ''}</span>
                          </div>
                        </div>
                      </div>

                      {/* 공급자 */}
                      <div className="border border-gray-300 rounded">
                        <div className="bg-green-50 px-3 py-2 border-b border-gray-300">
                          <h3 className="font-bold text-sm">공급자</h3>
                        </div>
                        <div className="p-3 space-y-1 text-xs">
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">상호:</span>
                            <span className="col-span-2 font-medium">{(selectedEstimate as any).supplier_info?.company_name || ''}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">사업자번호:</span>
                            <span className="col-span-2">{(selectedEstimate as any).supplier_info?.registration_number || ''}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">대표자:</span>
                            <span className="col-span-2">{(selectedEstimate as any).supplier_info?.representative || ''}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">주소:</span>
                            <span className="col-span-2">{(selectedEstimate as any).supplier_info?.address || ''}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-600">전화:</span>
                            <span className="col-span-2">{(selectedEstimate as any).supplier_info?.phone || ''}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 품목 테이블 */}
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full border-collapse border border-gray-300 text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border border-gray-300 px-2 py-2 w-12">No</th>
                            <th className="border border-gray-300 px-2 py-2">품명</th>
                            <th className="border border-gray-300 px-2 py-2 w-20">규격</th>
                            <th className="border border-gray-300 px-2 py-2 w-16">수량</th>
                            <th className="border border-gray-300 px-2 py-2 w-24">단가</th>
                            <th className="border border-gray-300 px-2 py-2 w-24">공급가액</th>
                            <th className="border border-gray-300 px-2 py-2 w-20">부가세</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEstimate.estimate_items.map((item: any) => (
                            <tr key={item.no}>
                              <td className="border border-gray-300 px-2 py-1 text-center">{item.no}</td>
                              <td className="border border-gray-300 px-2 py-1">{item.name}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center">{item.spec}</td>
                              <td className="border border-gray-300 px-2 py-1 text-right">{item.quantity}</td>
                              <td className="border border-gray-300 px-2 py-1 text-right">
                                {item.unit_price.toLocaleString()}
                              </td>
                              <td className="border border-gray-300 px-2 py-1 text-right">
                                {item.supply_amount.toLocaleString()}
                              </td>
                              <td className="border border-gray-300 px-2 py-1 text-right">
                                {item.vat_amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 참고사항 */}
                    {(selectedEstimate as any).reference_notes && (
                      <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                        <h3 className="font-bold text-sm mb-2">참고사항</h3>
                        <div className="text-xs text-gray-700 whitespace-pre-wrap">
                          {(selectedEstimate as any).reference_notes}
                        </div>
                      </div>
                    )}

                    {/* 합계 */}
                    <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-gray-600 mb-1">공급가액</div>
                          <div className="text-lg font-bold">
                            ₩{selectedEstimate.subtotal.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-600 mb-1">부가세</div>
                          <div className="text-lg font-bold">
                            ₩{selectedEstimate.vat_amount.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-600 mb-1">합계금액</div>
                          <div className="text-xl font-bold text-blue-600">
                            ₩{selectedEstimate.total_amount.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 안내사항 */}
                    {(selectedEstimate as any).terms_and_conditions && (
                      <div className="bg-gray-50 border border-gray-200 rounded p-4">
                        <h3 className="font-bold text-sm mb-2">안내사항</h3>
                        <div className="text-xs text-gray-700 whitespace-pre-wrap">
                          {(selectedEstimate as any).terms_and_conditions}
                        </div>
                      </div>
                    )}
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

      {/* 견적서 미리보기 모달 */}
      {isPreviewModalOpen && selectedBusiness && (
        <EstimatePreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => {
            setIsPreviewModalOpen(false)
            setSelectedBusiness(null)
          }}
          businessId={selectedBusiness.id}
          businessName={selectedBusiness.business_name}
          onEstimateCreated={() => {
            if (selectedBusiness) {
              loadEstimates(selectedBusiness.id)
            }
          }}
        />
      )}
    </div>
  )
}
