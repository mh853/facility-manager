// app/api/facility-tasks/route.ts - 시설 업무 관리 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { sendNotificationToUser, sendTaskUpdate } from '@/lib/websocket/websocket-server';
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
        created_by,
        created_by_name,
        last_modified_by,
        last_modified_by_name,
        is_active,
        is_deleted
      `)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    // 권한별 필터링 적용
    if (user.permission_level < 4) {
      // 권한 1-3: 본인이 생성한 업무만 조회 가능
      query = query.eq('created_by', user.id);
      console.log('🔒 [FACILITY-TASKS] 권한 제한 적용: 사용자 본인 업무만 조회');
    } else {
      // 권한 4 이상: 모든 업무 조회 가능
      console.log('🔓 [FACILITY-TASKS] 관리자 권한: 모든 업무 조회 가능');
    }

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

    // 실시간 WebSocket 알림 전송
    await sendTaskCreationNotifications(newTask, user);

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

    // 상태 변경 시 자동 메모 및 알림 생성
    await createAutoProgressNoteAndNotification(existingTask, updatedTask);

    // 실시간 WebSocket 알림 전송
    await sendTaskUpdateNotifications(existingTask, updatedTask, user);

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

    // 실시간 WebSocket 알림 전송 (삭제 알림)
    await sendTaskDeleteNotifications(existingTask, user);

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
    const { error } = await supabaseAdmin
      .from('task_notifications')
      .insert(notifications);

    if (error) {
      console.error('🔴 [AUTO-PROGRESS] 알림 생성 오류:', error);
    } else {
      console.log('✅ [AUTO-PROGRESS] 자동 알림 생성 성공:', notifications.length, '개');
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

    // 담당자가 있는 경우 알림도 생성
    if (task.assignees && task.assignees.length > 0) {
      const userIds = task.assignees.map((a: any) => a.id).filter(Boolean);

      if (userIds.length > 0) {
        const notifications = userIds.map((userId: string) => ({
          user_id: userId,
          task_id: task.id,
          business_name: task.business_name,
          message: `${task.business_name}의 새 업무 "${task.title}"이 담당자로 배정되었습니다.`,
          notification_type: 'assignment',
          priority: task.priority === 'high' ? 'high' : 'normal'
        }));

        const { error: notificationError } = await supabaseAdmin
          .from('task_notifications')
          .insert(notifications);

        if (notificationError) {
          console.error('🔴 [TASK-CREATION] 생성 알림 오류:', notificationError);
        } else {
          console.log('✅ [TASK-CREATION] 생성 알림 성공:', notifications.length, '개');
        }
      }
    }

  } catch (error) {
    console.error('🔴 [TASK-CREATION] 생성 메모/알림 처리 오류:', error);
    // 에러가 발생해도 메인 로직에 영향을 주지 않도록 함
  }
}

// ============================================================================
// 실시간 WebSocket 알림 함수들
// ============================================================================

// 업무 생성 시 실시간 알림 전송
async function sendTaskCreationNotifications(task: any, creator: any) {
  try {
    // Next.js 서버에서 WebSocket 서버 인스턴스 가져오기
    const { sendNotificationToUser, sendTaskUpdate } = await import('@/lib/websocket/websocket-server');

    // 전역 서버 인스턴스 참조 (Next.js에서 사용하는 패턴)
    const io = (global as any).io;
    if (!io) {
      console.warn('⚠️ [WEBSOCKET] WebSocket 서버가 초기화되지 않음');
      return;
    }

    // 1. 업무 생성자에게 알림 (본인이 등록한 업무)
    const creatorNotification = {
      id: crypto.randomUUID(),
      type: 'task_created',
      title: '업무 등록 완료',
      message: `"업무 ${task.title}"이 성공적으로 등록되었습니다.`,
      task_id: task.id,
      business_name: task.business_name,
      priority: task.priority,
      timestamp: new Date().toISOString(),
      read: false
    };

    sendNotificationToUser(io, creator.id, creatorNotification);
    console.log('🔔 [WEBSOCKET] 업무 생성 알림 전송:', creator.name);

    // 2. 담당자들에게 알림 (타인이 등록한 업무)
    if (task.assignees && Array.isArray(task.assignees)) {
      for (const assignee of task.assignees) {
        if (assignee.id && assignee.id !== creator.id) {
          const assigneeNotification = {
            id: crypto.randomUUID(),
            type: 'task_assigned',
            title: '새 업무 배정',
            message: `"${task.title}" 업무가 담당자로 배정되었습니다. (등록자: ${creator.name})`,
            task_id: task.id,
            business_name: task.business_name,
            priority: task.priority,
            timestamp: new Date().toISOString(),
            read: false
          };

          sendNotificationToUser(io, assignee.id, assigneeNotification);
          console.log('🔔 [WEBSOCKET] 업무 배정 알림 전송:', assignee.name);
        }
      }
    }

    // 3. 업무 업데이트 알림 (업무 목록 새로고침)
    sendTaskUpdate(io, task.id, {
      action: 'created',
      task: task,
      user: creator.name
    });

  } catch (error) {
    console.error('🔴 [WEBSOCKET] 업무 생성 알림 오류:', error);
  }
}

// 업무 수정 시 실시간 알림 전송
async function sendTaskUpdateNotifications(oldTask: any, newTask: any, modifier: any) {
  try {
    const io = (global as any).io;
    if (!io) {
      console.warn('⚠️ [WEBSOCKET] WebSocket 서버가 초기화되지 않음');
      return;
    }

    const { sendNotificationToUser, sendTaskUpdate } = await import('@/lib/websocket/websocket-server');

    const statusChanged = oldTask.status !== newTask.status;
    const assigneesChanged = JSON.stringify(oldTask.assignees || []) !== JSON.stringify(newTask.assignees || []);

    // 알림을 받을 사용자 ID 수집
    const userIds = new Set<string>();

    // 업무 생성자
    if (newTask.created_by) userIds.add(newTask.created_by);

    // 현재 담당자들
    if (newTask.assignees && Array.isArray(newTask.assignees)) {
      newTask.assignees.forEach((assignee: any) => {
        if (assignee.id) userIds.add(assignee.id);
      });
    }

    // 이전 담당자들 (변경된 경우)
    if (assigneesChanged && oldTask.assignees && Array.isArray(oldTask.assignees)) {
      oldTask.assignees.forEach((assignee: any) => {
        if (assignee.id) userIds.add(assignee.id);
      });
    }

    const statusLabels: { [key: string]: string } = {
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
      'on_hold': '보류',
      'completed': '완료',
      'cancelled': '취소'
    };

    // 상태 변경 알림
    if (statusChanged) {
      const oldStatusLabel = statusLabels[oldTask.status] || oldTask.status;
      const newStatusLabel = statusLabels[newTask.status] || newTask.status;

      Array.from(userIds).forEach(userId => {
        if (userId !== modifier.id) { // 수정자 제외
          const notification = {
            id: crypto.randomUUID(),
            type: 'task_status_changed',
            title: '업무 상태 변경',
            message: `"${newTask.title}" 업무 상태가 ${oldStatusLabel}에서 ${newStatusLabel}로 변경되었습니다. (수정자: ${modifier.name})`,
            task_id: newTask.id,
            business_name: newTask.business_name,
            priority: newTask.priority,
            timestamp: new Date().toISOString(),
            read: false
          };

          sendNotificationToUser(io, userId, notification);
        }
      });

      console.log('🔔 [WEBSOCKET] 업무 상태 변경 알림 전송:', userIds.size, '명');
    }

    // 담당자 변경 알림
    if (assigneesChanged) {
      const oldUserIds = oldTask.assignees?.map((a: any) => a.id).filter(Boolean) || [];
      const newUserIds = newTask.assignees?.map((a: any) => a.id).filter(Boolean) || [];

      // 새로 배정된 사용자들
      const assignedUserIds = newUserIds.filter((id: string) => !oldUserIds.includes(id));
      assignedUserIds.forEach((userId: string) => {
        const notification = {
          id: crypto.randomUUID(),
          type: 'task_assigned',
          title: '업무 배정',
          message: `"${newTask.title}" 업무가 담당자로 배정되었습니다. (수정자: ${modifier.name})`,
          task_id: newTask.id,
          business_name: newTask.business_name,
          priority: newTask.priority,
          timestamp: new Date().toISOString(),
          read: false
        };

        sendNotificationToUser(io, userId, notification);
      });

      // 배정 해제된 사용자들
      const unassignedUserIds = oldUserIds.filter((id: string) => !newUserIds.includes(id));
      unassignedUserIds.forEach((userId: string) => {
        const notification = {
          id: crypto.randomUUID(),
          type: 'task_unassigned',
          title: '업무 배정 해제',
          message: `"${newTask.title}" 업무의 담당자에서 해제되었습니다. (수정자: ${modifier.name})`,
          task_id: newTask.id,
          business_name: newTask.business_name,
          priority: newTask.priority,
          timestamp: new Date().toISOString(),
          read: false
        };

        sendNotificationToUser(io, userId, notification);
      });

      console.log('🔔 [WEBSOCKET] 담당자 변경 알림 전송:', assignedUserIds.length + unassignedUserIds.length, '명');
    }

    // 업무 업데이트 알림 (업무 목록 새로고침)
    sendTaskUpdate(io, newTask.id, {
      action: 'updated',
      task: newTask,
      oldTask: oldTask,
      user: modifier.name,
      statusChanged,
      assigneesChanged
    });

  } catch (error) {
    console.error('🔴 [WEBSOCKET] 업무 수정 알림 오류:', error);
  }
}

// 업무 삭제 시 실시간 알림 전송
async function sendTaskDeleteNotifications(task: any, deleter: any) {
  try {
    const io = (global as any).io;
    if (!io) {
      console.warn('⚠️ [WEBSOCKET] WebSocket 서버가 초기화되지 않음');
      return;
    }

    const { sendNotificationToUser, sendTaskUpdate } = await import('@/lib/websocket/websocket-server');

    // 알림을 받을 사용자 ID 수집
    const userIds = new Set<string>();

    // 업무 생성자
    if (task.created_by && task.created_by !== deleter.id) {
      userIds.add(task.created_by);
    }

    // 담당자들
    if (task.assignees && Array.isArray(task.assignees)) {
      task.assignees.forEach((assignee: any) => {
        if (assignee.id && assignee.id !== deleter.id) {
          userIds.add(assignee.id);
        }
      });
    }

    // 삭제 알림 전송
    Array.from(userIds).forEach(userId => {
      const notification = {
        id: crypto.randomUUID(),
        type: 'task_deleted',
        title: '업무 삭제',
        message: `"${task.title}" 업무가 삭제되었습니다. (삭제자: ${deleter.name})`,
        task_id: task.id,
        business_name: task.business_name,
        priority: task.priority,
        timestamp: new Date().toISOString(),
        read: false
      };

      sendNotificationToUser(io, userId, notification);
    });

    // 업무 업데이트 알림 (업무 목록에서 제거)
    sendTaskUpdate(io, task.id, {
      action: 'deleted',
      task: task,
      user: deleter.name
    });

    console.log('🔔 [WEBSOCKET] 업무 삭제 알림 전송:', userIds.size, '명');

  } catch (error) {
    console.error('🔴 [WEBSOCKET] 업무 삭제 알림 오류:', error);
  }
}