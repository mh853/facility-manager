'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, SocialProvider } from '@/types';
import { apiClient } from '@/lib/api-client';
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

      const currentUser = await apiClient.getCurrentUser();
      setUser(currentUser);
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
      const loginUrl = apiClient.getSocialLoginUrl(provider);
      window.location.href = loginUrl;
    } catch (error) {
      console.error('Login initiation failed:', error);
    }
  };

  // 로그아웃
  const logout = async () => {
    try {
      await apiClient.logout();
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
      const currentUser = await apiClient.getCurrentUser();
      setUser(currentUser);
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
      try {
        const refreshed = await apiClient.refreshToken();
        if (!refreshed) {
          // 토큰 갱신 실패 시 로그아웃
          setUser(null);
        }
      } catch (error) {
        console.error('Token refresh check failed:', error);
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