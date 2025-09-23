// app/api/notifications/simple/route.ts - 하이브리드 폴링 기반 통합 알림 API
import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

// 30초 응답 캐싱 설정
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 30; // 30초 캐싱

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 응답 캐시 (메모리 기반 - 30초)
interface CacheEntry {
  data: any;
  timestamp: number;
  etag: string;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30 * 1000; // 30초

// JWT 토큰에서 사용자 정보 추출
async function getUserFromToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // 사용자 정보 조회
    const { data: user, error } = await supabaseAdmin
      .from('employees')
      .select('id, name, email, permission_level, department')
      .eq('id', decoded.userId || decoded.id)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      console.warn('⚠️ [NOTIFICATIONS-SIMPLE] 사용자 조회 실패:', error?.message);
      return null;
    }

    return user;
  } catch (error) {
    console.warn('⚠️ [NOTIFICATIONS-SIMPLE] JWT 토큰 검증 실패:', error);
    return null;
  }
}

// GET: 통합 알림 조회 (일반 알림 + 업무 알림)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const cacheKey = `notifications:${user.id}`;
    const now = Date.now();

    // ETag 확인 (조건부 요청 지원)
    const ifNoneMatch = request.headers.get('if-none-match');
    const cachedEntry = responseCache.get(cacheKey);

    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_DURATION) {
      // ETag 매칭 시 304 Not Modified 응답
      if (ifNoneMatch && ifNoneMatch === cachedEntry.etag) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            'ETag': cachedEntry.etag,
            'Cache-Control': 'max-age=30'
          }
        });
      }

      console.log('📦 [CACHE] 캐시된 알림 응답 사용:', user.name);
      return NextResponse.json(cachedEntry.data, {
        headers: {
          'ETag': cachedEntry.etag,
          'Cache-Control': 'max-age=30'
        }
      });
    }

    console.log('🔔 [NOTIFICATIONS-SIMPLE] 통합 알림 조회:', user.name);

    // 병렬로 알림 조회 (성능 최적화)
    const [generalResult, taskResult] = await Promise.allSettled([
      // 1. 일반 알림 조회
      supabaseAdmin
        .from('notifications')
        .select(`
          id,
          title,
          message,
          category,
          priority,
          created_at,
          expires_at,
          is_read,
          is_system_notification,
          related_resource_type,
          related_resource_id,
          related_url,
          metadata,
          created_by_name
        `)
        .or(`target_user_id.eq.${user.id},target_user_id.is.null,is_system_notification.eq.true`)
        .eq('is_deleted', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(50),

      // 2. 업무 알림 조회
      supabaseAdmin
        .from('task_notifications')
        .select(`
          id,
          user_id,
          task_id,
          business_name,
          message,
          notification_type,
          priority,
          is_read,
          created_at,
          expires_at
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(30)
    ]);

    // 결과 처리
    const generalNotifications = generalResult.status === 'fulfilled' ? generalResult.value.data || [] : [];
    const taskNotifications = taskResult.status === 'fulfilled' ? taskResult.value.data || [] : [];

    // 오류 로깅
    if (generalResult.status === 'rejected') {
      console.error('🔴 [NOTIFICATIONS-SIMPLE] 일반 알림 조회 오류:', generalResult.reason);
    }
    if (taskResult.status === 'rejected') {
      console.error('🔴 [NOTIFICATIONS-SIMPLE] 업무 알림 조회 오류:', taskResult.reason);
    }

    // 3. 업무 알림을 일반 알림 형식으로 변환
    const transformedTaskNotifications = taskNotifications.map(taskNotif => ({
      id: taskNotif.id,
      title: '업무 알림',
      message: taskNotif.message,
      category: getTaskNotificationCategory(taskNotif.notification_type),
      priority: mapTaskPriority(taskNotif.priority),
      related_resource_type: 'task',
      related_resource_id: taskNotif.task_id,
      related_url: `/admin/tasks?focus=${taskNotif.task_id}`,
      metadata: {
        business_name: taskNotif.business_name,
        notification_type: taskNotif.notification_type,
        source: 'task_system'
      },
      created_by_name: 'System',
      created_at: taskNotif.created_at,
      expires_at: taskNotif.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_system_notification: false,
      is_read: taskNotif.is_read
    }));

    // 4. 알림 통합 및 정렬
    const allNotifications = [
      ...generalNotifications,
      ...transformedTaskNotifications
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 5. 읽지 않은 알림 수 계산
    const unreadCount = allNotifications.filter(notif => !notif.is_read).length;

    // 6. 우선순위별 통계
    const priorityStats = {
      critical: allNotifications.filter(n => n.priority === 'critical' && !n.is_read).length,
      high: allNotifications.filter(n => n.priority === 'high' && !n.is_read).length,
      medium: allNotifications.filter(n => n.priority === 'medium' && !n.is_read).length,
      low: allNotifications.filter(n => n.priority === 'low' && !n.is_read).length
    };

    // 7. 응답 데이터 생성
    const responseData = {
      success: true,
      data: {
        notifications: allNotifications,
        unreadCount,
        totalCount: allNotifications.length,
        priorityStats,
        lastFetched: new Date().toISOString(),
        cacheExpiry: new Date(now + CACHE_DURATION).toISOString(),
        hasGeneralNotifications: generalNotifications.length > 0,
        hasTaskNotifications: taskNotifications.length > 0,
        errors: {
          generalNotificationsError: generalResult.status === 'rejected' ? 'Failed to fetch general notifications' : null,
          taskNotificationsError: taskResult.status === 'rejected' ? 'Failed to fetch task notifications' : null
        }
      }
    };

    // ETag 생성 (데이터 변경 감지용)
    const etag = `"${Buffer.from(JSON.stringify({
      count: allNotifications.length,
      unread: unreadCount,
      latest: allNotifications[0]?.created_at || null
    })).toString('base64')}"`;

    // 캐시에 저장
    responseCache.set(cacheKey, {
      data: responseData,
      timestamp: now,
      etag
    });

    console.log('✅ [NOTIFICATIONS-SIMPLE] 조회 성공:', {
      user: user.name,
      totalNotifications: allNotifications.length,
      unreadCount,
      generalCount: generalNotifications.length,
      taskCount: taskNotifications.length,
      cached: false
    });

    return NextResponse.json(responseData, {
      headers: {
        'ETag': etag,
        'Cache-Control': 'max-age=30'
      }
    });

  } catch (error: any) {
    console.error('🔴 [NOTIFICATIONS-SIMPLE] GET 오류:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: '통합 알림 조회 중 오류가 발생했습니다',
        details: error?.message
      },
      { status: 500 }
    );
  }
}

