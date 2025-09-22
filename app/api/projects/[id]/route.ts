import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth/middleware';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 프로젝트 상세 조회 (GET)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const supabase = supabaseAdmin;

    // 프로젝트 상세 정보 조회
    let query = supabase
      .from('project_dashboard')
      .select('*')
      .eq('id', params.id);

    // 권한별 필터링
    if (user && (user.permissionLevel === 1 || user.permissionLevel === 2)) {
      query = query.eq('department_id', user.departmentId);
    } else if (user && user.permissionLevel === 3) {
      query = query.eq('manager_id', (user as any).id);
    }

    const { data: project, error: projectError } = await query.single();

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: '프로젝트를 찾을 수 없습니다.'
        }, { status: 404 });
      }
      console.error('프로젝트 조회 오류:', projectError);
      return NextResponse.json({
        success: false,
        error: '프로젝트 정보를 불러오는데 실패했습니다.'
      }, { status: 500 });
    }

    // 해당 프로젝트의 작업 목록 조회
    const { data: tasks, error: tasksError } = await supabase
      .from('task_dashboard')
      .select('*')
      .eq('project_id', params.id)
      .order('order_in_project');

    if (tasksError) {
      console.error('작업 목록 조회 오류:', tasksError);
    }

    return NextResponse.json({
      success: true,
      data: {
        project,
        tasks: tasks || []
      }
    });

  } catch (error) {
    console.error('프로젝트 상세 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 프로젝트 수정 (PUT)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      status,
      business_name,
      business_registration_number,
      business_address,
      contact_person,
      contact_phone,
      manager_id,
      start_date,
      expected_end_date,
      actual_end_date,
      total_budget,
      subsidy_amount,
      self_funding_amount
    } = body;

    const supabase = supabaseAdmin;

    // 권한 확인 - 프로젝트 매니저이거나 권한 1,2 사용자만 수정 가능
    let accessQuery = supabase
      .from('projects')
      .select('manager_id, department_id')
      .eq('id', params.id);

    if (user && (user.permissionLevel === 1 || user.permissionLevel === 2)) {
      accessQuery = accessQuery.eq('department_id', user.departmentId);
    } else if (user && user.permissionLevel === 3) {
      accessQuery = accessQuery.eq('manager_id', (user as any).id);
    }

    const { data: projectAccess, error: accessError } = await accessQuery.single();

    if (accessError || !projectAccess) {
      return NextResponse.json({
        success: false,
        error: '프로젝트를 수정할 권한이 없습니다.'
      }, { status: 403 });
    }

    // 프로젝트 업데이트
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (business_name !== undefined) updateData.business_name = business_name;
    if (business_registration_number !== undefined) updateData.business_registration_number = business_registration_number;
    if (business_address !== undefined) updateData.business_address = business_address;
    if (contact_person !== undefined) updateData.contact_person = contact_person;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
    if (manager_id !== undefined) updateData.manager_id = manager_id;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (expected_end_date !== undefined) updateData.expected_end_date = expected_end_date;
    if (actual_end_date !== undefined) updateData.actual_end_date = actual_end_date;
    if (total_budget !== undefined) updateData.total_budget = total_budget;
    if (subsidy_amount !== undefined) updateData.subsidy_amount = subsidy_amount;
    if (self_funding_amount !== undefined) updateData.self_funding_amount = self_funding_amount;

    // 완료 날짜 자동 설정
    if (status === '완료' && !actual_end_date) {
      updateData.actual_end_date = new Date().toISOString().split('T')[0];
    }

    const { data: project, error: updateError } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('프로젝트 업데이트 오류:', updateError);
      return NextResponse.json({
        success: false,
        error: '프로젝트 수정에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: project,
      message: '프로젝트가 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('프로젝트 수정 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 프로젝트 삭제 (DELETE)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    // 권한 확인 (권한 1 또는 프로젝트 매니저만 삭제 가능)
    if (user && user.permissionLevel > 2) {
      return NextResponse.json({
        success: false,
        error: '프로젝트 삭제 권한이 없습니다.'
      }, { status: 403 });
    }

    const supabase = supabaseAdmin;

    // 프로젝트 삭제 권한 확인
    let accessQuery = supabase
      .from('projects')
      .select('manager_id, department_id')
      .eq('id', params.id);

    if (user && (user.permissionLevel === 1 || user.permissionLevel === 2)) {
      accessQuery = accessQuery.eq('department_id', user.departmentId);
    }

    const { data: projectAccess, error: accessError } = await accessQuery.single();

    if (accessError || !projectAccess) {
      return NextResponse.json({
        success: false,
        error: '프로젝트를 삭제할 권한이 없습니다.'
      }, { status: 403 });
    }

    // 진행 중인 작업이 있는지 확인
    const { data: activeTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', params.id)
      .in('status', ['진행중', '할당대기']);

    if (activeTasks && activeTasks.length > 0) {
      return NextResponse.json({
        success: false,
        error: '진행 중인 작업이 있는 프로젝트는 삭제할 수 없습니다.'
      }, { status: 400 });
    }

    // 프로젝트 삭제 (CASCADE로 관련 작업도 함께 삭제됨)
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('프로젝트 삭제 오류:', deleteError);
      return NextResponse.json({
        success: false,
        error: '프로젝트 삭제에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '프로젝트가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('프로젝트 삭제 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}