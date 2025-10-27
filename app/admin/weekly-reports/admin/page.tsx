'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/ui/AdminLayout'
import { withAuth, useAuth } from '@/contexts/AuthContext'
import { TokenManager } from '@/lib/api-client'
import {
  Calendar,
  Users,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Clock,
  RefreshCw,
  Eye
} from 'lucide-react'

interface WeeklyReport {
  id: string
  user_id: string
  user_name: string
  week_start: string
  week_end: string
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  pending_tasks: number
  completion_rate: number
  self_tasks: number
  subsidy_tasks: number
  overdue_tasks: number
  average_completion_time_days: number
  generated_at: string
  is_auto_generated: boolean
  completed_task_details: any[]
  pending_task_details: any[]
}

interface AdminSummary {
  total_users: number
  total_tasks: number
  total_completed: number
  average_completion_rate: number
  total_overdue: number
  total_in_progress: number
  total_pending: number
}

function AdminWeeklyReportsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState('')
  const [weekPeriod, setWeekPeriod] = useState<{ start: string; end: string; display: string } | null>(null)

  // URL 파라미터 또는 이번 주 기본값 설정
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const weekDateParam = urlParams.get('weekDate')

      if (weekDateParam) {
        console.log('📅 [관리자페이지] URL 주간 파라미터:', weekDateParam)
        setSelectedWeek(weekDateParam)
      } else {
        const today = new Date()
        const day = today.getDay()
        const diff = today.getDate() - day
        const monday = new Date(today.setDate(diff))
        setSelectedWeek(monday.toISOString().split('T')[0])
      }
    }
  }, [])

  const fetchAdminReports = async () => {
    if (!selectedWeek) return

    setLoading(true)
    try {
      const token = TokenManager.getToken()
      const response = await fetch(
        `/api/weekly-reports/admin?weekDate=${selectedWeek}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      console.log('📡 응답 상태:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ HTTP 에러:', response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()

      if (data.success) {
        setReports(data.data.reports)
        setSummary(data.data.summary)
        setWeekPeriod(data.data.week_period)
        console.log('✅ 리포트 조회 성공:', data.data.reports.length, '건')
      } else {
        console.error('리포트 조회 실패:', data.error || data.message)
        alert(data.message || '리포트 조회에 실패했습니다')
      }
    } catch (error: any) {
      console.error('리포트 조회 오류:', error)
      alert(`리포트 조회 중 오류가 발생했습니다: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const generateAllReports = async () => {
    if (!selectedWeek) {
      alert('주간을 먼저 선택해주세요')
      return
    }

    if (!confirm('전체 사용자의 리포트를 생성하시겠습니까?\n기존 리포트가 있으면 업데이트됩니다.')) {
      return
    }

    setGenerating(true)
    try {
      const token = TokenManager.getToken()
      const response = await fetch('/api/weekly-reports/generate-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ weekDate: selectedWeek })
      })

      const data = await response.json()

      if (data.success) {
        const results = data.data.results
        alert(`리포트 생성 완료!\n\n성공: ${results.success}건\n업데이트: ${results.updated}건\n실패: ${results.failed}건`)

        // 리포트 재조회
        await fetchAdminReports()
      } else {
        console.error('리포트 생성 실패:', data.error)
        alert(data.message || '리포트 생성에 실패했습니다')
      }
    } catch (error) {
      console.error('리포트 생성 오류:', error)
      alert('리포트 생성 중 오류가 발생했습니다')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (selectedWeek) {
      fetchAdminReports()
    }
  }, [selectedWeek])

  const getPerformanceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-100'
    if (rate >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <AdminLayout
      title="주간 리포트 관리"
      description="전체 사용자의 주간 업무 성과 확인 (관리자 전용)"
    >
      <div className="space-y-6">
        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <Calendar className="w-5 h-5 text-gray-500" />
              <label className="text-sm font-medium text-gray-700">주간 선택:</label>
              <input
                type="date"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={fetchAdminReports}
                disabled={loading || generating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? '조회중...' : '리포트 조회'}
              </button>
              <button
                onClick={generateAllReports}
                disabled={loading || generating}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                {generating ? '생성중...' : '전체 생성'}
              </button>
            </div>
            {weekPeriod && (
              <div className="text-sm text-gray-600">
                기간: {weekPeriod.display}
              </div>
            )}
          </div>
        </div>

        {/* 전체 통계 카드 */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.total_users}</div>
                  <div className="text-xs text-gray-600">전체 사용자</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.total_tasks}</div>
                  <div className="text-xs text-gray-600">총 업무</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.total_completed}</div>
                  <div className="text-xs text-gray-600">완료</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.total_in_progress}</div>
                  <div className="text-xs text-gray-600">진행중</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.total_pending}</div>
                  <div className="text-xs text-gray-600">대기</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.average_completion_rate}%</div>
                  <div className="text-xs text-gray-600">평균 완료율</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.total_overdue}</div>
                  <div className="text-xs text-gray-600">전체 연체</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 사용자별 리포트 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">사용자별 주간 성과</h3>
            <p className="text-sm text-gray-600 mt-1">
              {reports.length}명의 사용자 리포트
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {reports.map((report) => (
              <div
                key={report.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h4 className="text-lg font-semibold text-gray-900">{report.user_name}</h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPerformanceColor(report.completion_rate)}`}>
                        완료율 {report.completion_rate}%
                      </span>
                      {report.is_auto_generated && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          자동생성
                        </span>
                      )}
                      <button
                        onClick={() => router.push(`/admin/weekly-reports/${report.user_id}?weekDate=${selectedWeek}`)}
                        className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        상세보기
                      </button>
                    </div>

                    {/* 통계 그리드 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">총 업무</div>
                        <div className="text-xl font-bold text-gray-900">{report.total_tasks}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">완료</div>
                        <div className="text-xl font-bold text-green-600">{report.completed_tasks}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">진행중</div>
                        <div className="text-xl font-bold text-blue-600">{report.in_progress_tasks}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">대기</div>
                        <div className="text-xl font-bold text-gray-600">{report.pending_tasks}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">연체</div>
                        <div className={`text-xl font-bold ${report.overdue_tasks > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {report.overdue_tasks}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">평균 완료시간</div>
                        <div className="text-xl font-bold text-gray-900">{report.average_completion_time_days}일</div>
                      </div>
                    </div>

                    {/* 업무 타입 */}
                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                      <span>자체 {report.self_tasks}개</span>
                      <span>보조 {report.subsidy_tasks}개</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-xs text-gray-500">
                        {formatDate(report.generated_at)} 생성
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {reports.length === 0 && !loading && (
              <div className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">해당 주간의 리포트가 없습니다</p>
                <p className="text-sm text-gray-400 mt-2">
                  주간을 선택하고 리포트 조회 버튼을 클릭하세요
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

// 관리자 전용 (권한 3 이상)
export default withAuth(AdminWeeklyReportsPage, undefined, 3)
