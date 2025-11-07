// app/admin/document-automation/components/EstimatePreviewModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Download, FileText, Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface EstimateItem {
  no: number
  name: string
  spec: string
  quantity: number
  unit_price: number
  supply_amount: number
  vat_amount: number
  note: string
}

interface EstimatePreviewData {
  estimate_number: string
  estimate_date: string
  business_name: string
  customer_name: string
  customer_registration_number: string
  customer_address: string
  customer_representative: string
  customer_business_type: string
  customer_business_category: string
  customer_phone: string
  customer_manager: string
  customer_manager_contact: string
  supplier_info: {
    company_name: string
    address: string
    registration_number: string
    representative: string
    business_type: string
    business_category: string
    phone: string
    fax: string
  }
  estimate_items: EstimateItem[]
  subtotal: number
  vat_amount: number
  total_amount: number
  terms_and_conditions: string
}

interface EstimatePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  businessId: string
  businessName: string
  onEstimateCreated?: () => void
}

export default function EstimatePreviewModal({
  isOpen,
  onClose,
  businessId,
  businessName,
  onEstimateCreated
}: EstimatePreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [data, setData] = useState<EstimatePreviewData | null>(null)
  const [estimates, setEstimates] = useState<any[]>([])
  const [selectedEstimate, setSelectedEstimate] = useState<any | null>(null)
  const [referenceNotes, setReferenceNotes] = useState<string>('')

  // AuthContext에서 사용자 정보 및 권한 가져오기
  const { user } = useAuth()
  const userPermissionLevel = user?.permission_level || 0

  // 데이터 로드
  useEffect(() => {
    if (isOpen && businessId) {
      loadData()
      loadEstimates()
    }
  }, [isOpen, businessId])

  const loadData = async () => {
    try {
      setLoading(true)

      const token = localStorage.getItem('auth_token')
      const response = await fetch(
        `/api/estimates/preview?business_id=${businessId}`,
        {
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        }
      )

      if (!response.ok) {
        throw new Error('데이터 로드 실패')
      }

      const result = await response.json()
      setData(result.data)
    } catch (error) {
      console.error('데이터 로드 오류:', error)
      alert('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadEstimates = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(
        `/api/estimates?business_id=${businessId}`,
        {
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Cache-Control': 'no-cache'
          }
        }
      )

      if (response.ok) {
        const result = await response.json()
        setEstimates(result.data?.estimates || [])
      }
    } catch (error) {
      console.error('견적서 이력 로드 오류:', error)
    }
  }

  // 미리보기 HTML을 PDF로 변환
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

          ${(estimateData.reference_notes || referenceNotes) ? `
            <!-- 참고사항 -->
            <div style="background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
              <h3 style="font-weight: bold; font-size: 13px; margin-bottom: 10px;">참고사항</h3>
              <div style="font-size: 12px; white-space: pre-wrap; line-height: 1.6;">${estimateData.reference_notes || referenceNotes}</div>
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

  const handleGenerate = async () => {
    if (!data) return

    try {
      setGenerating(true)

      const token = localStorage.getItem('auth_token')
      const userId = localStorage.getItem('user_id')

      const response = await fetch('/api/estimates/generate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          business_id: businessId,
          reference_notes: referenceNotes,
          created_by: userId
        })
      })

      if (!response.ok) {
        throw new Error('견적서 생성 실패')
      }

      const result = await response.json()
      const createdEstimate = result.data

      // 즉시 PDF 생성 및 다운로드
      const pdf = await generatePDFFromPreview(createdEstimate)
      const dateStr = createdEstimate.estimate_date.replace(/-/g, '')
      const fileName = `${dateStr}_${businessName}_IoT설치견적서.pdf`
      pdf.save(fileName)

      alert('견적서가 생성되고 다운로드되었습니다.')

      // 참고사항 초기화
      setReferenceNotes('')

      // 이력 새로고침
      await loadEstimates()

      // 부모 컴포넌트에 알림
      if (onEstimateCreated) {
        onEstimateCreated()
      }
    } catch (error) {
      console.error('견적서 생성 오류:', error)
      alert('견적서 생성 중 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const downloadPDF = async (estimateId: string, estimateNumber: string, businessName: string, estimateDate: string) => {
    try {
      setLoading(true)

      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/estimates/${estimateId}/pdf`, {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })

      if (!response.ok) {
        throw new Error('PDF 생성 실패')
      }

      const { data: estimateData } = await response.json()

      // 미리보기 양식으로 PDF 생성
      const pdf = await generatePDFFromPreview(estimateData)

      // 파일명 생성: YYYYMMDD_사업장명_IoT설치견적서
      const dateStr = estimateDate.replace(/-/g, '')
      const fileName = `${dateStr}_${businessName}_IoT설치견적서.pdf`

      // PDF 저장
      pdf.save(fileName)
    } catch (error) {
      console.error('PDF 다운로드 오류:', error)
      alert('PDF 다운로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const deleteEstimate = async (estimateId: string) => {
    if (!confirm('견적서를 삭제하시겠습니까?')) return

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/estimates/${estimateId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })

      const result = await response.json()

      if (result.success) {
        alert('견적서가 삭제되었습니다.')
        await loadEstimates()
        // 부모 컴포넌트의 목록도 새로고침
        if (onEstimateCreated) {
          onEstimateCreated()
        }
      } else {
        alert(result.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('견적서 삭제 오류:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-3 md:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-full sm:max-w-[98vw] md:max-w-[95vw] lg:max-w-6xl max-h-[95vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex-1 min-w-0 mr-2">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">
              견적서 미리보기
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 truncate">
              {businessName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* 견적서 미리보기 */}
              <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
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
                          <span className="col-span-2 font-medium">{data.business_name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-600">사업장주소:</span>
                          <span className="col-span-2">{data.customer_address}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-600">전화:</span>
                          <span className="col-span-2">{data.customer_phone}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-600">담당자:</span>
                          <span className="col-span-2">{data.customer_manager}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-600">담당자연락처:</span>
                          <span className="col-span-2">{data.customer_manager_contact}</span>
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
                          <span className="col-span-2 font-medium">{data.supplier_info.company_name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-600">사업자번호:</span>
                          <span className="col-span-2">{data.supplier_info.registration_number}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-600">대표자:</span>
                          <span className="col-span-2">{data.supplier_info.representative}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-600">주소:</span>
                          <span className="col-span-2">{data.supplier_info.address}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-600">전화:</span>
                          <span className="col-span-2">{data.supplier_info.phone}</span>
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
                        {data.estimate_items.map((item) => (
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

                  {/* 참고사항 입력 */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2 text-gray-700">참고사항</label>
                    <textarea
                      value={referenceNotes}
                      onChange={(e) => setReferenceNotes(e.target.value)}
                      placeholder="견적서에 포함할 참고사항을 입력하세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      rows={3}
                    />
                  </div>

                  {/* 합계 */}
                  <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-gray-600 mb-1">공급가액</div>
                        <div className="text-lg font-bold">
                          ₩{data.subtotal.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-600 mb-1">부가세</div>
                        <div className="text-lg font-bold">
                          ₩{data.vat_amount.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-600 mb-1">합계금액</div>
                        <div className="text-xl font-bold text-blue-600">
                          ₩{data.total_amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 안내사항 */}
                  {data.terms_and_conditions && (
                    <div className="bg-gray-50 border border-gray-200 rounded p-4">
                      <h3 className="font-bold text-sm mb-2">안내사항</h3>
                      <div className="text-xs text-gray-700 whitespace-pre-wrap">
                        {data.terms_and_conditions}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 견적서 이력 */}
              {estimates.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-bold text-sm mb-3">견적서 이력</h3>
                  <div className="space-y-2">
                    {estimates.map((estimate) => (
                      <div
                        key={estimate.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{estimate.estimate_number}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(estimate.created_at).toLocaleString('ko-KR')}
                          </div>
                          {estimate.reference_notes && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-semibold">참고:</span> {estimate.reference_notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadPDF(estimate.id, estimate.estimate_number, estimate.business_name, estimate.estimate_date)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {userPermissionLevel >= 4 && (
                            <button
                              onClick={() => deleteEstimate(estimate.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              데이터를 불러올 수 없습니다.
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 p-3 sm:p-4 md:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            닫기
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !data}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                <span>생성 중...</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>견적서 생성</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
