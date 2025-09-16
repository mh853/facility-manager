'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authAPI, TokenManager } from '@/lib/api-client';
import { Employee } from '@/types/work-management';

interface SocialAccount {
  id: string;
  provider: 'kakao' | 'naver' | 'google';
  provider_user_id: string;
  provider_email: string;
  provider_name: string;
  provider_picture_url?: string;
  connected_at: string;
  last_login_at: string;
  is_primary: boolean;
}

interface AuthContextType {
  user: Employee | null;
  socialAccounts: SocialAccount[] | null;
  permissions: {
    canViewAllTasks: boolean;
    canCreateTasks: boolean;
    canEditTasks: boolean;
    canDeleteTasks: boolean;
    canViewReports: boolean;
    canApproveReports: boolean;
    canAccessAdminPages: boolean;
    canViewSensitiveData: boolean;
  } | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  socialLogin: (token: string, userData: any, isNewUser: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[] | null>(null);
  const [permissions, setPermissions] = useState<AuthContextType['permissions']>(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await authAPI.login(email, password);

      if (response.success && response.data) {
        setUser(response.data.user);
        setPermissions(response.data.permissions);
        setSocialAccounts(null); // 이메일 로그인은 소셜 계정 정보 없음
        return { success: true };
      } else {
        return {
          success: false,
          error: response.error?.message || '로그인에 실패했습니다.'
        };
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      return {
        success: false,
        error: '네트워크 오류가 발생했습니다.'
      };
    } finally {
      setLoading(false);
    }
  };

  const socialLogin = async (token: string, userData: any, isNewUser: boolean) => {
    try {
      setLoading(true);

      // 토큰을 직접 저장
      TokenManager.setToken(token);

      // 토큰 검증을 통해 최신 사용자 정보 가져오기
      const response = await authAPI.verify();

      if (response.success && response.data) {
        setUser(response.data.user);
        setPermissions(response.data.permissions);
        setSocialAccounts(response.data.socialAccounts || []);

        console.log('✅ [AUTH-CONTEXT] 소셜 로그인 성공:', {
          user: response.data.user,
          isNewUser,
          socialAccounts: response.data.socialAccounts?.length || 0
        });

        return { success: true };
      } else {
        // 토큰이 유효하지 않음 - 제거
        TokenManager.removeToken();
        return {
          success: false,
          error: response.error?.message || '소셜 로그인 인증에 실패했습니다.'
        };
      }
    } catch (error) {
      console.error('소셜 로그인 오류:', error);
      TokenManager.removeToken();
      return {
        success: false,
        error: '소셜 로그인 중 오류가 발생했습니다.'
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('로그아웃 오류:', error);
    } finally {
      setUser(null);
      setPermissions(null);
      setSocialAccounts(null);
      TokenManager.removeToken();
    }
  };

  const checkAuth = async () => {
    try {
      setLoading(true);
      const token = TokenManager.getToken();

      if (!token) {
        console.log('🔒 [AUTH-CONTEXT] 토큰 없음 - 로그인 필요');
        setUser(null);
        setPermissions(null);
        setSocialAccounts(null);
        return;
      }

      console.log('🔑 [AUTH-CONTEXT] 토큰 확인 중...');
      const response = await authAPI.verify();

      if (response.success && response.data) {
        setUser(response.data.user);
        setPermissions(response.data.permissions);
        setSocialAccounts(response.data.socialAccounts || []);
        console.log('✅ [AUTH-CONTEXT] 인증 성공:', response.data.user?.name);
      } else {
        // 토큰이 유효하지 않음
        console.warn('⚠️ [AUTH-CONTEXT] 토큰 무효:', response.error?.message);
        TokenManager.removeToken();
        setUser(null);
        setPermissions(null);
        setSocialAccounts(null);
      }
    } catch (error) {
      console.error('❌ [AUTH-CONTEXT] 인증 확인 오류:', error);
      TokenManager.removeToken();
      setUser(null);
      setPermissions(null);
      setSocialAccounts(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value: AuthContextType = {
    user,
    socialAccounts,
    permissions,
    loading,
    login,
    socialLogin,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 권한 확인 훅
export function usePermission() {
  const { permissions } = useAuth();

  return {
    canViewAllTasks: permissions?.canViewAllTasks || false,
    canCreateTasks: permissions?.canCreateTasks || false,
    canEditTasks: permissions?.canEditTasks || false,
    canDeleteTasks: permissions?.canDeleteTasks || false,
    canViewReports: permissions?.canViewReports || false,
    canApproveReports: permissions?.canApproveReports || false,
    canAccessAdminPages: permissions?.canAccessAdminPages || false,
    canViewSensitiveData: permissions?.canViewSensitiveData || false,
  };
}

// 인증이 필요한 컴포넌트를 래핑하는 HOC
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission?: keyof AuthContextType['permissions']
) {
  return function AuthenticatedComponent(props: P) {
    const { user, permissions, loading } = useAuth();

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!user) {
      // 로그인 페이지로 리다이렉트 (클라이언트에서 처리)
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }

    if (requiredPermission && !permissions?.[requiredPermission]) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">접근 권한 없음</h1>
            <p className="text-gray-600">이 페이지에 접근할 권한이 없습니다.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}