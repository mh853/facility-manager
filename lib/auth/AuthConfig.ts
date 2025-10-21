// lib/auth/AuthConfig.ts - 인증 시스템 설정

import { AuthLevel } from './AuthLevels';

/**
 * 인증 모드 타입
 */
export type AuthMode = 'development' | 'production' | 'testing';

/**
 * 인증 설정 인터페이스
 */
export interface AuthConfig {
  /** 현재 인증 모드 */
  mode: AuthMode;

  /** 개발 환경에서 인증 우회 여부 */
  bypassAuth: boolean;

  /** 인증 실패 시 기본 권한 레벨 */
  fallbackLevel: AuthLevel;

  /** 기본 사용자 권한 레벨 */
  defaultUserLevel: AuthLevel;

  /** 세션 타임아웃 (분) */
  sessionTimeout: number;

  /** 자동 로그아웃 여부 */
  autoLogout: boolean;
}

/**
 * 환경별 기본 설정
 */
const DEFAULT_CONFIGS: Record<AuthMode, AuthConfig> = {
  development: {
    mode: 'development',
    bypassAuth: true,
    fallbackLevel: AuthLevel.ADMIN, // 개발 시 높은 권한
    defaultUserLevel: AuthLevel.SUPER_ADMIN,
    sessionTimeout: 1440, // 24시간
    autoLogout: false
  },

  production: {
    mode: 'production',
    bypassAuth: false,
    fallbackLevel: AuthLevel.PUBLIC, // 운영 시 엄격한 권한
    defaultUserLevel: AuthLevel.AUTHENTICATED,
    sessionTimeout: 480, // 8시간
    autoLogout: true
  },

  testing: {
    mode: 'testing',
    bypassAuth: true,
    fallbackLevel: AuthLevel.AUTHENTICATED,
    defaultUserLevel: AuthLevel.ADMIN,
    sessionTimeout: 60, // 1시간
    autoLogout: false
  }
};

/**
 * 인증 설정 관리자
 */
export class AuthConfigManager {
  private static instance: AuthConfigManager;
  private config: AuthConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): AuthConfigManager {
    if (!AuthConfigManager.instance) {
      AuthConfigManager.instance = new AuthConfigManager();
    }
    return AuthConfigManager.instance;
  }

  /**
   * 환경변수에서 설정 로드
   */
  private loadConfig(): AuthConfig {
    const mode = this.getAuthMode();
    const baseConfig = { ...DEFAULT_CONFIGS[mode] };

    // 환경변수로 설정 오버라이드
    return {
      ...baseConfig,
      bypassAuth: this.getEnvBoolean('NEXT_PUBLIC_DEV_AUTH_BYPASS', baseConfig.bypassAuth),
      defaultUserLevel: this.getEnvNumber('NEXT_PUBLIC_DEFAULT_USER_LEVEL', baseConfig.defaultUserLevel),
      sessionTimeout: this.getEnvNumber('AUTH_SESSION_TIMEOUT', baseConfig.sessionTimeout),
      autoLogout: this.getEnvBoolean('AUTH_AUTO_LOGOUT', baseConfig.autoLogout)
    };
  }

  /**
   * 현재 인증 모드 확인
   */
  private getAuthMode(): AuthMode {
    const envMode = process.env.NEXT_PUBLIC_AUTH_MODE;
    const nodeEnv = process.env.NODE_ENV;

    if (envMode === 'testing') return 'testing';
    if (envMode === 'production' || nodeEnv === 'production') return 'production';
    return 'development';
  }

  /**
   * 환경변수에서 boolean 값 가져오기
   */
  private getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  /**
   * 환경변수에서 number 값 가져오기
   */
  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * 현재 설정 반환
   */
  getConfig(): AuthConfig {
    return { ...this.config };
  }

  /**
   * 개발 모드 여부 확인
   */
  isDevelopment(): boolean {
    return this.config.mode === 'development';
  }

  /**
   * 운영 모드 여부 확인
   */
  isProduction(): boolean {
    return this.config.mode === 'production';
  }

  /**
   * 인증 우회 여부 확인
   */
  shouldBypassAuth(): boolean {
    return this.config.bypassAuth && !this.isProduction();
  }

  /**
   * 기본 사용자 레벨 반환
   */
  getDefaultUserLevel(): AuthLevel {
    return this.config.defaultUserLevel;
  }

  /**
   * 폴백 권한 레벨 반환
   */
  getFallbackLevel(): AuthLevel {
    return this.config.fallbackLevel;
  }

  /**
   * 설정 업데이트 (런타임에 설정 변경 시 사용)
   */
  updateConfig(updates: Partial<AuthConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 설정 초기화
   */
  resetConfig(): void {
    this.config = this.loadConfig();
  }
}