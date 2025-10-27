// app/api/weekly-reports/generate-all/route.ts - 관리자용 전체 리포트 수동 생성 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/secure-jwt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 주간 날짜 계산 함수
function getWeekRange(dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const day = date.getDay();
  const diff = date.getDate() - day; // 일요일을 주의 시작으로

  const weekStart = new Date(date.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return {
    start: weekStart.toISOString(),
    end: weekEnd.toISOString()
  };
}

// 통계 계산 함수
function calculateWeeklyStats(tasks: any[], weekStart: string, weekEnd: string) {
  const totalTasks = tasks.length;

  // 완료된 업무: 보조금 지급 완료만 "완료"로 간주
  const completedTasks = tasks.filter(t =>
    ['subsidy_payment'].includes(t.status)
  );

  // 진행중 업무: 현장조사부터 서류완료까지 모든 단계
  const inProgressTasks = tasks.filter(t =>
    ['site_survey', 'document_preparation', 'subsidy_application',
     'completion_inspection', 'product_shipment', 'final_document_submit', 'document_complete'].includes(t.status)
  );

  // 대기 업무
  const pendingTasks = tasks.filter(t =>
    ['customer_contact', 'consultation_scheduled'].includes(t.status)
  );

  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  // 업무 타입별
  const selfTasks = tasks.filter(t => t.task_type === 'self').length;
  const subsidyTasks = tasks.filter(t => t.task_type === 'subsidy').length;

  // 우선순위별 완료
  const highPriorityCompleted = completedTasks.filter(t => t.priority === 'high').length;
  const mediumPriorityCompleted = completedTasks.filter(t => t.priority === 'medium').length;
  const lowPriorityCompleted = completedTasks.filter(t => t.priority === 'low').length;

  // 완료 업무 상세
  const completedTaskDetails = completedTasks.map(task => ({
    id: task.id,
    title: task.title,
    business_name: task.business_name,
    task_type: task.task_type,
    status: task.status,
    completed_at: task.completed_at,
    priority: task.priority
  }));

  // 미완료 업무 상세 (연체 계산)
  const pendingTaskDetails = [...inProgressTasks, ...pendingTasks].map(task => {
    const daysOverdue = task.due_date
      ? Math.max(0, Math.ceil((new Date().getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)))
      : undefined;

    return {
      id: task.id,
      title: task.title,
      business_name: task.business_name,
      task_type: task.task_type,
      status: task.status,
      due_date: task.due_date,
      priority: task.priority,
      days_overdue: daysOverdue
    };
  });

  // 평균 완료 시간
  const completedWithDuration = completedTasks.filter(t => t.created_at && t.completed_at);
  const averageCompletionTime = completedWithDuration.length > 0
    ? completedWithDuration.reduce((acc, task) => {
        const created = new Date(task.created_at);
        const completed = new Date(task.completed_at);
        const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return acc + days;
      }, 0) / completedWithDuration.length
    : 0;

  // 연체 업무 수
  const overdueTasks = pendingTaskDetails.filter(t => t.days_overdue && t.days_overdue > 0).length;

  return {
    total_tasks: totalTasks,
    completed_tasks: completedTasks.length,
    in_progress_tasks: inProgressTasks.length,
    pending_tasks: pendingTasks.length,
    completion_rate: completionRate,
    self_tasks: selfTasks,
    subsidy_tasks: subsidyTasks,
    high_priority_completed: highPriorityCompleted,
    medium_priority_completed: mediumPriorityCompleted,
    low_priority_completed: lowPriorityCompleted,
    completed_task_details: JSON.stringify(completedTaskDetails),
    pending_task_details: JSON.stringify(pendingTaskDetails),
    average_completion_time_days: Math.round(averageCompletionTime * 10) / 10,
    overdue_tasks: overdueTasks
  };
}

// 리포트 생성 및 저장
async function generateAndSaveReport(
  userId: string,
  userName: string,
  weekStart: string,
  weekEnd: string
) {
  // 해당 주간의 업무 조회
  const { data: weeklyTasks, error: tasksError } = await supabaseAdmin
    .from('facility_tasks')
    .select(`
      id,
      title,
      business_name,
      task_type,
      status,
      priority,
      assignee,
      due_date,
      completed_at,
      created_at,
      updated_at
    `)
    .eq('assignee', userName)
    .eq('is_active', true)
    .eq('is_deleted', false);

  if (tasksError) {
    console.error(`❌ [GENERATE-ALL] ${userName} 업무 조회 실패:`, tasksError);
    throw tasksError;
  }

  // 클라이언트 사이드에서 필터링 (OR 조건 + 범위 체크)
  const tasks = (weeklyTasks || []).filter(task => {
    const created = new Date(task.created_at);
    const updated = task.updated_at ? new Date(task.updated_at) : null;
    const completed = task.completed_at ? new Date(task.completed_at) : null;
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekEnd);

    // 주간 범위 내에 생성/수정/완료 중 하나라도 있으면 포함
    return (
      (created >= weekStartDate && created <= weekEndDate) ||
      (updated && updated >= weekStartDate && updated <= weekEndDate) ||
      (completed && completed >= weekStartDate && completed <= weekEndDate)
    );
  });

  // 통계 계산
  const stats = calculateWeeklyStats(tasks || [], weekStart, weekEnd);

  // 기존 리포트 확인 (중복 방지)
  const { data: existingReport } = await supabaseAdmin
    .from('weekly_reports')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();

  if (existingReport) {
    // 이미 존재하면 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('weekly_reports')
      .update({
        ...stats,
        generated_at: new Date().toISOString(),
        is_auto_generated: false, // 수동 생성
        updated_at: new Date().toISOString()
      })
      .eq('id', existingReport.id);

    if (updateError) throw updateError;
    return { action: 'updated', reportId: existingReport.id };
  } else {
    // 새로 생성
    const { data: newReport, error: insertError } = await supabaseAdmin
      .from('weekly_reports')
      .insert({
        user_id: userId,
        user_name: userName,
        week_start: weekStart,
        week_end: weekEnd,
        ...stats,
        is_auto_generated: false, // 수동 생성
        generated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    return { action: 'created', reportId: newReport?.id };
  }
}

// POST: 전체 사용자 리포트 생성 (관리자 전용)
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    // JWT 토큰 검증 및 권한 확인
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) token = cookieToken;
    }

    if (!token) {
      console.log('❌ [GENERATE-ALL] 토큰 없음');
      return createErrorResponse('인증이 필요합니다', 401);
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('❌ [GENERATE-ALL] 토큰 검증 실패');
      return createErrorResponse('유효하지 않은 토큰입니다', 401);
    }

    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 3 이상 확인
    if (permissionLevel < 3) {
      console.log('❌ [GENERATE-ALL] 권한 부족:', { userId, permissionLevel });
      return createErrorResponse('권한이 부족합니다 (권한 3 이상 필요)', 403);
    }

    console.log('✅ [GENERATE-ALL] 관리자 인증 성공:', { userId, permissionLevel });

    const body = await request.json();
    const { weekDate } = body;

    // 주간 범위 계산
    const { start, end } = getWeekRange(weekDate || undefined);

    console.log('📅 [GENERATE-ALL] 주간 범위:', {
      weekDate,
      start: start.split('T')[0],
      end: end.split('T')[0]
    });

    // 모든 활성 사용자 조회
    const { data: users, error: usersError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .eq('is_active', true);

    if (usersError) {
      console.error('❌ [GENERATE-ALL] 사용자 조회 실패:', usersError);
      throw usersError;
    }

    console.log(`👥 [GENERATE-ALL] 활성 사용자 ${users?.length || 0}명 발견`);

    const results = {
      total: users?.length || 0,
      success: 0,
      updated: 0,
      failed: 0,
      errors: [] as any[]
    };

    // 각 사용자별 리포트 생성
    for (const user of users || []) {
      try {
        const result = await generateAndSaveReport(user.id, user.name, start, end);
        results.success++;
        if (result.action === 'updated') results.updated++;
        console.log(`✅ [GENERATE-ALL] ${user.name} 리포트 ${result.action === 'created' ? '생성' : '업데이트'} 완료`);
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          userId: user.id,
          name: user.name,
          error: error.message
        });
        console.error(`❌ [GENERATE-ALL] ${user.name} 리포트 생성 실패:`, error.message);
      }
    }

    console.log('✅ [GENERATE-ALL] 주간 리포트 생성 완료:', {
      total: results.total,
      success: results.success,
      updated: results.updated,
      failed: results.failed
    });

    return createSuccessResponse({
      message: '전체 사용자 리포트 생성이 완료되었습니다',
      results,
      week_period: `${start.split('T')[0]} ~ ${end.split('T')[0]}`
    });

  } catch (error: any) {
    console.error('❌ [GENERATE-ALL] 리포트 생성 오류:', error);
    return createErrorResponse(
      error.message || '리포트 생성 중 오류가 발생했습니다',
      500
    );
  }
}, { logLevel: 'debug' });
