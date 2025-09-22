// components/ui/AdminLayout.tsx - Modern Admin Layout Component
'use client'

import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  Home,
  Building2,
  FileText,
  History,
  Settings,
  Menu,
  X,
  ChevronRight,
  User,
  Clock,
  Activity,
  ClipboardList,
  TrendingUp,
  Sliders
} from 'lucide-react'

interface AdminLayoutProps {
  children: ReactNode
  title?: string
  description?: string
  actions?: ReactNode
}

interface NavigationItem {
  name: string
  href: string
  icon: any
  description: string
  requiredLevel?: number
}

const navigationItems: NavigationItem[] = [
  {
    name: '대시보드',
    href: '/admin',
    icon: Activity,
    description: '관리자 종합 현황 대시보드',
    requiredLevel: 1
  },
  {
    name: '사업장 관리',
    href: '/admin/business',
    icon: Building2,
    description: '사업장 정보 및 등록 관리',
    requiredLevel: 1
  },
  {
    name: '대기필증 관리',
    href: '/admin/air-permit',
    icon: FileText,
    description: '대기배출시설 허가증 관리',
    requiredLevel: 1
  },
  {
    name: '실사관리',
    href: '/facility',
    icon: Home,
    description: '사업장 실사 및 파일 관리',
    requiredLevel: 1
  },
  {
    name: '업무 관리',
    href: '/admin/tasks',
    icon: ClipboardList,
    description: '업무 흐름 및 진행 상황 관리',
    requiredLevel: 1
  },
  {
    name: '사용자 관리',
    href: '/admin/users',
    icon: User,
    description: '사용자 승인 및 권한 관리',
    requiredLevel: 3
  },
  {
    name: '주간 리포트',
    href: '/weekly-reports',
    icon: TrendingUp,
    description: '개인별 주간 업무 성과 분석',
    requiredLevel: 1
  },
  {
    name: '문서 자동화',
    href: '/admin/document-automation',
    icon: Settings,
    description: '문서 생성 및 자동화 설정',
    requiredLevel: 1
  },
  {
    name: '데이터 이력',
    href: '/admin/data-history',
    icon: History,
    description: '시스템 데이터 변경 이력',
    requiredLevel: 2
  },
  {
    name: '지연 기준 설정',
    href: '/admin/settings/delay-criteria',
    icon: Sliders,
    description: '업무 지연/위험 판단 기준 관리',
    requiredLevel: 3
  },
]

function NavigationItems({ pathname, onItemClick }: { pathname: string, onItemClick: () => void }) {
  const router = useRouter()
  const { user, permissions } = useAuth()

  // 사용자 권한에 따라 네비게이션 아이템 필터링
  const filteredItems = navigationItems.filter(item => {
    if (!user) return false;
    return user.permission_level >= (item.requiredLevel || 1);
  });

  return (
    <>
      {filteredItems.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon

        return (
          <div
            key={item.name}
            onClick={() => {
              router.push(item.href)
              onItemClick()
            }}
            className={`
              group flex items-center px-4 py-3 lg:px-4 lg:py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer
              ${isActive
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 lg:bg-gradient-to-br lg:from-blue-100 lg:to-indigo-100 text-blue-700 shadow-sm border border-blue-200'
                : 'text-gray-600 hover:bg-gray-50 lg:hover:bg-gray-100 hover:text-gray-900'
              }
            `}
          >
            <Icon className={`w-5 h-5 lg:w-5 lg:h-5 mr-3 lg:mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-sm lg:text-base ${isActive ? 'text-blue-900' : ''}`}>
                {item.name}
              </div>
              <div className={`text-xs lg:text-sm mt-0.5 ${isActive ? 'text-blue-600' : 'text-gray-400'} truncate`}>
                {item.description}
              </div>
            </div>
            {isActive && (
              <ChevronRight className="w-4 h-4 lg:w-3 lg:h-3 text-blue-600" />
            )}
          </div>
        )
      })}
    </>
  )
}

