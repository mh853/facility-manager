// lib/task-memo-sync.ts - 업무 메모 → 사업장 메모 동기화 유틸리티
import { query as pgQuery, queryOne } from '@/lib/supabase-direct'
import { TASK_STATUS_KR, TASK_TYPE_KR } from '@/lib/task-status-utils'
import { logDebug, logError } from '@/lib/logger'

/**
 * 업무 메모를 사업장 메모로 동기화 (이력 누적 방식)
 *
 * @description
 * - 업무 메모를 business_memos에 새 레코드로 추가 (이력 누적)
 * - facility_tasks.notes는 비워지지 않고 유지됨
 * - 동일한 source_id로 여러 개의 메모 이력이 쌓임
 *
 * @param params - 동기화 파라미터
 * @returns Promise<{ success: boolean, memoId?: string, error?: string }>
 */
export async function addTaskMemoToBusinessHistory({
  taskId,
  businessId,
  businessName,
  notes,
  status,
  taskType,
  userId,
  userName
}: {
  taskId: string
  businessId: string
  businessName: string
  notes: string
  status: string
  taskType: string
  userId: string
  userName: string
}): Promise<{ success: boolean; memoId?: string; error?: string }> {
  try {
    // 메모가 비어있으면 동기화하지 않음
    if (!notes || notes.trim() === '') {
      logDebug('TASK-MEMO-SYNC', '메모가 비어있어 동기화하지 않음', { taskId })
      return { success: true }
    }

    // 상태 및 타입 한글 변환
    const statusKR = TASK_STATUS_KR[status] || status
    const taskTypeKR = TASK_TYPE_KR[taskType] || taskType

    // 제목 생성: [업무] 사업장명 - 업무타입 - 현재단계
    const title = `[업무] ${businessName} - ${taskTypeKR} - ${statusKR}`

    logDebug('TASK-MEMO-SYNC', '업무 메모 → 사업장 메모 동기화 시작', {
      taskId,
      businessId,
      businessName,
      status: statusKR,
      taskType: taskTypeKR
    })

    // business_memos에 새 이력 레코드 추가
    const insertQuery = `
      INSERT INTO business_memos (
        business_id,
        title,
        content,
        source_type,
        source_id,
        task_status,
        task_type,
        created_by,
        updated_by,
        is_active,
        is_deleted
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, false)
      RETURNING id
    `

    const result = await pgQuery(insertQuery, [
      businessId,
      title,
      notes,
      'task_sync', // source_type
      taskId, // source_id
      statusKR, // task_status
      taskType, // task_type (코드값)
      userName,
      userName
    ])

    if (!result.rows || result.rows.length === 0) {
      logError('TASK-MEMO-SYNC', '메모 레코드 생성 실패', { taskId, businessId })
      return { success: false, error: '메모 레코드 생성 실패' }
    }

    const memoId = result.rows[0].id

    logDebug('TASK-MEMO-SYNC', '업무 메모 동기화 완료', {
      taskId,
      businessId,
      memoId,
      title
    })

    return { success: true, memoId }
  } catch (error: any) {
    logError('TASK-MEMO-SYNC', '업무 메모 동기화 오류', {
      error: error.message,
      taskId,
      businessId
    })
    return { success: false, error: error.message || '동기화 오류 발생' }
  }
}

/**
 * 특정 업무의 모든 메모 이력 조회
 *
 * @param taskId - 업무 ID
 * @returns Promise<Array<BusinessMemo>>
 */
export async function getTaskMemoHistory(taskId: string) {
  try {
    const query = `
      SELECT
        id,
        title,
        content,
        task_status,
        task_type,
        created_at,
        created_by
      FROM business_memos
      WHERE source_type = 'task_sync'
        AND source_id = $1
        AND is_active = true
        AND is_deleted = false
      ORDER BY created_at DESC
    `

    const result = await pgQuery(query, [taskId])

    return result.rows || []
  } catch (error: any) {
    logError('TASK-MEMO-SYNC', '업무 메모 이력 조회 오류', {
      error: error.message,
      taskId
    })
    return []
  }
}

/**
 * 업무 삭제 시 관련 메모 이력도 소프트 삭제
 * (CASCADE 설정으로 자동 처리되지만, 소프트 삭제를 위한 함수)
 *
 * @param taskId - 업무 ID
 * @returns Promise<{ success: boolean, deletedCount: number }>
 */
export async function softDeleteTaskMemos(taskId: string): Promise<{ success: boolean; deletedCount: number }> {
  try {
    const updateQuery = `
      UPDATE business_memos
      SET is_deleted = true, updated_at = NOW()
      WHERE source_type = 'task_sync'
        AND source_id = $1
        AND is_deleted = false
      RETURNING id
    `

    const result = await pgQuery(updateQuery, [taskId])

    const deletedCount = result.rows?.length || 0

    logDebug('TASK-MEMO-SYNC', '업무 메모 이력 소프트 삭제 완료', {
      taskId,
      deletedCount
    })

    return { success: true, deletedCount }
  } catch (error: any) {
    logError('TASK-MEMO-SYNC', '업무 메모 이력 삭제 오류', {
      error: error.message,
      taskId
    })
    return { success: false, deletedCount: 0 }
  }
}
