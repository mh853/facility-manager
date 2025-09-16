// components/ui/AdminLayout.tsx - Modern Admin Layout Component
'use client'

import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  LogOut,
  Users,
  CheckSquare
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface AdminLayoutProps {
  children: ReactNode
  title?: string
  description?: string
  actions?: ReactNode
}

const getNavigationItems = (userPermissionLevel?: number) => [
  {
    name: '대시보드',
    href: '/admin',
    icon: Activity,
    description: '관리자 종합 현황 대시보드'
  },
  {
    name: '실사관리',
    href: '/business',
    icon: Home,
    description: '사업장 실사 및 파일 관리'
  },
  {
    name: '사업장 관리',
    href: '/admin/business',
    icon: Building2,
    description: '사업장 정보 및 등록 관리'
  },
  {
    name: '대기필증 관리',
    href: '/admin/air-permit',
    icon: FileText,
    description: '대기배출시설 허가증 관리'
  },
  {
    name: '업무 관리',
    href: '/admin/tasks',
    icon: CheckSquare,
    description: '업무 등록 및 진행 상황 관리'
  },
  {
    name: '데이터 이력',
    href: '/admin/data-history',
    icon: History,
    description: '시스템 데이터 변경 이력'
  },
  {
    name: '문서 자동화',
    href: '/admin/document-automation',
    icon: Settings,
    description: '문서 생성 및 자동화 설정'
  },
  // 관리자 전용 메뉴 (맨 아래 배치)
  ...(userPermissionLevel === 3 ? [{
    name: '사용자 관리',
    href: '/admin/users',
    icon: Users,
    description: '시스템 사용자 및 권한 관리'
  }] : []),
]

function NavigationItems({ pathname, onItemClick, userPermissionLevel }: {
  pathname: string,
  onItemClick: () => void,
  userPermissionLevel?: number
}) {
  const router = useRouter()
  const navigationItems = getNavigationItems(userPermissionLevel)

  return (
    <>
      {navigationItems.map((item) => {
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
              group flex items-center px-4 py-3 lg:px-3 lg:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer
              ${isActive 
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 lg:bg-gradient-to-br lg:from-blue-100 lg:to-indigo-100 text-blue-700 shadow-sm border border-blue-200' 
                : 'text-gray-600 hover:bg-gray-50 lg:hover:bg-gray-100 hover:text-gray-900'
              }
            `}
          >
            <Icon className={`w-5 h-5 lg:w-4 lg:h-4 mr-3 lg:mr-2.5 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <div className="flex-1">
              <div className={`font-medium lg:text-sm ${isActive ? 'text-blue-900' : ''}`}>
                {item.name}
              </div>
              <div className={`text-xs lg:text-xs mt-0.5 lg:hidden ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
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
  const { user, logout } = useAuth()

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

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/login')
    } catch (error) {
      console.error('로그아웃 에러:', error)
    }
  }

  // 사용자 정보 포맷팅
  const getUserDisplayName = () => {
    if (!user) return '사용자'
    return user.name || user.email || '사용자'
  }

  const getUserSubtitle = () => {
    if (!user) return '로딩 중...'

    // 부서가 있으면 부서를 표시
    if (user.department) return user.department

    // 권한 레벨로 표시
    switch (user.role) {
      case 3: return '관리자'
      case 2: return '매니저'
      case 1: return '일반 사용자'
      default: return '사용자'
    }
  }

  const getUserInitial = () => {
    if (!user) return 'U'
    const name = user.name || user.email || 'User'
    return name.charAt(0).toUpperCase()
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
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

      {/* Container with integrated layout */}
      <div className="lg:flex lg:gap-6 lg:p-6 lg:h-screen">
        {/* Sidebar - Integrated Card Design */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white/95 lg:bg-white/90 backdrop-blur-md 
          shadow-xl lg:shadow-sm lg:border lg:border-gray-200 lg:rounded-2xl transform transition-all duration-300 ease-in-out 
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          lg:translate-x-0 lg:static lg:z-0 lg:flex lg:flex-col lg:h-full lg:max-h-[calc(100vh-3rem)]
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
            <nav className="flex-1 px-3 lg:px-2 py-4 lg:py-2 space-y-1 lg:overflow-y-auto">
              <NavigationItems
                pathname={pathname || ''}
                onItemClick={() => setSidebarOpen(false)}
                userPermissionLevel={user?.role}
              />
            </nav>

            {/* Footer - Enhanced User Info */}
            <div className="border-t border-gray-200 lg:border-gray-300 p-4 lg:p-3 lg:bg-gradient-to-r lg:from-gray-50 lg:to-blue-50 lg:rounded-xl lg:border lg:m-2 lg:mt-0">
              {/* 사용자 정보 - 클릭 가능 */}
              <button
                onClick={() => router.push('/profile')}
                className="w-full flex items-center gap-3 lg:gap-2 mb-3 p-2 rounded-lg hover:bg-white hover:bg-opacity-50 transition-colors duration-200 group"
              >
                <div className="w-8 h-8 lg:w-7 lg:h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <span className="text-xs lg:text-xs font-bold text-white">
                    {getUserInitial()}
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm lg:text-xs font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                    {getUserDisplayName()}
                  </div>
                  <div className="text-xs lg:text-xs text-gray-600 truncate group-hover:text-blue-600 transition-colors">
                    {getUserSubtitle()}
                  </div>
                  {user?.email && (
                    <div className="text-xs text-gray-500 truncate lg:hidden group-hover:text-blue-500 transition-colors">
                      {user.email}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </button>

              {/* 추가 사용자 정보 (모바일에서만 표시) */}
              {user && (
                <div className="mb-3 lg:hidden">
                  <div className="bg-white bg-opacity-50 rounded-lg p-2 space-y-1">
                    {user.id && (
                      <div className="text-xs text-gray-600">
                        ID: {user.id.slice(-6)}
                      </div>
                    )}
                    <div className="text-xs text-gray-600">
                      권한: {user.role === 3 ? '관리자' :
                             user.role === 2 ? '매니저' : '일반사용자'}
                    </div>
                    {user.lastLoginAt && (
                      <div className="text-xs text-gray-500">
                        최근 로그인: {new Date(user.lastLoginAt).toLocaleDateString('ko-KR')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 로그아웃 버튼 */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 group"
              >
                <LogOut className="w-4 h-4 group-hover:text-red-600" />
                <span className="font-medium">로그아웃</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main content - Integrated Card Design */}
        <div className="flex-1 lg:flex lg:flex-col lg:min-h-0">
          <div className="lg:bg-white lg:shadow-sm lg:border lg:border-gray-200 lg:rounded-2xl lg:flex lg:flex-col lg:h-full lg:overflow-hidden">
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