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
  Bell,
  User,
  Search,
  Clock,
  Activity
} from 'lucide-react'

interface AdminLayoutProps {
  children: ReactNode
  title?: string
  description?: string
  actions?: ReactNode
}

const navigationItems = [
  {
    name: '대시보드',
    href: '/admin',
    icon: Activity,
    description: '관리자 종합 현황 대시보드'
  },
  {
    name: '실사관리',
    href: '/',
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
]

function NavigationItems({ pathname, onItemClick }: { pathname: string, onItemClick: () => void }) {
  const router = useRouter()
  
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
  const [searchQuery, setSearchQuery] = useState('')
  const [currentTime, setCurrentTime] = useState('')
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

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
              <NavigationItems pathname={pathname} onItemClick={() => setSidebarOpen(false)} />
            </nav>

            {/* Footer */}
            <div className="border-t border-gray-200 lg:border-gray-300 p-4 lg:p-3 lg:bg-gradient-to-r lg:from-gray-50 lg:to-blue-50 lg:rounded-xl lg:border lg:m-2 lg:mt-0">
              <div className="flex items-center gap-3 lg:gap-2">
                <div className="w-8 h-8 lg:w-7 lg:h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm">
                  <User className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm lg:text-xs font-medium text-gray-900">관리자</div>
                  <div className="text-xs lg:text-xs text-gray-500 lg:hidden">주식회사 블루온</div>
                </div>
              </div>
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
                    {/* Mobile Search Button */}
                    <button className="p-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors duration-200 touch-manipulation">
                      <Search className="w-5 h-5" />
                    </button>
                    
                    {/* Mobile Actions */}
                    {actions && (
                      <div className="flex items-center">
                        {actions}
                      </div>
                    )}
                    
                    {/* Mobile Notifications */}
                    <button className="relative p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors duration-200 touch-manipulation">
                      <Bell className="w-5 h-5" />
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                    </button>
                    
                    {/* Mobile Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                      <User className="w-5 h-5 text-white" />
                    </div>
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
                    {/* Desktop Search Bar */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="시설명, 담당자 검색..."
                        className="pl-10 pr-4 py-2.5 lg:py-3 w-64 lg:w-80 text-sm lg:text-base border border-gray-300 lg:border-gray-200 rounded-xl lg:rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 lg:bg-gray-50 hover:bg-white transition-all duration-200 shadow-sm"
                      />
                    </div>

                    {/* Desktop Quick Stats */}
                    <div className="hidden lg:flex items-center gap-4">
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm">
                        <Activity className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-semibold text-green-700">시스템 정상</span>
                      </div>
                      
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 text-gray-700 shadow-sm">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-semibold">
                          {currentTime}
                        </span>
                      </div>
                    </div>

                    {/* Desktop Actions */}
                    {actions && (
                      <div className="flex items-center gap-3">
                        {actions}
                      </div>
                    )}
                    
                    {/* Desktop User Area */}
                    <div className="flex items-center gap-4">
                      <button className="relative p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 shadow-sm border border-gray-200 lg:border-gray-300">
                        <Bell className="w-5 h-5" />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-sm"></span>
                      </button>
                      
                      <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                        <User className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                      </div>
                    </div>
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