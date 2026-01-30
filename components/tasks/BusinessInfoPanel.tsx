// components/tasks/BusinessInfoPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { formatDate, formatCurrency } from '@/utils/formatters'

interface UnifiedBusinessInfo {
  id: string
  business_name: string
  address: string | null
  manager_name: string | null
  manager_contact: string | null

  // 일정 관리
  subsidy_approval_date: string | null
  contract_sent_date: string | null
  order_date: string | null
  shipment_date: string | null
  installation_date: string | null
  construction_report_submitted_at: string | null
  greenlink_confirmation_submitted_at: string | null
  attachment_completion_submitted_at: string | null

  // 계산서 및 입금 (보조금)
  invoice_1st_date: string | null
  invoice_1st_amount: number | null
  payment_1st_date: string | null
  payment_1st_amount: number | null
  invoice_2nd_date: string | null
  invoice_2nd_amount: number | null
  payment_2nd_date: string | null
  payment_2nd_amount: number | null
  invoice_additional_date: string | null
  payment_additional_date: string | null
  payment_additional_amount: number | null

  // 계산서 및 입금 (자비)
  invoice_advance_date: string | null
  invoice_advance_amount: number | null
  payment_advance_date: string | null
  payment_advance_amount: number | null
  invoice_balance_date: string | null
  invoice_balance_amount: number | null
  payment_balance_date: string | null
  payment_balance_amount: number | null
}

interface Memo {
  id: string
  content: string
  author: string | null
  created_at: string
  source_type?: string // 'manual' or 'task_sync'
  task_status?: string | null
  task_type?: string | null
}

interface BusinessInfoPanelProps {
  businessId: string | null
  businessName?: string
  taskId?: string // 현재 업무 ID (복귀용)
  onModalClose?: () => void // 모달 닫기 콜백
}

