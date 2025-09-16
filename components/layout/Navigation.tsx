'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationCenter from '@/components/work-management/NotificationCenter';
import {
  Building2,
  CheckSquare,
  Users,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  BarChart3,
  FileText,
  Home,
  Briefcase
} from 'lucide-react';

interface NavigationProps {
  className?: string;
}

const navigationItems = [
  {
    name: '홈',
    href: '/',
    icon: Home,
    description: '메인 대시보드'
  },
  {
    name: '사업장 관리',
    href: '/business',
    icon: Building2,
    description: '시설 관리 시스템'
  },
  {
    name: '내 업무',
    href: '/tasks',
    icon: CheckSquare,
    description: '업무 관리'
  },
  {
    name: '직원 관리',
    href: '/employees',
    icon: Users,
    description: '팀원 관리',
    requiresPermission: 'canViewAllTasks' as const
  }
];

const adminItems = [
  {
    name: '관리자 패널',
    href: '/admin',
    icon: Settings,
    description: '시스템 관리'
  },
  {
    name: '보고서',
    href: '/admin/reports',
    icon: FileText,
    description: '업무 보고서'
  },
  {
    name: '통계',
    href: '/admin/stats',
    icon: BarChart3,
    description: '업무 통계'
  }
];

export default function Navigation({ className = '' }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  // Simple role-based permissions - role 3 = admin
  const permissions = {
    canViewAllTasks: user?.role === 3,
    canCreateTasks: true,
    canEditTasks: user?.role === 3,
    canDeleteTasks: user?.role === 3,
    canViewReports: true,
    canApproveReports: user?.role === 3,
    canAccessAdminPages: user?.role === 3,
    canViewSensitiveData: user?.role === 3
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const filteredNavItems = navigationItems.filter(item => {
    if (!item.requiresPermission) return true;
    return permissions[item.requiresPermission];
  });

  const showAdminItems = permissions.canAccessAdminPages;

  if (!user) {
    return null; // 로그인하지 않은 경우 네비게이션 숨김
  }

  return (
    <nav className={`bg-white shadow-sm border-b border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* 로고 및 메인 네비게이션 */}
          <div className="flex">
            {/* 로고 */}
            <Link href="/" className="flex items-center px-4">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">
                시설관리시스템
              </span>
            </Link>

            {/* 데스크톱 메뉴 */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              ))}

              {/* 관리자 메뉴 */}
              {showAdminItems && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                      pathname?.startsWith('/admin')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    관리자
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </button>

                  {showUserMenu && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                      <div className="py-1">
                        {adminItems.map((item) => (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <item.icon className="w-4 h-4 mr-3" />
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-gray-500">{item.description}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 우측 메뉴 */}
          <div className="flex items-center">
            {/* 알림 센터 */}
            <NotificationCenter className="mr-4" />

            {/* 사용자 정보 */}
            <div className="relative ml-3">
              <div className="flex items-center">
                <span className="text-sm text-gray-700 mr-3">
                  {user.name}
                  <span className="text-xs text-gray-500 ml-1">
                    (관리자)
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700 focus:outline-none transition"
                  title="로그아웃"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 모바일 메뉴 버튼 */}
            <div className="sm:hidden ml-4">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                {isOpen ? (
                  <X className="block h-6 w-6" />
                ) : (
                  <Menu className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {isOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1 bg-gray-50 border-t border-gray-200">
            {filteredNavItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`block pl-3 pr-4 py-2 text-base font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-blue-50 border-r-4 border-blue-500 text-blue-700'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <item.icon className="w-5 h-5 mr-3" />
                  <div>
                    <div>{item.name}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                  </div>
                </div>
              </Link>
            ))}

            {/* 관리자 메뉴 (모바일) */}
            {showAdminItems && (
              <>
                <div className="border-t border-gray-200 pt-3 pb-2">
                  <div className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    관리자
                  </div>
                </div>
                {adminItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`block pl-3 pr-4 py-2 text-base font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-50 border-r-4 border-blue-500 text-blue-700'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <item.icon className="w-5 h-5 mr-3" />
                      <div>
                        <div>{item.name}</div>
                        <div className="text-sm text-gray-500">{item.description}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </div>

          {/* 모바일 사용자 정보 */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="flex items-center px-4">
              <div className="flex-1">
                <div className="text-base font-medium text-gray-800">{user.name}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
                <div className="text-xs text-gray-400">관리자</div>
              </div>
              <button
                onClick={handleLogout}
                className="ml-auto flex-shrink-0 p-2 text-gray-400 hover:text-gray-600"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}