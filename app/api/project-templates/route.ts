import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth/middleware';

// 프로젝트 템플릿 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const project_type = searchParams.get('project_type'); // '자체자금' | '보조금'
    const department_id = searchParams.get('department_id');
    const is_active = searchParams.get('is_active');

    const supabase = supabaseAdmin;

    // 기본 쿼리 빌드
    let query = supabase
      .from('project_templates')
      .select(`
        *,
        department:departments(id, name),
        creator:employees(id, name, email)
      `);

    // 필터 적용
    if (project_type) {
      query = query.eq('project_type', project_type);
    }
    if (department_id) {
      query = query.eq('department_id', department_id);
    }
    if (is_active) {
      query = query.eq('is_active', is_active === 'true');
    }

    // 권한별 필터링
    if (user.permission_level === 2) {
      query = query.eq('department_id', user.department_id);
    }

    // 정렬
    query = query.order('created_at', { ascending: false });

    const { data: templates, error: templatesError } = await query;

    if (templatesError) {
      console.error('템플릿 조회 오류:', templatesError);
      return NextResponse.json({
        success: false,
        error: '템플릿 목록을 불러오는데 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('템플릿 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 새 프로젝트 템플릿 생성 (POST)
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    // 권한 확인 (권한 3은 템플릿 생성 불가)
    if (user.permission_level === 3) {
      return NextResponse.json({
        success: false,
        error: '템플릿 생성 권한이 없습니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      project_type,
      template_tasks,
      department_id
    } = body;

    // 필수 필드 검증
    if (!name || !project_type || !template_tasks) {
      return NextResponse.json({
        success: false,
        error: '템플릿명, 프로젝트 유형, 작업 목록은 필수입니다.'
      }, { status: 400 });
    }

    // 작업 목록 검증
    if (!Array.isArray(template_tasks) || template_tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '최소 하나 이상의 작업이 필요합니다.'
      }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    // 템플릿 생성
    const { data: template, error: templateError } = await supabase
      .from('project_templates')
      .insert({
        name,
        description,
        project_type,
        template_tasks,
        department_id: department_id || user.department_id,
        created_by: user.id
      })
      .select()
      .single();

    if (templateError) {
      console.error('템플릿 생성 오류:', templateError);
      return NextResponse.json({
        success: false,
        error: '템플릿 생성에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: template,
      message: '템플릿이 성공적으로 생성되었습니다.'
    });

  } catch (error) {
    console.error('템플릿 생성 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}