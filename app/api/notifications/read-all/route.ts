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

    // 현재 읽지 않은 알림 목록 조회
    const { data: unreadNotifications, error: fetchError } = await supabase
      .from('notifications')
      .select(`
        id,
        title,
        user_notification_reads!left(user_id)
      `)
      .gt('expires_at', new Date().toISOString())
      .is('user_notification_reads.user_id', null);

    if (fetchError) {
      console.error('읽지 않은 알림 조회 오류:', fetchError);
      return NextResponse.json(
        { success: false, error: { message: '알림 조회에 실패했습니다.' } },
        { status: 500 }
      );
    }

    // 읽지 않은 알림이 없는 경우
    if (!unreadNotifications || unreadNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          processedCount: 0,
          message: '읽지 않은 알림이 없습니다.'
        }
      });
    }

    // 모든 읽지 않은 알림에 대해 읽음 기록 생성
    const readRecords = unreadNotifications.map(notification => ({
      notification_id: notification.id,
      user_id: user.id,
      user_name: user.name
    }));

    const { data: createdReads, error: insertError } = await supabase
      .from('user_notification_reads')
      .insert(readRecords)
      .select();

    if (insertError) {
      console.error('모든 알림 읽음 처리 오류:', insertError);
      return NextResponse.json(
        { success: false, error: { message: '읽음 처리에 실패했습니다.' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        processedCount: createdReads?.length || 0,
        readAt: new Date().toISOString(),
        message: `${createdReads?.length || 0}개의 알림이 읽음 처리되었습니다.`
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