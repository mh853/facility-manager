import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { verifyToken } from '@/lib/secure-jwt'

// 기본 레이아웃 설정
const DEFAULT_LAYOUT = {
  widgets: [
    { id: 'organization', visible: true, order: 1 },
    { id: 'revenue', visible: true, order: 2 },
    { id: 'receivable', visible: true, order: 3 },
    { id: 'installation', visible: true, order: 4 }
  ]
};

// GET: 사용자의 레이아웃 설정 조회
export async function GET(request: NextRequest) {
  try {
    // 토큰에서 사용자 정보 추출
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);
    const userId = decoded.userId;

    const supabase = await createClient();

    // 사용자의 레이아웃 설정 조회
    const { data, error } = await supabase
      .from('dashboard_layouts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // 레이아웃이 없으면 기본값 반환
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          data: DEFAULT_LAYOUT
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data.layout_config || DEFAULT_LAYOUT
    });

  } catch (error: any) {
    console.error('❌ [Dashboard Layout API GET Error]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: 레이아웃 설정 저장
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);
    const userId = decoded.userId;

    const body = await request.json();
    const { layout_config } = body;

    if (!layout_config || !layout_config.widgets) {
      return NextResponse.json(
        { success: false, error: 'layout_config는 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // upsert: 존재하면 업데이트, 없으면 생성
    const { data, error } = await supabase
      .from('dashboard_layouts')
      .upsert(
        {
          user_id: userId,
          layout_config,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id'
        }
      )
      .select()
      .single();

    if (error) {
      console.error('❌ [Dashboard Layout API] POST error:', error);
      throw error;
    }

    console.log('✅ [Dashboard Layout API] Layout saved for user:', userId);

    return NextResponse.json({
      success: true,
      data: data.layout_config
    });

  } catch (error: any) {
    console.error('❌ [Dashboard Layout API POST Error]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: 레이아웃 설정 초기화 (기본값으로 되돌림)
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);
    const userId = decoded.userId;

    const supabase = await createClient();

    const { error } = await supabase
      .from('dashboard_layouts')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Dashboard Layout API] DELETE error:', error);
      throw error;
    }

    console.log('✅ [Dashboard Layout API] Layout reset for user:', userId);

    return NextResponse.json({
      success: true,
      message: '레이아웃이 기본값으로 초기화되었습니다.',
      data: DEFAULT_LAYOUT
    });

  } catch (error: any) {
    console.error('❌ [Dashboard Layout API DELETE Error]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
