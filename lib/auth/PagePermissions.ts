// lib/auth/PagePermissions.ts - 페이지별 권한 매핑

import { AuthLevel } from './AuthLevels';

/**
 * 페이지별 필요한 인증 레벨 정의
 * 새로운 페이지 추가 시 이곳에 권한 레벨을 정의하세요
 */
export const PAGE_AUTH_LEVELS = {
  // PUBLIC 페이지 - 누구나 접근 가능
  '/': AuthLevel.PUBLIC,
  '/login': AuthLevel.PUBLIC,
  '/about': AuthLevel.PUBLIC,

  // AUTHENTICATED 페이지 - 로그인 필요
  '/admin': AuthLevel.AUTHENTICATED,
  '/admin/business': AuthLevel.AUTHENTICATED,
  '/admin/tasks': AuthLevel.AUTHENTICATED,
  '/admin/data-history': AuthLevel.AUTHENTICATED,

  // ADMIN 페이지 - 관리자 권한 필요
  '/admin/revenue': AuthLevel.ADMIN,
  '/admin/air-permit': AuthLevel.ADMIN,
  '/admin/users': AuthLevel.ADMIN,

  // SUPER_ADMIN 페이지 - 슈퍼 관리자 권한 필요 (레벨 3 이상)
  '/admin/revenue/pricing': AuthLevel.SUPER_ADMIN,
  '/admin/settings': AuthLevel.SUPER_ADMIN,
  '/admin/system': AuthLevel.SUPER_ADMIN,

  // 테스트 페이지 - 개발 환경에서만 접근 가능
  '/admin/revenue/test': AuthLevel.PUBLIC, // 테스트용이므로 PUBLIC
} as const;

/**
 * 페이지 권한 관리 유틸리티
 */
export class PagePermissions {
  /**
   * 특정 페이지의 필요 권한 레벨을 반환
   */
  static getRequiredLevel(pathname: string): AuthLevel {
    // 정확히 일치하는 경로 찾기
    if (pathname in PAGE_AUTH_LEVELS) {
      return PAGE_AUTH_LEVELS[pathname as keyof typeof PAGE_AUTH_LEVELS];
    }

    // 동적 라우트 처리 (예: /admin/business/[id])
    for (const [route, level] of Object.entries(PAGE_AUTH_LEVELS)) {
      if (this.matchDynamicRoute(pathname, route)) {
        return level;
      }
    }

    // 기본값: AUTHENTICATED (안전한 기본값)
    return AuthLevel.AUTHENTICATED;
  }

  /**
   * 동적 라우트 매칭 (예: /admin/business/123 -> /admin/business/[id])
   */
  private static matchDynamicRoute(pathname: string, route: string): boolean {
    const pathSegments = pathname.split('/').filter(Boolean);
    const routeSegments = route.split('/').filter(Boolean);

    if (pathSegments.length !== routeSegments.length) {
      return false;
    }

    return routeSegments.every((segment, index) => {
      return segment.startsWith('[') && segment.endsWith(']') || segment === pathSegments[index];
    });
  }

  /**
   * 관리자 페이지인지 확인
   */
  static isAdminPage(pathname: string): boolean {
    return pathname.startsWith('/admin');
  }

  /**
   * 공개 페이지인지 확인
   */
  static isPublicPage(pathname: string): boolean {
    return this.getRequiredLevel(pathname) === AuthLevel.PUBLIC;
  }

  /**
   * 특정 레벨 이상의 권한이 필요한 모든 페이지 반환
   */
  static getPagesRequiringLevel(minLevel: AuthLevel): string[] {
    return Object.entries(PAGE_AUTH_LEVELS)
      .filter(([, level]) => level >= minLevel)
      .map(([path]) => path);
  }

  /**
   * 새로운 페이지 권한 동적 추가 (런타임에 페이지가 생성되는 경우)
   */
  static setPageLevel(pathname: string, level: AuthLevel): void {
    // 타입 단언을 통해 동적 추가
    (PAGE_AUTH_LEVELS as any)[pathname] = level;
  }
}