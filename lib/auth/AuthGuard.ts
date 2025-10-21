// lib/auth/AuthGuard.ts - 새로운 인증 가드 시스템

import { AuthLevel, AuthLevelUtils } from './AuthLevels';
import { PagePermissions } from './PagePermissions';
import { AuthConfigManager } from './AuthConfig';

/**
 * 인증 결과 인터페이스
 */
export interface AuthResult {
  /** 접근 허용 여부 */
  allowed: boolean;

  /** 리다이렉트할 URL (접근 거부 시) */
  redirectTo?: string;

  /** 사용자 권한 레벨 */
  userLevel: AuthLevel;

  /** 요구되는 권한 레벨 */
  requiredLevel: AuthLevel;

  /** 인증 우회 여부 */
  bypassed: boolean;

  /** 오류 메시지 */
  error?: string;
}

/**
 * 사용자 정보 인터페이스 (간소화)
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  permission_level: number;
}

/**
 * 새로운 인증 가드 시스템
 */
export class AuthGuard {
  private static configManager = AuthConfigManager.getInstance();

  /**
   * 페이지 접근 권한 확인
   */
  static async checkPageAccess(pathname: string, user?: AuthUser | null): Promise<AuthResult> {
    const requiredLevel = PagePermissions.getRequiredLevel(pathname);
    const config = this.configManager.getConfig();

    // 공개 페이지는 항상 허용
    if (requiredLevel === AuthLevel.PUBLIC) {
      return {
        allowed: true,
        userLevel: user?.permission_level ?? AuthLevel.PUBLIC,
        requiredLevel,
        bypassed: false
      };
    }

    // 개발 환경에서 인증 우회
    if (config.bypassAuth && !this.configManager.isProduction()) {
      const devUserLevel = config.defaultUserLevel;
      return {
        allowed: true,
        userLevel: devUserLevel,
        requiredLevel,
        bypassed: true
      };
    }

    // 사용자 로그인 상태 확인
    if (!user) {
      return {
        allowed: false,
        redirectTo: `/login?redirect=${encodeURIComponent(pathname)}`,
        userLevel: AuthLevel.PUBLIC,
        requiredLevel,
        bypassed: false,
        error: '로그인이 필요합니다.'
      };
    }

    // 권한 레벨 확인
    const userLevel = user.permission_level;
    const hasPermission = AuthLevelUtils.hasPermission(userLevel, requiredLevel);

    if (!hasPermission) {
      return {
        allowed: false,
        redirectTo: '/admin', // 권한 부족 시 메인 대시보드로
        userLevel,
        requiredLevel,
        bypassed: false,
        error: `이 페이지는 ${AuthLevelUtils.getLevelName(requiredLevel)} 권한이 필요합니다.`
      };
    }

    return {
      allowed: true,
      userLevel,
      requiredLevel,
      bypassed: false
    };
  }

  /**
   * 컴포넌트 레벨 권한 확인
   */
  static checkComponentAccess(requiredLevel: AuthLevel, user?: AuthUser | null): AuthResult {
    const config = this.configManager.getConfig();

    // 개발 환경에서 인증 우회
    if (config.bypassAuth && !this.configManager.isProduction()) {
      return {
        allowed: true,
        userLevel: config.defaultUserLevel,
        requiredLevel,
        bypassed: true
      };
    }

    // 사용자 로그인 상태 확인
    if (!user) {
      return {
        allowed: false,
        userLevel: AuthLevel.PUBLIC,
        requiredLevel,
        bypassed: false,
        error: '로그인이 필요합니다.'
      };
    }

    // 권한 레벨 확인
    const userLevel = user.permission_level;
    const hasPermission = AuthLevelUtils.hasPermission(userLevel, requiredLevel);

    return {
      allowed: hasPermission,
      userLevel,
      requiredLevel,
      bypassed: false,
      error: hasPermission ? undefined : `${AuthLevelUtils.getLevelName(requiredLevel)} 권한이 필요합니다.`
    };
  }

  /**
   * API 엔드포인트 권한 확인
   */
  static checkApiAccess(endpoint: string, user?: AuthUser | null): AuthResult {
    // API 엔드포인트별 권한 매핑
    const apiPermissions: Record<string, AuthLevel> = {
      '/api/business-list': AuthLevel.AUTHENTICATED,
      '/api/revenue': AuthLevel.ADMIN,
      '/api/revenue/calculate': AuthLevel.ADMIN,
      '/api/revenue/pricing': AuthLevel.ADMIN,
      '/api/admin': AuthLevel.ADMIN,
      '/api/settings': AuthLevel.SUPER_ADMIN,
    };

    // 패턴 매칭으로 권한 확인
    let requiredLevel = AuthLevel.AUTHENTICATED; // 기본값

    for (const [pattern, level] of Object.entries(apiPermissions)) {
      if (endpoint.startsWith(pattern)) {
        requiredLevel = level;
        break;
      }
    }

    return this.checkComponentAccess(requiredLevel, user);
  }

  /**
   * 개발 환경에서 임시 사용자 생성
   */
  static createDevUser(level: AuthLevel = AuthLevel.SUPER_ADMIN): AuthUser {
    return {
      id: 'dev-user',
      name: '개발자',
      email: 'dev@facility-manager.com',
      permission_level: level
    };
  }

  /**
   * 권한 레벨 이름 반환 (편의 메서드)
   */
  static getLevelName(level: AuthLevel): string {
    return AuthLevelUtils.getLevelName(level);
  }

  /**
   * 현재 설정 정보 반환
   */
  static getConfig() {
    return this.configManager.getConfig();
  }

  /**
   * 인증 우회 모드 여부
   */
  static isBypassMode(): boolean {
    return this.configManager.shouldBypassAuth();
  }
}