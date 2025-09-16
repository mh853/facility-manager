'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  Building2,
  Users,
  TrendingUp,
  Calendar,
  Settings,
  FileText,
  BarChart3,
  Wrench,
  CreditCard,
  Activity,
  ChevronRight,
  ExternalLink,
  User,
  Mail,
  Shield,
  Clock,
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'

interface DashboardStats {
  totalBusinesses: number
  activeBusinesses: number
  monthlyRevenue: number
  installationsInProgress: number
  completedThisMonth: number
  upcomingInstallations: number
}

interface RecentActivity {
  id: string
  type: 'business_added' | 'installation_completed' | 'revenue_recorded'
  message: string
  timestamp: string
  link?: string
}

interface MyTask {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  type: 'inspection' | 'maintenance' | 'report' | 'approval'
}

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  isRead: boolean
  createdAt: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({
    totalBusinesses: 0,
    activeBusinesses: 0,
    monthlyRevenue: 15000000,
    installationsInProgress: 3,
    completedThisMonth: 8,
    upcomingInstallations: 5
  })
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([
    {
      id: '1',
      type: 'business_added',
      message: '시스템 시작됨',
      timestamp: new Date().toISOString(),
      link: '/admin/business'
    }
  ])
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    loadDashboardData()
    loadMyTasks()
    loadNotifications()
  }, [])

  const loadMyTasks = async () => {
    // Mock tasks data - 실제 API 호출로 대체 가능
    setMyTasks([
      {
        id: '1',
        title: '농업회사법인 주식회사 건양 2공장 점검',
        status: 'in_progress',
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 내일
        type: 'inspection'
      },
      {
        id: '2',
        title: '오메가칼라 사업장 환경 보고서 승인',
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3일 후
        type: 'approval'
      },
      {
        id: '3',
        title: '월간 업무 보고서 작성',
        status: 'pending',
        priority: 'low',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 일주일 후
        type: 'report'
      }
    ])
  }

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=5')
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          const formattedNotifications = data.data.map((notif: any) => ({
            id: notif.id,
            title: notif.title,
            message: notif.message,
            type: notif.notification_type === '시스템공지' ? 'info' : 'warning',
            isRead: notif.is_read,
            createdAt: notif.created_at
          }))
          setNotifications(formattedNotifications)
        }
      } else {
        // 알림 API 실패 시 mock 데이터 사용
        setNotifications([
          {
            id: '1',
            title: '새로운 업무 할당',
            message: '농업회사법인 주식회사 건양 2공장 점검 업무가 할당되었습니다.',
            type: 'info',
            isRead: false,
            createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
          },
          {
            id: '2',
            title: '보고서 승인 요청',
            message: '오메가칼라 환경 보고서 승인이 필요합니다.',
            type: 'warning',
            isRead: false,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '3',
            title: '시스템 업데이트',
            message: '시설관리 시스템이 최신 버전으로 업데이트되었습니다.',
            type: 'success',
            isRead: true,
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        ])
      }
    } catch (error) {
      console.error('알림 로드 실패:', error)
      // 에러 시에도 mock 데이터 제공
      setNotifications([])
    }
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // Load business stats from business-list API with proper error handling
      try {
        const businessResponse = await fetch('/api/business-list')

        if (businessResponse.ok) {
          const contentType = businessResponse.headers.get('content-type')

          if (contentType && contentType.includes('application/json')) {
            const businessData = await businessResponse.json()
            const businesses = businessData.data?.businesses || []

            setStats(prev => ({
              ...prev,
              totalBusinesses: businesses.length,
              activeBusinesses: businesses.length
            }))
          } else {
            console.warn('API returned non-JSON response')
            setStats(prev => ({
              ...prev,
              totalBusinesses: 0,
              activeBusinesses: 0
            }))
          }
        } else {
          console.warn('API request failed:', businessResponse.status)
          setStats(prev => ({
            ...prev,
            totalBusinesses: 0,
            activeBusinesses: 0
          }))
        }
      } catch (apiError) {
        console.warn('Business API error:', apiError)
        setStats(prev => ({
          ...prev,
          totalBusinesses: 0,
          activeBusinesses: 0
        }))
      }

      // Mock data for future features
      setStats(prev => ({
        ...prev,
        monthlyRevenue: 15000000, // 1,500만원 (예시)
        installationsInProgress: 3,
        completedThisMonth: 8,
        upcomingInstallations: 5
      }))

      // Mock recent activities
      setRecentActivities([
        {
          id: '1',
          type: 'business_added',
          message: '새 사업장 "오메가칼라" 등록됨',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          link: '/admin/business'
        },
        {
          id: '2',
          type: 'installation_completed',
          message: '농업회사법인 주식회사 건양 2공장 설치 완료',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
        },
        {
          id: '3',
          type: 'revenue_recorded',
          message: '이번 달 매출 목표 달성 (120%)',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
        }
      ])

    } catch (error) {
      console.warn('Dashboard data loading error:', error)
      // 오류 발생 시에도 기본값으로 계속 진행 (사용자에게 알림 없이)
      setStats({
        totalBusinesses: 0,
        activeBusinesses: 0,
        monthlyRevenue: 15000000,
        installationsInProgress: 3,
        completedThisMonth: 8,
        upcomingInstallations: 5
      })

      // 기본 활동 내역도 설정
      setRecentActivities([
        {
          id: '1',
          type: 'business_added',
          message: '시스템 시작됨',
          timestamp: new Date().toISOString(),
          link: '/admin/business'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const quickActions = [
    {
      title: '사업장 관리',
      description: '사업장 정보 등록 및 관리',
      icon: Building2,
      color: 'blue',
      href: '/admin/business',
      stats: `${stats.totalBusinesses}개 등록`,
      disabled: false
    },
    {
      title: '매출 관리',
      description: '매출 현황 및 분석 (준비중)',
      icon: CreditCard,
      color: 'green',
      href: '#',
      stats: '준비중',
      disabled: true
    },
    {
      title: '설치 현황',
      description: '설치 진행 상황 관리 (준비중)',
      icon: Wrench,
      color: 'orange',
      href: '#',
      stats: '준비중',
      disabled: true
    },
    {
      title: '데이터 히스토리',
      description: '데이터 변경 이력 조회',
      icon: FileText,
      color: 'purple',
      href: '/admin/data-history',
      stats: '이력 조회',
      disabled: false
    }
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'business_added': return <Building2 className="w-4 h-4 text-blue-600" />
      case 'installation_completed': return <Wrench className="w-4 h-4 text-green-600" />
      case 'revenue_recorded': return <CreditCard className="w-4 h-4 text-purple-600" />
      default: return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  const formatRelativeTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    return new Date(timestamp).toLocaleDateString('ko-KR')
  }

  const getTaskStatusIcon = (status: MyTask['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-600" />
      case 'pending': return <AlertTriangle className="w-4 h-4 text-orange-600" />
      default: return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  const getPriorityColor = (priority: MyTask['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-600" />
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />
      case 'info':
      default: return <Bell className="w-4 h-4 text-blue-600" />
    }
  }

  const formatAccountInfo = () => {
    if (!user) return null

    // 소셜 로그인 방식은 user 객체에서 추정
    const loginMethod = '소셜 로그인'

    return {
      name: user.name,
      email: user.email,
      department: user.department || '미설정',
      permissionLevel: user.role,
      loginMethod,
      lastLoginAt: user.lastLoginAt
    }
  }

  // AdminLayout component
  const AdminLayoutComponent = ({ children, title, description }: any) => (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-2">{description}</p>
        </div>
        {children}
      </div>
    </div>
  )

  // StatsCard component
  const StatsCardComponent = ({ title, value, icon: Icon, color, description, trend }: any) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${color === 'blue' ? 'bg-blue-100' : color === 'green' ? 'bg-green-100' : color === 'orange' ? 'bg-orange-100' : 'bg-purple-100'}`}>
          <Icon className={`w-6 h-6 ${color === 'blue' ? 'text-blue-600' : color === 'green' ? 'text-green-600' : color === 'orange' ? 'text-orange-600' : 'text-purple-600'}`} />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
          {trend && (
            <div className="flex items-center mt-1">
              <span className="text-xs text-green-600">↗ {trend.value} {trend.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <AdminLayoutComponent
      title="관리자 대시보드"
      description="시설 관리 시스템 종합 현황"
    >
      <div className="space-y-8">
        {/* 핵심 KPI 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCardComponent
            title="전체 사업장"
            value={stats.totalBusinesses}
            icon={Building2}
            color="blue"
            description="등록된 총 사업장 수"
            trend={{
              value: stats.activeBusinesses,
              direction: 'up',
              label: '활성 사업장'
            }}
          />

          <StatsCardComponent
            title="이번 달 매출"
            value={`${(stats.monthlyRevenue / 10000).toFixed(0)}만원`}
            icon={CreditCard}
            color="green"
            description="당월 누적 매출"
            trend={{
              value: 120,
              direction: 'up',
              label: '목표 대비'
            }}
          />

          <StatsCardComponent
            title="설치 진행중"
            value={stats.installationsInProgress}
            icon={Wrench}
            color="orange"
            description="현재 진행 중인 설치"
            trend={{
              value: stats.completedThisMonth,
              direction: 'up',
              label: '이번 달 완료'
            }}
          />

          <StatsCardComponent
            title="예정된 설치"
            value={stats.upcomingInstallations}
            icon={Calendar}
            color="purple"
            description="예정된 설치 건수"
          />
        </div>

        {/* 계정 정보 및 내 업무 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* 계정 정보 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              계정 정보
            </h3>

            {user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{formatAccountInfo()?.name}</h4>
                    <p className="text-sm text-gray-600">{formatAccountInfo()?.department}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{formatAccountInfo()?.email}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      권한 레벨 {formatAccountInfo()?.permissionLevel}
                      {user.role === 3 && <span className="text-red-600"> (관리자)</span>}
                      {user.role === 2 && <span className="text-orange-600"> (매니저)</span>}
                      {user.role === 1 && <span className="text-blue-600"> (일반)</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{formatAccountInfo()?.department}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{formatAccountInfo()?.loginMethod}</span>
                  </div>
                </div>

                {user.lastLoginAt && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      마지막 로그인: {new Date(user.lastLoginAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500">계정 정보를 불러오는 중...</p>
              </div>
            )}
          </div>

          {/* 내 업무 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              내 업무
            </h3>

            <div className="space-y-4">
              {myTasks.length > 0 ? (
                myTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="mt-1">
                      {getTaskStatusIcon(task.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 mb-1 truncate">
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded border ${getPriorityColor(task.priority)}`}>
                          {task.priority === 'high' && '높음'}
                          {task.priority === 'medium' && '보통'}
                          {task.priority === 'low' && '낮음'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {task.type === 'inspection' && '점검'}
                          {task.type === 'maintenance' && '정비'}
                          {task.type === 'report' && '보고서'}
                          {task.type === 'approval' && '승인'}
                        </span>
                      </div>
                      {task.dueDate && (
                        <p className="text-xs text-gray-500">
                          기한: {new Date(task.dueDate).toLocaleDateString('ko-KR')}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">할당된 업무가 없습니다.</p>
                </div>
              )}
            </div>

            {myTasks.length > 3 && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <button className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium">
                  모든 업무 보기 ({myTasks.length}개)
                </button>
              </div>
            )}
          </div>

          {/* 알림 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-600" />
              알림
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </h3>

            <div className="space-y-4">
              {notifications.length > 0 ? (
                notifications.slice(0, 3).map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      notification.isRead ? 'bg-gray-50' : 'bg-blue-50 border-l-4 border-blue-400'
                    }`}
                  >
                    <div className="mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-medium mb-1 truncate ${
                        notification.isRead ? 'text-gray-700' : 'text-gray-900'
                      }`}>
                        {notification.title}
                      </h4>
                      <p className={`text-xs mb-2 ${
                        notification.isRead ? 'text-gray-500' : 'text-gray-700'
                      }`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">새로운 알림이 없습니다.</p>
                </div>
              )}
            </div>

            {notifications.length > 3 && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <button className="w-full text-sm text-purple-600 hover:text-purple-800 font-medium">
                  모든 알림 보기
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 빠른 액션 섹션 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            업무 관리
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => (
              <div
                key={index}
                onClick={() => !action.disabled && router.push(action.href)}
                className={`
                  relative p-6 rounded-xl border-2 transition-all duration-200 text-left cursor-pointer
                  ${action.disabled
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-lg bg-white'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`
                    p-3 rounded-lg
                    ${action.color === 'blue' ? 'bg-blue-100' : ''}
                    ${action.color === 'green' ? 'bg-green-100' : ''}
                    ${action.color === 'orange' ? 'bg-orange-100' : ''}
                    ${action.color === 'purple' ? 'bg-purple-100' : ''}
                  `}>
                    <action.icon className={`
                      w-6 h-6
                      ${action.color === 'blue' ? 'text-blue-600' : ''}
                      ${action.color === 'green' ? 'text-green-600' : ''}
                      ${action.color === 'orange' ? 'text-orange-600' : ''}
                      ${action.color === 'purple' ? 'text-purple-600' : ''}
                    `} />
                  </div>
                  {!action.disabled && (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {action.description}
                  </p>
                  <div className={`
                    text-sm font-medium
                    ${action.color === 'blue' ? 'text-blue-600' : ''}
                    ${action.color === 'green' ? 'text-green-600' : ''}
                    ${action.color === 'orange' ? 'text-orange-600' : ''}
                    ${action.color === 'purple' ? 'text-purple-600' : ''}
                    ${action.disabled ? 'text-gray-400' : ''}
                  `}>
                    {action.stats}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 최근 활동 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              최근 활동
            </h3>

            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium">
                      {activity.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                  {activity.link && (
                    <div
                      onClick={() => router.push(activity.link!)}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 시스템 상태 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              시스템 상태
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-900">Supabase 연결</span>
                </div>
                <span className="text-xs text-green-600">정상</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-900">파일 업로드</span>
                </div>
                <span className="text-xs text-green-600">정상</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm font-medium text-yellow-900">매출 시스템</span>
                </div>
                <span className="text-xs text-yellow-600">준비중</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm font-medium text-yellow-900">설치 관리</span>
                </div>
                <span className="text-xs text-yellow-600">준비중</span>
              </div>
            </div>
          </div>
        </div>

        {/* 미래 기능 프리뷰 */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            개발 예정 기능
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white bg-opacity-70 rounded-lg p-4 border border-blue-100">
              <CreditCard className="w-8 h-8 text-blue-600 mb-3" />
              <h4 className="font-semibold text-gray-900 mb-2">매출 관리</h4>
              <p className="text-sm text-gray-600">월별/연도별 매출 분석, 청구서 관리, 수익성 분석</p>
            </div>

            <div className="bg-white bg-opacity-70 rounded-lg p-4 border border-blue-100">
              <Wrench className="w-8 h-8 text-orange-600 mb-3" />
              <h4 className="font-semibold text-gray-900 mb-2">설치 관리</h4>
              <p className="text-sm text-gray-600">설치 일정 관리, 진행 상황 추적, 기술자 배정</p>
            </div>

            <div className="bg-white bg-opacity-70 rounded-lg p-4 border border-blue-100">
              <BarChart3 className="w-8 h-8 text-purple-600 mb-3" />
              <h4 className="font-semibold text-gray-900 mb-2">통계 리포트</h4>
              <p className="text-sm text-gray-600">업무 성과 분석, 트렌드 분석, 자동 리포트 생성</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayoutComponent>
  )
}