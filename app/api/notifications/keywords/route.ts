// app/api/notifications/keywords/route.ts - 키워드 알림 설정 관리 API
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

// GET: 사용자의 키워드 알림 설정 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { data: keywords, error } = await supabaseAdmin
      .from('notification_keywords')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('키워드 조회 오류:', error);
      return NextResponse.json({ error: '키워드 조회에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      keywords: keywords || []
    });

  } catch (error) {
    console.error('키워드 API GET 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// POST: 새 키워드 알림 설정 추가
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { keyword, alertTypes } = await request.json();

    if (!keyword?.trim()) {
      return NextResponse.json({ error: '키워드를 입력해주세요' }, { status: 400 });
    }

    if (!alertTypes || !Array.isArray(alertTypes) || alertTypes.length === 0) {
      return NextResponse.json({ error: '알림 유형을 선택해주세요' }, { status: 400 });
    }

    // 유효한 알림 유형 검증
    const validTypes = ['status_change', 'assignment', 'deadline'];
    const invalidTypes = alertTypes.filter(type => !validTypes.includes(type));
    if (invalidTypes.length > 0) {
      return NextResponse.json({
        error: `잘못된 알림 유형: ${invalidTypes.join(', ')}`
      }, { status: 400 });
    }

    // 중복 키워드 확인
    const { data: existing } = await supabaseAdmin
      .from('notification_keywords')
      .select('id')
      .eq('user_id', user.id)
      .eq('keyword', keyword.trim())
      .eq('is_active', true)
      .single();

    if (existing) {
      return NextResponse.json({
        error: '이미 등록된 키워드입니다'
      }, { status: 409 });
    }

    // 새 키워드 설정 추가
    const { data: newKeyword, error } = await supabaseAdmin
      .from('notification_keywords')
      .insert({
        user_id: user.id,
        keyword: keyword.trim(),
        alert_types: alertTypes,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('키워드 생성 오류:', error);
      return NextResponse.json({ error: '키워드 등록에 실패했습니다' }, { status: 500 });
    }

    console.log('✅ [KEYWORD] 새 키워드 알림 설정:', user.name, keyword, alertTypes);

    return NextResponse.json({
      success: true,
      keyword: newKeyword,
      message: `"${keyword}" 키워드 알림이 등록되었습니다`
    });

  } catch (error) {
    console.error('키워드 API POST 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// PUT: 키워드 알림 설정 수정
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id, alertTypes, isActive } = await request.json();

    if (!id) {
      return NextResponse.json({ error: '키워드 ID가 필요합니다' }, { status: 400 });
    }

    // 권한 확인 (본인의 키워드만 수정 가능)
    const { data: keyword } = await supabaseAdmin
      .from('notification_keywords')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!keyword || keyword.user_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    // 업데이트할 필드 구성
    const updateData: any = { updated_at: new Date().toISOString() };

    if (alertTypes && Array.isArray(alertTypes)) {
      const validTypes = ['status_change', 'assignment', 'deadline'];
      const invalidTypes = alertTypes.filter(type => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        return NextResponse.json({
          error: `잘못된 알림 유형: ${invalidTypes.join(', ')}`
        }, { status: 400 });
      }
      updateData.alert_types = alertTypes;
    }

    if (typeof isActive === 'boolean') {
      updateData.is_active = isActive;
    }

    // 키워드 설정 업데이트
    const { data: updatedKeyword, error } = await supabaseAdmin
      .from('notification_keywords')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('키워드 수정 오류:', error);
      return NextResponse.json({ error: '키워드 수정에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      keyword: updatedKeyword,
      message: '키워드 알림 설정이 수정되었습니다'
    });

  } catch (error) {
    console.error('키워드 API PUT 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// DELETE: 키워드 알림 설정 삭제
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '키워드 ID가 필요합니다' }, { status: 400 });
    }

    // 권한 확인
    const { data: keyword } = await supabaseAdmin
      .from('notification_keywords')
      .select('user_id, keyword')
      .eq('id', id)
      .single();

    if (!keyword || keyword.user_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    // 키워드 삭제
    const { error } = await supabaseAdmin
      .from('notification_keywords')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('키워드 삭제 오류:', error);
      return NextResponse.json({ error: '키워드 삭제에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `"${keyword.keyword}" 키워드 알림이 삭제되었습니다`
    });

  } catch (error) {
    console.error('키워드 API DELETE 오류:', error);
    return NextResponse.json({ error: '서버 오료' }, { status: 500 });
  }
}