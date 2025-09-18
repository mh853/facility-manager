// app/api/notifications/route.ts - 실시간 알림 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

// 알림 타입 정의
export interface UserNotification {
  id: string;
  user_id: string;
  type: 'task_assigned' | 'task_completed' | 'task_updated' | 'system_notice';
  title: string;
  message: string;
  related_task_id?: string;
  related_user_id?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  expires_at: string;

  // 조인된 정보
  related_task?: {
    id: string;
    title: string;
    business_name: string;
    status: string;
  };
  related_user?: {
    id: string;
    name: string;
    email: string;
  };
}

// GET: 사용자 알림 목록 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log('📢 [NOTIFICATIONS] 알림 목록 조회:', { userId, unreadOnly, limit });

    if (!userId) {
      return createErrorResponse('사용자 ID가 필요합니다', 400);
    }

    let query = supabaseAdmin
      .from('user_notifications')
      .select(`
        id,
        user_id,
        type,
        title,
        message,
        related_task_id,
        related_user_id,
        is_read,
        read_at,
        created_at,
        expires_at
      `)
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    // 읽지 않은 알림만 조회
    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('🔴 [NOTIFICATIONS] 조회 오류:', error);
      throw error;
    }

    console.log('✅ [NOTIFICATIONS] 조회 성공:', notifications?.length || 0, '개 알림');

    return createSuccessResponse({
      notifications: notifications || [],
      count: notifications?.length || 0,
      unreadCount: notifications?.filter(n => !n.is_read).length || 0
    });

  } catch (error: any) {
    console.error('🔴 [NOTIFICATIONS] GET 오류:', error?.message || error);
    return createErrorResponse('알림 조회 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// POST: 알림 생성 (관리자용)
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      user_id,
      type,
      title,
      message,
      related_task_id,
      related_user_id,
      target_permission_level
    } = body;

    console.log('📢 [NOTIFICATIONS] 알림 생성:', { type, title, user_id, target_permission_level });

    // 시스템 공지인 경우 (여러 사용자에게)
    if (type === 'system_notice' && target_permission_level) {
      const { data: targetUsers, error: usersError } = await supabaseAdmin
        .from('employees')
        .select('id')
        .gte('permission_level', target_permission_level)
        .eq('is_active', true)
        .eq('is_deleted', false);

      if (usersError) throw usersError;

      // 여러 사용자에게 알림 생성
      const notifications = targetUsers.map(user => ({
        user_id: user.id,
        type,
        title,
        message,
        related_task_id,
        related_user_id
      }));

      const { data: createdNotifications, error: createError } = await supabaseAdmin
        .from('user_notifications')
        .insert(notifications)
        .select();

      if (createError) throw createError;

      console.log('✅ [NOTIFICATIONS] 시스템 공지 생성 성공:', createdNotifications.length, '명');

      return createSuccessResponse({
        notifications: createdNotifications,
        count: createdNotifications.length,
        message: `${createdNotifications.length}명에게 알림이 전송되었습니다`
      });
    }

    // 개별 사용자 알림 생성
    if (!user_id) {
      return createErrorResponse('사용자 ID가 필요합니다', 400);
    }

    const { data: newNotification, error } = await supabaseAdmin
      .from('user_notifications')
      .insert({
        user_id,
        type,
        title,
        message,
        related_task_id,
        related_user_id
      })
      .select()
      .single();

    if (error) {
      console.error('🔴 [NOTIFICATIONS] 생성 오류:', error);
      throw error;
    }

    console.log('✅ [NOTIFICATIONS] 생성 성공:', newNotification.id);

    return createSuccessResponse({
      notification: newNotification,
      message: '알림이 성공적으로 생성되었습니다'
    });

  } catch (error: any) {
    console.error('🔴 [NOTIFICATIONS] POST 오류:', error?.message || error);
    return createErrorResponse('알림 생성 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// PUT: 알림 읽음 처리
export const PUT = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { notification_ids, user_id, mark_all_read } = body;

    console.log('📢 [NOTIFICATIONS] 읽음 처리:', { notification_ids, user_id, mark_all_read });

    if (!user_id) {
      return createErrorResponse('사용자 ID가 필요합니다', 400);
    }

    let query = supabaseAdmin
      .from('user_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .eq('is_read', false);

    // 전체 읽음 처리
    if (mark_all_read) {
      // 조건 없이 모든 읽지 않은 알림 처리
    } else if (notification_ids && notification_ids.length > 0) {
      // 특정 알림들만 처리
      query = query.in('id', notification_ids);
    } else {
      return createErrorResponse('알림 ID 또는 전체 읽음 플래그가 필요합니다', 400);
    }

    const { data: updatedNotifications, error } = await query.select();

    if (error) {
      console.error('🔴 [NOTIFICATIONS] 읽음 처리 오류:', error);
      throw error;
    }

    console.log('✅ [NOTIFICATIONS] 읽음 처리 성공:', updatedNotifications?.length || 0, '개 알림');

    return createSuccessResponse({
      updatedCount: updatedNotifications?.length || 0,
      message: `${updatedNotifications?.length || 0}개 알림을 읽음 처리했습니다`
    });

  } catch (error: any) {
    console.error('🔴 [NOTIFICATIONS] PUT 오류:', error?.message || error);
    return createErrorResponse('알림 읽음 처리 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// DELETE: 알림 삭제
export const DELETE = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    const userId = searchParams.get('userId');
    const deleteExpired = searchParams.get('deleteExpired') === 'true';

    console.log('📢 [NOTIFICATIONS] 알림 삭제:', { notificationId, userId, deleteExpired });

    if (!userId) {
      return createErrorResponse('사용자 ID가 필요합니다', 400);
    }

    // 만료된 알림 일괄 삭제
    if (deleteExpired) {
      const { data: deletedNotifications, error } = await supabaseAdmin
        .from('user_notifications')
        .delete()
        .eq('user_id', userId)
        .or(`expires_at.lt.${new Date().toISOString()},and(is_read.eq.true,read_at.lt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()})`)
        .select();

      if (error) throw error;

      console.log('✅ [NOTIFICATIONS] 만료 알림 삭제 성공:', deletedNotifications?.length || 0, '개');

      return createSuccessResponse({
        deletedCount: deletedNotifications?.length || 0,
        message: `${deletedNotifications?.length || 0}개 만료된 알림을 삭제했습니다`
      });
    }

    // 특정 알림 삭제
    if (!notificationId) {
      return createErrorResponse('알림 ID가 필요합니다', 400);
    }

    const { data: deletedNotification, error } = await supabaseAdmin
      .from('user_notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('🔴 [NOTIFICATIONS] 삭제 오류:', error);
      throw error;
    }

    if (!deletedNotification) {
      return createErrorResponse('알림을 찾을 수 없습니다', 404);
    }

    console.log('✅ [NOTIFICATIONS] 삭제 성공:', deletedNotification.id);

    return createSuccessResponse({
      message: '알림이 성공적으로 삭제되었습니다'
    });

  } catch (error: any) {
    console.error('🔴 [NOTIFICATIONS] DELETE 오류:', error?.message || error);
    return createErrorResponse('알림 삭제 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });