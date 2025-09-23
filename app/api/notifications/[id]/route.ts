import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// JWT 토큰에서 사용자 정보 추출하는 헬퍼 함수
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

async function getUserFromToken(authHeader: string | null) {
  try {
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

// GET: 특정 알림 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const notificationId = params.id;

    // 알림 상세 정보 조회 (읽음 상태 포함)
    const { data: notification, error } = await supabase
      .from('notifications')
      .select(`
        *,
        user_notification_reads!left(
          user_id,
          read_at
        )
      `)
      .eq('id', notificationId)
      .single();

    if (error) {
      console.error('알림 조회 오류:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { message: '알림을 찾을 수 없습니다.' } },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: { message: '알림 조회에 실패했습니다.' } },
        { status: 500 }
      );
    }

    // 읽음 상태 확인
    const readRecord = notification.user_notification_reads?.find(
      (read: any) => read.user_id === user.id
    );

    const processedNotification = {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      category: notification.category,
      priority: notification.priority,
      relatedResourceType: notification.related_resource_type,
      relatedResourceId: notification.related_resource_id,
      relatedUrl: notification.related_url,
      metadata: notification.metadata,
      createdById: notification.created_by_id,
      createdByName: notification.created_by_name,
      createdAt: notification.created_at,
      expiresAt: notification.expires_at,
      isSystemNotification: notification.is_system_notification,
      isRead: !!readRecord,
      readAt: readRecord?.read_at || null
    };

    return NextResponse.json({
      success: true,
      data: processedNotification
    });

  } catch (error) {
    console.error('알림 상세 조회 API 오류:', error);
    return NextResponse.json(
      { success: false, error: { message: '서버 내부 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}

// DELETE: 특정 알림 삭제 (사용자별)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const notificationId = params.id;

    // 알림 존재 확인
    const { data: notification, error: checkError } = await supabase
      .from('notifications')
      .select('id, title, created_by_id')
      .eq('id', notificationId)
      .single();

    if (checkError || !notification) {
      return NextResponse.json(
        { success: false, error: { message: '알림을 찾을 수 없습니다.' } },
        { status: 404 }
      );
    }

    // 시스템 알림인 경우 실제 삭제 대신 읽음 처리만 수행
    if (notification.created_by_id === 'system' || !notification.created_by_id) {
      // 읽음 기록이 없으면 생성
      const { data: existingRead } = await supabase
        .from('user_notification_reads')
        .select('id')
        .eq('notification_id', notificationId)
        .eq('user_id', user.id)
        .single();

      if (!existingRead) {
        await supabase
          .from('user_notification_reads')
          .insert({
            notification_id: notificationId,
            user_id: user.id,
            user_name: user.name
          });
      }

      return NextResponse.json({
        success: true,
        data: {
          message: '시스템 알림이 숨김 처리되었습니다.',
          isHidden: true
        }
      });
    }

    // 사용자가 직접 생성한 알림이거나 권한이 있는 경우 실제 삭제
    if (notification.created_by_id === user.id) {
      // 관련된 읽음 기록도 함께 삭제
      await supabase
        .from('user_notification_reads')
        .delete()
        .eq('notification_id', notificationId);

      // 알림 삭제
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (deleteError) {
        console.error('알림 삭제 오류:', deleteError);
        return NextResponse.json(
          { success: false, error: { message: '알림 삭제에 실패했습니다.' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          message: '알림이 성공적으로 삭제되었습니다.',
          isDeleted: true
        }
      });
    }

    // 권한이 없는 경우
    return NextResponse.json(
      { success: false, error: { message: '알림을 삭제할 권한이 없습니다.' } },
      { status: 403 }
    );

  } catch (error) {
    console.error('알림 삭제 API 오류:', error);
    return NextResponse.json(
      { success: false, error: { message: '서버 내부 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}