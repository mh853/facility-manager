// 사용자 ID 매핑 유틸리티
// 레거시 user_id와 실제 UUID 간 매핑 처리

import { supabaseAdmin } from '@/lib/supabase';

export interface UserMappingResult {
  actualUserId: string;
  displayName: string;
  mappingUsed: boolean;
}

// 레거시 사용자 ID 매핑 테이블
const LEGACY_USER_MAPPING: Record<string, string> = {
  'user_1': '최문호',
  'test-user': 'Demo User',
  'admin': '관리자'
};

/**
 * 사용자 ID를 실제 UUID로 변환
 * 레거시 ID인 경우 이름으로 검색하여 실제 UUID 반환
 */
export async function resolveUserId(inputUserId: string): Promise<UserMappingResult | null> {
  try {
    // 1. 이미 UUID 형식인지 확인
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (uuidPattern.test(inputUserId)) {
      // UUID 형식이면 직접 사용자 정보 조회
      const { data: user, error } = await supabaseAdmin
        .from('employees')
        .select('id, name')
        .eq('id', inputUserId)
        .eq('is_active', true)
        .single();

      if (!error && user) {
        return {
          actualUserId: user.id,
          displayName: user.name,
          mappingUsed: false
        };
      }
      return null;
    }

    // 2. 레거시 ID인 경우 매핑 테이블 확인
    const mappedName = LEGACY_USER_MAPPING[inputUserId];
    if (!mappedName) {
      console.warn(`⚠️ [USER-MAPPING] 알 수 없는 사용자 ID: ${inputUserId}`);
      return null;
    }

    // 3. 이름으로 실제 사용자 검색
    const { data: user, error } = await supabaseAdmin
      .from('employees')
      .select('id, name')
      .eq('name', mappedName)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      console.error(`❌ [USER-MAPPING] 사용자 "${mappedName}" 조회 실패:`, error?.message);
      return null;
    }

    console.log(`✅ [USER-MAPPING] 레거시 ID "${inputUserId}" → UUID "${user.id}" (${user.name})`);

    return {
      actualUserId: user.id,
      displayName: user.name,
      mappingUsed: true
    };

  } catch (error: any) {
    console.error('❌ [USER-MAPPING] 사용자 ID 변환 오류:', error);
    return null;
  }
}

/**
 * 알림 데이터의 사용자 ID를 일괄 변환
 */
export async function transformNotificationUserIds(notifications: any[]): Promise<any[]> {
  const transformed = await Promise.all(
    notifications.map(async (notification) => {
      const userMapping = await resolveUserId(notification.user_id);

      if (userMapping) {
        return {
          ...notification,
          user_id: userMapping.actualUserId,
          user_name: userMapping.displayName,
          _legacy_mapping: userMapping.mappingUsed
        };
      }

      return notification; // 변환 실패 시 원본 반환
    })
  );

  return transformed;
}

/**
 * 현재 사용자에 대한 알림 필터링 (레거시 ID 지원)
 */
export async function filterNotificationsForUser(
  notifications: any[],
  currentUserId: string
): Promise<any[]> {
  const currentUserMapping = await resolveUserId(currentUserId);
  if (!currentUserMapping) {
    return [];
  }

  // 변환된 알림 데이터에서 현재 사용자 것만 필터링
  const transformedNotifications = await transformNotificationUserIds(notifications);

  return transformedNotifications.filter(notification =>
    notification.user_id === currentUserMapping.actualUserId
  );
}