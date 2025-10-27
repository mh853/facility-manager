'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/ui/AdminLayout'
import StatsCard from '@/components/ui/StatsCard'
import OrganizationChart from '@/components/admin/OrganizationChart'
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
  ExternalLink
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

export default function AdminDashboard() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({
    totalBusinesses: 0,
    activeBusinesses: 0,
    monthlyRevenue: 0,
    installationsInProgress: 0,
    completedThisMonth: 0,
    upcomingInstallations: 0
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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    loadDashboardData()
  }, [])


  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // 병렬로 모든 데이터 로드
      await Promise.all([
        loadBusinessStats(),
        loadMonthlyRevenue(),
        loadInstallationStats(),
        loadRecentActivities()
      ])

    } catch (error) {
      console.warn('Dashboard data loading error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 사업장 통계 로드
  const loadBusinessStats = async () => {
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
        }
      }
    } catch (error) {
      console.warn('Business stats loading error:', error)
    }
  }

  // 이번 달 매출 로드 (설치월 기준) - 저장된 계산 결과 + 미계산 사업장 자동 계산
  const loadMonthlyRevenue = async () => {
    try {
      const now = new Date()
      const currentMonth = now.getMonth() + 1  // 1-12
      const currentYear = now.getFullYear()

      console.log('📊 [Dashboard] 현재 날짜:', { currentYear, currentMonth })

      // business-info-direct API 사용 (installation_date 조회)
      const businessResponse = await fetch('/api/business-info-direct')

      if (!businessResponse.ok) {
        console.warn('📊 [Dashboard] 사업장 조회 실패')
        setStats(prev => ({ ...prev, monthlyRevenue: 0 }))
        return
      }

      const businessData = await businessResponse.json()
      const businesses = businessData.data || []

      console.log('📊 [Dashboard] 전체 사업장:', businesses.length, '건')

      // 이번 달 설치된 사업장 필터링
      const monthlyBusinesses = businesses.filter((business: any) => {
        if (!business.installation_date) return false
        const installDate = new Date(business.installation_date)
        const installMonth = installDate.getMonth() + 1
        const installYear = installDate.getFullYear()
        return installMonth === currentMonth && installYear === currentYear
      })

      console.log('📊 [Dashboard] 이번 달 설치 사업장:', monthlyBusinesses.length, '건')

      // 저장된 매출 계산 데이터 조회
      const revenueResponse = await fetch('/api/revenue/calculate?limit=10000')
      const revenueData = await revenueResponse.json()
      const calculations = revenueData.data?.calculations || []

      console.log('📊 [Dashboard] 전체 저장된 매출 계산:', calculations.length, '건')

      // 매출 합산: 저장된 계산 결과 우선, 없으면 0
      const monthlyRevenue = monthlyBusinesses.reduce((sum: number, business: any) => {
        // 저장된 계산 결과 찾기
        const savedCalc = calculations.find((calc: any) => calc.business_id === business.id)

        if (savedCalc) {
          console.log('📊 [Dashboard] 사업장 매출 (저장됨):', {
            name: business.business_name,
            net_profit: (savedCalc.net_profit || 0).toLocaleString()
          })
          return sum + (savedCalc.net_profit || 0)
        } else {
          console.log('⚠️ [Dashboard] 사업장 매출 미계산:', business.business_name)
          return sum
        }
      }, 0)

      console.log('📊 [Dashboard] 이번 달 매출 합계:', monthlyRevenue.toLocaleString(), '원')

      setStats(prev => ({
        ...prev,
        monthlyRevenue: monthlyRevenue
      }))
    } catch (error) {
      console.warn('Monthly revenue loading error:', error)
      setStats(prev => ({ ...prev, monthlyRevenue: 0 }))
    }
  }

  // 설치 업무 통계 로드
  const loadInstallationStats = async () => {
    try {
      const response = await fetch('/api/facility-tasks')

      if (response.ok) {
        const data = await response.json()
        // API 응답 구조: { data: { tasks: [], count: 0 } }
        const tasks = data.data?.tasks || []

        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length
        const completed = tasks.filter((t: any) => {
          if (t.status !== 'completed' || !t.updated_at) return false
          const updatedDate = new Date(t.updated_at)
          return updatedDate.getMonth() === currentMonth &&
                 updatedDate.getFullYear() === currentYear
        }).length
        const upcoming = tasks.filter((t: any) => t.status === 'backlog').length

        setStats(prev => ({
          ...prev,
          installationsInProgress: inProgress,
          completedThisMonth: completed,
          upcomingInstallations: upcoming
        }))
      }
    } catch (error) {
      console.warn('Installation stats loading error:', error)
      setStats(prev => ({
        ...prev,
        installationsInProgress: 0,
        completedThisMonth: 0,
        upcomingInstallations: 0
      }))
    }
  }

  // 최근 활동 로드
  const loadRecentActivities = async () => {
    try {
      const activities: RecentActivity[] = []

      // 최근 사업장 추가 활동
      const businessResponse = await fetch('/api/business-list')
      if (businessResponse.ok) {
        const businessData = await businessResponse.json()
        const businesses = businessData.data?.businesses || []

        // 최근 3개 사업장
        const recentBusinesses = businesses
          .sort((a: any, b: any) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          )
          .slice(0, 2)

        recentBusinesses.forEach((business: any) => {
          activities.push({
            id: `business-${business.id}`,
            type: 'business_added',
            message: `새 사업장 "${business.business_name}" 등록됨`,
            timestamp: business.created_at || new Date().toISOString(),
            link: '/admin/business'
          })
        })
      }

      // 최근 완료된 업무
      const tasksResponse = await fetch('/api/facility-tasks')
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json()
        // API 응답 구조: { data: { tasks: [], count: 0 } }
        const tasks = tasksData.data?.tasks || []

        // 최근 완료된 업무 2개
        const completedTasks = tasks
          .filter((t: any) => t.status === 'completed')
          .sort((a: any, b: any) =>
            new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
          )
          .slice(0, 2)

        completedTasks.forEach((task: any) => {
          activities.push({
            id: `task-${task.id}`,
            type: 'installation_completed',
            message: `${task.title} 완료`,
            timestamp: task.updated_at || new Date().toISOString()
          })
        })
      }

      // 시간순 정렬 (최신순)
      const sortedActivities = activities
        .sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, 5) // 최대 5개

      setRecentActivities(sortedActivities.length > 0 ? sortedActivities : [
        {
          id: '1',
          type: 'business_added',
          message: '시스템 시작됨',
          timestamp: new Date().toISOString(),
          link: '/admin/business'
        }
      ])
    } catch (error) {
      console.warn('Recent activities loading error:', error)
      setRecentActivities([
        {
          id: '1',
          type: 'business_added',
          message: '시스템 시작됨',
          timestamp: new Date().toISOString(),
          link: '/admin/business'
        }
      ])
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
      description: '매출 현황 및 분석',
      icon: CreditCard,
      color: 'green',
      href: '/admin/revenue',
      stats: `${(stats.monthlyRevenue / 10000).toFixed(0)}만원`,
      disabled: false
    },
    {
      title: '업무 관리',
      description: '시설 설치 업무 관리',
      icon: Wrench,
      color: 'orange',
      href: '/admin/tasks',
      stats: `${stats.installationsInProgress}건 진행중`,
      disabled: false
    },
    {
      title: '실사 관리',
      description: '대기배출시설 실사 관리',
      icon: FileText,
      color: 'purple',
      href: '/admin/air-permit',
      stats: '실사 조회',
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

  return (
    <AdminLayout
      title="관리자 대시보드"
      description="시설 관리 시스템 종합 현황"
    >
      <div className="space-y-8">
        {/* 핵심 KPI 카드들 - 1행 레이아웃 (반응형) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 lg:gap-6">
          <StatsCard
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

          <StatsCard
            title="이번 달 매출"
            value={`${(stats.monthlyRevenue / 10000).toFixed(0)}만원`}
            icon={CreditCard}
            color="green"
            description="당월 누적 매출"
          />

          <StatsCard
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

          <StatsCard
            title="예정된 설치"
            value={stats.upcomingInstallations}
            icon={Calendar}
            color="purple"
            description="예정된 설치 건수"
          />
        </div>

        {/* 빠른 액션 섹션 - 업무 관리 */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 md:mb-6 flex items-center gap-2 sm:gap-3">
            <div className="p-1 sm:p-1.5 md:p-2 bg-blue-100 rounded-lg">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-600" />
            </div>
            <span className="text-sm sm:text-base md:text-xl">업무 관리</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {quickActions.map((action, index) => (
              <div
                key={index}
                onClick={() => !action.disabled && router.push(action.href)}
                className={`
                  relative p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl border-2 transition-all duration-200 text-left cursor-pointer
                  ${action.disabled
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-lg bg-white'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3 md:mb-4">
                  <div className={`
                    p-2 sm:p-2.5 md:p-3 rounded-lg
                    ${action.color === 'blue' ? 'bg-blue-100' : ''}
                    ${action.color === 'green' ? 'bg-green-100' : ''}
                    ${action.color === 'orange' ? 'bg-orange-100' : ''}
                    ${action.color === 'purple' ? 'bg-purple-100' : ''}
                  `}>
                    <action.icon className={`
                      w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6
                      ${action.color === 'blue' ? 'text-blue-600' : ''}
                      ${action.color === 'green' ? 'text-green-600' : ''}
                      ${action.color === 'orange' ? 'text-orange-600' : ''}
                      ${action.color === 'purple' ? 'text-purple-600' : ''}
                    `} />
                  </div>
                  {!action.disabled && (
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-gray-400" />
                  )}
                </div>

                <div>
                  <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
                    {action.title}
                  </h3>
                  <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-2 sm:mb-3 line-clamp-2">
                    {action.description}
                  </p>
                  <div className={`
                    text-xs sm:text-sm md:text-base font-medium
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 md:mb-4 flex items-center gap-1 sm:gap-2">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              최근 활동
            </h3>

            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="mt-0.5 sm:mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm md:text-base text-gray-900 font-medium line-clamp-2">
                      {activity.message}
                    </p>
                    <p className="text-[10px] sm:text-xs md:text-sm text-gray-500 mt-0.5 sm:mt-1">
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
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 md:mb-4 flex items-center gap-1 sm:gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              시스템 상태
            </h3>

            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-green-50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                  <span className="text-xs sm:text-sm md:text-base font-medium text-green-900">Supabase 연결</span>
                </div>
                <span className="text-[10px] sm:text-xs md:text-sm text-green-600">정상</span>
              </div>

              <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-green-50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                  <span className="text-xs sm:text-sm md:text-base font-medium text-green-900">파일 업로드</span>
                </div>
                <span className="text-[10px] sm:text-xs md:text-sm text-green-600">정상</span>
              </div>

              <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-green-50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                  <span className="text-xs sm:text-sm md:text-base font-medium text-green-900">매출 시스템</span>
                </div>
                <span className="text-[10px] sm:text-xs md:text-sm text-green-600">정상</span>
              </div>

              <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-yellow-50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-xs sm:text-sm md:text-base font-medium text-yellow-900">설치 관리</span>
                </div>
                <span className="text-[10px] sm:text-xs md:text-sm text-yellow-600">준비중</span>
              </div>
            </div>
          </div>
        </div>

        {/* 미래 기능 프리뷰 */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-lg sm:rounded-xl border border-blue-200 p-3 sm:p-4 md:p-6">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 md:mb-4 flex items-center gap-1 sm:gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            개발 예정 기능
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white bg-opacity-70 rounded-lg p-3 sm:p-4 border border-blue-100">
              <CreditCard className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600 mb-2 sm:mb-3" />
              <h4 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">매출 관리</h4>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 line-clamp-3">월별/연도별 매출 분석, 청구서 관리, 수익성 분석</p>
            </div>

            <div className="bg-white bg-opacity-70 rounded-lg p-3 sm:p-4 border border-blue-100">
              <Wrench className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-orange-600 mb-2 sm:mb-3" />
              <h4 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">설치 관리</h4>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 line-clamp-3">설치 일정 관리, 진행 상황 추적, 기술자 배정</p>
            </div>

            <div className="bg-white bg-opacity-70 rounded-lg p-3 sm:p-4 border border-blue-100">
              <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-purple-600 mb-2 sm:mb-3" />
              <h4 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">통계 리포트</h4>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 line-clamp-3">업무 성과 분석, 트렌드 분석, 자동 리포트 생성</p>
            </div>
          </div>
        </div>

        {/* 조직 현황 섹션 - 최하단 */}
        <OrganizationChart />
      </div>
    </AdminLayout>
  )
}