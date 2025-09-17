// API Client for work management system
import { Employee } from '@/types/work-management';

export class TokenManager {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';

  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  static removeTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  static isTokenValid(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = TokenManager.getToken();

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(`${this.baseURL}/api${endpoint}`, config);

    if (response.status === 401) {
      TokenManager.removeTokens();
      window.location.href = '/auth/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // GET request
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

const apiClient = new ApiClient();

// Authentication API
export const authAPI = {
  login: async (email: string, password: string) => {
    return apiClient.post('/auth/login', { email, password });
  },

  logout: async () => {
    return apiClient.post('/auth/logout');
  },

  verify: async () => {
    return apiClient.get('/auth/verify');
  },

  socialLogin: async (token: string, userData: any, isNewUser: boolean) => {
    return apiClient.post('/auth/social/login', { token, userData, isNewUser });
  },
};

// Work Task API
export const workTaskAPI = {
  getTasks: async (params?: any) => {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.get(`/tasks${queryString}`);
  },

  getTask: async (id: string) => {
    return apiClient.get(`/tasks/${id}`);
  },

  createTask: async (data: any) => {
    return apiClient.post('/tasks', data);
  },

  updateTask: async (id: string, data: any) => {
    return apiClient.put(`/tasks/${id}`, data);
  },

  deleteTask: async (id: string) => {
    return apiClient.delete(`/tasks/${id}`);
  },

  getMetadata: async () => {
    return apiClient.get('/tasks/metadata');
  },
};

// Employee API
export const employeeAPI = {
  getEmployees: async () => {
    return apiClient.get('/employees');
  },

  getEmployee: async (id: string) => {
    return apiClient.get(`/employees/${id}`);
  },

  createEmployee: async (data: any) => {
    return apiClient.post('/employees', data);
  },

  updateEmployee: async (id: string, data: any) => {
    return apiClient.put(`/employees/${id}`, data);
  },

  deleteEmployee: async (id: string) => {
    return apiClient.delete(`/employees/${id}`);
  },
};

export default apiClient;