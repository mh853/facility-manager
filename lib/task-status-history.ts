// 업무 단계 이력 관리 유틸리티
import { queryOne, queryAll, query as pgQuery } from '@/lib/supabase-direct';

export interface StatusHistoryEntry {
  id: string;
  created_at: string;
  task_id: string;
  status: string;
  task_type: 'self' | 'subsidy';
  started_at: string;
  completed_at: string | null;
  duration_days: number | null;
  assignee_id: string | null;
  assignee_name: string | null;
  primary_assignee_id: string | null;
  notes: string | null;
  business_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
}

export interface StatusTimelineEntry extends StatusHistoryEntry {
  task_title: string;
  priority: 'low' | 'medium' | 'high';
  is_active: boolean;
  next_status: string | null;
  next_started_at: string | null;
}

/**
 * 새로운 단계 시작 기록
 */
export async function startNewStatus(params: {
  taskId: string;
  status: string;
  taskType: 'self' | 'subsidy';
  businessName: string;
  assigneeId?: string;
  assigneeName?: string;
  primaryAssigneeId?: string;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
}) {
  const {
    taskId,
    status,
    taskType,
    businessName,
    assigneeId,
    assigneeName,
    primaryAssigneeId,
    notes,
    createdBy,
    createdByName
  } = params;

  // 1. 이전 단계가 있으면 완료 처리 - Direct PostgreSQL
  try {
    await pgQuery(
      `UPDATE task_status_history
       SET completed_at = $1
       WHERE task_id = $2 AND completed_at IS NULL`,
      [new Date().toISOString(), taskId]
    );
  } catch (completeError) {
    console.error('❌ [STATUS-HISTORY] 이전 단계 완료 처리 실패:', completeError);
  }

  // 2. 새 단계 시작 기록 - Direct PostgreSQL
  const data = await queryOne(
    `INSERT INTO task_status_history (
      task_id, status, task_type, started_at, assignee_id, assignee_name,
      primary_assignee_id, business_name, notes, created_by, created_by_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      taskId,
      status,
      taskType,
      new Date().toISOString(),
      assigneeId || null,
      assigneeName || null,
      primaryAssigneeId || null,
      businessName,
      notes || null,
      createdBy || null,
      createdByName || null
    ]
  );

  if (!data) {
    console.error('❌ [STATUS-HISTORY] 새 단계 기록 실패');
    throw new Error('새 단계 기록 실패');
  }

  console.log('✅ [STATUS-HISTORY] 새 단계 시작 기록:', {
    taskId,
    status,
    historyId: data.id
  });

  return data;
}

/**
 * 현재 진행 중인 단계 완료 처리
 */
export async function completeCurrentStatus(taskId: string, notes?: string) {
  const now = new Date().toISOString();

  // Direct PostgreSQL - UPDATE with RETURNING
  const result = await pgQuery(
    `UPDATE task_status_history
     SET completed_at = $1, notes = COALESCE($2, notes)
     WHERE task_id = $3 AND completed_at IS NULL
     RETURNING *`,
    [now, notes || null, taskId]
  );

  if (!result.rows || result.rows.length === 0) {
    console.error('❌ [STATUS-HISTORY] 단계 완료 처리 실패: 진행 중인 단계를 찾을 수 없음');
    throw new Error('진행 중인 단계를 찾을 수 없습니다');
  }

  const data = result.rows[0];

  console.log('✅ [STATUS-HISTORY] 단계 완료 처리:', {
    taskId,
    historyId: data?.id,
    status: data?.status,
    durationDays: data?.duration_days
  });

  return data;
}

/**
 * 업무의 전체 단계 이력 조회
 */
export async function getTaskStatusHistory(taskId: string): Promise<StatusHistoryEntry[]> {
  // Direct PostgreSQL
  const data = await queryAll(
    `SELECT * FROM task_status_history
     WHERE task_id = $1
     ORDER BY started_at ASC`,
    [taskId]
  );

  return data || [];
}

/**
 * 업무의 타임라인 조회 (다음 단계 정보 포함)
 */
export async function getTaskTimeline(taskId: string): Promise<StatusTimelineEntry[]> {
  // Direct PostgreSQL - task_status_timeline view 사용
  const data = await queryAll(
    `SELECT * FROM task_status_timeline
     WHERE task_id = $1
     ORDER BY started_at ASC`,
    [taskId]
  );

  return data || [];
}

/**
 * 현재 진행 중인 단계 조회
 */
export async function getCurrentStatus(taskId: string): Promise<StatusHistoryEntry | null> {
  // Direct PostgreSQL
  try {
    const data = await queryOne(
      `SELECT * FROM task_status_history
       WHERE task_id = $1 AND completed_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`,
      [taskId]
    );

    return data;
  } catch (error) {
    console.error('❌ [STATUS-HISTORY] 현재 단계 조회 실패:', error);
    return null;
  }
}

/**
 * 특정 단계의 통계 조회
 */
export async function getStatusStatistics(status: string, taskType?: 'self' | 'subsidy') {
  // Direct PostgreSQL - task_status_statistics view 사용
  try {
    let queryText = `SELECT * FROM task_status_statistics WHERE status = $1`;
    const params: any[] = [status];

    if (taskType) {
      queryText += ` AND task_type = $2`;
      params.push(taskType);
    }

    queryText += ` LIMIT 1`;

    const data = await queryOne(queryText, params);
    return data;
  } catch (error) {
    console.error('❌ [STATUS-HISTORY] 통계 조회 실패:', error);
    return null;
  }
}

/**
 * 사업장별 단계 이력 조회
 */
export async function getBusinessStatusHistory(businessName: string): Promise<StatusHistoryEntry[]> {
  // Direct PostgreSQL
  const data = await queryAll(
    `SELECT * FROM task_status_history
     WHERE business_name = $1
     ORDER BY started_at DESC`,
    [businessName]
  );

  return data || [];
}
