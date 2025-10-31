'use client'

// app/admin/order-management/components/RouterAddModal.tsx
// 라우터 일괄 추가 모달 (Excel 복사-붙여넣기)

import { useState } from 'react'
import { X, Upload, AlertCircle, Check } from 'lucide-react'
import { getSupplierFromProductName } from '@/lib/router-supplier-mapping'

interface RouterAddModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface ParsedRouter {
  product_name: string
  serial_number: string
  mac_address?: string
  imei?: string
  shipped_date?: string
  supplier?: string
  assigned_business_name?: string  // 사업장 이름 (이름으로 검색해서 ID 찾음)
}

export default function RouterAddModal({ onClose, onSuccess }: RouterAddModalProps) {
  const [pasteData, setPasteData] = useState('')
  const [parsedRouters, setParsedRouters] = useState<ParsedRouter[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Excel 데이터 파싱
  const handleParse = () => {
    setParseError(null)
    setParsedRouters([])

    if (!pasteData.trim()) {
      setParseError('데이터를 입력해주세요')
      return
    }

    try {
      const lines = pasteData.trim().split('\n')
      const routers: ParsedRouter[] = []

      // 첫 줄이 헤더인지 확인 (상품명, S/N 등의 키워드 포함)
      const firstLine = lines[0].toLowerCase()
      const hasHeader =
        firstLine.includes('상품명') ||
        firstLine.includes('product') ||
        firstLine.includes('s/n') ||
        firstLine.includes('serial')

      const startIndex = hasHeader ? 1 : 0

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // 탭 또는 여러 공백으로 구분
        const columns = line.split(/\t+/)

        if (columns.length < 2) {
          throw new Error(`${i + 1}번째 줄: 최소 2개 컬럼(상품명, S/N)이 필요합니다`)
        }

        const router: ParsedRouter = {
          product_name: columns[0].trim(),
          serial_number: columns[1].trim()
        }

        // S/N 중복 체크
        if (routers.some((r) => r.serial_number === router.serial_number)) {
          throw new Error(`중복된 S/N: ${router.serial_number}`)
        }

        // 선택적 컬럼 (빈 문자열은 undefined로 처리)
        if (columns[2] && columns[2].trim()) router.mac_address = columns[2].trim()
        if (columns[3] && columns[3].trim()) router.imei = columns[3].trim()
        if (columns[4] && columns[4].trim()) router.shipped_date = columns[4].trim()

        // 공급업체: 상품명 기반 자동 매핑
        const autoSupplier = getSupplierFromProductName(router.product_name)
        if (autoSupplier) {
          router.supplier = autoSupplier
        }

        // 할당 사업장 이름 (6번째 컬럼)
        if (columns[5] && columns[5].trim()) {
          router.assigned_business_name = columns[5].trim()
        }

        routers.push(router)
      }

      if (routers.length === 0) {
        throw new Error('유효한 데이터가 없습니다')
      }

      setParsedRouters(routers)
    } catch (error: any) {
      setParseError(error.message)
    }
  }

  // 라우터 추가 제출
  const handleSubmit = async () => {
    if (parsedRouters.length === 0) {
      alert('먼저 데이터를 파싱해주세요')
      return
    }

    try {
      setSubmitting(true)

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

      const response = await fetch('/api/router-inventory', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ routers: parsedRouters })
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMessage = result.error || result.message || '라우터 추가 중 오류가 발생했습니다'
        console.error('서버 응답 오류:', {
          status: response.status,
          statusText: response.statusText,
          result
        })
        throw new Error(errorMessage)
      }

      alert(result.message || `${parsedRouters.length}개 라우터가 추가되었습니다`)
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('라우터 추가 오류:', error)
      alert(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">라우터 일괄 추가</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 사용 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Upload className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-2">Excel 데이터 붙여넣기 방법:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Excel에서 라우터 정보를 복사합니다</li>
                  <li>아래 입력란에 붙여넣기(Ctrl+V)합니다</li>
                  <li>"데이터 파싱" 버튼을 클릭합니다</li>
                  <li>결과를 확인 후 "추가" 버튼을 클릭합니다</li>
                </ol>
                <p className="mt-3 font-medium text-green-700">
                  ✨ 중복 처리: 같은 S/N이 있으면 자동으로 업데이트됩니다!
                </p>
                <p className="mt-3 font-medium">컬럼 순서:</p>
                <p className="text-blue-700">
                  상품명(필수) | S/N(필수) | MAC 주소 | IMEI | 출고일 | 할당 사업장
                </p>
                <p className="mt-2 text-blue-700">
                  💡 빈 칸 처리: 데이터가 없는 셀은 그냥 비워두면 됩니다 (탭으로만 구분)
                </p>
                <p className="mt-2 text-green-700 font-medium">
                  ✨ 공급업체는 상품명 기준으로 자동 설정됩니다!
                </p>
                <p className="mt-1 text-green-700 font-medium">
                  ✨ 할당 사업장 이름을 입력하면 자동으로 할당됩니다!
                </p>
              </div>
            </div>
          </div>

          {/* 데이터 입력 영역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excel 데이터 입력
            </label>
            <textarea
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              placeholder="Excel에서 복사한 데이터를 여기에 붙여넣으세요&#10;&#10;예시:&#10;Router-X100	SN12345	AA:BB:CC:DD:EE:FF	123456	2025-01-15	업체A&#10;Router-X100	SN12346	AA:BB:CC:DD:EE:F0		2025-01-16	업체B (출고일 없음)&#10;Router-X100	SN12347				업체C (MAC, IMEI, 출고일 없음)"
              className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          {/* 파싱 버튼 */}
          <div>
            <button
              onClick={handleParse}
              disabled={!pasteData.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              데이터 파싱
            </button>
          </div>

          {/* 파싱 오류 */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-900">
                  <p className="font-medium">파싱 오류:</p>
                  <p className="mt-1">{parseError}</p>
                </div>
              </div>
            </div>
          )}

          {/* 파싱 결과 */}
          {parsedRouters.length > 0 && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-900 font-medium">
                    {parsedRouters.length}개 라우터 파싱 완료
                  </p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">
                          #
                        </th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">
                          상품명
                        </th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">
                          S/N
                        </th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">
                          MAC
                        </th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">
                          IMEI
                        </th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">
                          출고일
                        </th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">
                          할당 사업장
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parsedRouters.map((router, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-600">{index + 1}</td>
                          <td className="py-2 px-3 text-gray-900">
                            {router.product_name}
                          </td>
                          <td className="py-2 px-3 text-gray-900 font-mono">
                            {router.serial_number}
                          </td>
                          <td className="py-2 px-3 text-gray-600 font-mono">
                            {router.mac_address || '-'}
                          </td>
                          <td className="py-2 px-3 text-gray-600 font-mono">
                            {router.imei || '-'}
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            {router.shipped_date || '-'}
                          </td>
                          <td className="py-2 px-3 text-green-700 font-medium">
                            {router.assigned_business_name || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={parsedRouters.length === 0 || submitting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '추가 중...' : `${parsedRouters.length}개 추가`}
          </button>
        </div>
      </div>
    </div>
  )
}
