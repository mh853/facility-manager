// 세션 보안 관리 - 무기한 세션의 보안 위험을 완화하는 기능들
import { supabaseAdmin } from './supabase';

export interface SessionInfo {
  userId: string;
  sessionId: string;
  deviceInfo: string;
  ipAddress: string;
  lastActivity: string;
  createdAt: string;
}

export interface SecurityEvent {
  userId: string;
  eventType: 'login' | 'logout' | 'suspicious_activity' | 'token_refresh';
  ipAddress: string;
  deviceInfo: string;
  details?: any;
  timestamp: string;
}

export class SessionSecurityManager {
  private static readonly MAX_SESSIONS_PER_USER = 5; // 사용자당 최대 동시 세션 수
  private static readonly ACTIVITY_TIMEOUT = 30 * 24 * 60 * 60 * 1000; // 30일 비활성 시 자동 만료

  // 새로운 세션 생성 기록
  static async createSession(sessionData: {
    userId: string;
    sessionId: string;
    deviceInfo?: string;
    ipAddress?: string;
  }): Promise<void> {
    try {
      // 기존 세션 수 확인
      const { count } = await supabaseAdmin
        .from('user_sessions')
        .select('*', { count: 'exact' })
        .eq('user_id', sessionData.userId)
        .eq('is_active', true);

      // 최대 세션 수 초과 시 가장 오래된 세션 제거
      if (count && count >= this.MAX_SESSIONS_PER_USER) {
        await this.cleanupOldSessions(sessionData.userId);
      }

      // 새 세션 기록
      await supabaseAdmin
        .from('user_sessions')
        .insert({
          user_id: sessionData.userId,
          session_id: sessionData.sessionId,
          device_info: sessionData.deviceInfo || 'Unknown Device',
          ip_address: sessionData.ipAddress || 'Unknown IP',
          last_activity: new Date().toISOString(),
          is_active: true
        });

      // 보안 이벤트 기록
      await this.logSecurityEvent({
        userId: sessionData.userId,
        eventType: 'login',
        ipAddress: sessionData.ipAddress || 'Unknown IP',
        deviceInfo: sessionData.deviceInfo || 'Unknown Device',
        timestamp: new Date().toISOString()
      });

      console.log('✅ [SESSION-SECURITY] 새 세션 생성:', sessionData.sessionId);
    } catch (error) {
      console.error('🔴 [SESSION-SECURITY] 세션 생성 오류:', error);
    }
  }

  // 세션 활동 업데이트
  static async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('user_sessions')
        .update({
          last_activity: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('is_active', true);
    } catch (error) {
      console.error('🔴 [SESSION-SECURITY] 세션 활동 업데이트 오류:', error);
    }
  }

  // 세션 종료
  static async endSession(sessionId: string): Promise<void> {
    try {
      const { data } = await supabaseAdmin
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .select('user_id')
        .single();

      if (data) {
        await this.logSecurityEvent({
          userId: data.user_id,
          eventType: 'logout',
          ipAddress: 'Unknown IP',
          deviceInfo: 'Unknown Device',
          timestamp: new Date().toISOString()
        });
      }

      console.log('✅ [SESSION-SECURITY] 세션 종료:', sessionId);
    } catch (error) {
      console.error('🔴 [SESSION-SECURITY] 세션 종료 오류:', error);
    }
  }