// POST: 알림 읽음 처리 및 폴링 업데이트
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { action, notificationIds, markAllAsRead, lastUpdated } = body;

    // 폴링 업데이트 요청 처리
    if (action === 'poll' && lastUpdated) {
      const since = new Date(lastUpdated).toISOString();

      // 변경된 알림만 조회 (일반 + 업무)
      const [generalResult, taskResult] = await Promise.allSettled([
        supabaseAdmin
          .from('notifications')
          .select('id, title, message, priority, category, created_at, is_read')
          .or(`target_user_id.eq.${user.id},target_user_id.is.null,is_system_notification.eq.true`)
          .eq('is_deleted', false)
          .gte('updated_at', since)
          .order('created_at', { ascending: false }),

        supabaseAdmin
          .from('task_notifications')
          .select('id, message, priority, task_id, business_name, created_at, is_read, notification_type')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .gte('updated_at', since)
          .order('created_at', { ascending: false })
      ]);

      const generalNotifications = generalResult.status === 'fulfilled' ? generalResult.value.data || [] : [];
      const taskNotifications = taskResult.status === 'fulfilled' ? taskResult.value.data || [] : [];

      const transformedTaskNotifications = taskNotifications.map(taskNotif => ({
        id: taskNotif.id,
        title: '업무 알림',
        message: taskNotif.message,
        category: getTaskNotificationCategory(taskNotif.notification_type),
        priority: mapTaskPriority(taskNotif.priority),
        created_at: taskNotif.created_at,
        is_read: taskNotif.is_read,
        metadata: {
          business_name: taskNotif.business_name,
          source: 'task_system'
        }
      }));

      const allUpdates = [...generalNotifications, ...transformedTaskNotifications]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return NextResponse.json({
        success: true,
        data: {
          notifications: allUpdates,
          hasChanges: allUpdates.length > 0,
          updateCount: allUpdates.length
        }
      });
    }

    // 읽음 처리 요청
    console.log('📖 [NOTIFICATIONS-SIMPLE] 읽음 처리:', {
      user: user.name,
      notificationIds,
      markAllAsRead
    });

    let updatedCount = 0;

    if (markAllAsRead) {
      // 모든 알림 읽음 처리
      const [generalResult, taskResult] = await Promise.allSettled([
        supabaseAdmin
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .or(`target_user_id.eq.${user.id},target_user_id.is.null`)
          .eq('is_read', false),

        supabaseAdmin
          .from('task_notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('is_read', false)
      ]);

      updatedCount = -1; // 전체 처리 표시

    } else if (notificationIds && Array.isArray(notificationIds)) {
      // 특정 알림들 읽음 처리
      for (const notificationId of notificationIds) {
        const [generalResult, taskResult] = await Promise.allSettled([
          supabaseAdmin
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .or(`target_user_id.eq.${user.id},target_user_id.is.null`),

          supabaseAdmin
            .from('task_notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .eq('user_id', user.id)
        ]);

        if (generalResult.status === 'fulfilled' || taskResult.status === 'fulfilled') {
          updatedCount++;
        }
      }
    }

    // 캐시 무효화
    const cacheKey = `notifications:${user.id}`;
    responseCache.delete(cacheKey);

    console.log('✅ [NOTIFICATIONS-SIMPLE] 읽음 처리 완료:', {
      user: user.name,
      updatedCount
    });

    return NextResponse.json({
      success: true,
      data: {
        message: markAllAsRead ? '모든 알림이 읽음 처리되었습니다' : `${updatedCount}개의 알림이 읽음 처리되었습니다`,
        updatedCount
      }
    });

  } catch (error: any) {
    console.error('🔴 [NOTIFICATIONS-SIMPLE] POST 오류:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: '요청 처리 중 오류가 발생했습니다',
        details: error?.message
      },
      { status: 500 }
    );
  }
}

