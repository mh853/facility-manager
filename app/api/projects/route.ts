import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth/middleware';

// 프로젝트 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const department_id = searchParams.get('department_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const supabase = supabaseAdmin;

    // 기본 쿼리 빌드
    let query = supabase
      .from('project_dashboard')
      .select('*');

    // 필터 적용
    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('project_type', type);
    }
    if (department_id) {
      query = query.eq('department_id', department_id);
    }

    // 권한별 필터링 (권한 1: 전체, 권한 2: 자신의 부서, 권한 3: 자신의 프로젝트만)
    if (user.permission_level === 2) {
      query = query.eq('department_id', user.department_id);
    } else if (user.permission_level === 3) {
      query = query.eq('manager_id', user.id);
    }

    // 페이징 및 정렬
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: projects, error: projectError } = await query;

    if (projectError) {
      console.error('프로젝트 조회 오류:', projectError);
      return NextResponse.json({
        success: false,
        error: '프로젝트 목록을 불러오는데 실패했습니다.'
      }, { status: 500 });
    }

    // 전체 개수 조회 (페이징용)
    let countQuery = supabase
      .from('projects')
      .select('*', { count: 'exact', head: true });

    if (status) countQuery = countQuery.eq('status', status);
    if (type) countQuery = countQuery.eq('project_type', type);
    if (department_id) countQuery = countQuery.eq('department_id', department_id);
    if (user.permission_level === 2) countQuery = countQuery.eq('department_id', user.department_id);
    if (user.permission_level === 3) countQuery = countQuery.eq('manager_id', user.id);

    const { count } = await countQuery;

    return NextResponse.json({
      success: true,
      data: {
        projects,
        pagination: {
          current_page: page,
          total_pages: Math.ceil((count || 0) / limit),
          total_count: count || 0,
          limit
        }
      }
    });

  } catch (error) {
    console.error('프로젝트 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 새 프로젝트 생성 (POST)
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    // 권한 확인 (권한 3은 프로젝트 생성 불가)
    if (user.permission_level === 3) {
      return NextResponse.json({
        success: false,
        error: '프로젝트 생성 권한이 없습니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      project_type,
      business_name,
      business_registration_number,
      business_address,
      contact_person,
      contact_phone,
      department_id,
      manager_id,
      start_date,
      expected_end_date,
      total_budget,
      subsidy_amount,
      self_funding_amount,
      template_id // 템플릿 기반 생성
    } = body;

    // 필수 필드 검증
    if (!name || !business_name || !project_type) {
      return NextResponse.json({
        success: false,
        error: '프로젝트명, 사업장명, 프로젝트 유형은 필수입니다.'
      }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    // 프로젝트 생성
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        project_type,
        business_name,
        business_registration_number,
        business_address,
        contact_person,
        contact_phone,
        status: '계획',
        department_id: department_id || user.department_id,
        manager_id: manager_id || user.id,
        start_date,
        expected_end_date,
        total_budget,
        subsidy_amount,
        self_funding_amount,
        created_by: user.id
      })
      .select()
      .single();

    if (projectError) {
      console.error('프로젝트 생성 오류:', projectError);
      return NextResponse.json({
        success: false,
        error: '프로젝트 생성에 실패했습니다.'
      }, { status: 500 });
    }

    // 템플릿 기반 작업 생성
    if (template_id) {
      const { data: template } = await supabase
        .from('project_templates')
        .select('template_tasks')
        .eq('id', template_id)
        .single();

      if (template && template.template_tasks) {
        const tasks = (template.template_tasks as any[]).map((task, index) => ({
          title: task.title,
          description: task.description,
          project_id: project.id,
          priority: task.priority || '보통',
          estimated_hours: task.estimated_hours,
          order_in_project: task.order || index + 1,
          department_id: department_id || user.department_id,
          created_by: user.id
        }));

        await supabase
          .from('tasks')
          .insert(tasks);
      }
    }

    return NextResponse.json({
      success: true,
      data: project,
      message: '프로젝트가 성공적으로 생성되었습니다.'
    });

  } catch (error) {
    console.error('프로젝트 생성 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}