  // 사용자의 모든 세션 종료 (보안 사고 시)
  static async endAllUserSessions(userId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      await this.logSecurityEvent({
        userId,
        eventType: 'logout',
        ipAddress: 'System',
        deviceInfo: 'All Devices',
        details: { reason: 'Force logout all sessions' },
        timestamp: new Date().toISOString()
      });

      console.log('✅ [SESSION-SECURITY] 사용자 모든 세션 종료:', userId);
    } catch (error) {
      console.error('🔴 [SESSION-SECURITY] 모든 세션 종료 오류:', error);
    }
  }

  // 오래된 세션 정리
  static async cleanupOldSessions(userId: string): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - this.ACTIVITY_TIMEOUT).toISOString();

      // 30일 이상 비활성 세션들을 비활성화
      await supabaseAdmin
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .lt('last_activity', cutoffDate)
        .eq('is_active', true);

      // 최대 세션 수 초과 시 가장 오래된 활성 세션 제거
      const { data: oldestSessions } = await supabaseAdmin
        .from('user_sessions')
        .select('session_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: true })
        .limit(this.MAX_SESSIONS_PER_USER - 1); // 새 세션을 위해 1자리 확보

      if (oldestSessions && oldestSessions.length > 0) {
        // 가장 오래된 세션 하나 제거
        const oldestSession = oldestSessions[0];
        await this.endSession(oldestSession.session_id);
      }

      console.log('✅ [SESSION-SECURITY] 오래된 세션 정리 완료:', userId);
    } catch (error) {
      console.error('🔴 [SESSION-SECURITY] 세션 정리 오류:', error);
    }
  }

  // 의심스러운 활동 탐지
  static async detectSuspiciousActivity(sessionId: string, currentIP: string): Promise<boolean> {
    try {
      // 같은 세션에서 다른 IP로 접근 시도 탐지
      const { data: session } = await supabaseAdmin
        .from('user_sessions')
        .select('user_id, ip_address, device_info')
        .eq('session_id', sessionId)
        .eq('is_active', true)
        .single();

      if (session && session.ip_address !== currentIP) {
        await this.logSecurityEvent({
          userId: session.user_id,
          eventType: 'suspicious_activity',
          ipAddress: currentIP,
          deviceInfo: session.device_info,
          details: {
            reason: 'IP address change',
            originalIP: session.ip_address,
            newIP: currentIP
          },
          timestamp: new Date().toISOString()
        });

        console.warn('⚠️ [SESSION-SECURITY] 의심스러운 활동 탐지:', {
          sessionId,
          originalIP: session.ip_address,
          newIP: currentIP
        });

        return true; // 의심스러운 활동 감지됨
      }

      return false;
    } catch (error) {
      console.error('🔴 [SESSION-SECURITY] 의심스러운 활동 탐지 오류:', error);
      return false;
    }
  }

  // 사용자의 활성 세션 목록 조회
  static async getUserActiveSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const { data: sessions } = await supabaseAdmin
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      return sessions?.map(session => ({
        userId: session.user_id,
        sessionId: session.session_id,
        deviceInfo: session.device_info,
        ipAddress: session.ip_address,
        lastActivity: session.last_activity,
        createdAt: session.created_at
      })) || [];
    } catch (error) {
      console.error('🔴 [SESSION-SECURITY] 활성 세션 조회 오류:', error);
      return [];
    }
  }

  // 보안 이벤트 로깅
  static async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await supabaseAdmin
        .from('security_events')
        .insert({
          user_id: event.userId,
          event_type: event.eventType,
          ip_address: event.ipAddress,
          device_info: event.deviceInfo,
          details: event.details || {},
          timestamp: event.timestamp
        });
    } catch (error) {
      console.error('🔴 [SESSION-SECURITY] 보안 이벤트 로깅 오류:', error);
    }
  }

  // 사용자의 보안 이벤트 기록 조회
  static async getUserSecurityEvents(userId: string, limit: number = 50): Promise<SecurityEvent[]> {
    try {
      const { data: events } = await supabaseAdmin
        .from('security_events')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      return events?.map(event => ({
        userId: event.user_id,
        eventType: event.event_type,
        ipAddress: event.ip_address,
        deviceInfo: event.device_info,
        details: event.details,
        timestamp: event.timestamp
      })) || [];
    } catch (error) {
      console.error('🔴 [SESSION-SECURITY] 보안 이벤트 조회 오류:', error);
      return [];
    }
  }

  // 자동 세션 정리 (정기 실행용)
  static async performRoutineCleanup(): Promise<void> {
    try {
      console.log('🧹 [SESSION-SECURITY] 정기 세션 정리 시작');

      const cutoffDate = new Date(Date.now() - this.ACTIVITY_TIMEOUT).toISOString();

      // 30일 이상 비활성 세션들을 모두 비활성화
      const { count } = await supabaseAdmin
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .lt('last_activity', cutoffDate)
        .eq('is_active', true);

      console.log(`✅ [SESSION-SECURITY] 정기 세션 정리 완료: ${count || 0}개 세션 만료`);

      // 90일 이상 된 보안 이벤트 정리
      const eventCutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { count: eventCount } = await supabaseAdmin
        .from('security_events')
        .delete()
        .lt('timestamp', eventCutoffDate);

      console.log(`✅ [SESSION-SECURITY] 정기 보안 이벤트 정리 완료: ${eventCount || 0}개 이벤트 삭제`);
    } catch (error) {
      console.error('🔴 [SESSION-SECURITY] 정기 정리 오류:', error);
    }
  }
}

// 장치 정보 추출 유틸리티
export function getDeviceInfo(): string {
  if (typeof window === 'undefined') return 'Server';

  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;

  // 간단한 디바이스 정보 추출
  let deviceType = 'Desktop';
  if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
    deviceType = 'Mobile';
  } else if (/Tablet|iPad/.test(userAgent)) {
    deviceType = 'Tablet';
  }

  return `${deviceType} (${platform}, ${language})`;
}

// 클라이언트 IP 주소 추출 (서버 사이드에서 사용)
export function getClientIP(request: Request): string {
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  const remoteAddr = request.headers.get('remote-addr');

  return xForwardedFor?.split(',')[0].trim() ||
         xRealIP ||
         remoteAddr ||
         'Unknown IP';
}