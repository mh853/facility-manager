import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 토큰에서 사용자 정보 추출
function getUserFromToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    // 임시 사용자 정보 (실제로는 토큰에서 추출)
    return {
      id: 'user_1',
      name: '관리자',
      email: 'admin@blueon.kr'
    };
  } catch (error) {
    console.error('토큰 파싱 오류:', error);
    return null;
  }
}

// POST: 모든 알림 읽음 처리
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    // 업무 알림 조회 (task_notifications 테이블의 안읽은 알림만)
    const { data: unreadTaskNotifications, error: taskFetchError } = await supabase
      .from('task_notifications')
      .select('id, message, business_name')
      .eq('user_id', user.id)
      .eq('is_read', false);

    console.log('📊 [READ-ALL] 조회 결과:', {
      taskNotifications: unreadTaskNotifications?.length || 0,
      error: taskFetchError?.message || 'none'
    });

    if (taskFetchError) {
      console.error('업무 알림 조회 오류:', taskFetchError);
      return NextResponse.json(
        { success: false, error: { message: '알림 조회에 실패했습니다.' } },
        { status: 500 }
      );
    }

    // 읽지 않은 업무 알림이 없는 경우
    if (!unreadTaskNotifications || unreadTaskNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          processedCount: 0,
          message: '읽지 않은 업무 알림이 없습니다.'
        }
      });
    }

    // 모든 업무 알림을 읽음 처리
    const taskNotificationIds = unreadTaskNotifications.map(n => n.id);

    console.log('🔄 [READ-ALL] 업무 알림 읽음 처리 시작:', {
      totalCount: taskNotificationIds.length,
      ids: taskNotificationIds
    });

    const { data: updatedTaskNotifications, error: taskUpdateError } = await supabase
      .from('task_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .in('id', taskNotificationIds)
      .eq('user_id', user.id)
      .select();

    if (taskUpdateError) {
      console.error('❌ [READ-ALL] 업무 알림 읽음 처리 오류:', taskUpdateError);
      return NextResponse.json(
        { success: false, error: { message: '읽음 처리에 실패했습니다.' } },
        { status: 500 }
      );
    }

    const totalProcessed = updatedTaskNotifications?.length || 0;

    console.log('✅ [READ-ALL] 업무 알림 읽음 처리 완료:', {
      processed: totalProcessed,
      requested: taskNotificationIds.length
    });

    return NextResponse.json({
      success: true,
      data: {
        processedCount: totalProcessed,
        readAt: new Date().toISOString(),
        message: `${totalProcessed}개의 업무 알림이 읽음 처리되었습니다.`
      }
    });

  } catch (error) {
    console.error('모든 알림 읽음 처리 API 오류:', error);
    return NextResponse.json(
      { success: false, error: { message: '서버 내부 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}