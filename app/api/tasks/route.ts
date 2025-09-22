import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth/middleware';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 작업 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assigned_to = searchParams.get('assigned_to');
    const department_id = searchParams.get('department_id');
    const due_soon = searchParams.get('due_soon'); // 마감 임박 작업
    const my_tasks = searchParams.get('my_tasks'); // 내 작업만
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const supabase = supabaseAdmin;

    // 기본 쿼리 빌드
    let query = supabase
      .from('task_dashboard')
      .select('*');

    // 필터 적용
    if (project_id) {
      query = query.eq('project_id', project_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    }
    if (department_id) {
      query = query.eq('department_id', department_id);
    }

    // 내 작업만 필터
    if (my_tasks === 'true' && user) {
      query = query.eq('assigned_to', (user as any).id);
    }

    // 마감 임박 작업 (7일 이내)
    if (due_soon === 'true') {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      query = query
        .not('due_date', 'is', null)
        .lte('due_date', sevenDaysFromNow.toISOString().split('T')[0])
        .neq('status', '완료');
    }

    // 권한별 필터링
    if (user && (user.permissionLevel === 1 || user.permissionLevel === 2)) {
      query = query.eq('department_id', user.departmentId);
    } else if (user && user.permissionLevel === 3) {
      // 권한 3: 자신이 담당하거나 소속 프로젝트의 작업만
      query = query.or(`assigned_to.eq.${(user as any).id},project_id.in.(select id from projects where manager_id = ${(user as any).id})`);
    }

    // 페이징 및 정렬
    query = query
      .order('priority', { ascending: false }) // 우선순위 순
      .order('due_date', { ascending: true }) // 마감일 순
      .range(offset, offset + limit - 1);

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      console.error('작업 조회 오류:', tasksError);
      return NextResponse.json({
        success: false,
        error: '작업 목록을 불러오는데 실패했습니다.'
      }, { status: 500 });
    }

    // 전체 개수 조회 (페이징용)
    let countQuery = supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true });

    if (project_id) countQuery = countQuery.eq('project_id', project_id);
    if (status) countQuery = countQuery.eq('status', status);
    if (priority) countQuery = countQuery.eq('priority', priority);
    if (assigned_to) countQuery = countQuery.eq('assigned_to', assigned_to);
    if (department_id) countQuery = countQuery.eq('department_id', department_id);
    if (my_tasks === 'true' && user) countQuery = countQuery.eq('assigned_to', (user as any).id);
    if (user && (user.permissionLevel === 1 || user.permissionLevel === 2)) countQuery = countQuery.eq('department_id', user.departmentId);

    const { count } = await countQuery;

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        pagination: {
          current_page: page,
          total_pages: Math.ceil((count || 0) / limit),
          total_count: count || 0,
          limit
        }
      }
    });

  } catch (error) {
    console.error('작업 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 새 작업 생성 (POST)
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      project_id,
      priority = '보통',
      assigned_to,
      department_id,
      start_date,
      due_date,
      estimated_hours,
      parent_task_id,
      order_in_project = 0,
      notes
    } = body;

    // 필수 필드 검증
    if (!title || !project_id) {
      return NextResponse.json({
        success: false,
        error: '작업명과 프로젝트는 필수입니다.'
      }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    // 프로젝트 접근 권한 확인
    let projectQuery = supabase
      .from('projects')
      .select('id, department_id, manager_id')
      .eq('id', project_id);

    if (user && (user.permissionLevel === 1 || user.permissionLevel === 2)) {
      projectQuery = projectQuery.eq('department_id', user.departmentId);
    } else if (user && user.permissionLevel === 3) {
      projectQuery = projectQuery.eq('manager_id', (user as any).id);
    }

    const { data: project, error: projectError } = await projectQuery.single();

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: '프로젝트에 접근할 권한이 없습니다.'
      }, { status: 403 });
    }

    // 작업 생성
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        project_id,
        priority,
        assigned_to,
        department_id: department_id || project.department_id,
        start_date,
        due_date,
        estimated_hours,
        parent_task_id,
        order_in_project,
        notes,
        created_by: (user as any)?.id
      })
      .select()
      .single();

    if (taskError) {
      console.error('작업 생성 오류:', taskError);
      return NextResponse.json({
        success: false,
        error: '작업 생성에 실패했습니다.'
      }, { status: 500 });
    }

    // 작업 생성 로그 추가
    await supabase
      .from('task_comments')
      .insert({
        task_id: task.id,
        content: `작업이 생성되었습니다.`,
        comment_type: 'status_change',
        author_id: (user as any)?.id
      });

    return NextResponse.json({
      success: true,
      data: task,
      message: '작업이 성공적으로 생성되었습니다.'
    });

  } catch (error) {
    console.error('작업 생성 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}