// components/ui/GoogleSheetsImporter.tsx - 구글시트 일괄 가져오기 컴포넌트
'use client'

import { useState } from 'react'
import { Download, RefreshCw, CheckCircle, AlertCircle, FileSpreadsheet, Database } from 'lucide-react'

interface ImportResult {
  totalBusinesses: number
  totalFacilities: number
  dischargeTotal: number
  preventionTotal: number
  processingTime: number
}

interface BusinessInfo {
  businessName: string
  dischargeCount: number
  preventionCount: number
  outletCount: number
  rowRange: string
}

export default function GoogleSheetsImporter() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    summary: ImportResult
    businesses: BusinessInfo[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log('🏭 전체 사업장 가져오기 시작')
      
      const response = await fetch('/api/import-all-facilities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
        console.log('✅ 전체 가져오기 성공:', data.data.summary)
        
        // 3초 후 페이지 새로고침 (데이터 동기화)
        setTimeout(() => {
          window.location.reload()
        }, 3000)
      } else {
        setError(data.message || '전체 가져오기에 실패했습니다.')
        console.error('❌ 가져오기 실패:', data.message)
      }
    } catch (err) {
      const errorMessage = '네트워크 오류가 발생했습니다: ' + 
        (err instanceof Error ? err.message : '알 수 없는 오류')
      setError(errorMessage)
      console.error('❌ 네트워크 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* Import Button */}
      <button
        onClick={handleImport}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm border border-green-700 font-semibold text-sm"
      >
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4" />
        )}
        {loading ? '가져오는 중...' : '구글시트 가져오기'}
      </button>

      {/* Result Status */}
      {(result || error) && (
        <div className="flex items-center gap-2">
          {result && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">
                {result.summary.totalBusinesses}개 사업장 완료
              </span>
            </div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-800">가져오기 실패</span>
            </div>
          )}
        </div>
      )}

      {/* Success Badge - 간단한 표시만 */}
      {result && (
        <div className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
          {result.summary.totalFacilities}개 시설 완료
        </div>
      )}
    </div>
  )
}