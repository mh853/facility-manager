// app/api/notifications/daily-monitor/route.ts - 일일 업무 모니터링 및 알림 생성
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 일일 모니터링 실행 (마감일, 지연 업무 체크)
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [DAILY-MONITOR] 일일 업무 모니터링 시작');

    // check_task_deadlines 함수 실행
    const { data: result, error } = await supabaseAdmin
      .rpc('check_task_deadlines');

    if (error) {
      console.error('일일 모니터링 실행 오류:', error);
      return NextResponse.json({
        success: false,
        error: '모니터링 실행에 실패했습니다',
        details: error.message
      }, { status: 500 });
    }

    const deadlineAlerts = result?.[0]?.created_deadline_alerts || 0;
    const overdueAlerts = result?.[0]?.created_overdue_alerts || 0;

    console.log('✅ [DAILY-MONITOR] 완료:', {
      deadlineAlerts,
      overdueAlerts,
      totalAlerts: deadlineAlerts + overdueAlerts
    });

    return NextResponse.json({
      success: true,
      summary: {
        deadlineAlerts,
        overdueAlerts,
        totalAlerts: deadlineAlerts + overdueAlerts,
        executedAt: new Date().toISOString()
      },
      message: `일일 모니터링 완료: 마감임박 ${deadlineAlerts}건, 지연업무 ${overdueAlerts}건`
    });

  } catch (error) {
    console.error('일일 모니터링 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// 현재 위험 업무 현황 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';

    // 마감일 임박 업무 (1-3일 이내)
    const { data: upcomingTasks } = await supabaseAdmin
      .from('facility_tasks')
      .select(`
        id, title, business_name, due_date, priority, status,
        assignees, created_at
      `)
      .gte('due_date', new Date().toISOString().split('T')[0])
      .lte('due_date', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .not('status', 'in', '(completed,cancelled)')
      .order('due_date', { ascending: true });

    // 지연 업무
    const { data: overdueTasks } = await supabaseAdmin
      .from('facility_tasks')
      .select(`
        id, title, business_name, due_date, priority, status,
        assignees, created_at
      `)
      .lt('due_date', new Date().toISOString().split('T')[0])
      .not('status', 'in', '(completed,cancelled)')
      .order('due_date', { ascending: true });

    // 고우선순위 진행중 업무
    const { data: highPriorityTasks } = await supabaseAdmin
      .from('facility_tasks')
      .select(`
        id, title, business_name, due_date, priority, status,
        assignees, created_at
      `)
      .eq('priority', 'high')
      .not('status', 'in', '(completed,cancelled)')
      .order('created_at', { ascending: false })
      .limit(10);

    const summary = {
      upcomingDeadlines: upcomingTasks?.length || 0,
      overdueTasks: overdueTasks?.length || 0,
      highPriorityActive: highPriorityTasks?.length || 0,
      totalRiskTasks: (upcomingTasks?.length || 0) + (overdueTasks?.length || 0)
    };

    const response: any = {
      success: true,
      summary,
      checkedAt: new Date().toISOString()
    };

    if (includeDetails) {
      response.details = {
        upcomingTasks: upcomingTasks?.slice(0, 5) || [],
        overdueTasks: overdueTasks?.slice(0, 5) || [],
        highPriorityTasks: highPriorityTasks?.slice(0, 5) || []
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('위험 업무 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '조회에 실패했습니다'
    }, { status: 500 });
  }
}

// 특정 사용자의 알림 통계
export async function PATCH(request: NextRequest) {
  try {
    const { userId, days = 7 } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다' }, { status: 400 });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 사용자 알림 통계
    const { data: notifications } = await supabaseAdmin
      .from('task_notifications')
      .select('notification_type, priority, created_at, is_read')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    // 통계 계산
    const stats = {
      total: notifications?.length || 0,
      unread: notifications?.filter(n => !n.is_read).length || 0,
      urgent: notifications?.filter(n => n.priority === 'urgent').length || 0,
      byType: notifications?.reduce((acc, n) => {
        acc[n.notification_type] = (acc[n.notification_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      period: `${days}일`
    };

    return NextResponse.json({
      success: true,
      userId,
      stats,
      calculatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('사용자 알림 통계 오류:', error);
    return NextResponse.json({
      success: false,
      error: '통계 조회에 실패했습니다'
    }, { status: 500 });
  }
}