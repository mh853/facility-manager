// app/api/business/[id]/route.ts - 캘린더용 읽기 전용 사업장 정보 API
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/business/[id]
 * 캘린더 모달에서 사용하는 읽기 전용 사업장 정보 조회
 * - 인증 불필요 (공개 정보만 반환)
 * - 기본 정보만 제공 (이름, 주소, 연락처 등)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = params;

    // 사업장 기본 정보 조회
    const { data, error } = await supabase
      .from('business_info')
      .select(`
        id,
        business_name,
        address,
        local_government,
        representative_name,
        business_registration_number,
        business_contact,
        manager_name,
        manager_contact,
        email,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('[사업장 정보 조회 실패]', error);
      return NextResponse.json(
        {
          success: false,
          error: '사업장을 찾을 수 없습니다.',
          details: error.message
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[사업장 조회 API 오류]', error);
    return NextResponse.json(
      {
        success: false,
        error: '사업장 조회 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
