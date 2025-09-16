import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 업무 목록 조회
export async function GET(request: NextRequest) {
  try {
    console.log('🟡 [TASKS] API 시작:', {
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString()
    });

    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth-token')?.value;
    const token = authHeader?.replace('Bearer ', '') || cookieToken;

    if (!token) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as any;
    } catch (jwtError) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // URL 파라미터 추출
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // 상태 필터
    const priority = searchParams.get('priority'); // 우선순위 필터
    const category = searchParams.get('category'); // 카테고리 필터
    const assignee = searchParams.get('assignee'); // 담당자 필터
    const search = searchParams.get('search'); // 검색어
    const sortBy = searchParams.get('sortBy') || 'created_at'; // 정렬 기준
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // 정렬 순서

    const offset = (page - 1) * limit;

    console.log('🔍 [TASKS] 조회 조건:', {
      userId: decodedToken.userId,
      permissionLevel: decodedToken.permissionLevel,
      page,
      limit,
      filters: { status, priority, category, assignee, search },
      sort: { sortBy, sortOrder }
    });

    // 기본 쿼리 구성
    let query = supabaseAdmin
      .from('task_details')
      .select(`
        id,
        title,
        description,
        priority,
        start_date,
        due_date,
        estimated_hours,
        actual_hours,
        progress_percentage,
        is_urgent,
        created_at,
        updated_at,
        category_name,
        category_color,
        category_icon,
        status_name,
        status_color,
        status_icon,
        status_type,
        status_is_final,
        created_by_name,
        created_by_email,
        assigned_to_name,
        assigned_to_email,
        assigned_to_department,
        assigned_to_position,
        attachment_count,
        subtask_count,
        tags
      `, { count: 'exact' });

    // 권한에 따른 필터링
    if (decodedToken.permissionLevel === 1) {
      // 일반 사용자: 자신이 담당하거나 생성한 업무만
      query = query.or(`assigned_to.eq.${decodedToken.userId},created_by.eq.${decodedToken.userId}`);
    } else if (decodedToken.permissionLevel === 2) {
      // 매니저: 팀 업무도 포함 (현재는 모든 업무, 추후 부서별 필터 추가 가능)
      // 추가 필터링 로직 필요시 여기에 구현
    }
    // 관리자(레벨 3)는 모든 업무 조회 가능

    // 필터 적용
    if (status) {
      query = query.eq('status_name', status);
    }

    if (priority) {
      query = query.eq('priority', parseInt(priority));
    }

    if (category) {
      query = query.eq('category_name', category);
    }

    if (assignee) {
      query = query.eq('assigned_to', assignee);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,assigned_to_name.ilike.%${search}%`);
    }

    // 정렬 적용
    const validSortFields = ['created_at', 'updated_at', 'due_date', 'priority', 'title', 'status_name'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const ascending = sortOrder === 'asc';

    query = query.order(sortField, { ascending });

    // 페이지네이션 적용
    query = query.range(offset, offset + limit - 1);

    const { data: tasks, error, count } = await query;

    if (error) {
      console.error('업무 목록 조회 오류:', error);
      return NextResponse.json(
        { success: false, message: '업무 목록 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log('✅ [TASKS] 조회 성공:', {
      count: tasks?.length || 0,
      totalCount: count,
      page,
      totalPages: Math.ceil((count || 0) / limit)
    });

    return NextResponse.json({
      success: true,
      data: {
        data: tasks || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasNext: offset + limit < (count || 0),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('업무 목록 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 업무 생성
export async function POST(request: NextRequest) {
  try {
    console.log('🟡 [TASKS-CREATE] API 시작');

    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth-token')?.value;
    const token = authHeader?.replace('Bearer ', '') || cookieToken;

    if (!token) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as any;
    } catch (jwtError) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      category_id,
      priority = 2,
      start_date,
      due_date,
      estimated_hours,
      assigned_to,
      tags = [],
      is_urgent = false,
      is_private = false,
      parent_task_id
    } = body;

    console.log('🔍 [TASKS-CREATE] 수신된 데이터:', {
      title,
      assigned_to,
      priority,
      category_id,
      created_by: decodedToken.userId
    });

    // 입력 데이터 검증
    if (!title || !assigned_to) {
      return NextResponse.json(
        { success: false, message: '제목과 담당자는 필수 항목입니다.' },
        { status: 400 }
      );
    }

    // 담당자 권한 검증 (일반 사용자는 자신만 지정 가능)
    if (decodedToken.permissionLevel === 1 && assigned_to !== decodedToken.userId) {
      return NextResponse.json(
        { success: false, message: '다른 사용자에게 업무를 할당할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 담당자 존재 확인
    const { data: assignee, error: assigneeError } = await supabaseAdmin
      .from('employees')
      .select('id, name, permission_level')
      .eq('id', assigned_to)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (assigneeError || !assignee) {
      return NextResponse.json(
        { success: false, message: '지정된 담당자를 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // 기본 상태 ID 가져오기 (신규 상태)
    const { data: defaultStatus, error: statusError } = await supabaseAdmin
      .from('task_statuses')
      .select('id')
      .eq('name', '신규')
      .eq('is_active', true)
      .single();

    if (statusError || !defaultStatus) {
      return NextResponse.json(
        { success: false, message: '기본 상태를 찾을 수 없습니다.' },
        { status: 500 }
      );
    }

    // 업무 생성
    const taskData = {
      title: title.trim(),
      description: description?.trim() || null,
      category_id: category_id || null,
      status_id: defaultStatus.id,
      priority,
      start_date: start_date || null,
      due_date: due_date || null,
      estimated_hours: estimated_hours || null,
      created_by: decodedToken.userId,
      assigned_to,
      tags: tags || [],
      is_urgent,
      is_private,
      parent_task_id: parent_task_id || null,
      progress_percentage: 0
    };

    const { data: newTask, error: createError } = await supabaseAdmin
      .from('tasks')
      .insert(taskData)
      .select(`
        *,
        category:task_categories(name, color, icon),
        status:task_statuses(name, color, icon),
        assignee:assigned_to(name, email, department, position),
        creator:created_by(name, email)
      `)
      .single();

    if (createError) {
      console.error('업무 생성 오류:', createError);
      return NextResponse.json(
        { success: false, message: `업무 생성에 실패했습니다: ${createError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ [TASKS-CREATE] 업무 생성 성공:', {
      taskId: newTask.id,
      title: newTask.title,
      assignedTo: assignee.name
    });

    return NextResponse.json({
      success: true,
      message: '업무가 성공적으로 생성되었습니다.',
      data: {
        task: newTask
      }
    });

  } catch (error) {
    console.error('업무 생성 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}