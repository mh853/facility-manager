// app/api/facility-tasks/route.ts - 시설 업무 관리 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

// 담당자 타입 정의
export interface TaskAssignee {
  id: string;
  name: string;
  position: string;
  email: string;
}

// Facility Task 타입 정의 (다중 담당자 지원)
export interface FacilityTask {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description?: string;
  business_name: string;
  business_id?: string;
  task_type: 'self' | 'subsidy';
  status: string;
  priority: 'low' | 'medium' | 'high';
  assignee?: string; // 기존 호환성 유지
  assignees: TaskAssignee[]; // 새로운 다중 담당자 필드
  primary_assignee_id?: string;
  assignee_updated_at?: string;
  due_date?: string;
  completed_at?: string;
  notes?: string;
  is_active: boolean;
  is_deleted: boolean;
}

// GET: 시설 업무 목록 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const businessName = searchParams.get('businessName');
    const taskType = searchParams.get('type');
    const status = searchParams.get('status');
    const assignee = searchParams.get('assignee');

    console.log('📋 [FACILITY-TASKS] 시설 업무 목록 조회:', { businessName, taskType, status, assignee });

    let query = supabaseAdmin
      .from('facility_tasks')
      .select(`
        id,
        created_at,
        updated_at,
        title,
        description,
        business_name,
        business_id,
        task_type,
        status,
        priority,
        assignee,
        assignees,
        primary_assignee_id,
        assignee_updated_at,
        start_date,
        due_date,
        completed_at,
        notes,
        is_active,
        is_deleted
      `)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    // 필터 적용
    if (businessName) {
      query = query.eq('business_name', businessName);
    }
    if (taskType && taskType !== 'all') {
      query = query.eq('task_type', taskType);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (assignee) {
      // 다중 담당자 지원: assignees JSON 배열에서 검색
      query = query.or(`assignee.eq.${assignee},assignees.cs.[{"name":"${assignee}"}]`);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error('🔴 [FACILITY-TASKS] 조회 오류:', error);
      throw error;
    }

    console.log('✅ [FACILITY-TASKS] 조회 성공:', tasks?.length || 0, '개 업무');

    return createSuccessResponse({
      tasks: tasks || [],
      count: tasks?.length || 0,
      metadata: {
        filters: { businessName, taskType, status, assignee },
        totalCount: tasks?.length || 0
      }
    });

  } catch (error: any) {
    console.error('🔴 [FACILITY-TASKS] GET 오류:', error?.message || error);
    return createErrorResponse('시설 업무 목록 조회 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// POST: 새 시설 업무 생성
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      title,
      description,
      business_name,
      task_type,
      status = 'customer_contact',
      priority = 'medium',
      assignee, // 기존 호환성용
      assignees, // 새로운 다중 담당자
      primary_assignee_id,
      start_date,
      due_date,
      notes
    } = body;

    console.log('📝 [FACILITY-TASKS] 새 시설 업무 생성:', { title, business_name, task_type, status });

    // 필수 필드 검증
    if (!title || !business_name || !task_type) {
      return createErrorResponse('제목, 사업장명, 업무 타입은 필수입니다', 400);
    }

    // 업무 타입 검증
    if (!['self', 'subsidy'].includes(task_type)) {
      return createErrorResponse('유효하지 않은 업무 타입입니다', 400);
    }

    // 우선순위 검증
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      return createErrorResponse('유효하지 않은 우선순위입니다', 400);
    }

    // 담당자 처리: assignees 우선, 없으면 assignee를 assignees로 변환
    let finalAssignees = assignees || [];
    if (!finalAssignees.length && assignee) {
      finalAssignees = [{
        id: '',
        name: assignee,
        position: '미정',
        email: ''
      }];
    }

    const { data: newTask, error } = await supabaseAdmin
      .from('facility_tasks')
      .insert({
        title,
        description,
        business_name,
        task_type,
        status,
        priority,
        assignee: finalAssignees.length > 0 ? finalAssignees[0].name : null, // 기존 호환성
        assignees: finalAssignees,
        primary_assignee_id,
        start_date,
        due_date,
        notes
      })
      .select()
      .single();

    if (error) {
      console.error('🔴 [FACILITY-TASKS] 생성 오류:', error);
      throw error;
    }

    console.log('✅ [FACILITY-TASKS] 생성 성공:', newTask.id);

    return createSuccessResponse({
      task: newTask,
      message: '시설 업무가 성공적으로 생성되었습니다'
    });

  } catch (error: any) {
    console.error('🔴 [FACILITY-TASKS] POST 오류:', error?.message || error);
    return createErrorResponse('시설 업무 생성 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// PUT: 시설 업무 수정
export const PUT = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      business_name,
      task_type,
      status,
      priority,
      assignee, // 기존 호환성용
      assignees, // 새로운 다중 담당자
      primary_assignee_id,
      start_date,
      due_date,
      notes,
      completed_at
    } = body;

    console.log('📝 [FACILITY-TASKS] 시설 업무 수정:', { id, title, status });

    if (!id) {
      return createErrorResponse('업무 ID는 필수입니다', 400);
    }

    // 업데이트할 필드만 포함
    const updateData: any = { updated_at: new Date().toISOString() };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (business_name !== undefined) updateData.business_name = business_name;
    if (task_type !== undefined) updateData.task_type = task_type;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (notes !== undefined) updateData.notes = notes;
    if (completed_at !== undefined) updateData.completed_at = completed_at;

    // 담당자 업데이트 처리
    if (assignees !== undefined) {
      updateData.assignees = assignees;
      updateData.assignee = assignees.length > 0 ? assignees[0].name : null; // 기존 호환성
    } else if (assignee !== undefined) {
      updateData.assignee = assignee;
      // assignee가 있으면 assignees도 업데이트
      if (assignee) {
        updateData.assignees = [{
          id: '',
          name: assignee,
          position: '미정',
          email: ''
        }];
      } else {
        updateData.assignees = [];
      }
    }

    if (primary_assignee_id !== undefined) updateData.primary_assignee_id = primary_assignee_id;

    const { data: updatedTask, error } = await supabaseAdmin
      .from('facility_tasks')
      .update(updateData)
      .eq('id', id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      console.error('🔴 [FACILITY-TASKS] 수정 오류:', error);
      throw error;
    }

    if (!updatedTask) {
      return createErrorResponse('시설 업무를 찾을 수 없습니다', 404);
    }

    console.log('✅ [FACILITY-TASKS] 수정 성공:', updatedTask.id);

    return createSuccessResponse({
      task: updatedTask,
      message: '시설 업무가 성공적으로 수정되었습니다'
    });

  } catch (error: any) {
    console.error('🔴 [FACILITY-TASKS] PUT 오류:', error?.message || error);
    return createErrorResponse('시설 업무 수정 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// DELETE: 시설 업무 삭제 (소프트 삭제)
export const DELETE = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    console.log('🗑️ [FACILITY-TASKS] 시설 업무 삭제:', id);

    if (!id) {
      return createErrorResponse('업무 ID는 필수입니다', 400);
    }

    const { data: deletedTask, error } = await supabaseAdmin
      .from('facility_tasks')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      console.error('🔴 [FACILITY-TASKS] 삭제 오류:', error);
      throw error;
    }

    if (!deletedTask) {
      return createErrorResponse('시설 업무를 찾을 수 없습니다', 404);
    }

    console.log('✅ [FACILITY-TASKS] 삭제 성공:', deletedTask.id);

    return createSuccessResponse({
      message: '시설 업무가 성공적으로 삭제되었습니다'
    });

  } catch (error: any) {
    console.error('🔴 [FACILITY-TASKS] DELETE 오류:', error?.message || error);
    return createErrorResponse('시설 업무 삭제 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });