// lib/api-client.ts
// 업무관리 시스템 API 클라이언트

import {
  Employee,
  WorkTask,
  Notification,
  ApiResponse,
  PaginatedResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  TaskFilters,
  NotificationFilters
} from '@/types/work-management';

// API 기본 설정
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://your-vercel-domain.vercel.app'
  : 'http://localhost:3000';

// 토큰 관리
export class TokenManager {
  private static readonly TOKEN_KEY = 'facility_manager_token';

  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static removeToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.TOKEN_KEY);
  }
}

// HTTP 요청 헬퍼
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const token = TokenManager.getToken();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      // 토큰 만료 또는 인증 실패 처리
      if (response.status === 401) {
        console.warn('🔒 [API-CLIENT] 인증 실패 또는 토큰 만료:', {
          url: endpoint,
          error: data.error || data.message
        });

        TokenManager.removeToken();

        // 로그인 페이지로 리다이렉트 (클라이언트에서 처리)
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }

      return data;
    } catch (error) {
      console.error('❌ [API-CLIENT] 네트워크 오류:', {
        url: endpoint,
        error: error
      });
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: '네트워크 오류가 발생했습니다.'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<T>(`${endpoint}${queryString}`);
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

const apiClient = new ApiClient();
export { apiClient };

// 인증 API
export const authAPI = {
  async login(email: string, password: string): Promise<ApiResponse<{
    token: string;
    user: Employee;
    permissions: any;
  }>> {
    const response = await apiClient.post('/api/auth/login', { email, password });

    if (response.success && response.data && typeof response.data === 'object' && 'token' in response.data) {
      TokenManager.setToken(response.data.token as string);
    }

    return response as ApiResponse<{ token: string; user: Employee; permissions: any; }>;
  },

  async socialLogin(provider: string, code: string, state?: string): Promise<ApiResponse<{
    token: string;
    user: Employee;
    permissions: any;
    isNewUser: boolean;
  }>> {
    const response = await apiClient.post(`/api/auth/social/${provider}`, { code, state });

    if (response.success && response.data && typeof response.data === 'object' && 'token' in response.data) {
      TokenManager.setToken(response.data.token as string);
    }

    return response as ApiResponse<{ token: string; user: Employee; permissions: any; isNewUser: boolean; }>;
  },

  async verify(): Promise<ApiResponse<{
    user: Employee;
    permissions: any;
    socialAccounts?: any[];
  }>> {
    return apiClient.post('/api/auth/verify');
  },

  async logout(): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post('/api/auth/logout');
    TokenManager.removeToken();
    return response as ApiResponse<{ message: string }>;
  }
};

// 직원 관리 API
export const employeeAPI = {
  async getEmployees(params?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    permissionLevel?: number;
  }): Promise<ApiResponse<PaginatedResponse<Employee>>> {
    return apiClient.get('/api/employees', params);
  },

  async getEmployee(id: string): Promise<ApiResponse<Employee>> {
    return apiClient.get(`/api/employees/${id}`);
  },

  async createEmployee(data: CreateEmployeeRequest): Promise<ApiResponse<Employee>> {
    return apiClient.post('/api/employees', data);
  },

  async updateEmployee(id: string, data: UpdateEmployeeRequest): Promise<ApiResponse<Employee>> {
    return apiClient.put(`/api/employees/${id}`, data);
  },

  async deleteEmployee(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete(`/api/employees/${id}`);
  }
};

// 업무 관리 API
export const workTaskAPI = {
  // 업무 메타데이터 조회 (카테고리, 상태, 직원 목록)
  async getMetadata(): Promise<ApiResponse<{
    categories: any[];
    statuses: any[];
    statusesByType: any;
    employees: any[];
    priorities: any[];
    userInfo: any;
  }>> {
    return apiClient.get('/api/tasks/metadata');
  },

  // 업무 목록 조회
  async getTasks(params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    assigneeId?: string;
    requesterId?: string;
    businessId?: string;
    search?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<PaginatedResponse<WorkTask>>> {
    return apiClient.get('/api/tasks', params);
  },

  async getTasks_old(params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    assigneeId?: string;
    requesterId?: string;
    businessId?: string;
    search?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
  }): Promise<ApiResponse<PaginatedResponse<WorkTask>>> {
    return apiClient.get('/api/work-tasks', params);
  },

  async getTask(id: string): Promise<ApiResponse<WorkTask>> {
    return apiClient.get(`/api/work-tasks/${id}`);
  },

  async createTask(data: CreateTaskRequest): Promise<ApiResponse<WorkTask>> {
    return apiClient.post('/api/work-tasks', data);
  },

  async updateTask(id: string, data: UpdateTaskRequest): Promise<ApiResponse<WorkTask>> {
    return apiClient.put(`/api/work-tasks/${id}`, data);
  },

  async deleteTask(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete(`/api/work-tasks/${id}`);
  },

  // 내 업무 조회
  async getMyTasks(params?: {
    page?: number;
    limit?: number;
    status?: string;
    role?: 'assigned' | 'requested' | 'all';
  }): Promise<ApiResponse<PaginatedResponse<WorkTask>>> {
    return apiClient.get('/api/work-tasks', {
      ...params,
      // role에 따라 필터링 로직은 클라이언트에서 처리하거나 별도 엔드포인트 생성
    });
  }
};