// 기본 정보 섹션
function BasicInfoSection({ data }: { data: UnifiedBusinessInfo | null }) {
  if (!data) return null

  return (
    <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200">
      <h4 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
        <span>🏢</span>
        <span>기본 정보</span>
      </h4>
      <div className="space-y-1 text-xs text-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 min-w-[50px]">사업장:</span>
          <span className="font-medium">{data.business_name}</span>
        </div>
        {data.address && (
          <div className="flex items-start gap-2">
            <span className="text-gray-500 min-w-[50px]">주소:</span>
            <span className="flex-1">{data.address}</span>
          </div>
        )}
        {data.manager_name && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[50px]">담당자:</span>
            <span>{data.manager_name} {data.manager_contact && `(${data.manager_contact})`}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// 일정 관리 섹션
function ScheduleSection({ data }: { data: UnifiedBusinessInfo | null }) {
  if (!data) return null

  const scheduleItems = [
    { label: '보조금 승인일', value: data.subsidy_approval_date, icon: '💰' },
    { label: '계약서 발송일', value: data.contract_sent_date, icon: '📄' },
    { label: '발주일', value: data.order_date, icon: '📦' },
    { label: '출고일', value: data.shipment_date, icon: '🚚' },
    { label: '설치일', value: data.installation_date, icon: '🔧' },
    { label: '착공신고서 제출일', value: data.construction_report_submitted_at, icon: '📋' },
    { label: '그린링크 제출일', value: data.greenlink_confirmation_submitted_at, icon: '🔗' },
    { label: '부착완료 통보서', value: data.attachment_completion_submitted_at, icon: '✅' },
  ]

  const hasSchedule = scheduleItems.some(item => item.value)

  if (!hasSchedule) {
    return null
  }

  return (
    <div className="bg-white rounded-lg p-4 mb-3 border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span>📅</span>
        <span>일정 관리</span>
      </h4>
      <div className="space-y-2">
        {scheduleItems.map(item => (
          item.value && (
            <div key={item.label} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 flex items-center gap-1">
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </span>
              <span className="font-medium text-gray-900">{formatDate(item.value)}</span>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

// 계산서 및 입금 현황 섹션
function InvoicePaymentSection({ data }: { data: UnifiedBusinessInfo | null }) {
  if (!data) return null

  const invoices = [
    {
      label: '1차',
      invoice: { date: data.invoice_1st_date, amount: data.invoice_1st_amount },
      payment: { date: data.payment_1st_date, amount: data.payment_1st_amount }
    },
    {
      label: '2차',
      invoice: { date: data.invoice_2nd_date, amount: data.invoice_2nd_amount },
      payment: { date: data.payment_2nd_date, amount: data.payment_2nd_amount }
    },
    {
      label: '추가',
      invoice: { date: data.invoice_additional_date, amount: null },
      payment: { date: data.payment_additional_date, amount: data.payment_additional_amount }
    },
    {
      label: '선급',
      invoice: { date: data.invoice_advance_date, amount: data.invoice_advance_amount },
      payment: { date: data.payment_advance_date, amount: data.payment_advance_amount }
    },
    {
      label: '잔금',
      invoice: { date: data.invoice_balance_date, amount: data.invoice_balance_amount },
      payment: { date: data.payment_balance_date, amount: data.payment_balance_amount }
    },
  ]

  const hasInvoices = invoices.some(item => item.invoice.date || item.payment.date)

  if (!hasInvoices) {
    return null
  }

  return (
    <div className="bg-white rounded-lg p-4 mb-3 border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span>💰</span>
        <span>계산서 및 입금 현황</span>
      </h4>
      <div className="space-y-2">
        {invoices.map(item => (
          (item.invoice.date || item.payment.date) && (
            <div key={item.label} className="border-l-2 border-blue-400 pl-3 py-1">
              <div className="text-xs font-medium text-gray-600 mb-1">[{item.label}]</div>
              <div className="text-xs space-y-1">
                {item.invoice.date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">발행:</span>
                    <span>{formatDate(item.invoice.date)} {item.invoice.amount && `(${formatCurrency(item.invoice.amount)}원)`}</span>
                  </div>
                )}
                {item.payment.date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">입금:</span>
                    <span>{formatDate(item.payment.date)} {item.payment.amount && `(${formatCurrency(item.payment.amount)}원)`}</span>
                  </div>
                )}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

// 메모 섹션
function MemoSection({ memos }: { memos: Memo[] }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span>📝</span>
        <span>업무진행현황 메모</span>
      </h4>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {memos.length === 0 ? (
          <p className="text-xs text-gray-500 italic">등록된 메모가 없습니다.</p>
        ) : (
          memos.map((memo, idx) => (
            <div key={memo.id || idx} className="bg-gray-50 p-2 rounded text-xs border border-gray-100">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-1.5">
                  {memo.source_type === 'task_sync' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
                      업무
                    </span>
                  )}
                  <span className="font-medium text-gray-700">{memo.author || '작성자'}</span>
                </div>
                <span className="text-gray-500 text-[10px]">{formatDate(memo.created_at)}</span>
              </div>
              <p className="text-gray-600 whitespace-pre-wrap">{memo.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// 빈 상태 컴포넌트
function EmptyState({ message }: { message: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">📋</div>
        <p className="text-gray-500 text-sm">{message}</p>
      </div>
    </div>
  )
}

// 로딩 컴포넌트
function LoadingSpinner() {
  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
}

// 메인 컴포넌트
export default function BusinessInfoPanel({
  businessId,
  businessName,
  taskId,
  onModalClose
}: BusinessInfoPanelProps) {
  const router = useRouter()
  const [businessData, setBusinessData] = useState<UnifiedBusinessInfo | null>(null)
  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (businessId) {
      fetchData()
    } else {
      setBusinessData(null)
      setMemos([])
    }
  }, [businessId])

  const fetchData = async () => {
    if (!businessId) return

    setLoading(true)
    setError(null)

    try {
      // 사업장 정보 조회
      const timestamp = Date.now()
      const response = await fetch(`/api/business-info-direct?id=${businessId}&t=${timestamp}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.data && data.data.length > 0) {
        setBusinessData(data.data[0])
      } else {
        setBusinessData(null)
      }

      // 메모 조회
      const memosResponse = await fetch(`/api/business-memos?businessId=${businessId}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })

      if (memosResponse.ok) {
        const memosData = await memosResponse.json()
        if (memosData.success && memosData.data) {
          // API가 { data: { data: [...], metadata: {...} } } 형태로 반환하는 경우 처리
          const memosArray = Array.isArray(memosData.data)
            ? memosData.data
            : memosData.data.data || [];
          setMemos(memosArray)
        }
      }
    } catch (err: any) {
      console.error('사업장 정보 조회 오류:', err)
      setError(err.message || '데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!businessId) {
    return <EmptyState message="사업장을 선택하면 상세 정보가 표시됩니다." />
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!businessData) {
    return <EmptyState message="사업장 정보를 찾을 수 없습니다." />
  }

  // 사업장 상세보기 버튼 핸들러
  const handleOpenBusinessDetail = () => {
    if (!businessId || !taskId) return

    // ⚡ 최적화: 네비게이션과 모달 닫기를 동시에 처리
    const targetUrl = `/admin/business?openModal=${businessId}&returnTo=tasks&taskId=${taskId}`

    // 네비게이션 시작 (즉시 실행)
    router.push(targetUrl)

    // 모달 닫기 (네비게이션과 동시에)
    if (onModalClose) {
      onModalClose()
    }
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50 p-4">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-lg mb-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <span>📊</span>
              <span>사업장 정보</span>
            </h3>
            <p className="text-xs text-blue-100 mt-1">
              조회된 사업장의 상세 정보입니다.
            </p>
          </div>

          {/* 상세보기 버튼 */}
          {businessId && taskId && (
            <button
              onClick={handleOpenBusinessDetail}
              className="flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
              title="사업장 상세보기"
            >
              <span className="hidden sm:inline">상세보기</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 기본 정보 (작게) */}
      <BasicInfoSection data={businessData} />

      {/* 일정 관리 (주요) */}
      <ScheduleSection data={businessData} />

      {/* 계산서 및 입금 현황 (주요) */}
      <InvoicePaymentSection data={businessData} />

      {/* 메모 (주요) */}
      <MemoSection memos={memos} />
    </div>
  )
}
