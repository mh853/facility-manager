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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    loadDashboardData()
  }, [])


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

  return (
    <AdminLayout
      title="관리자 대시보드"
      description="시설 관리 시스템 종합 현황"
    >
      <div className="space-y-8">
        {/* 핵심 KPI 카드들 - 2열 레이아웃 */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:gap-6">
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
            trend={{
              value: 120,
              direction: 'up',
              label: '목표 대비'
            }}
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

        {/* 조직 현황 섹션 */}
        <OrganizationChart />

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

              <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-yellow-50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-xs sm:text-sm md:text-base font-medium text-yellow-900">매출 시스템</span>
                </div>
                <span className="text-[10px] sm:text-xs md:text-sm text-yellow-600">준비중</span>
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
      </div>
    </AdminLayout>
  )
}