import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 토큰에서 사용자 정보 추출 (임시 인증 우회)
function getUserFromToken(authHeader: string | null) {
  // 개발 환경용 임시 사용자
  return {
    id: 'demo-user',
    name: '데모 사용자',
    email: 'demo@example.com'
  };
}

// DELETE: 모든 알림 완전 삭제
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    console.log('🗑️ [DELETE-ALL] 모든 알림 삭제 시작:', { userId: user.id, userName: user.name });

    let totalDeleted = 0;
    const results = [];

    // 1. user_notifications에서 사용자 알림 삭제
    try {
      const { data: deletedUserNotifications, error: userDeleteError } = await supabaseAdmin
        .from('user_notifications')
        .delete()
        .eq('user_id', user.id)
        .select();

      if (userDeleteError) {
        console.error('사용자 알림 삭제 오류:', userDeleteError);
        results.push({ type: 'user_notifications', success: false, error: userDeleteError.message });
      } else {
        const deletedCount = deletedUserNotifications?.length || 0;
        totalDeleted += deletedCount;
        results.push({ type: 'user_notifications', success: true, deletedCount });
        console.log('✅ [DELETE-ALL] 사용자 알림 삭제 완료:', deletedCount, '개');
      }
    } catch (error: any) {
      console.log('⚠️ [DELETE-ALL] user_notifications 테이블 없음 또는 접근 불가');
      results.push({ type: 'user_notifications', success: false, error: 'Table not found' });
    }

    // 2. task_notifications에서 업무 알림 삭제
    try {
      const { data: deletedTaskNotifications, error: taskDeleteError } = await supabaseAdmin
        .from('task_notifications')
        .delete()
        .eq('user_id', user.id)
        .select();

      if (taskDeleteError) {
        console.error('업무 알림 삭제 오류:', taskDeleteError);
        results.push({ type: 'task_notifications', success: false, error: taskDeleteError.message });
      } else {
        const deletedCount = deletedTaskNotifications?.length || 0;
        totalDeleted += deletedCount;
        results.push({ type: 'task_notifications', success: true, deletedCount });
        console.log('✅ [DELETE-ALL] 업무 알림 삭제 완료:', deletedCount, '개');
      }
    } catch (error: any) {
      console.error('업무 알림 삭제 오류:', error);
      results.push({ type: 'task_notifications', success: false, error: error.message });
    }

    console.log('🎯 [DELETE-ALL] 모든 알림 삭제 완료:', {
      totalDeleted,
      results
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: totalDeleted,
        results,
        message: `${totalDeleted}개의 알림이 완전히 삭제되었습니다.`
      }
    });

  } catch (error: any) {
    console.error('모든 알림 삭제 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: '서버 내부 오류가 발생했습니다.',
          details: error.message
        }
      },
      { status: 500 }
    );
  }
}

// POST: 특정 조건의 알림들 삭제 (선택적)
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const { deleteType, olderThanDays } = await request.json();

    console.log('🗑️ [DELETE-SELECTIVE] 조건부 알림 삭제 시작:', {
      userId: user.id,
      deleteType,
      olderThanDays
    });

    let totalDeleted = 0;
    const results = [];

    if (deleteType === 'read') {
      // 읽은 알림만 삭제

      // user_notifications에서 읽은 알림 삭제
      try {
        const { data: deletedUserNotifications, error: userDeleteError } = await supabaseAdmin
          .from('user_notifications')
          .delete()
          .eq('user_id', user.id)
          .eq('is_read', true)
          .select();

        if (!userDeleteError) {
          const deletedCount = deletedUserNotifications?.length || 0;
          totalDeleted += deletedCount;
          results.push({ type: 'user_notifications', success: true, deletedCount });
        }
      } catch (error) {
        console.log('⚠️ user_notifications 테이블 없음');
      }

      // task_notifications에서 읽은 알림 삭제
      const { data: deletedTaskNotifications, error: taskDeleteError } = await supabaseAdmin
        .from('task_notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', true)
        .select();

      if (!taskDeleteError) {
        const deletedCount = deletedTaskNotifications?.length || 0;
        totalDeleted += deletedCount;
        results.push({ type: 'task_notifications', success: true, deletedCount });
      }

    } else if (deleteType === 'expired') {
      // 만료된 알림만 삭제

      // user_notifications에서 만료된 알림 삭제
      try {
        const { data: deletedUserNotifications, error: userDeleteError } = await supabaseAdmin
          .from('user_notifications')
          .delete()
          .eq('user_id', user.id)
          .lt('expires_at', new Date().toISOString())
          .select();

        if (!userDeleteError) {
          const deletedCount = deletedUserNotifications?.length || 0;
          totalDeleted += deletedCount;
          results.push({ type: 'user_notifications', success: true, deletedCount });
        }
      } catch (error) {
        console.log('⚠️ user_notifications 테이블 없음');
      }

      // task_notifications에서 만료된 알림 삭제
      const { data: deletedTaskNotifications, error: taskDeleteError } = await supabaseAdmin
        .from('task_notifications')
        .delete()
        .eq('user_id', user.id)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString())
        .select();

      if (!taskDeleteError) {
        const deletedCount = deletedTaskNotifications?.length || 0;
        totalDeleted += deletedCount;
        results.push({ type: 'task_notifications', success: true, deletedCount });
      }

    } else if (deleteType === 'old' && olderThanDays) {
      // 특정 일수보다 오래된 알림 삭제
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffDateString = cutoffDate.toISOString();

      // user_notifications에서 오래된 알림 삭제
      try {
        const { data: deletedUserNotifications, error: userDeleteError } = await supabaseAdmin
          .from('user_notifications')
          .delete()
          .eq('user_id', user.id)
          .lt('created_at', cutoffDateString)
          .select();

        if (!userDeleteError) {
          const deletedCount = deletedUserNotifications?.length || 0;
          totalDeleted += deletedCount;
          results.push({ type: 'user_notifications', success: true, deletedCount });
        }
      } catch (error) {
        console.log('⚠️ user_notifications 테이블 없음');
      }

      // task_notifications에서 오래된 알림 삭제
      const { data: deletedTaskNotifications, error: taskDeleteError } = await supabaseAdmin
        .from('task_notifications')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', cutoffDateString)
        .select();

      if (!taskDeleteError) {
        const deletedCount = deletedTaskNotifications?.length || 0;
        totalDeleted += deletedCount;
        results.push({ type: 'task_notifications', success: true, deletedCount });
      }
    }

    console.log('🎯 [DELETE-SELECTIVE] 조건부 알림 삭제 완료:', {
      deleteType,
      totalDeleted,
      results
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: totalDeleted,
        deleteType,
        results,
        message: `${totalDeleted}개의 ${deleteType === 'read' ? '읽은' : deleteType === 'expired' ? '만료된' : '오래된'} 알림이 삭제되었습니다.`
      }
    });

  } catch (error: any) {
    console.error('조건부 알림 삭제 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: '서버 내부 오류가 발생했습니다.',
          details: error.message
        }
      },
      { status: 500 }
    );
  }
}