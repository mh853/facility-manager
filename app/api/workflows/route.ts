import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth/middleware';

// 워크플로우 상태 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');
    const project_type = searchParams.get('project_type');

    if (!project_id && !project_type) {
      return NextResponse.json({
        success: false,
        error: '프로젝트 ID 또는 프로젝트 유형이 필요합니다.'
      }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    // 프로젝트별 워크플로우 상태 조회
    if (project_id) {
      const { data: project, error: projectError } = await supabase
        .from('project_dashboard')
        .select('*')
        .eq('id', project_id)
        .single();

      if (projectError || !project) {
        return NextResponse.json({
          success: false,
          error: '프로젝트를 찾을 수 없습니다.'
        }, { status: 404 });
      }

      // 워크플로우 진행 상태 계산
      const workflow = await calculateWorkflowStatus(supabase, project);

      return NextResponse.json({
        success: true,
        data: {
          project,
          workflow
        }
      });
    }

    // 프로젝트 유형별 표준 워크플로우 조회
    if (project_type) {
      const standardWorkflow = getStandardWorkflow(project_type as '자체자금' | '보조금');

      return NextResponse.json({
        success: true,
        data: {
          workflow: standardWorkflow
        }
      });
    }

  } catch (error) {
    console.error('워크플로우 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 워크플로우 다음 단계 실행 (POST)
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const body = await request.json();
    const {
      project_id,
      action, // 'start', 'complete_task', 'approve', 'reject', 'submit'
      task_id,
      comment,
      approval_data
    } = body;

    if (!project_id || !action) {
      return NextResponse.json({
        success: false,
        error: '프로젝트 ID와 액션이 필요합니다.'
      }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    // 프로젝트 정보 조회
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: '프로젝트를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 워크플로우 실행
    const result = await executeWorkflowAction(supabase, {
      project,
      action,
      task_id,
      comment,
      approval_data,
      user
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: result.message
    });

  } catch (error) {
    console.error('워크플로우 실행 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 워크플로우 상태 계산 함수
async function calculateWorkflowStatus(supabase: any, project: any) {
  const workflow = getStandardWorkflow(project.project_type);

  // 프로젝트의 작업들 조회
  const { data: tasks } = await supabase
    .from('task_dashboard')
    .select('*')
    .eq('project_id', project.id)
    .order('order_in_project');

  // 각 단계별 완료 상태 계산
  const stepsWithStatus = workflow.steps.map(step => {
    const stepTasks = tasks?.filter(task => step.tasks.includes(task.title)) || [];
    const completedTasks = stepTasks.filter(task => task.status === '완료');
    const isCompleted = stepTasks.length > 0 && completedTasks.length === stepTasks.length;
    const isInProgress = stepTasks.some(task => task.status === '진행중');

    return {
      ...step,
      status: isCompleted ? 'completed' : isInProgress ? 'in_progress' : 'pending',
      completedTasks: completedTasks.length,
      totalTasks: stepTasks.length,
      tasks: stepTasks
    };
  });

  // 현재 단계 찾기
  const currentStepIndex = stepsWithStatus.findIndex(step => step.status !== 'completed');
  const currentStep = currentStepIndex >= 0 ? stepsWithStatus[currentStepIndex] : null;

  // 전체 진행률 계산
  const completedSteps = stepsWithStatus.filter(step => step.status === 'completed').length;
  const progressPercentage = Math.round((completedSteps / workflow.steps.length) * 100);

  return {
    ...workflow,
    steps: stepsWithStatus,
    currentStep,
    currentStepIndex,
    progressPercentage,
    isCompleted: completedSteps === workflow.steps.length
  };
}

// 표준 워크플로우 정의
function getStandardWorkflow(projectType: '자체자금' | '보조금') {
  if (projectType === '보조금') {
    return {
      type: '보조금',
      name: '보조금 지원 시설 개선 프로젝트',
      description: '정부 보조금을 활용한 시설 개선 프로젝트 워크플로우',
      steps: [
        {
          id: 1,
          name: '보조금 신청 준비',
          description: '보조금 신청에 필요한 서류 작성 및 준비',
          tasks: ['보조금 신청 서류 준비'],
          requiredApproval: false,
          estimatedDays: 5
        },
        {
          id: 2,
          name: '현장 실태 조사',
          description: '보조금 지원 대상 시설 실태 조사',
          tasks: ['현장 실태 조사'],
          requiredApproval: false,
          estimatedDays: 3
        },
        {
          id: 3,
          name: '개선 계획 수립',
          description: '시설 개선 계획 및 예산 수립',
          tasks: ['개선 계획 수립'],
          requiredApproval: true,
          estimatedDays: 7
        },
        {
          id: 4,
          name: '보조금 신청',
          description: '관련 기관에 보조금 신청서 제출',
          tasks: ['보조금 신청 제출'],
          requiredApproval: true,
          estimatedDays: 2
        },
        {
          id: 5,
          name: '결과 확인 및 후속 조치',
          description: '보조금 승인 결과 확인 및 프로젝트 진행',
          tasks: ['승인 결과 확인 및 후속 조치'],
          requiredApproval: false,
          estimatedDays: 10
        }
      ]
    };
  } else {
    return {
      type: '자체자금',
      name: '표준 시설 점검 프로젝트',
      description: '일반적인 사업장 시설 점검을 위한 표준 워크플로우',
      steps: [
        {
          id: 1,
          name: '사전 조사',
          description: '현장 방문 및 사전 조사',
          tasks: ['현장 방문 및 사전 조사'],
          requiredApproval: false,
          estimatedDays: 2
        },
        {
          id: 2,
          name: '시설 현황 조사',
          description: '기본시설, 배출시설, 방지시설 조사',
          tasks: ['시설 현황 조사'],
          requiredApproval: false,
          estimatedDays: 4
        },
        {
          id: 3,
          name: '자료 수집',
          description: '사진 촬영 및 관련 서류 수집',
          tasks: ['사진 촬영 및 자료 수집'],
          requiredApproval: false,
          estimatedDays: 2
        },
        {
          id: 4,
          name: '보고서 작성',
          description: '현장 조사 결과를 바탕으로 상세 보고서 작성',
          tasks: ['점검 보고서 작성'],
          requiredApproval: true,
          estimatedDays: 3
        },
        {
          id: 5,
          name: '완료 처리',
          description: '고객 설명 및 프로젝트 완료 처리',
          tasks: ['고객 설명 및 완료 확인'],
          requiredApproval: false,
          estimatedDays: 1
        }
      ]
    };
  }
}

// 워크플로우 액션 실행 함수
async function executeWorkflowAction(supabase: any, params: any) {
  const { project, action, task_id, comment, user } = params;

  switch (action) {
    case 'start':
      // 프로젝트 시작 - 첫 번째 작업들을 '진행중'으로 변경
      const workflow = getStandardWorkflow(project.project_type);
      const firstStep = workflow.steps[0];

      await supabase
        .from('projects')
        .update({
          status: '진행중',
          start_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', project.id);

      // 첫 번째 단계의 작업들을 진행중으로 변경
      const { data: firstTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', project.id)
        .in('title', firstStep.tasks);

      if (firstTasks && firstTasks.length > 0) {
        await supabase
          .from('tasks')
          .update({ status: '진행중', start_date: new Date().toISOString().split('T')[0] })
          .eq('project_id', project.id)
          .in('id', firstTasks.map(task => task.id));
      }

      return {
        success: true,
        message: '프로젝트가 시작되었습니다.',
        data: { status: '진행중' }
      };

    case 'complete_task':
      if (!task_id) {
        return { success: false, error: '작업 ID가 필요합니다.' };
      }

      // 작업 완료 처리
      await supabase
        .from('tasks')
        .update({
          status: '완료',
          completed_date: new Date().toISOString().split('T')[0],
          actual_hours: params.actual_hours || null
        })
        .eq('id', task_id);

      // 작업 완료 로그 추가
      if (comment) {
        await supabase
          .from('task_comments')
          .insert({
            task_id,
            content: comment,
            comment_type: 'completion',
            author_id: user.id
          });
      }

      return {
        success: true,
        message: '작업이 완료되었습니다.',
        data: { task_id, status: '완료' }
      };

    default:
      return { success: false, error: '지원되지 않는 액션입니다.' };
  }
}