// DELETE: 알림 삭제
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json({ error: '알림 ID가 필요합니다' }, { status: 400 });
    }

    console.log('🗑️ [NOTIFICATIONS-SIMPLE] 알림 삭제:', {
      user: user.name,
      notificationId
    });

    // 일반 알림과 업무 알림에서 모두 삭제 시도
    const [generalResult, taskResult] = await Promise.allSettled([
      supabaseAdmin
        .from('notifications')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', notificationId)
        .or(`target_user_id.eq.${user.id},target_user_id.is.null`),

      supabaseAdmin
        .from('task_notifications')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id)
    ]);

    const deleteSuccess = generalResult.status === 'fulfilled' || taskResult.status === 'fulfilled';

    if (!deleteSuccess) {
      return NextResponse.json(
        { error: '알림을 찾을 수 없거나 삭제 권한이 없습니다' },
        { status: 404 }
      );
    }

    // 캐시 무효화
    const cacheKey = `notifications:${user.id}`;
    responseCache.delete(cacheKey);

    console.log('✅ [NOTIFICATIONS-SIMPLE] 삭제 완료:', notificationId);

    return NextResponse.json({
      success: true,
      data: {
        message: '알림이 삭제되었습니다'
      }
    });

  } catch (error: any) {
    console.error('🔴 [NOTIFICATIONS-SIMPLE] DELETE 오류:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: '알림 삭제 중 오류가 발생했습니다',
        details: error?.message
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// 유틸리티 함수들
// ============================================================================

// 업무 알림 타입을 일반 알림 카테고리로 매핑
function getTaskNotificationCategory(notificationType: string): string {
  const categoryMap: { [key: string]: string } = {
    'assignment': 'task_assigned',
    'status_change': 'task_status_changed',
    'completion': 'task_completed',
    'creation': 'task_created',
    'update': 'task_updated',
    'reminder': 'task_assigned',
    'deadline': 'task_assigned'
  };

  return categoryMap[notificationType] || 'task_assigned';
}

// 업무 우선순위를 일반 알림 우선순위로 매핑
function mapTaskPriority(taskPriority: string): string {
  const priorityMap: { [key: string]: string } = {
    'urgent': 'critical',
    'high': 'high',
    'normal': 'medium',
    'low': 'low'
  };

  return priorityMap[taskPriority] || 'medium';
}

// 캐시 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION * 2) { // 캐시 만료 시간의 2배
      responseCache.delete(key);
    }
  }
}, CACHE_DURATION); // 30초마다 정리