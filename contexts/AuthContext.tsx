'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, SocialProvider, UserRole } from '@/types';
import { authAPI } from '@/lib/api-client';
import { getTokenFromCookie } from '@/utils/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider: SocialProvider) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // 현재 사용자 정보 로드
  const loadUser = async () => {
    try {
      const token = getTokenFromCookie();
      if (!token) {
        setUser(null);
        return;
      }

      const response = await authAPI.verify();
      if (response.success && response.data) {
        const employee = response.data.user;
        // Map Employee to User type
        const user: User = {
          id: employee.id,
          email: employee.email,
          name: employee.name,
          role: employee.permissionLevel as UserRole,
          isActive: employee.isActive,
          createdAt: new Date(employee.createdAt),
          lastLoginAt: employee.lastLoginAt ? new Date(employee.lastLoginAt) : undefined,
          department: employee.department
        };
        setUser(user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 소셜 로그인 시작
  const login = (provider: SocialProvider) => {
    try {
      // For Kakao login, redirect to existing auth URL
      if (provider === 'kakao') {
        window.location.href = '/api/auth/kakao';
      } else {
        console.warn('Unsupported social provider:', provider);
      }
    } catch (error) {
      console.error('Login initiation failed:', error);
    }
  };

  // 로그아웃
  const logout = async () => {
    try {
      await authAPI.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // 로그아웃 실패해도 클라이언트 상태는 초기화
      setUser(null);
    }
  };

  // 사용자 정보 새로고침
  const refreshUser = async () => {
    try {
      const response = await authAPI.verify();
      if (response.success && response.data) {
        const employee = response.data.user;
        // Map Employee to User type
        const user: User = {
          id: employee.id,
          email: employee.email,
          name: employee.name,
          role: employee.permissionLevel as UserRole,
          isActive: employee.isActive,
          createdAt: new Date(employee.createdAt),
          lastLoginAt: employee.lastLoginAt ? new Date(employee.lastLoginAt) : undefined,
          department: employee.department
        };
        setUser(user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
    }
  };

  // 컴포넌트 마운트 시 사용자 정보 로드
  useEffect(() => {
    loadUser();
  }, []);

  // 토큰 변경 감지 (탭 간 동기화)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-token') {
        loadUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 토큰 만료 자동 감지 및 갱신
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const checkTokenExpiry = async () => {
      // Token refresh not implemented for current system
      // If token is invalid, the API will return 401 and trigger logout
      try {
        await refreshUser();
      } catch (error) {
        console.error('Token validation failed:', error);
        setUser(null);
      }
    };

    // 10분마다 토큰 상태 확인
    const interval = setInterval(checkTokenExpiry, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, isAuthenticated]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 권한 검사 훅
export function useRequireAuth(requiredRole?: number) {
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      window.location.href = '/?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }

    if (requiredRole && user && user.role < requiredRole) {
      window.location.href = '/access-denied';
      return;
    }
  }, [user, isLoading, isAuthenticated, requiredRole]);

  return { user, isLoading, isAuthenticated };
}

// 관리자 권한 확인 훅
export function useRequireAdmin() {
  return useRequireAuth(3);
}