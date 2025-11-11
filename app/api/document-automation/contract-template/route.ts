// app/api/document-automation/contract-template/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/document-automation/contract-template
 * 계약서 템플릿 조회
 * 권한: 1 이상
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    if (!permissionLevel || permissionLevel < 1) {
      return NextResponse.json({
        success: false,
        message: '템플릿 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const contractType = url.searchParams.get('contract_type');

    let query = supabaseAdmin
      .from('contract_templates')
      .select('*')
      .eq('is_active', true);

    if (contractType && ['subsidy', 'self_pay'].includes(contractType)) {
      query = query.eq('contract_type', contractType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('템플릿 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '템플릿 조회에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('템플릿 조회 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * PUT /api/document-automation/contract-template
 * 계약서 템플릿 수정
 * 권한: 4 이상만 가능
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    if (!permissionLevel || permissionLevel < 4) {
      return NextResponse.json({
        success: false,
        message: '템플릿 수정 권한이 없습니다. (권한 4 이상 필요)'
      }, { status: 403 });
    }

    const body = await request.json();
    const { template_id, ...updates } = body;

    if (!template_id) {
      return NextResponse.json({
        success: false,
        message: 'template_id가 필요합니다.'
      }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('contract_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', template_id)
      .select()
      .single();

    if (error) {
      console.error('템플릿 수정 오류:', error);
      return NextResponse.json({
        success: false,
        message: '템플릿 수정에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '템플릿이 수정되었습니다.',
      data
    });

  } catch (error) {
    console.error('템플릿 수정 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
