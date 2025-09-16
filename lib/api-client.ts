import { AuthResponse, LoginRequest, User } from '@/types';
import { getTokenFromCookie, setTokenCookie, removeTokenCookie } from '@/utils/auth';

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://facility.blueon-iot.com'
      : 'http://localhost:3000';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = getTokenFromCookie();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // 토큰이 만료되었거나 유효하지 않음
          this.logout();
          throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return response.text() as unknown as T;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // 인증 관련 API
  async login(loginData: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await this.request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
      });

      if (response.success && response.token) {
        setTokenCookie(response.token);
      }

      return response;
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '로그인에 실패했습니다.'
      };
    }
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      removeTokenCookie();
      // 로그아웃 후 홈페이지로 리다이렉트
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await this.request<{ user: User }>('/api/auth/me');
      return response.user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const response = await this.request<AuthResponse>('/api/auth/refresh', {
        method: 'POST',
      });

      if (response.success && response.token) {
        setTokenCookie(response.token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  // 소셜 로그인 URL 생성
  getSocialLoginUrl(provider: 'kakao' | 'naver' | 'google'): string {
    const redirectUri = encodeURIComponent(`${this.baseUrl}/api/auth/social/${provider}/callback`);
    const state = Math.random().toString(36).substring(7);

    // 상태 값을 세션 스토리지에 저장 (CSRF 방지)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('oauth_state', state);
    }

    switch (provider) {
      case 'kakao':
        return `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&state=${state}`;

      case 'naver':
        return `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&redirect_uri=${redirectUri}&state=${state}`;

      case 'google':
        return `https://accounts.google.com/o/oauth2/v2/auth?scope=https%3A//www.googleapis.com/auth/userinfo.profile%20https%3A//www.googleapis.com/auth/userinfo.email&access_type=offline&include_granted_scopes=true&response_type=code&state=${state}&redirect_uri=${redirectUri}&client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}`;

      default:
        throw new Error('지원하지 않는 소셜 로그인 제공자입니다.');
    }
  }

  // 비즈니스 관련 API
  async getBusinessList(): Promise<any[]> {
    return this.request<any[]>('/api/business-list');
  }

  async getUploadedFiles(businessName: string): Promise<any> {
    return this.request(`/api/uploaded-files-supabase?businessName=${encodeURIComponent(businessName)}`);
  }

  // 관리자 API
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/api/admin/users');
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    return this.request<User>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(userId: string): Promise<void> {
    return this.request(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // 건강 상태 확인
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/api/health');
  }
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient();

// 편의 함수들
export const login = (loginData: LoginRequest) => apiClient.login(loginData);
export const logout = () => apiClient.logout();
export const getCurrentUser = () => apiClient.getCurrentUser();
export const refreshToken = () => apiClient.refreshToken();
export const getSocialLoginUrl = (provider: 'kakao' | 'naver' | 'google') =>
  apiClient.getSocialLoginUrl(provider);

export default apiClient;