import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth/middleware';

// 업무 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🟡 [TASK-DETAIL] API 시작:', {
      taskId: params.id,
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

    // 업무 상세 정보 조회
    const { data: task, error } = await supabaseAdmin
      .from('task_details')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !task) {
      return NextResponse.json(
        { success: false, message: '업무를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 접근 권한 확인
    const hasAccess =
      task.assigned_to === decodedToken.userId ||
      task.created_by === decodedToken.userId ||
      decodedToken.permissionLevel >= 2;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, message: '업무에 접근할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 업무 히스토리 조회
    const { data: history, error: historyError } = await supabaseAdmin
      .from('task_history')
      .select(`
        id,
        action,
        field_name,
        old_value,
        new_value,
        change_reason,
        created_at,
        changed_by,
        changer:employees!task_history_changed_by_fkey(name, email)
      `)
      .eq('task_id', params.id)
      .order('created_at', { ascending: false });

    if (historyError) {
      console.warn('히스토리 조회 오류:', historyError);
    }

    console.log('✅ [TASK-DETAIL] 조회 성공:', {
      taskId: task.id,
      title: task.title,
      hasHistory: !!history?.length
    });

    return NextResponse.json({
      success: true,
      data: {
        task,
        history: history || []
      }
    });

  } catch (error) {
    console.error('업무 상세 조회 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 업무 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🟡 [TASK-UPDATE] API 시작:', { taskId: params.id });

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

    // 기존 업무 정보 조회
    const { data: existingTask, error: findError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', params.id)
      .eq('is_deleted', false)
      .single();

    if (findError || !existingTask) {
      return NextResponse.json(
        { success: false, message: '업무를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 수정 권한 확인
    const canEdit =
      existingTask.assigned_to === decodedToken.userId ||
      existingTask.created_by === decodedToken.userId ||
      decodedToken.permissionLevel >= 2;

    if (!canEdit) {
      return NextResponse.json(
        { success: false, message: '업무를 수정할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      category_id,
      status_id,
      priority,
      start_date,
      due_date,
      estimated_hours,
      actual_hours,
      assigned_to,
      tags,
      is_urgent,
      is_private,
      progress_percentage
    } = body;

    console.log('🔍 [TASK-UPDATE] 수신된 데이터:', {
      title,
      status_id,
      priority,
      assigned_to
    });

    // 담당자 변경 권한 확인
    if (assigned_to && assigned_to !== existingTask.assigned_to) {
      if (decodedToken.permissionLevel === 1 && assigned_to !== decodedToken.userId) {
        return NextResponse.json(
          { success: false, message: '다른 사용자에게 업무를 할당할 권한이 없습니다.' },
          { status: 403 }
        );
      }

      // 새로운 담당자 존재 확인
      const { data: newAssignee, error: assigneeError } = await supabaseAdmin
        .from('employees')
        .select('id, name')
        .eq('id', assigned_to)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .single();

      if (assigneeError || !newAssignee) {
        return NextResponse.json(
          { success: false, message: '지정된 담당자를 찾을 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    // 상태 변경 권한 확인
    if (status_id && status_id !== existingTask.status_id) {
      const { data: newStatus, error: statusError } = await supabaseAdmin
        .from('task_statuses')
        .select('required_permission_level, name')
        .eq('id', status_id)
        .eq('is_active', true)
        .single();

      if (statusError || !newStatus) {
        return NextResponse.json(
          { success: false, message: '지정된 상태를 찾을 수 없습니다.' },
          { status: 400 }
        );
      }

      if (decodedToken.permissionLevel < newStatus.required_permission_level) {
        return NextResponse.json(
          {
            success: false,
            message: `'${newStatus.name}' 상태로 변경할 권한이 없습니다.`
          },
          { status: 403 }
        );
      }
    }

    // 업데이트할 데이터 구성
    const updateData: any = {
      updated_by: decodedToken.userId
    };

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (status_id !== undefined) updateData.status_id = status_id;
    if (priority !== undefined) updateData.priority = priority;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (estimated_hours !== undefined) updateData.estimated_hours = estimated_hours;
    if (actual_hours !== undefined) updateData.actual_hours = actual_hours;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (tags !== undefined) updateData.tags = tags;
    if (is_urgent !== undefined) updateData.is_urgent = is_urgent;
    if (is_private !== undefined) updateData.is_private = is_private;
    if (progress_percentage !== undefined) updateData.progress_percentage = progress_percentage;

    // 업무 업데이트
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from('tasks')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        category:task_categories(name, color, icon),
        status:task_statuses(name, color, icon),
        assignee:assigned_to(name, email, department, position),
        creator:created_by(name, email),
        updater:updated_by(name, email)
      `)
      .single();

    if (updateError) {
      console.error('업무 업데이트 오류:', updateError);
      return NextResponse.json(
        { success: false, message: `업무 업데이트에 실패했습니다: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ [TASK-UPDATE] 업무 업데이트 성공:', {
      taskId: updatedTask.id,
      title: updatedTask.title
    });

    return NextResponse.json({
      success: true,
      message: '업무가 성공적으로 업데이트되었습니다.',
      data: {
        task: updatedTask
      }
    });

  } catch (error) {
    console.error('업무 업데이트 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 업무 삭제 (소프트 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🟡 [TASK-DELETE] API 시작:', { taskId: params.id });

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

    // 기존 업무 정보 조회
    const { data: existingTask, error: findError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', params.id)
      .eq('is_deleted', false)
      .single();

    if (findError || !existingTask) {
      return NextResponse.json(
        { success: false, message: '업무를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 삭제 권한 확인 (관리자 또는 생성자만)
    const canDelete =
      existingTask.created_by === decodedToken.userId ||
      decodedToken.permissionLevel >= 2;

    if (!canDelete) {
      return NextResponse.json(
        { success: false, message: '업무를 삭제할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 자식 업무가 있는지 확인
    const { data: subtasks, error: subtaskError } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('parent_task_id', params.id)
      .eq('is_deleted', false);

    if (subtaskError) {
      console.error('자식 업무 확인 오류:', subtaskError);
    }

    if (subtasks && subtasks.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: '하위 업무가 있는 업무는 삭제할 수 없습니다. 먼저 하위 업무를 처리해주세요.'
        },
        { status: 400 }
      );
    }

    // 소프트 삭제 실행
    const { error: deleteError } = await supabaseAdmin
      .from('tasks')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: decodedToken.userId
      })
      .eq('id', params.id);

    if (deleteError) {
      console.error('업무 삭제 오류:', deleteError);
      return NextResponse.json(
        { success: false, message: `업무 삭제에 실패했습니다: ${deleteError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ [TASK-DELETE] 업무 삭제 성공:', {
      taskId: params.id,
      deletedBy: decodedToken.userId
    });

    return NextResponse.json({
      success: true,
      message: '업무가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('업무 삭제 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}