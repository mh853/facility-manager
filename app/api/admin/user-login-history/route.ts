// app/api/admin/user-login-history/route.ts - 사용자 로그인 이력 관리 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

// 로그인 이력 정보 타입
export interface UserLoginHistory {
  id: string;
  user_id: string;
  login_method: 'google' | 'kakao' | 'naver';
  ip_address: string;
  user_agent: string;
  device_info?: string;
  location_info?: string;
  login_at: string;
  logout_at?: string;
  session_duration?: number;
  is_suspicious: boolean;
}

// GET: 특정 사용자의 로그인 이력 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    console.log('📊 [LOGIN-HISTORY] 로그인 이력 조회:', { userId, limit, offset, dateFrom, dateTo });

    if (!userId) {
      return createErrorResponse('사용자 ID가 필요합니다', 400);
    }

    // 기본 쿼리 구성
    let query = supabaseAdmin
      .from('user_sessions')
      .select(`
        id,
        user_id,
        login_method,
        ip_address,
        user_agent,
        device_info,
        location_info,
        created_at,
        last_activity_at,
        expires_at,
        is_active,
        logout_at,
        is_suspicious
      `)
      .eq('user_id', userId);

    // 날짜 필터 적용
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // 정렬 및 페이지네이션
    const { data: sessions, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('🔴 [LOGIN-HISTORY] 세션 조회 오류:', error);
      throw error;
    }

    // 세션 데이터를 로그인 이력 형태로 변환
    const loginHistory: UserLoginHistory[] = (sessions || []).map(session => ({
      id: session.id,
      user_id: session.user_id,
      login_method: session.login_method,
      ip_address: session.ip_address,
      user_agent: session.user_agent,
      device_info: session.device_info,
      location_info: session.location_info,
      login_at: session.created_at,
      logout_at: session.logout_at,
      session_duration: session.logout_at
        ? Math.floor((new Date(session.logout_at).getTime() - new Date(session.created_at).getTime()) / 1000)
        : session.is_active
          ? Math.floor((new Date().getTime() - new Date(session.created_at).getTime()) / 1000)
          : null,
      is_suspicious: session.is_suspicious
    }));

    // 사용자 기본 정보도 함께 조회
    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('🔴 [LOGIN-HISTORY] 사용자 조회 오류:', userError);
      throw userError;
    }

    // 통계 정보 생성
    const totalSessions = count || 0;
    const activeSessions = loginHistory.filter(h => !h.logout_at).length;
    const suspiciousSessions = loginHistory.filter(h => h.is_suspicious).length;
    const uniqueIPs = [...new Set(loginHistory.map(h => h.ip_address))].length;
    const loginMethods = [...new Set(loginHistory.map(h => h.login_method))];

    console.log('✅ [LOGIN-HISTORY] 조회 성공:', loginHistory.length, '개 이력');

    return createSuccessResponse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      loginHistory,
      pagination: {
        limit,
        offset,
        total: totalSessions,
        hasMore: (offset + limit) < totalSessions
      },
      statistics: {
        totalSessions,
        activeSessions,
        suspiciousSessions,
        uniqueIPs,
        loginMethods,
        avgSessionDuration: loginHistory
          .filter(h => h.session_duration)
          .reduce((sum, h) => sum + (h.session_duration || 0), 0) /
          Math.max(1, loginHistory.filter(h => h.session_duration).length)
      }
    });

  } catch (error: any) {
    console.error('🔴 [LOGIN-HISTORY] GET 오류:', error?.message || error);
    return createErrorResponse('로그인 이력 조회 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// DELETE: 특정 세션 강제 종료
export const DELETE = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    console.log('🔒 [LOGIN-HISTORY] 세션 강제 종료:', { sessionId });

    if (!sessionId) {
      return createErrorResponse('세션 ID가 필요합니다', 400);
    }

    // 세션 정보 조회 (종료 전 확인)
    const { data: session, error: fetchError } = await supabaseAdmin
      .from('user_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      console.error('🔴 [LOGIN-HISTORY] 세션 조회 실패:', fetchError);
      return createErrorResponse('세션을 찾을 수 없습니다', 404);
    }

    if (!session.is_active) {
      return createErrorResponse('이미 종료된 세션입니다', 400);
    }

    // 세션 강제 종료
    const { data: updatedSession, error } = await supabaseAdmin
      .from('user_sessions')
      .update({
        is_active: false,
        logout_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('🔴 [LOGIN-HISTORY] 세션 종료 오류:', error);
      throw error;
    }

    // 보안 이벤트 로그 기록
    await supabaseAdmin
      .from('security_events')
      .insert({
        user_id: session.user_id,
        event_type: 'admin_session_termination',
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        details: {
          terminated_session_id: sessionId,
          reason: '관리자에 의한 강제 종료'
        }
      });

    console.log('✅ [LOGIN-HISTORY] 세션 강제 종료 성공:', sessionId);

    return createSuccessResponse({
      message: '세션이 성공적으로 종료되었습니다',
      terminatedSession: {
        id: sessionId,
        userId: session.user_id,
        terminatedAt: updatedSession.logout_at
      }
    });

  } catch (error: any) {
    console.error('🔴 [LOGIN-HISTORY] DELETE 오류:', error?.message || error);
    return createErrorResponse('세션 종료 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// PUT: 의심스러운 세션 표시/해제
export const PUT = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { sessionId, action, isSuspicious } = body;

    console.log('⚠️ [LOGIN-HISTORY] 의심스러운 세션 처리:', { sessionId, action, isSuspicious });

    if (!sessionId) {
      return createErrorResponse('세션 ID가 필요합니다', 400);
    }

    if (action === 'mark_suspicious') {
      // 의심스러운 세션으로 표시/해제
      const { data: updatedSession, error } = await supabaseAdmin
        .from('user_sessions')
        .update({
          is_suspicious: isSuspicious
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        console.error('🔴 [LOGIN-HISTORY] 의심스러운 세션 마킹 오류:', error);
        throw error;
      }

      if (!updatedSession) {
        return createErrorResponse('세션을 찾을 수 없습니다', 404);
      }

      // 보안 이벤트 로그 기록
      await supabaseAdmin
        .from('security_events')
        .insert({
          user_id: updatedSession.user_id,
          event_type: isSuspicious ? 'session_marked_suspicious' : 'session_unmarked_suspicious',
          ip_address: updatedSession.ip_address,
          user_agent: updatedSession.user_agent,
          details: {
            session_id: sessionId,
            reason: '관리자에 의한 수동 표시'
          }
        });

      console.log('✅ [LOGIN-HISTORY] 의심스러운 세션 마킹 성공:', sessionId);

      return createSuccessResponse({
        message: `세션이 ${isSuspicious ? '의심스러운 세션으로 표시' : '정상 세션으로 변경'}되었습니다`,
        updatedSession: {
          id: sessionId,
          is_suspicious: isSuspicious
        }
      });
    }

    return createErrorResponse('지원하지 않는 작업입니다', 400);

  } catch (error: any) {
    console.error('🔴 [LOGIN-HISTORY] PUT 오류:', error?.message || error);
    return createErrorResponse('세션 수정 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });