'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/ui/AdminLayout'
import { withAuth } from '@/contexts/AuthContext'
import {
  Calendar,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Mail,
  Download,
  RefreshCw,
  BarChart3
} from 'lucide-react'

interface WeeklyTaskSummary {
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
  high_priority_completed: number
  medium_priority_completed: number
  low_priority_completed: number
  completed_task_details: Array<{
    id: string
    title: string
    business_name: string
    task_type: string
    status: string
    completed_at: string
    priority: string
  }>
  pending_task_details: Array<{
    id: string
    title: string
    business_name: string
    task_type: string
    status: string
    due_date?: string
    priority: string
    days_overdue?: number
  }>
  average_completion_time_days: number
  overdue_tasks: number
  created_at: string
}

function WeeklyReportsPage() {
  const [report, setReport] = useState<WeeklyTaskSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState('')
  const [currentUserId] = useState('temp-user-id') // 실제로는 auth context에서 가져옴

  // 이번 주 날짜를 기본값으로 설정
  useEffect(() => {
    const today = new Date()
    const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1))
    setSelectedWeek(monday.toISOString().split('T')[0])
  }, [])

  const fetchWeeklyReport = async () => {
    if (!selectedWeek) return

    setLoading(true)
    try {
      const response = await fetch(`/api/weekly-reports?userId=${currentUserId}&weekDate=${selectedWeek}`)
      const data = await response.json()

      if (data.success) {
        setReport(data.data.report)
      } else {
        console.error('주간 리포트 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('주간 리포트 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedWeek) {
      fetchWeeklyReport()
    }
  }, [selectedWeek])

  const sendEmailReport = async () => {
    if (!report) return

    try {
      const response = await fetch('/api/weekly-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          weekDate: selectedWeek,
          sendEmail: true,
          recipients: ['manager@company.com'] // 실제로는 매니저 이메일 목록
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('이메일이 성공적으로 발송되었습니다')
      }
    } catch (error) {
      console.error('이메일 발송 오류:', error)
      alert('이메일 발송 중 오류가 발생했습니다')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'document_complete':
      case 'subsidy_payment':
      case 'final_document_submit':
        return 'bg-green-100 text-green-800'
      case 'site_survey':
      case 'document_preparation':
      case 'subsidy_application':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <AdminLayout
      title="주간 업무 리포트"
      description="개인별 주간 업무 성과 및 진행 상황 분석"
    >
      <div className="space-y-6">
        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">주간 선택:</label>
              </div>
              <input
                type="date"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={fetchWeeklyReport}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? '조회중...' : '리포트 생성'}
              </button>
            </div>

            {report && (
              <div className="flex gap-2">
                <button
                  onClick={sendEmailReport}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  이메일 발송
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                  <Download className="w-4 h-4" />
                  PDF 다운로드
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 리포트 내용 */}
        {report ? (
          <div className="space-y-6">
            {/* 리포트 헤더 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{report.user_name}님의 주간 리포트</h2>
                  <p className="text-gray-600 mt-1">
                    {formatDate(report.week_start)} - {formatDate(report.week_end)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{report.completion_rate}%</div>
                  <div className="text-sm text-gray-600">완료율</div>
                </div>
              </div>
            </div>

            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{report.total_tasks}</div>
                    <div className="text-sm text-gray-600">총 업무</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{report.completed_tasks}</div>
                    <div className="text-sm text-gray-600">완료</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{report.average_completion_time_days}일</div>
                    <div className="text-sm text-gray-600">평균 완료시간</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{report.overdue_tasks}</div>
                    <div className="text-sm text-gray-600">연체 업무</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 진행 상황 차트 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">업무 진행 현황</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 상태별 분포 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">상태별 분포</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">완료</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${(report.completed_tasks / report.total_tasks) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{report.completed_tasks}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">진행중</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(report.in_progress_tasks / report.total_tasks) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{report.in_progress_tasks}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">대기</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gray-600 h-2 rounded-full"
                            style={{ width: `${(report.pending_tasks / report.total_tasks) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{report.pending_tasks}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 타입별 분포 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">업무 타입별</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">자체사업</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${(report.self_tasks / report.total_tasks) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{report.self_tasks}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">보조사업</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-orange-600 h-2 rounded-full"
                            style={{ width: `${(report.subsidy_tasks / report.total_tasks) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{report.subsidy_tasks}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 완료된 업무 목록 */}
            {report.completed_task_details.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  완료된 업무 ({report.completed_task_details.length}개)
                </h3>
                <div className="space-y-3">
                  {report.completed_task_details.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{task.title}</div>
                        <div className="text-sm text-gray-600">{task.business_name}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(task.status)}`}>
                          {task.task_type === 'self' ? '자체' : '보조'}
                        </span>
                        <span className={`text-sm font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}
                        </span>
                        <div className="text-xs text-gray-500">
                          {formatDate(task.completed_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 미완료 업무 목록 */}
            {report.pending_task_details.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  미완료 업무 ({report.pending_task_details.length}개)
                </h3>
                <div className="space-y-3">
                  {report.pending_task_details.map((task) => (
                    <div key={task.id} className={`flex items-center justify-between p-4 rounded-lg border ${
                      task.days_overdue && task.days_overdue > 0
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{task.title}</div>
                        <div className="text-sm text-gray-600">{task.business_name}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(task.status)}`}>
                          {task.task_type === 'self' ? '자체' : '보조'}
                        </span>
                        <span className={`text-sm font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}
                        </span>
                        {task.days_overdue && task.days_overdue > 0 && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                            {task.days_overdue}일 연체
                          </span>
                        )}
                        {task.due_date && (
                          <div className="text-xs text-gray-500">
                            마감: {formatDate(task.due_date)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">주간을 선택하고 리포트 생성 버튼을 클릭하세요</p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

// 주간 리포트는 모든 사용자가 접근 가능 (레벨 1: 일반사용자도 가능)
export default withAuth(WeeklyReportsPage, undefined, 1)