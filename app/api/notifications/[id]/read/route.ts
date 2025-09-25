import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// JWT 토큰에서 사용자 정보 추출하는 헬퍼 함수 (facility-tasks와 동일한 로직)
async function getUserFromToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // 사용자 정보 조회
    const { data: user, error } = await supabase
      .from('employees')
      .select('id, name, email, permission_level, department')
      .eq('id', decoded.userId || decoded.id)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      console.warn('⚠️ [AUTH] 사용자 조회 실패:', error?.message);
      return null;
    }

    return user;
  } catch (error) {
    console.warn('⚠️ [AUTH] JWT 토큰 검증 실패:', error);
    return null;
  }
}

// POST: 특정 알림 읽음 처리
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const rawNotificationId = params.id;
    let notificationId = rawNotificationId;
    let isTaskNotification = false;

    // task- 접두사가 있는 경우 제거하고 task_notifications 테이블에서 검색
    if (rawNotificationId.startsWith('task-')) {
      notificationId = rawNotificationId.substring(5); // "task-" 제거
      isTaskNotification = true;
    }

    let notification = null;
    let checkError = null;

    if (isTaskNotification) {
      // task_notifications 테이블에서 검색
      const { data, error } = await supabase
        .from('task_notifications')
        .select('id, business_name, message')
        .eq('id', notificationId)
        .single();

      notification = data;
      checkError = error;
    } else {
      // notifications 테이블에서 검색
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title')
        .eq('id', notificationId)
        .single();

      notification = data;
      checkError = error;
    }

    if (checkError || !notification) {
      return NextResponse.json(
        { success: false, error: { message: '알림을 찾을 수 없습니다.' } },
        { status: 404 }
      );
    }

    if (isTaskNotification) {
      // task_notifications 테이블의 is_read 필드 업데이트
      const { error: updateError } = await supabase
        .from('task_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (updateError) {
        console.error('업무 알림 읽음 처리 오류:', updateError);
        return NextResponse.json(
          { success: false, error: { message: '읽음 처리에 실패했습니다.' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          notificationId: rawNotificationId,
          notificationType: 'task_notification',
          message: '업무 알림이 읽음 처리되었습니다.'
        }
      });
    } else {
      // notifications 테이블용 user_notification_reads 처리
      const { data: existingRead } = await supabase
        .from('user_notification_reads')
        .select('id')
        .eq('notification_id', notificationId)
        .eq('user_id', user.id)
        .single();

      if (existingRead) {
        return NextResponse.json({
          success: true,
          data: {
            message: '이미 읽음 처리된 알림입니다.',
            isAlreadyRead: true
          }
        });
      }

      // 읽음 기록 생성
      const { data: readRecord, error } = await supabase
        .from('user_notification_reads')
        .insert({
          notification_id: notificationId,
          user_id: user.id,
          user_name: user.name
        })
        .select()
        .single();

      if (error) {
        console.error('읽음 처리 오류:', error);
        return NextResponse.json(
          { success: false, error: { message: '읽음 처리에 실패했습니다.' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          notificationId: rawNotificationId,
          notificationType: 'notification',
          readAt: readRecord.read_at,
          message: '알림이 읽음 처리되었습니다.'
        }
      });
    }

  } catch (error) {
    console.error('알림 읽음 처리 API 오류:', error);
    return NextResponse.json(
      { success: false, error: { message: '서버 내부 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}