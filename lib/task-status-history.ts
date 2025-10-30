// 업무 단계 이력 관리 유틸리티
import { supabaseAdmin } from '@/lib/supabase';

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

  // 1. 이전 단계가 있으면 완료 처리
  const { error: completeError } = await supabaseAdmin
    .from('task_status_history')
    .update({
      completed_at: new Date().toISOString()
    })
    .eq('task_id', taskId)
    .is('completed_at', null);

  if (completeError) {
    console.error('❌ [STATUS-HISTORY] 이전 단계 완료 처리 실패:', completeError);
  }

  // 2. 새 단계 시작 기록
  const { data, error } = await supabaseAdmin
    .from('task_status_history')
    .insert([{
      task_id: taskId,
      status,
      task_type: taskType,
      started_at: new Date().toISOString(),
      assignee_id: assigneeId,
      assignee_name: assigneeName,
      primary_assignee_id: primaryAssigneeId,
      business_name: businessName,
      notes,
      created_by: createdBy,
      created_by_name: createdByName
    }])
    .select()
    .single();

  if (error) {
    console.error('❌ [STATUS-HISTORY] 새 단계 기록 실패:', error);
    throw error;
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

  const { data, error } = await supabaseAdmin
    .from('task_status_history')
    .update({
      completed_at: now,
      notes: notes || undefined
    })
    .eq('task_id', taskId)
    .is('completed_at', null)
    .select()
    .single();

  if (error) {
    console.error('❌ [STATUS-HISTORY] 단계 완료 처리 실패:', error);
    throw error;
  }

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
  const { data, error } = await supabaseAdmin
    .from('task_status_history')
    .select('*')
    .eq('task_id', taskId)
    .order('started_at', { ascending: true });

  if (error) {
    console.error('❌ [STATUS-HISTORY] 이력 조회 실패:', error);
    throw error;
  }

  return data || [];
}

/**
 * 업무의 타임라인 조회 (다음 단계 정보 포함)
 */
export async function getTaskTimeline(taskId: string): Promise<StatusTimelineEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('task_status_timeline')
    .select('*')
    .eq('task_id', taskId)
    .order('started_at', { ascending: true });

  if (error) {
    console.error('❌ [STATUS-HISTORY] 타임라인 조회 실패:', error);
    throw error;
  }

  return data || [];
}

/**
 * 현재 진행 중인 단계 조회
 */
export async function getCurrentStatus(taskId: string): Promise<StatusHistoryEntry | null> {
  const { data, error } = await supabaseAdmin
    .from('task_status_history')
    .select('*')
    .eq('task_id', taskId)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ [STATUS-HISTORY] 현재 단계 조회 실패:', error);
    return null;
  }

  return data;
}

/**
 * 특정 단계의 통계 조회
 */
export async function getStatusStatistics(status: string, taskType?: 'self' | 'subsidy') {
  let query = supabaseAdmin
    .from('task_status_statistics')
    .select('*')
    .eq('status', status);

  if (taskType) {
    query = query.eq('task_type', taskType);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('❌ [STATUS-HISTORY] 통계 조회 실패:', error);
    return null;
  }

  return data;
}

/**
 * 사업장별 단계 이력 조회
 */
export async function getBusinessStatusHistory(businessName: string): Promise<StatusHistoryEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('task_status_history')
    .select('*')
    .eq('business_name', businessName)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('❌ [STATUS-HISTORY] 사업장 이력 조회 실패:', error);
    throw error;
  }

  return data || [];
}
