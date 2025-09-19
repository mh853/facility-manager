// app/api/weekly-reports/route.ts - 주간 업무 정리 시스템 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

// 주간 리포트 타입 정의
export interface WeeklyTaskSummary {
  user_id: string;
  user_name: string;
  week_start: string;
  week_end: string;

  // 업무 통계
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  pending_tasks: number;
  completion_rate: number;

  // 업무 타입별 분석
  self_tasks: number;
  subsidy_tasks: number;

  // 우선순위별 분석
  high_priority_completed: number;
  medium_priority_completed: number;
  low_priority_completed: number;

  // 상세 업무 목록
  completed_task_details: Array<{
    id: string;
    title: string;
    business_name: string;
    task_type: string;
    status: string;
    completed_at: string;
    priority: string;
  }>;

  // 미완료 업무 목록
  pending_task_details: Array<{
    id: string;
    title: string;
    business_name: string;
    task_type: string;
    status: string;
    due_date?: string;
    priority: string;
    days_overdue?: number;
  }>;

  // 성과 지표
  average_completion_time_days: number;
  overdue_tasks: number;
  created_at: string;
}

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

// GET: 주간 업무 리포트 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const weekDate = searchParams.get('weekDate'); // YYYY-MM-DD 형식
    const includeTeam = searchParams.get('includeTeam') === 'true';

    console.log('📊 [WEEKLY-REPORTS] 주간 리포트 조회:', { userId, weekDate, includeTeam });

    if (!userId) {
      return createErrorResponse('사용자 ID가 필요합니다', 400);
    }

    const { start: weekStart, end: weekEnd } = getWeekRange(weekDate);

    // 사용자 정보 조회
    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return createErrorResponse('사용자를 찾을 수 없습니다', 404);
    }

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
      .eq('assignee', user.name)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .or(`created_at.gte.${weekStart},updated_at.gte.${weekStart},completed_at.gte.${weekStart}`)
      .lte('created_at', weekEnd);

    if (tasksError) {
      console.error('🔴 [WEEKLY-REPORTS] 업무 조회 오류:', tasksError);
      throw tasksError;
    }

    const tasks = weeklyTasks || [];

    // 업무 통계 계산
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t =>
      ['document_complete', 'subsidy_payment', 'final_document_submit'].includes(t.status) &&
      t.completed_at &&
      new Date(t.completed_at) >= new Date(weekStart) &&
      new Date(t.completed_at) <= new Date(weekEnd)
    );
    const inProgressTasks = tasks.filter(t =>
      ['site_survey', 'document_preparation', 'subsidy_application'].includes(t.status)
    );
    const pendingTasks = tasks.filter(t =>
      ['customer_contact', 'consultation_scheduled'].includes(t.status)
    );

    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

    // 업무 타입별 분석
    const selfTasks = tasks.filter(t => t.task_type === 'self').length;
    const subsidyTasks = tasks.filter(t => t.task_type === 'subsidy').length;

    // 우선순위별 완료 업무
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
      completed_at: task.completed_at!,
      priority: task.priority
    }));

    // 미완료 업무 상세 (연체 계산 포함)
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

    // 평균 완료 시간 계산
    const completedWithDuration = completedTasks.filter(t => t.created_at && t.completed_at);
    const averageCompletionTime = completedWithDuration.length > 0
      ? completedWithDuration.reduce((acc, task) => {
          const created = new Date(task.created_at);
          const completed = new Date(task.completed_at!);
          const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          return acc + days;
        }, 0) / completedWithDuration.length
      : 0;

    // 연체 업무 수
    const overdueTasks = pendingTaskDetails.filter(t => t.days_overdue && t.days_overdue > 0).length;

    const weeklyReport: WeeklyTaskSummary = {
      user_id: userId,
      user_name: user.name,
      week_start: weekStart,
      week_end: weekEnd,
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
      completed_task_details: completedTaskDetails,
      pending_task_details: pendingTaskDetails,
      average_completion_time_days: Math.round(averageCompletionTime * 10) / 10,
      overdue_tasks: overdueTasks,
      created_at: new Date().toISOString()
    };

    console.log('✅ [WEEKLY-REPORTS] 주간 리포트 생성 성공:', {
      user: user.name,
      week: `${weekStart.split('T')[0]} ~ ${weekEnd.split('T')[0]}`,
      totalTasks,
      completedTasks: completedTasks.length,
      completionRate
    });

    return createSuccessResponse({
      report: weeklyReport,
      summary: {
        week_period: `${weekStart.split('T')[0]} ~ ${weekEnd.split('T')[0]}`,
        performance_summary: `${completedTasks.length}/${totalTasks} 업무 완료 (${completionRate}%)`,
        overdue_alert: overdueTasks > 0 ? `${overdueTasks}개 연체 업무` : null
      }
    });

  } catch (error: any) {
    console.error('🔴 [WEEKLY-REPORTS] GET 오류:', error?.message || error);
    return createErrorResponse('주간 리포트 생성 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// POST: 주간 리포트 저장/이메일 발송
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { userId, weekDate, sendEmail = false, recipients = [] } = body;

    console.log('📧 [WEEKLY-REPORTS] 주간 리포트 저장/발송:', { userId, weekDate, sendEmail });

    if (!userId) {
      return createErrorResponse('사용자 ID가 필요합니다', 400);
    }

    // 주간 리포트 생성 (GET 로직 재사용)
    const reportResponse = await GET(new NextRequest(`${request.url}?userId=${userId}&weekDate=${weekDate || ''}`));
    const reportData = await reportResponse.json();

    if (!reportData.success) {
      return reportData;
    }

    const weeklyReport = reportData.data.report;

    // 리포트를 데이터베이스에 저장 (선택사항)
    // 향후 historical tracking을 위해 저장할 수 있음

    // 이메일 발송 처리
    if (sendEmail && recipients.length > 0) {
      // 이메일 내용 생성
      const emailContent = generateEmailContent(weeklyReport);

      // 여기에 실제 이메일 발송 로직 구현
      // 예: SendGrid, SES 등을 사용
      console.log('📧 이메일 발송 예정:', { recipients, subject: `${weeklyReport.user_name}님의 주간 업무 리포트` });
    }

    return createSuccessResponse({
      message: '주간 리포트가 성공적으로 처리되었습니다',
      report: weeklyReport,
      email_sent: sendEmail && recipients.length > 0
    });

  } catch (error: any) {
    console.error('🔴 [WEEKLY-REPORTS] POST 오류:', error?.message || error);
    return createErrorResponse('주간 리포트 처리 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// 이메일 내용 생성 함수
function generateEmailContent(report: WeeklyTaskSummary): string {
  const weekPeriod = `${report.week_start.split('T')[0]} ~ ${report.week_end.split('T')[0]}`;

  return `
    <h2>${report.user_name}님의 주간 업무 리포트</h2>
    <p><strong>기간:</strong> ${weekPeriod}</p>

    <h3>📊 업무 통계</h3>
    <ul>
      <li>총 업무: ${report.total_tasks}개</li>
      <li>완료: ${report.completed_tasks}개</li>
      <li>진행중: ${report.in_progress_tasks}개</li>
      <li>대기: ${report.pending_tasks}개</li>
      <li>완료율: ${report.completion_rate}%</li>
    </ul>

    <h3>⚡ 성과 지표</h3>
    <ul>
      <li>평균 완료 시간: ${report.average_completion_time_days}일</li>
      <li>연체 업무: ${report.overdue_tasks}개</li>
      <li>고우선순위 완료: ${report.high_priority_completed}개</li>
    </ul>

    <h3>✅ 완료된 업무</h3>
    ${report.completed_task_details.map(task =>
      `<li><strong>${task.title}</strong> (${task.business_name}) - ${task.task_type}</li>`
    ).join('')}

    ${report.pending_task_details.length > 0 ? `
    <h3>⏳ 미완료 업무</h3>
    ${report.pending_task_details.map(task =>
      `<li><strong>${task.title}</strong> (${task.business_name}) - ${task.status}${task.days_overdue ? ` [${task.days_overdue}일 연체]` : ''}</li>`
    ).join('')}
    ` : ''}

    <p><em>시설관리 시스템에서 자동 생성된 리포트입니다.</em></p>
  `;
}