// 알림 API
export const notificationAPI = {
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    isRead?: boolean;
    notificationType?: string;
    priority?: string;
  }): Promise<ApiResponse<PaginatedResponse<Notification> & { meta: { unreadCount: number } }>> {
    return apiClient.get('/api/notifications', params);
  },

  async markAsRead(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post(`/api/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<ApiResponse<{ message: string; updatedCount: number }>> {
    return apiClient.post('/api/notifications/mark-all-read');
  },

  async createSystemNotification(data: {
    recipientIds: string | string[];
    title: string;
    message: string;
    notificationType?: string;
    priority?: string;
    actionUrl?: string;
    actionLabel?: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post('/api/notifications', data);
  }
};

// 대시보드 및 통계 API (향후 구현)
export const dashboardAPI = {
  async getStats(): Promise<ApiResponse<{
    totalTasks: number;
    completedTasks: number;
    ongoingTasks: number;
    overdueTasks: number;
  }>> {
    return apiClient.get('/api/dashboard/stats');
  },

  async getWorkloadAnalysis(): Promise<ApiResponse<any[]>> {
    return apiClient.get('/api/dashboard/workload');
  }
};

// 기존 시스템과의 통합 API
export const integrationAPI = {
  // 사업장 정보 조회 (기존 API 확장)
  async getBusinessInfo(businessName: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/api/business-info-direct?businessName=${encodeURIComponent(businessName)}`);
  },

  // 사업장별 업무 조회
  async getBusinessTasks(businessId: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ApiResponse<PaginatedResponse<WorkTask>>> {
    return apiClient.get('/api/work-tasks', {
      ...params,
      businessId
    });
  }
};

// React Hook용 유틸리티 함수들
export const apiUtils = {
  // 에러 메시지 추출
  getErrorMessage(response: ApiResponse<any>): string {
    return response.error?.message || '알 수 없는 오류가 발생했습니다.';
  },

  // 성공 여부 확인
  isSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true; data: T } {
    return response.success === true;
  },

  // 페이지네이션 정보 추출
  getPaginationInfo(response: ApiResponse<PaginatedResponse<any>>) {
    if (this.isSuccess(response)) {
      return response.data.pagination;
    }
    return null;
  },

  // 로딩 상태 관리를 위한 헬퍼
  createAsyncHandler<T>(
    apiCall: () => Promise<ApiResponse<T>>,
    onSuccess?: (data: T) => void,
    onError?: (error: string) => void
  ) {
    return async () => {
      try {
        const response = await apiCall();

        if (this.isSuccess(response)) {
          onSuccess?.(response.data);
          return response.data;
        } else {
          const errorMessage = this.getErrorMessage(response);
          onError?.(errorMessage);
          throw new Error(errorMessage);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        onError?.(errorMessage);
        throw error;
      }
    };
  }
};

// 실시간 업데이트를 위한 WebSocket 클라이언트 (향후 구현)
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(userId: string) {
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws?userId=${userId}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ [REALTIME] WebSocket 연결됨');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('❌ [REALTIME] 메시지 파싱 오류:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 [REALTIME] WebSocket 연결 해제');
        this.reconnect(userId);
      };

      this.ws.onerror = (error) => {
        console.error('❌ [REALTIME] WebSocket 오류:', error);
      };

    } catch (error) {
      console.error('❌ [REALTIME] WebSocket 연결 실패:', error);
    }
  }

  private reconnect(userId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`🔄 [REALTIME] 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connect(userId);
      }, 1000 * this.reconnectAttempts);
    }
  }

  private handleMessage(data: any) {
    // 실시간 업데이트 처리
    switch (data.type) {
      case 'task_created':
      case 'task_updated':
      case 'notification_created':
        // 이벤트 발생 (React에서 구독)
        window.dispatchEvent(new CustomEvent('realtime_update', { detail: data }));
        break;
      default:
        console.log('🔔 [REALTIME] 알 수 없는 메시지 타입:', data.type);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const realtimeClient = new RealtimeClient();

// 기본 내보내기
export default {
  auth: authAPI,
  employees: employeeAPI,
  workTasks: workTaskAPI,
  notifications: notificationAPI,
  dashboard: dashboardAPI,
  integration: integrationAPI,
  utils: apiUtils,
  realtime: realtimeClient
};