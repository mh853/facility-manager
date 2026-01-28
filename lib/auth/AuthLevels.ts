// lib/auth/AuthLevels.ts - 인증 레벨 정의

/**
 * 시설관리 시스템 인증 레벨
 * 레벨이 높을수록 더 많은 권한을 가짐
 */
export enum AuthLevel {
  /** 게스트 - 로그인 필요, 읽기 전용 */
  GUEST = 0,

  /** 일반 - 일반 직원, 기본 업무 */
  AUTHENTICATED = 1,

  /** 매니저 - 관리자 권한, 매출관리, 시스템 설정 등 */
  MANAGER = 2,

  /** 관리자 - 슈퍼 관리자 권한, 원가관리 등 */
  ADMIN = 3,

  /** 시스템 - 시스템 관리자 권한, 최고 권한 */
  SYSTEM_ADMIN = 4
}

/**
 * 권한 레벨 설명
 */
export const AUTH_LEVEL_DESCRIPTIONS = {
  [AuthLevel.GUEST]: '게스트 (읽기 전용)',
  [AuthLevel.AUTHENTICATED]: '일반',
  [AuthLevel.MANAGER]: '매니저',
  [AuthLevel.ADMIN]: '관리자',
  [AuthLevel.SYSTEM_ADMIN]: '시스템'
} as const;

/**
 * 권한 레벨 체크 유틸리티
 */
export class AuthLevelUtils {
  /**
   * 사용자가 요구되는 권한 레벨을 가지고 있는지 확인
   */
  static hasPermission(userLevel: number, requiredLevel: AuthLevel): boolean {
    return userLevel >= requiredLevel;
  }

  /**
   * 권한 레벨 이름 반환
   */
  static getLevelName(level: AuthLevel): string {
    return AUTH_LEVEL_DESCRIPTIONS[level] || '알 수 없음';
  }

  /**
   * 모든 권한 레벨 목록 반환
   */
  static getAllLevels(): Array<{ level: AuthLevel; name: string }> {
    return Object.values(AuthLevel)
      .filter(value => typeof value === 'number')
      .map(level => ({
        level: level as AuthLevel,
        name: AUTH_LEVEL_DESCRIPTIONS[level as AuthLevel]
      }));
  }
}