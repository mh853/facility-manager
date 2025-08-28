// app/admin/data-history/page.tsx - 데이터 이력 및 복구 관리 페이지
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Undo2, Eye, Users, FileText, Database, History } from 'lucide-react'

export default function DataHistoryPage() {
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [selectedRecordId, setSelectedRecordId] = useState<string>('')
  const [limit, setLimit] = useState<number>(100)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null)
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false)
  const [restoreReason, setRestoreReason] = useState('')

  const tableOptions = [
    { value: 'business_info', label: '사업장 정보' },
    { value: 'air_permit_info', label: '대기필증 정보' },
    { value: 'discharge_outlets', label: '배출구 정보' },
    { value: 'discharge_facilities', label: '배출시설 정보' },
    { value: 'prevention_facilities', label: '방지시설 정보' }
  ]

  // 이력 데이터 로드
  const loadHistory = async () => {
    try {
      setIsLoading(true)
      
      let url = `/api/data-history?limit=${limit}`
      
      if (selectedTables.length > 0) {
        url += `&tables=${selectedTables.join(',')}`
      }
      
      if (selectedRecordId) {
        url += `&recordId=${selectedRecordId}`
      }
      
      const response = await fetch(url)
      const result = await response.json()
      
      if (response.ok) {
        setHistory(result.data)
      } else {
        alert('데이터 이력을 불러오는데 실패했습니다: ' + result.error)
      }
    } catch (error) {
      console.error('Error loading history:', error)
      alert('데이터 이력을 불러오는데 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  // 페이지 로드 시 이력 데이터 로드
  useEffect(() => {
    loadHistory()
  }, [])

  // 필터 적용
  const handleFilter = () => {
    loadHistory()
  }

  // 필터 초기화
  const handleResetFilter = () => {
    setSelectedTables([])
    setSelectedRecordId('')
    setLimit(100)
  }

  // 상세 정보 모달 열기
  const openDetailModal = (historyItem: any) => {
    setSelectedHistoryItem(historyItem)
    setIsDetailModalOpen(true)
  }

  // 복구 모달 열기
  const openRestoreModal = (historyItem: any) => {
    setSelectedHistoryItem(historyItem)
    setRestoreReason('')
    setIsRestoreModalOpen(true)
  }

  // 데이터 복구 실행
  const handleRestore = async () => {
    if (!selectedHistoryItem) return

    try {
      const response = await fetch('/api/data-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historyId: selectedHistoryItem.id,
          reason: restoreReason
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert('데이터가 성공적으로 복구되었습니다')
        setIsRestoreModalOpen(false)
        loadHistory() // 이력 새로고침
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error restoring data:', error)
      alert('데이터 복구에 실패했습니다')
    }
  }

  // 테이블 선택 핸들러
  const handleTableSelect = (tableValue: string) => {
    setSelectedTables(prev => 
      prev.includes(tableValue)
        ? prev.filter(t => t !== tableValue)
        : [...prev, tableValue]
    )
  }

  // JSON 데이터를 읽기 쉽게 포맷
  const formatJsonData = (data: any) => {
    if (!data) return '없음'
    return JSON.stringify(data, null, 2)
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
        <h1 className="text-3xl font-bold text-gray-800 mb-4">데이터 변경 이력 관리</h1>
        
        {/* 필터 섹션 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">필터 설정</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 테이블 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                테이블 선택
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded p-2">
                {tableOptions.map(option => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedTables.includes(option.value)}
                      onChange={() => handleTableSelect(option.value)}
                      className="mr-2"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 레코드 ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                특정 레코드 ID
              </label>
              <input
                type="text"
                value={selectedRecordId}
                onChange={(e) => setSelectedRecordId(e.target.value)}
                placeholder="UUID 입력..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 조회 개수 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                조회 개수
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value={50}>50개</option>
                <option value={100}>100개</option>
                <option value={200}>200개</option>
                <option value={500}>500개</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <button
              onClick={handleFilter}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              조회
            </button>
            <button
              onClick={handleResetFilter}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {/* 이력 목록 */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500">조회된 이력이 없습니다</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  테이블
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  변경일시
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  레코드 ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.table_display_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      item.operation === 'INSERT' ? 'bg-green-100 text-green-800' :
                      item.operation === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.operation_display_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.formatted_created_at}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {item.record_id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openDetailModal(item)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        상세
                      </button>
                      {(item.operation === 'UPDATE' || item.operation === 'DELETE') && (
                        <button
                          onClick={() => openRestoreModal(item)}
                          className="text-green-600 hover:text-green-900 flex items-center gap-1"
                        >
                          <Undo2 className="w-4 h-4" />
                          복구
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

      {/* 상세 정보 모달 */}
      {isDetailModalOpen && selectedHistoryItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">데이터 변경 상세 정보</h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">테이블</label>
                  <div className="mt-1">{selectedHistoryItem.table_display_name}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">작업</label>
                  <div className="mt-1">{selectedHistoryItem.operation_display_name}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">변경일시</label>
                  <div className="mt-1">{selectedHistoryItem.formatted_created_at}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">레코드 ID</label>
                  <div className="mt-1 font-mono text-sm">{selectedHistoryItem.record_id}</div>
                </div>
              </div>

              <div className="space-y-4">
                {selectedHistoryItem.old_data && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">변경 전 데이터</label>
                    <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-h-48">
                      {formatJsonData(selectedHistoryItem.old_data)}
                    </pre>
                  </div>
                )}
                
                {selectedHistoryItem.new_data && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">변경 후 데이터</label>
                    <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-h-48">
                      {formatJsonData(selectedHistoryItem.new_data)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-8">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 복구 확인 모달 */}
      {isRestoreModalOpen && selectedHistoryItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">데이터 복구 확인</h2>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  다음 데이터를 복구하시겠습니까?
                </p>
                <div className="bg-gray-100 p-3 rounded text-sm">
                  <div><strong>테이블:</strong> {selectedHistoryItem.table_display_name}</div>
                  <div><strong>작업:</strong> {selectedHistoryItem.operation_display_name}</div>
                  <div><strong>변경일시:</strong> {selectedHistoryItem.formatted_created_at}</div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  복구 사유 (선택사항)
                </label>
                <textarea
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="복구 사유를 입력하세요..."
                />
              </div>

              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setIsRestoreModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleRestore}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  복구 실행
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}