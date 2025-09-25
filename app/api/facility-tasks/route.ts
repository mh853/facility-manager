// app/api/facility-tasks/route.ts - 시설 업무 관리 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { createTaskAssignmentNotifications, updateTaskAssignmentNotifications, type TaskAssignee } from '@/lib/task-notification-service';
import jwt from 'jsonwebtoken';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// JWT 토큰에서 사용자 정보 추출하는 헬퍼 함수
async function getUserFromToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // 사용자 정보 조회
    const { data: user, error } = await supabaseAdmin
      .from('employees')
      .select('id, name, email, permission_level, department')
      .eq('id', decoded.userId || decoded.id)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      console.warn('⚠️ [AUTH] 사용자 조회 실패:', error?.message);
      return null;
    }

    return user;
  } catch (error) {
    console.warn('⚠️ [AUTH] JWT 토큰 검증 실패:', error);
    return null;
  }
}


// 담당자 타입은 lib/task-notification-service.ts에서 import됨

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

// GET: 시설 업무 목록 조회 (권한별 필터링 적용)
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const businessName = searchParams.get('businessName');
    const taskType = searchParams.get('type');
    const status = searchParams.get('status');
    const assignee = searchParams.get('assignee');

    // 사용자 인증 및 권한 확인
    const user = await getUserFromToken(request);
    if (!user) {
      return createErrorResponse('인증이 필요합니다', 401);
    }

    console.log('📋 [FACILITY-TASKS] 시설 업무 목록 조회:', {
      user: user.name,
      permission: user.permission_level,
      filters: { businessName, taskType, status, assignee }
    });

    let query = supabaseAdmin
      .from('facility_tasks_with_business')
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
        created_by,
        created_by_name,
        last_modified_by,
        last_modified_by_name,
        is_active,
        is_deleted,
        address,
        manager_name,
        manager_contact,
        local_government
      `)
      .order('created_at', { ascending: false });

    // 임시로 권한 필터링 제거 - 모든 업무 조회 가능하도록 설정
    console.log('🔓 [FACILITY-TASKS] 임시 설정: 모든 업무 조회 가능 (테스트용)');

    // 추가 필터 적용
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

    console.log('✅ [FACILITY-TASKS] 조회 성공:', {
      user: user.name,
      permission: user.permission_level,
      taskCount: tasks?.length || 0
    });

    return createSuccessResponse({
      tasks: tasks || [],
      count: tasks?.length || 0,
      user: {
        id: user.id,
        name: user.name,
        permission_level: user.permission_level
      },
      metadata: {
        filters: { businessName, taskType, status, assignee },
        totalCount: tasks?.length || 0,
        userPermission: user.permission_level,
        isAdmin: user.permission_level >= 4
      }
    });

  } catch (error: any) {
    console.error('🔴 [FACILITY-TASKS] GET 오류:', error?.message || error);
    return createErrorResponse('시설 업무 목록 조회 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// POST: 새 시설 업무 생성 (생성자 정보 포함)
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    // 사용자 인증 및 권한 확인
    const user = await getUserFromToken(request);
    if (!user) {
      return createErrorResponse('인증이 필요합니다', 401);
    }

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

    console.log('📝 [FACILITY-TASKS] 새 시설 업무 생성:', {
      user: user.name,
      permission: user.permission_level,
      title,
      business_name,
      task_type,
      status
    });

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

    // 담당자 이름으로 ID 조회 및 매핑
    if (finalAssignees.length > 0) {
      for (let i = 0; i < finalAssignees.length; i++) {
        const assigneeItem = finalAssignees[i];
        if (assigneeItem.name && !assigneeItem.id) {
          // employees 테이블에서 이름으로 사용자 정보 조회
          const { data: employee, error: employeeError } = await supabaseAdmin
            .from('employees')
            .select('id, name, email, position')
            .eq('name', assigneeItem.name)
            .eq('is_active', true)
            .eq('is_deleted', false)
            .single();

          if (!employeeError && employee) {
            finalAssignees[i] = {
              id: employee.id,
              name: employee.name,
              position: employee.position || '미정',
              email: employee.email || ''
            };
            console.log('✅ [FACILITY-TASKS] 담당자 ID 매핑 성공:', employee.name, '→', employee.id);
          } else {
            console.warn('⚠️ [FACILITY-TASKS] 담당자 ID 조회 실패:', assigneeItem.name, employeeError?.message);
          }
        }
      }
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
        notes,
        // 생성자 정보 추가
        created_by: user.id,
        created_by_name: user.name,
        last_modified_by: user.id,
        last_modified_by_name: user.name
      })
      .select()
      .single();

    if (error) {
      console.error('🔴 [FACILITY-TASKS] 생성 오류:', error);
      throw error;
    }

    console.log('✅ [FACILITY-TASKS] 생성 성공:', newTask.id);

    // 업무 생성 시 자동 메모 생성
    await createTaskCreationNote(newTask);

    // 다중 담당자 알림 생성 (PostgreSQL 함수 사용)
    if (finalAssignees.length > 0) {
      try {
        const notificationResult = await createTaskAssignmentNotifications(
          newTask.id,
          finalAssignees.map(a => ({
            id: a.id,
            name: a.name,
            email: a.email,
            position: a.position
          })),
          newTask.business_name,
          newTask.title,
          newTask.task_type,
          newTask.priority,
          user.name
        );

        console.log('✅ [NOTIFICATION] 업무 할당 알림 생성:', notificationResult);
      } catch (notificationError) {
        console.error('❌ [NOTIFICATION] 업무 할당 알림 생성 실패:', notificationError);
      }
    }

    return createSuccessResponse({
      task: newTask,
      message: '시설 업무가 성공적으로 생성되었습니다'
    });

  } catch (error: any) {
    console.error('🔴 [FACILITY-TASKS] POST 오류:', error?.message || error);
    return createErrorResponse('시설 업무 생성 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// PUT: 시설 업무 수정 (권한 제어 적용)
export const PUT = withApiHandler(async (request: NextRequest) => {
  try {
    // 사용자 인증 및 권한 확인
    const user = await getUserFromToken(request);
    if (!user) {
      return createErrorResponse('인증이 필요합니다', 401);
    }

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

    console.log('📝 [FACILITY-TASKS] 시설 업무 수정:', {
      user: user.name,
      permission: user.permission_level,
      id,
      title,
      status
    });

    if (!id) {
      return createErrorResponse('업무 ID는 필수입니다', 400);
    }

    // 기존 업무 정보 조회 (상태 변경 감지용)
    const { data: existingTask, error: fetchError } = await supabaseAdmin
      .from('facility_tasks')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existingTask) {
      return createErrorResponse('시설 업무를 찾을 수 없습니다', 404);
    }

    // 권한 체크: 관리자가 아니면 본인이 생성한 업무만 수정 가능
    if (user.permission_level < 4 && existingTask.created_by !== user.id) {
      return createErrorResponse('이 업무를 수정할 권한이 없습니다', 403);
    }

    // 업데이트할 필드만 포함
    const updateData: any = {
      updated_at: new Date().toISOString(),
      last_modified_by: user.id,
      last_modified_by_name: user.name
    };

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
      // 담당자 배열이 전달된 경우 ID 매핑 처리
      const mappedAssignees = [...assignees];
      for (let i = 0; i < mappedAssignees.length; i++) {
        const assigneeItem = mappedAssignees[i];
        if (assigneeItem.name && !assigneeItem.id) {
          // employees 테이블에서 이름으로 사용자 정보 조회
          const { data: employee, error: employeeError } = await supabaseAdmin
            .from('employees')
            .select('id, name, email, position')
            .eq('name', assigneeItem.name)
            .eq('is_active', true)
            .eq('is_deleted', false)
            .single();

          if (!employeeError && employee) {
            mappedAssignees[i] = {
              id: employee.id,
              name: employee.name,
              position: employee.position || '미정',
              email: employee.email || ''
            };
            console.log('✅ [FACILITY-TASKS] 수정 시 담당자 ID 매핑 성공:', employee.name, '→', employee.id);
          } else {
            console.warn('⚠️ [FACILITY-TASKS] 수정 시 담당자 ID 조회 실패:', assigneeItem.name, employeeError?.message);
          }
        }
      }
      updateData.assignees = mappedAssignees;
      updateData.assignee = mappedAssignees.length > 0 ? mappedAssignees[0].name : null; // 기존 호환성
    } else if (assignee !== undefined) {
      updateData.assignee = assignee;
      // assignee가 있으면 assignees도 업데이트하고 ID 매핑
      if (assignee) {
        // employees 테이블에서 이름으로 사용자 정보 조회
        const { data: employee, error: employeeError } = await supabaseAdmin
          .from('employees')
          .select('id, name, email, position')
          .eq('name', assignee)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .single();

        if (!employeeError && employee) {
          updateData.assignees = [{
            id: employee.id,
            name: employee.name,
            position: employee.position || '미정',
            email: employee.email || ''
          }];
          console.log('✅ [FACILITY-TASKS] 단일 담당자 ID 매핑 성공:', employee.name, '→', employee.id);
        } else {
          console.warn('⚠️ [FACILITY-TASKS] 단일 담당자 ID 조회 실패:', assignee, employeeError?.message);
          updateData.assignees = [{
            id: '',
            name: assignee,
            position: '미정',
            email: ''
          }];
        }
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

    // 상태 변경 시 자동 메모 및 알림 생성
    await createAutoProgressNoteAndNotification(existingTask, updatedTask);

    // 담당자 변경 시 다중 담당자 알림 업데이트 (PostgreSQL 함수 사용)
    const assigneesChanged = JSON.stringify(existingTask.assignees || []) !== JSON.stringify(updatedTask.assignees || []);
    if (assigneesChanged) {
      try {
        const updateResult = await updateTaskAssignmentNotifications(
          updatedTask.id,
          existingTask.assignees || [],
          updatedTask.assignees || [],
          updatedTask.business_name,
          updatedTask.title,
          updatedTask.task_type,
          updatedTask.priority,
          user.name
        );

        console.log('✅ [NOTIFICATION] 담당자 변경 알림 업데이트:', updateResult);
      } catch (notificationError) {
        console.error('❌ [NOTIFICATION] 담당자 변경 알림 업데이트 실패:', notificationError);
      }
    }

    return createSuccessResponse({
      task: updatedTask,
      message: '시설 업무가 성공적으로 수정되었습니다'
    });

  } catch (error: any) {
    console.error('🔴 [FACILITY-TASKS] PUT 오류:', error?.message || error);
    return createErrorResponse('시설 업무 수정 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// DELETE: 시설 업무 삭제 (권한 제어 적용, 소프트 삭제)
export const DELETE = withApiHandler(async (request: NextRequest) => {
  try {
    // 사용자 인증 및 권한 확인
    const user = await getUserFromToken(request);
    if (!user) {
      return createErrorResponse('인증이 필요합니다', 401);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    console.log('🗑️ [FACILITY-TASKS] 시설 업무 삭제:', {
      user: user.name,
      permission: user.permission_level,
      id
    });

    if (!id) {
      return createErrorResponse('업무 ID는 필수입니다', 400);
    }

    // 기존 업무 정보 조회 (권한 체크용)
    const { data: existingTask, error: fetchError } = await supabaseAdmin
      .from('facility_tasks')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existingTask) {
      return createErrorResponse('시설 업무를 찾을 수 없습니다', 404);
    }

    // 권한 체크: 관리자가 아니면 본인이 생성한 업무만 삭제 가능
    if (user.permission_level < 4 && existingTask.created_by !== user.id) {
      return createErrorResponse('이 업무를 삭제할 권한이 없습니다', 403);
    }

    const { data: deletedTask, error } = await supabaseAdmin
      .from('facility_tasks')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
        last_modified_by: user.id,
        last_modified_by_name: user.name
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

    // Supabase Realtime: PostgreSQL 트리거가 자동으로 알림 생성
    console.log('🔔 [REALTIME] 업무 삭제 - 트리거가 자동으로 알림 생성:', deletedTask.id);

    return createSuccessResponse({
      message: '시설 업무가 성공적으로 삭제되었습니다'
    });

  } catch (error: any) {
    console.error('🔴 [FACILITY-TASKS] DELETE 오류:', error?.message || error);
    return createErrorResponse('시설 업무 삭제 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// ============================================================================
// 자동 메모 및 알림 생성 유틸리티 함수
// ============================================================================

async function createAutoProgressNoteAndNotification(existingTask: any, updatedTask: any) {
  try {
    const statusChanged = existingTask.status !== updatedTask.status;
    const assigneesChanged = JSON.stringify(existingTask.assignees || []) !== JSON.stringify(updatedTask.assignees || []);

    // 상태 변경 시 자동 메모 생성
    if (statusChanged) {
      await createAutoProgressNote({
        task: updatedTask,
        oldStatus: existingTask.status,
        newStatus: updatedTask.status,
        changeType: 'status_change'
      });
    }

    // 담당자 변경 시 자동 메모 생성
    if (assigneesChanged) {
      await createAutoProgressNote({
        task: updatedTask,
        oldAssignees: existingTask.assignees || [],
        newAssignees: updatedTask.assignees || [],
        changeType: 'assignee_change'
      });
    }

    // 알림 생성 (담당자들에게)
    if (statusChanged || assigneesChanged) {
      await createTaskNotifications({
        task: updatedTask,
        oldTask: existingTask,
        statusChanged,
        assigneesChanged
      });
    }

  } catch (error) {
    console.error('🔴 [AUTO-PROGRESS] 자동 메모/알림 생성 오류:', error);
    // 에러가 발생해도 메인 로직에 영향을 주지 않도록 함
  }
}

async function createAutoProgressNote(params: {
  task: any;
  oldStatus?: string;
  newStatus?: string;
  oldAssignees?: any[];
  newAssignees?: any[];
  changeType: 'status_change' | 'assignee_change';
}) {
  const { task, oldStatus, newStatus, oldAssignees, newAssignees, changeType } = params;

  let content = '';
  let metadata: any = {};

  if (changeType === 'status_change' && oldStatus && newStatus) {
    const statusLabels: { [key: string]: string } = {
      'pending': '대기',
      'in_progress': '진행중',
      'quote_requested': '견적 요청',
      'quote_received': '견적 수신',
      'work_scheduled': '작업 예정',
      'work_in_progress': '작업중',
      'completed': '완료',
      'cancelled': '취소',
      'customer_contact': '고객연락',
      'site_inspection': '현장조사',
      'quotation': '견적',
      'contract': '계약',
      'deposit_confirm': '계약금확인',
      'product_order': '제품주문',
      'product_shipment': '제품출하',
      'installation_schedule': '설치협의',
      'installation': '설치',
      'balance_payment': '잔금결제',
      'document_complete': '서류완료',
      'subsidy_payment': '보조금지급',
      'on_hold': '보류'
    };

    content = `업무 상태가 "${statusLabels[oldStatus] || oldStatus}"에서 "${statusLabels[newStatus] || newStatus}"로 변경되었습니다.`;
    metadata = {
      change_type: 'status',
      old_status: oldStatus,
      new_status: newStatus,
      task_priority: task.priority,
      task_type: task.task_type
    };
  } else if (changeType === 'assignee_change') {
    const oldNames = oldAssignees?.map(a => a.name).join(', ') || '없음';
    const newNames = newAssignees?.map(a => a.name).join(', ') || '없음';

    content = `담당자가 "${oldNames}"에서 "${newNames}"로 변경되었습니다.`;
    metadata = {
      change_type: 'assignee',
      old_assignees: oldAssignees,
      new_assignees: newAssignees,
      task_priority: task.priority,
      task_type: task.task_type
    };
  }

  if (content) {
    // business_name을 business_id로 변환
    const { data: businessInfo } = await supabaseAdmin
      .from('business_info')
      .select('id')
      .eq('business_name', task.business_name)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (!businessInfo) {
      console.warn(`⚠️ [FACILITY-TASKS] 사업장을 찾을 수 없음: ${task.business_name}`);
      return; // 메모 생성 실패하지만 업무는 계속 진행
    }

    const { error } = await supabaseAdmin
      .from('business_memos')
      .insert({
        business_id: businessInfo.id,
        title: `[자동] ${task.task_type === 'self' ? '자비' : task.task_type === 'subsidy' ? '보조금' : task.task_type === 'as' ? 'AS' : '기타'} 업무 상태 변경`,
        content,
        created_by: 'system',
        updated_by: 'system'
      });

    if (error) {
      console.error('🔴 [AUTO-PROGRESS] 메모 생성 오류:', error);
    } else {
      console.log('✅ [AUTO-PROGRESS] 자동 메모 생성 성공:', task.id);
    }
  }
}

async function createTaskNotifications(params: {
  task: any;
  oldTask: any;
  statusChanged: boolean;
  assigneesChanged: boolean;
}) {
  const { task, oldTask, statusChanged, assigneesChanged } = params;

  // 알림을 받을 사용자 ID 수집
  const userIds = new Set<string>();

  // 현재 담당자들
  if (task.assignees && Array.isArray(task.assignees)) {
    task.assignees.forEach((assignee: any) => {
      if (assignee.id) userIds.add(assignee.id);
    });
  }

  // 이전 담당자들 (변경된 경우)
  if (assigneesChanged && oldTask.assignees && Array.isArray(oldTask.assignees)) {
    oldTask.assignees.forEach((assignee: any) => {
      if (assignee.id) userIds.add(assignee.id);
    });
  }

  const userIdArray = Array.from(userIds);
  if (userIdArray.length === 0) return;

  // 알림 생성
  const notifications: any[] = [];

  if (statusChanged) {
    const statusLabels: { [key: string]: string } = {
      'pending': '대기',
      'in_progress': '진행중',
      'quote_requested': '견적 요청',
      'quote_received': '견적 수신',
      'work_scheduled': '작업 예정',
      'work_in_progress': '작업중',
      'completed': '완료',
      'cancelled': '취소'
    };

    const oldStatusLabel = statusLabels[oldTask.status] || oldTask.status;
    const newStatusLabel = statusLabels[task.status] || task.status;

    userIdArray.forEach(userId => {
      notifications.push({
        user_id: userId,
        task_id: task.id,
        business_name: task.business_name,
        message: `${task.business_name}의 업무 "${task.title}"이 ${oldStatusLabel}에서 ${newStatusLabel}로 변경되었습니다.`,
        notification_type: 'status_change',
        priority: task.priority === 'urgent' ? 'urgent' : task.priority === 'high' ? 'high' : 'normal'
      });
    });
  }

  if (assigneesChanged) {
    // 새로 배정된 담당자들에게 알림
    const newUserIds = task.assignees?.map((a: any) => a.id).filter((id: string) => id) || [];
    const oldUserIds = oldTask.assignees?.map((a: any) => a.id).filter((id: string) => id) || [];
    const assignedUserIds = newUserIds.filter((id: string) => !oldUserIds.includes(id));

    assignedUserIds.forEach((userId: string) => {
      notifications.push({
        user_id: userId,
        task_id: task.id,
        business_name: task.business_name,
        message: `${task.business_name}의 새 업무 "${task.title}"이 담당자로 배정되었습니다.`,
        notification_type: 'assignment',
        priority: task.priority === 'urgent' ? 'urgent' : task.priority === 'high' ? 'high' : 'normal'
      });
    });
  }

  // 알림 일괄 생성
  if (notifications.length > 0) {
    const { data: createdNotifications, error } = await supabaseAdmin
      .from('task_notifications')
      .insert(notifications)
      .select();

    if (error) {
      console.error('🔴 [AUTO-PROGRESS] 알림 생성 오류:', error);
    } else {
      console.log('✅ [AUTO-PROGRESS] 자동 알림 생성 성공:', notifications.length, '개');

      // WebSocket으로 실시간 알림 전송
      try {
        const io = (global as any).io;
        if (io && createdNotifications) {
          createdNotifications.forEach((notification: any) => {
            io.to(`user:${notification.user_id}`).emit('task_notification_created', {
              notification: notification
            });
          });
          console.log('🔔 [WEBSOCKET] 업무 변경 알림 WebSocket 전송 성공:', createdNotifications.length, '개');
        }
      } catch (wsError) {
        console.warn('⚠️ [WEBSOCKET] 업무 변경 알림 WebSocket 전송 실패:', wsError);
      }
    }
  }
}

// 업무 생성 시 자동 메모 생성 함수
async function createTaskCreationNote(task: any) {
  try {
    const taskTypeLabels: { [key: string]: string } = {
      'self': '자비 설치',
      'subsidy': '보조금',
      'as': 'AS',
      'etc': '기타'
    };

    const statusLabels: { [key: string]: string } = {
      'customer_contact': '고객 연락',
      'pending': '대기',
      'in_progress': '진행중',
      'quote_requested': '견적 요청',
      'quote_received': '견적 수신',
      'work_scheduled': '작업 예정',
      'work_in_progress': '작업중',
      'completed': '완료',
      'cancelled': '취소'
    };

    const taskTypeLabel = taskTypeLabels[task.task_type] || task.task_type;
    const statusLabel = statusLabels[task.status] || task.status;
    const assigneeList = task.assignees?.map((a: any) => a.name).filter(Boolean).join(', ') || '미배정';

    const content = `새로운 ${taskTypeLabel} 업무 "${task.title}"이 생성되었습니다. (상태: ${statusLabel}, 담당자: ${assigneeList})`;

    const metadata = {
      change_type: 'creation',
      task_type: task.task_type,
      initial_status: task.status,
      initial_assignees: task.assignees || [],
      task_priority: task.priority,
      creation_timestamp: new Date().toISOString()
    };

    // business_name을 business_id로 변환
    const { data: businessInfo } = await supabaseAdmin
      .from('business_info')
      .select('id')
      .eq('business_name', task.business_name)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (!businessInfo) {
      console.warn(`⚠️ [FACILITY-TASKS] 사업장을 찾을 수 없음: ${task.business_name}`);
      return; // 메모 생성 실패하지만 업무는 계속 진행
    }

    const { error } = await supabaseAdmin
      .from('business_memos')
      .insert({
        business_id: businessInfo.id,
        title: `[자동] ${task.task_type === 'self' ? '자비' : task.task_type === 'subsidy' ? '보조금' : task.task_type === 'as' ? 'AS' : '기타'} 업무 상태 변경`,
        content,
        created_by: 'system',
        updated_by: 'system'
      });

    if (error) {
      console.error('🔴 [TASK-CREATION] 생성 메모 오류:', error);
    } else {
      console.log('✅ [TASK-CREATION] 생성 메모 성공:', task.id);
    }

    // 알림은 이미 createTaskAssignmentNotifications에서 생성됨 (중복 제거)

  } catch (error) {
    console.error('🔴 [TASK-CREATION] 생성 메모/알림 처리 오류:', error);
    // 에러가 발생해도 메인 로직에 영향을 주지 않도록 함
  }
}

// ============================================================================
// Supabase Realtime 시스템 - PostgreSQL 트리거가 알림을 자동 생성
// ============================================================================

// 참고:
// - PostgreSQL 트리거 (sql/realtime_triggers.sql)가 facility_tasks 변경을 감지하여 자동으로 알림 생성
// - notifications 및 task_notifications 테이블에 Supabase Realtime 활성화
// - 클라이언트는 useRealtimeNotifications 훅으로 실시간 알림 수신
// - 폴링 폴백으로 연결 끊김 시에도 안정적인 알림 전달 보장