export default function AdminLayout({ children, title, description, actions }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  // Mount and time initialization
  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    }))

    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      }))
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // 인증 체크 및 리다이렉트
  useEffect(() => {
    if (mounted && !authLoading && !user) {
      console.log('🔒 [ADMIN-LAYOUT] 인증되지 않은 접근 - 로그인 페이지로 리다이렉트')
      router.push('/login?redirect=' + encodeURIComponent(pathname || '/admin'))
    }
  }, [mounted, authLoading, user, router, pathname])

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 사용자가 인증되지 않았으면 로딩 화면 유지 (리다이렉트가 진행 중)
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">인증 확인 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Container with improved layout */}
      <div className="lg:flex lg:gap-4 lg:p-4 lg:h-screen">
        {/* Sidebar - Improved responsive design */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-80 lg:w-64 xl:w-80 bg-white/95 lg:bg-white backdrop-blur-md
          shadow-xl lg:shadow-lg lg:border lg:border-gray-200 lg:rounded-xl transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-0 lg:flex lg:flex-col lg:h-full lg:min-w-0 lg:flex-shrink-0
        `}>
          <div className="flex flex-col h-full lg:p-2">
            {/* Logo/Header - Integrated with main design */}
            <div className="flex items-center justify-between lg:h-20 h-16 px-6 lg:px-4 bg-gray-800 lg:bg-white/80 lg:backdrop-blur-sm lg:rounded-xl lg:border lg:border-gray-100/50 lg:mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white lg:bg-blue-100 rounded-lg flex items-center justify-center lg:shadow-sm">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white lg:text-gray-800">시설관리</h1>
                  <p className="text-xs text-blue-100 lg:text-gray-500">주식회사 블루온</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 lg:px-3 py-4 lg:py-3 space-y-2 lg:space-y-1 lg:overflow-y-auto">
              <NavigationItems pathname={pathname || ''} onItemClick={() => setSidebarOpen(false)} />
            </nav>

            {/* Footer */}
            <div className="border-t border-gray-200 lg:border-gray-300 p-4 lg:p-3 lg:bg-gradient-to-r lg:from-gray-50 lg:to-blue-50 lg:rounded-xl lg:border lg:m-2 lg:mt-0">
              <Link href="/profile" className="flex items-center gap-3 lg:gap-2 hover:bg-white/50 lg:hover:bg-blue-100/50 rounded-lg p-2 -m-2 transition-colors duration-200">
                <div className="w-8 h-8 lg:w-7 lg:h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm">
                  <User className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm lg:text-xs font-medium text-gray-900">
                    {user?.name || '관리자'}
                  </div>
                  <div className="text-xs lg:text-xs text-gray-500 lg:hidden">
                    {user?.email || '주식회사 블루온'}
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Main content - Improved layout */}
        <div className="flex-1 lg:flex lg:flex-col lg:min-h-0 lg:min-w-0">
          <div className="lg:bg-white lg:shadow-lg lg:border lg:border-gray-200 lg:rounded-xl lg:flex lg:flex-col lg:h-full lg:overflow-hidden">
            {/* Top bar - Mobile optimized */}
            <header className="bg-white lg:bg-transparent border-b border-gray-200 lg:border-gray-300 shadow-sm lg:shadow-none">
              <div className="px-4 py-3 lg:px-8 lg:py-6">
                {/* Mobile Layout (< 768px) */}
                <div className="flex items-center justify-between md:hidden">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="flex-shrink-0 p-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors duration-200 touch-manipulation"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                    
                    <div className="min-w-0 flex-1">
                      {title && (
                        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
                      )}
                      {description && (
                        <p className="text-sm text-gray-500 truncate">{description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* 시간 표시 (모바일) */}
                    <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border">
                      <Clock className="w-3 h-3" />
                      <span>{currentTime}</span>
                    </div>
                    
                    {/* Mobile Actions */}
                    {actions && (
                      <div className="flex items-center">
                        {actions}
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop Layout (≥ 768px) */}
                <div className="hidden md:flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      {title && (
                        <h1 className="text-xl lg:text-2xl font-semibold lg:font-bold text-gray-900">{title}</h1>
                      )}
                      {description && (
                        <p className="text-sm lg:text-base text-gray-500 lg:text-gray-600 lg:mt-1">{description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 lg:gap-6">
                    {/* 시간 표시 */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border">
                      <Clock className="w-4 h-4" />
                      <span>{currentTime}</span>
                    </div>
                    
                    {/* Desktop Actions */}
                    {actions && (
                      <div className="flex items-center gap-3">
                        {actions}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {/* Page content */}
            <main className="p-6 lg:p-8 lg:flex-1 lg:overflow-y-auto bg-gray-50 lg:bg-transparent">
              <div className="lg:h-full">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}