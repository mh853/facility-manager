'use client'

// app/admin/order-management/components/RouterEditModal.tsx
// 라우터 정보 수정 모달

import { useState, useEffect } from 'react'
import { X, AlertCircle, Check } from 'lucide-react'
import type { RouterInventoryItem } from '@/types/router-inventory'
import BusinessAutocomplete from '@/components/ui/BusinessAutocomplete'
import { getSupplierFromProductName } from '@/lib/router-supplier-mapping'

interface BusinessInfo {
  id: string
  business_name: string
}

interface RouterEditModalProps {
  router: RouterInventoryItem
  onClose: () => void
  onSuccess: () => void
}

export default function RouterEditModal({
  router,
  onClose,
  onSuccess
}: RouterEditModalProps) {
  const [formData, setFormData] = useState({
    product_name: router.product_name || '',
    serial_number: router.serial_number || '',
    mac_address: router.mac_address || '',
    imei: router.imei || '',
    shipped_date: router.shipped_date || '',
    supplier: router.supplier || '',
    assigned_business_id: router.assigned_business_id || '',
    notes: router.notes || ''
  })

  const [businessList, setBusinessList] = useState<BusinessInfo[]>([])
  const [loadingBusinessList, setLoadingBusinessList] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 사업장 목록 로드
  useEffect(() => {
    loadBusinessList()
  }, [])

  const loadBusinessList = async () => {
    try {
      setLoadingBusinessList(true)
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

      console.log('[RouterEditModal] 사업장 목록 로드 시작')

      const response = await fetch('/api/business-list', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      console.log('[RouterEditModal] API 응답:', {
        ok: response.ok,
        status: response.status
      })

      if (!response.ok) {
        throw new Error('사업장 목록 조회 실패')
      }

      const result = await response.json()
      console.log('[RouterEditModal] API 결과:', {
        success: result.success,
        hasData: !!result.data,
        businessCount: result.data?.businesses?.length || 0,
        sampleBusiness: result.data?.businesses?.[0]
      })

      if (result.success && result.data) {
        // API는 { data: { businesses: [...] } } 구조로 응답
        const businesses = result.data.businesses || []
        setBusinessList(businesses)
        console.log('[RouterEditModal] 사업장 목록 설정 완료:', businesses.length)
      }
    } catch (error) {
      console.error('[RouterEditModal] 사업장 목록 로드 오류:', error)
    } finally {
      setLoadingBusinessList(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // 상품명 변경 시 공급업체 자동 매핑
    if (name === 'product_name' && value) {
      const autoSupplier = getSupplierFromProductName(value)
      if (autoSupplier) {
        setFormData((prev) => ({ ...prev, supplier: autoSupplier }))
      }
    }
  }

  // 사업장 자동완성 변경 핸들러
  const handleBusinessChange = (businessId: string, businessName: string) => {
    setFormData((prev) => ({ ...prev, assigned_business_id: businessId }))
  }

  // 신규 사업장 생성 핸들러
  const handleCreateNewBusiness = async (
    businessName: string
  ): Promise<{ id: string; name: string }> => {
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

      const response = await fetch('/api/business-list', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ business_name: businessName })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '사업장 생성 실패')
      }

      console.log('[RouterEditModal] 신규 사업장 생성 완료:', result.data)

      // 사업장 목록 새로고침
      await loadBusinessList()

      return {
        id: result.data.id,
        name: result.data.business_name
      }
    } catch (error: any) {
      console.error('[RouterEditModal] 신규 사업장 생성 오류:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // 필수 필드 검증
    if (!formData.product_name.trim()) {
      setError('상품명은 필수입니다')
      return
    }

    if (!formData.serial_number.trim()) {
      setError('S/N은 필수입니다')
      return
    }

    try {
      setSubmitting(true)

      const token =
        typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

      const response = await fetch(`/api/router-inventory/${router.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          product_name: formData.product_name.trim(),
          serial_number: formData.serial_number.trim(),
          mac_address: formData.mac_address.trim() || null,
          imei: formData.imei.trim() || null,
          shipped_date: formData.shipped_date.trim() || null,
          supplier: formData.supplier.trim() || null,
          assigned_business_id: formData.assigned_business_id || null,
          notes: formData.notes.trim() || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || '라우터 수정 중 오류가 발생했습니다')
      }

      alert(result.message || '라우터 정보가 수정되었습니다')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('라우터 수정 오류:', error)
      setError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">라우터 정보 수정</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 본문 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 오류 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-900">
                  <p className="font-medium">오류</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 상품명 (필수) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="product_name"
              value={formData.product_name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* S/N (필수) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              S/N (시리얼 넘버) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="serial_number"
              value={formData.serial_number}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
            />
          </div>

          {/* MAC 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MAC 주소
            </label>
            <input
              type="text"
              name="mac_address"
              value={formData.mac_address}
              onChange={handleChange}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
            />
          </div>

          {/* IMEI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IMEI
            </label>
            <input
              type="text"
              name="imei"
              value={formData.imei}
              onChange={handleChange}
              placeholder="15자리 숫자"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
            />
          </div>

          {/* 출고일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              출고일
            </label>
            <input
              type="date"
              name="shipped_date"
              value={formData.shipped_date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* 공급업체 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              공급업체
            </label>
            <input
              type="text"
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              placeholder="예: 가이아씨앤에스, LG유플러스"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              💡 라우터를 제조하거나 공급하는 회사명을 입력하세요
            </p>
          </div>

          {/* 할당 사업장 (자동완성 + 신규 등록) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              할당 사업장
            </label>
            <BusinessAutocomplete
              value={formData.assigned_business_id}
              onChange={handleBusinessChange}
              businessList={businessList}
              placeholder="사업장 이름을 검색하세요..."
              disabled={loadingBusinessList}
              allowCreate={true}
              onCreateNew={handleCreateNewBusiness}
            />
            <p className="mt-1 text-xs text-gray-500">
              💡 검색 결과에 없으면 하단의 "신규 등록" 버튼을 클릭하세요
            </p>
          </div>

          {/* 비고 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비고
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </form>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '수정 중...' : '수정'}
          </button>
        </div>
      </div>
    </div>
  )
}
