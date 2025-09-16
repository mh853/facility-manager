'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User as UserIcon, LogOut, Shield, Settings } from 'lucide-react';
import { User } from '@/types';

interface UserProfileProps {
  className?: string;
}

export default function UserProfile({ className = '' }: UserProfileProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getRoleName = (role: number) => {
    switch (role) {
      case 3:
        return '관리자';
      case 2:
        return '실사담당자';
      case 1:
        return '일반사용자';
      default:
        return '사용자';
    }
  };

  const getRoleColor = (role: number) => {
    switch (role) {
      case 3:
        return 'bg-red-100 text-red-700 border-red-200';
      case 2:
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 1:
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-gray-900">{user.name}</div>
          <div className="text-xs text-gray-500">{user.email}</div>
        </div>
      </button>

      {isMenuOpen && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* 드롭다운 메뉴 */}
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            {/* 사용자 정보 헤더 */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-lg">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                  {user.department && (
                    <div className="text-sm text-gray-500">{user.department}</div>
                  )}
                </div>
              </div>

              {/* 역할 배지 */}
              <div className="mt-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(
                    user.role
                  )}`}
                >
                  {user.role === 3 && <Shield className="w-3 h-3 mr-1" />}
                  {getRoleName(user.role)}
                </span>
              </div>
            </div>

            {/* 메뉴 항목들 */}
            <div className="py-2">
              {user.role === 3 && (
                <a
                  href="/admin"
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Settings className="w-4 h-4 mr-3" />
                  관리자 패널
                </a>
              )}

              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-3" />
                로그아웃
              </button>
            </div>

            {/* 시스템 정보 */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
              <div>시설 관리 시스템 v1.0</div>
              {user.lastLoginAt && (
                <div>
                  마지막 로그인: {new Date(user.lastLoginAt).toLocaleString('ko-KR')}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// 간단한 사용자 아바타 컴포넌트
export function UserAvatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  return (
    <div className={`bg-blue-500 rounded-full flex items-center justify-center text-white font-medium ${sizeClasses[size]}`}>
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={user.name}
          className={`rounded-full object-cover ${sizeClasses[size]}`}
        />
      ) : (
        user.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}