// Task Notification Service
// 업무 할당 및 변경 시 알림 관리

import { supabaseAdmin } from '@/lib/supabase';

export interface TaskAssignee {
  id: string;
  name: string;
  email: string;
  position?: string;
}

export interface TaskNotificationResult {
  success: boolean;
  notificationCount: number;
  error?: string;
  details?: any;
}

export interface AssignmentUpdateResult {
  success: boolean;
  removedCount: number;
  updatedCount: number;
  addedCount: number;
  totalChanges: number;
  error?: string;
}

/**
 * 업무 생성 시 담당자들에게 알림 생성
 */
export async function createTaskAssignmentNotifications(
  taskId: string,
  assignees: TaskAssignee[],
  businessName: string,
  taskTitle: string,
  taskType: string,
  taskPriority: string,
  assignedBy?: string
): Promise<TaskNotificationResult> {
  try {
    console.log(`🔔 [TASK-NOTIFICATION] 업무 할당 알림 생성: ${taskTitle}`, {
      taskId,
      assigneeCount: assignees.length,
      assignees: assignees.map(a => ({ id: a.id, name: a.name }))
    });

    if (!assignees || assignees.length === 0) {
      return {
        success: true,
        notificationCount: 0,
        details: { message: 'No assignees to notify' }
      };
    }

    // Supabase 함수 호출
    const { data, error } = await supabaseAdmin.rpc(
      'create_task_assignment_notifications',
      {
        p_task_id: taskId,
        p_assignees: JSON.stringify(assignees),
        p_business_name: businessName,
        p_task_title: taskTitle,
        p_task_type: taskType,
        p_task_priority: taskPriority,
        p_assigned_by: assignedBy || 'system'
      }
    );

    if (error) {
      console.error('❌ [TASK-NOTIFICATION] 알림 생성 오류:', error);
      return {
        success: false,
        notificationCount: 0,
        error: error.message
      };
    }

    console.log(`✅ [TASK-NOTIFICATION] 알림 생성 완료: ${data}개`);

    return {
      success: true,
      notificationCount: data || 0,
      details: { assignees: assignees.length }
    };

  } catch (error: any) {
    console.error('❌ [TASK-NOTIFICATION] 알림 생성 서비스 오류:', error);
    return {
      success: false,
      notificationCount: 0,
      error: error.message
    };
  }
}

/**
 * 업무 담당자 변경 시 알림 업데이트
 */
export async function updateTaskAssignmentNotifications(
  taskId: string,
  oldAssignees: TaskAssignee[],
  newAssignees: TaskAssignee[],
  businessName: string,
  taskTitle: string,
  taskType: string,
  taskPriority: string,
  assignedBy?: string
): Promise<AssignmentUpdateResult> {
  try {
    console.log(`🔄 [TASK-NOTIFICATION] 담당자 변경 알림 업데이트: ${taskTitle}`, {
      taskId,
      oldCount: oldAssignees.length,
      newCount: newAssignees.length
    });

    // Supabase 함수 호출
    const { data, error } = await supabaseAdmin.rpc(
      'update_task_assignment_notifications',
      {
        p_task_id: taskId,
        p_old_assignees: JSON.stringify(oldAssignees),
        p_new_assignees: JSON.stringify(newAssignees),
        p_business_name: businessName,
        p_task_title: taskTitle,
        p_task_type: taskType,
        p_task_priority: taskPriority,
        p_assigned_by: assignedBy || 'system'
      }
    );

    if (error) {
      console.error('❌ [TASK-NOTIFICATION] 담당자 변경 알림 오류:', error);
      return {
        success: false,
        removedCount: 0,
        updatedCount: 0,
        addedCount: 0,
        totalChanges: 0,
        error: error.message
      };
    }

    const result = data as any;
    console.log(`✅ [TASK-NOTIFICATION] 담당자 변경 알림 완료:`, result);

    return {
      success: true,
      removedCount: result.removed_notifications || 0,
      updatedCount: result.updated_notifications || 0,
      addedCount: result.added_notifications || 0,
      totalChanges: result.total_changes || 0
    };

  } catch (error: any) {
    console.error('❌ [TASK-NOTIFICATION] 담당자 변경 서비스 오류:', error);
    return {
      success: false,
      removedCount: 0,
      updatedCount: 0,
      addedCount: 0,
      totalChanges: 0,
      error: error.message
    };
  }
}

/**
 * 사용자의 담당 업무 알림 조회
 */
export async function getUserTaskNotifications(
  userId: string,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    includeExpired?: boolean;
  } = {}
) {
  try {
    const { unreadOnly = false, limit = 50, includeExpired = false } = options;

    let query = supabaseAdmin
      .from('task_notifications')
      .select(`
        id,
        user_id,
        user_name,
        task_id,
        business_name,
        message,
        notification_type,
        priority,
        metadata,
        is_read,
        read_at,
        created_at,
        expires_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // 읽지 않은 알림만
    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    // 만료된 알림 제외
    if (!includeExpired) {
      query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('❌ [TASK-NOTIFICATION] 사용자 알림 조회 오류:', error);
      return { success: false, notifications: [], error: error.message };
    }

    return {
      success: true,
      notifications: notifications || [],
      count: notifications?.length || 0
    };

  } catch (error: any) {
    console.error('❌ [TASK-NOTIFICATION] 사용자 알림 조회 서비스 오류:', error);
    return {
      success: false,
      notifications: [],
      error: error.message
    };
  }
}

/**
 * 알림 읽음 처리
 */
export async function markTaskNotificationAsRead(notificationId: string, userId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('task_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', userId); // 보안: 본인 알림만 처리 가능

    if (error) {
      console.error('❌ [TASK-NOTIFICATION] 알림 읽음 처리 오류:', error);
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error: any) {
    console.error('❌ [TASK-NOTIFICATION] 알림 읽음 처리 서비스 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 사용자의 읽지 않은 알림 개수 조회
 */
export async function getUserUnreadNotificationCount(userId: string) {
  try {
    const { count, error } = await supabaseAdmin
      .from('task_notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    if (error) {
      console.error('❌ [TASK-NOTIFICATION] 읽지 않은 알림 개수 조회 오류:', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: count || 0 };

  } catch (error: any) {
    console.error('❌ [TASK-NOTIFICATION] 읽지 않은 알림 개수 서비스 오류:', error);
    return { success: false, count: 0, error: error.message };
  }
}