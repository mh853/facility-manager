// app/api/notifications/cleanup/route.ts - 중복 알림 정리 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// JWT에서 사용자 정보 추출
async function getUserFromRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const { data: user } = await supabaseAdmin
      .from('employees')
      .select('id, name, email, permission_level')
      .eq('id', decoded.userId || decoded.id)
      .eq('is_active', true)
      .single();

    return user;
  } catch (error) {
    return null;
  }
}

// POST: 중복 알림 정리 (관리자 전용)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.permission_level < 3) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { action } = await request.json();

    let result: any = {};

    if (action === 'remove_duplicates') {
      console.log('🧹 [CLEANUP] 중복 시스템 알림 정리 시작');

      // 1. 중복 Supabase Realtime 알림 조회
      const { data: duplicates, error: queryError } = await supabaseAdmin
        .from('notifications')
        .select('id, title, message, created_at')
        .eq('is_system_notification', true)
        .or('title.ilike.%Supabase Realtime%,title.ilike.%시스템 활성화%,message.ilike.%WebSocket%,message.ilike.%실시간 알림%')
        .order('created_at', { ascending: true });

      if (queryError) {
        throw new Error(`중복 알림 조회 실패: ${queryError.message}`);
      }

      console.log(`📊 [CLEANUP] 발견된 시스템 알림: ${duplicates?.length || 0}개`);

      // 2. 제목+메시지별로 그룹화하고 가장 오래된 것만 유지
      const groupedNotifications = new Map<string, any[]>();
      duplicates?.forEach(notification => {
        const key = `${notification.title}|${notification.message}`;
        if (!groupedNotifications.has(key)) {
          groupedNotifications.set(key, []);
        }
        groupedNotifications.get(key)!.push(notification);
      });

      let deletedCount = 0;
      const duplicateGroups: any[] = [];

      for (const [key, notifications] of groupedNotifications) {
        if (notifications.length > 1) {
          // 첫 번째(가장 오래된)를 제외하고 나머지 삭제
          const toDelete = notifications.slice(1);
          duplicateGroups.push({
            title: notifications[0].title,
            totalCount: notifications.length,
            keepingOldest: notifications[0].created_at,
            deletingCount: toDelete.length
          });

          // 실제 삭제 수행
          const deleteIds = toDelete.map(n => n.id);
          const { error: deleteError } = await supabaseAdmin
            .from('notifications')
            .delete()
            .in('id', deleteIds);

          if (deleteError) {
            console.error(`❌ [CLEANUP] 삭제 실패 (${key}):`, deleteError);
          } else {
            deletedCount += toDelete.length;
            console.log(`✅ [CLEANUP] 중복 제거: ${key} (${toDelete.length}개 삭제)`);
          }
        }
      }

      result.duplicateCleanup = {
        duplicateGroups,
        totalDeleted: deletedCount,
        groupsProcessed: duplicateGroups.length
      };

    } else if (action === 'remove_test_notifications') {
      console.log('🧪 [CLEANUP] 테스트 알림 정리 시작');

      // 테스트 알림 삭제
      const { count: globalTestCount, error: globalTestError } = await supabaseAdmin
        .from('notifications')
        .delete({ count: 'exact' })
        .or('title.ilike.%테스트%,title.ilike.%🧪%,message.ilike.%테스트%,created_by_name.in.(System Test,테스트 관리자)');

      const { count: taskTestCount, error: taskTestError } = await supabaseAdmin
        .from('task_notifications')
        .delete({ count: 'exact' })
        .or('message.ilike.%테스트%,message.ilike.%🧪%,user_id.eq.test-user');

      if (globalTestError || taskTestError) {
        throw new Error(`테스트 알림 삭제 실패: ${globalTestError?.message || taskTestError?.message}`);
      }

      result.testCleanup = {
        deletedGlobalNotifications: globalTestCount || 0,
        deletedTaskNotifications: taskTestCount || 0,
        totalDeleted: (globalTestCount || 0) + (taskTestCount || 0)
      };

      console.log(`✅ [CLEANUP] 테스트 알림 삭제 완료: 전역 ${globalTestCount}개, 업무 ${taskTestCount}개`);

    } else if (action === 'archive_expired') {
      console.log('📦 [CLEANUP] 만료된 알림 아카이브 시작');

      // 만료된 알림 조회
      const { data: expiredNotifications, error: expiredError } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .lt('expires_at', new Date().toISOString());

      if (expiredError) {
        throw new Error(`만료된 알림 조회 실패: ${expiredError.message}`);
      }

      let archivedCount = 0;
      if (expiredNotifications && expiredNotifications.length > 0) {
        // 히스토리로 이동
        const historyRecords = expiredNotifications.map(notif => ({
          original_notification_id: notif.id,
          title: notif.title,
          message: notif.message,
          category: notif.category,
          priority: notif.priority,
          related_resource_type: notif.related_resource_type,
          related_resource_id: notif.related_resource_id,
          related_url: notif.related_url,
          metadata: notif.metadata,
          created_by_id: notif.created_by_id,
          created_by_name: notif.created_by_name,
          notification_created_at: notif.created_at,
          notification_type: 'global'
        }));

        const { error: archiveError } = await supabaseAdmin
          .from('notification_history')
          .insert(historyRecords);

        if (!archiveError) {
          // 원본 삭제
          const { count: deletedCount, error: deleteError } = await supabaseAdmin
            .from('notifications')
            .delete({ count: 'exact' })
            .lt('expires_at', new Date().toISOString());

          if (!deleteError) {
            archivedCount = deletedCount || 0;
          }
        }
      }

      result.expiredArchive = {
        archivedCount,
        expiredFound: expiredNotifications?.length || 0
      };

      console.log(`✅ [CLEANUP] 만료된 알림 아카이브 완료: ${archivedCount}개`);

    } else {
      return NextResponse.json({
        error: '유효하지 않은 액션입니다. remove_duplicates, remove_test_notifications, archive_expired 중 선택하세요.'
      }, { status: 400 });
    }

    // 정리 후 현재 상태 조회
    const { data: remainingNotifications, error: countError } = await supabaseAdmin
      .from('notifications')
      .select('is_system_notification')
      .eq('is_system_notification', true);

    const remainingCount = remainingNotifications?.length || 0;

    console.log(`📊 [CLEANUP] 정리 완료. 남은 시스템 알림: ${remainingCount}개`);

    return NextResponse.json({
      success: true,
      message: '알림 정리가 완료되었습니다',
      result,
      remainingSystemNotifications: remainingCount,
      cleanupBy: user.name,
      cleanupAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [CLEANUP] 정리 오류:', error);
    return NextResponse.json({
      success: false,
      error: '알림 정리 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET: 현재 중복 알림 상태 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    // 중복 시스템 알림 조회
    const { data: duplicates, error: duplicateError } = await supabaseAdmin
      .rpc('get_duplicate_notifications');

    if (duplicateError) {
      console.warn('중복 조회 함수 없음, 기본 조회 사용');
    }

    // 시스템 알림 현황
    const { data: systemNotifications, error: systemError } = await supabaseAdmin
      .from('notifications')
      .select('title, message, created_at, is_system_notification')
      .eq('is_system_notification', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (systemError) {
      throw new Error(`시스템 알림 조회 실패: ${systemError.message}`);
    }

    // 중복 패턴 분석
    const titleGroups = new Map<string, number>();
    systemNotifications?.forEach(notif => {
      const count = titleGroups.get(notif.title) || 0;
      titleGroups.set(notif.title, count + 1);
    });

    const duplicatePatterns = Array.from(titleGroups.entries())
      .filter(([title, count]) => count > 1)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      systemNotifications: systemNotifications || [],
      duplicatePatterns,
      totalSystemNotifications: systemNotifications?.length || 0,
      duplicateCount: duplicatePatterns.reduce((sum, p) => sum + p.count - 1, 0)
    });

  } catch (error) {
    console.error('정리 상태 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '정리 상태 조회에 실패했습니다'
    }, { status: 500 });
  }
}