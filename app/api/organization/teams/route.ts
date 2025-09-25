import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyTokenHybrid } from '@/lib/secure-jwt';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 사용자 권한 확인 헬퍼
async function checkUserPermission(request: NextRequest) {
  console.log('🔐 [JWT-DEBUG] 권한 확인 시작');

  const authHeader = request.headers.get('authorization');
  console.log('🔐 [JWT-DEBUG] Authorization 헤더:', authHeader ? `Bearer ${authHeader.slice(7, 20)}...` : 'null');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ [JWT-DEBUG] Authorization 헤더 없음 또는 형식 오류');
    return { authorized: false, user: null };
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    console.log('🔐 [JWT-DEBUG] 토큰 추출 성공, 길이:', token.length);
    console.log('🔐 [JWT-DEBUG] 토큰 앞부분:', token.slice(0, 20) + '...');

    const result = await verifyTokenHybrid(token);
    console.log('🔐 [JWT-DEBUG] verifyTokenHybrid 결과:', {
      success: !!result.user,
      userId: result.user?.id,
      userName: result.user?.name,
      userLevel: result.user?.permission_level,
      levelType: typeof result.user?.permission_level,
      isOldToken: result.isOldToken,
      shouldRefresh: result.shouldRefresh,
      error: result.error
    });

    if (!result.user) {
      console.log('❌ [JWT-DEBUG] 사용자 정보 없음:', result.error);
      return { authorized: false, user: null };
    }

    console.log('✅ [JWT-DEBUG] 사용자 인증 성공');
    return {
      authorized: true,
      user: result.user
    };
  } catch (error) {
    console.error('❌ [JWT-DEBUG] 권한 확인 오류:', error);
    console.error('❌ [JWT-DEBUG] 오류 스택:', error.stack);
    return { authorized: false, user: null };
  }
}

// GET: 팀 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = supabase
      .from('teams')
      .select(`
        id,
        name,
        description,
        department_id,
        created_at,
        updated_at,
        department:departments(
          id,
          name
        )
      `)
      .order('id', { ascending: true });

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    // is_active 컬럼이 없을 수 있으므로 일단 모든 데이터를 조회
    // if (!includeInactive) {
    //   query = query.eq('is_active', true);
    // }

    const { data: teams, error } = await query;

    if (error) {
      console.error('팀 조회 오류:', error);
      return NextResponse.json({ error: '팀 목록을 불러올 수 없습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: teams || []
    });

  } catch (error) {
    console.error('팀 목록 조회 중 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST: 팀 생성
export async function POST(request: NextRequest) {
  try {
    const { authorized, user } = await checkUserPermission(request);
    // 강화된 권한 검증 및 디버깅
    const userLevel = user?.permission_level;
    const hasValidLevel = userLevel !== undefined && userLevel !== null && userLevel >= 3;

    console.log('🔍 [ORGANIZATION] 권한 검증 상세:', {
      authorized,
      user: user ? {
        id: user.id,
        name: user.name,
        permission_level: user.permission_level,
        permission_level_type: typeof user.permission_level
      } : null,
      hasValidLevel,
      comparison: userLevel !== undefined ? `${userLevel} >= 3 = ${userLevel >= 3}` : 'userLevel is undefined'
    });

    if (!authorized || !user || !hasValidLevel) {
      console.error('❌ [ORGANIZATION] 조직 관리 권한 거부:', {
        reason: !authorized ? 'not_authorized' : !user ? 'no_user' : 'insufficient_level',
        authorized,
        userId: user?.id,
        userName: user?.name,
        userLevel: user?.permission_level,
        userLevelType: typeof user?.permission_level,
        requiredLevel: 1 // 임시로 레벨 1로 낮춤
      });

      return NextResponse.json({
        error: '권한이 없습니다. 조직 관리는 레벨 3 이상의 권한이 필요합니다.',
        debug: {
          userLevel: user?.permission_level,
          userLevelType: typeof user?.permission_level,
          requiredLevel: 1, // 임시로 레벨 1로 낮춤
          authorized,
          hasUser: !!user
        }
      }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, department_id, manager_user_id } = body;

    if (!name || !department_id) {
      return NextResponse.json({ error: '팀명과 소속 부서는 필수입니다.' }, { status: 400 });
    }

    // 부서 존재 확인
    const { data: department } = await supabase
      .from('departments')
      .select('id, name')
      .eq('id', department_id)
      .eq('is_active', true)
      .single();

    if (!department) {
      return NextResponse.json({ error: '존재하지 않는 부서입니다.' }, { status: 404 });
    }

    // 같은 부서 내 중복 팀명 체크
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('name', name)
      .eq('department_id', department_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: '해당 부서에 이미 존재하는 팀명입니다.' }, { status: 409 });
    }

    // 다음 표시 순서 계산 (부서 내에서)
    const { data: maxOrder } = await supabase
      .from('teams')
      .select('display_order')
      .eq('department_id', department_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrder?.display_order || 0) + 1;

    // 팀 생성
    const { data: newTeam, error } = await supabase
      .from('teams')
      .insert({
        name,
        description,
        department_id,
        manager_user_id,
        display_order: nextOrder,
        updated_by: user.id
      })
      .select(`
        *,
        department:departments(
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error('팀 생성 오류:', error);
      return NextResponse.json({ error: '팀을 생성할 수 없습니다.' }, { status: 500 });
    }

    // 변경 히스토리 기록
    await supabase.from('organization_changes').insert({
      change_type: 'create',
      entity_type: 'team',
      entity_id: newTeam.id,
      new_data: newTeam,
      changed_by: user.id,
      impact_summary: `새 팀 생성 - ${department.name} 부서`
    });

    return NextResponse.json({
      success: true,
      data: newTeam,
      message: '팀이 성공적으로 생성되었습니다.'
    });

  } catch (error) {
    console.error('팀 생성 중 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT: 팀 수정/이동
export async function PUT(request: NextRequest) {
  console.log('🔄 [PUT-DEBUG] PUT 요청 시작:', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries())
  });
  try {
    const { authorized, user } = await checkUserPermission(request);
    // 강화된 권한 검증 및 디버깅
    const userLevel = user?.permission_level;
    const hasValidLevel = userLevel !== undefined && userLevel !== null && userLevel >= 3;

    console.log('🔍 [ORGANIZATION] 권한 검증 상세:', {
      authorized,
      user: user ? {
        id: user.id,
        name: user.name,
        permission_level: user.permission_level,
        permission_level_type: typeof user.permission_level
      } : null,
      hasValidLevel,
      comparison: userLevel !== undefined ? `${userLevel} >= 3 = ${userLevel >= 3}` : 'userLevel is undefined'
    });

    if (!authorized || !user || !hasValidLevel) {
      console.error('❌ [ORGANIZATION] 조직 관리 권한 거부:', {
        reason: !authorized ? 'not_authorized' : !user ? 'no_user' : 'insufficient_level',
        authorized,
        userId: user?.id,
        userName: user?.name,
        userLevel: user?.permission_level,
        userLevelType: typeof user?.permission_level,
        requiredLevel: 1 // 임시로 레벨 1로 낮춤
      });

      return NextResponse.json({
        error: '권한이 없습니다. 조직 관리는 레벨 3 이상의 권한이 필요합니다.',
        debug: {
          userLevel: user?.permission_level,
          userLevelType: typeof user?.permission_level,
          requiredLevel: 1, // 임시로 레벨 1로 낮춤
          authorized,
          hasUser: !!user
        }
      }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, department_id, manager_user_id, display_order } = body;

    if (!id || !name || !department_id) {
      return NextResponse.json({ error: '팀 ID, 팀명, 소속 부서는 필수입니다.' }, { status: 400 });
    }

    // 기존 데이터 조회 (히스토리용)
    const { data: oldData } = await supabase
      .from('teams')
      .select(`
        *,
        department:departments(id, name)
      `)
      .eq('id', id)
      .single();

    if (!oldData) {
      return NextResponse.json({ error: '팀을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 새 부서 존재 확인
    const { data: newDepartment } = await supabase
      .from('departments')
      .select('id, name')
      .eq('id', department_id)
      .eq('is_active', true)
      .single();

    if (!newDepartment) {
      return NextResponse.json({ error: '존재하지 않는 부서입니다.' }, { status: 404 });
    }

    // 같은 부서 내 중복 팀명 체크 (자기 자신 제외)
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('name', name)
      .eq('department_id', department_id)
      .neq('id', id)
      .single();

    if (existing) {
      return NextResponse.json({ error: '해당 부서에 이미 존재하는 팀명입니다.' }, { status: 409 });
    }

    // 부서 이동 시 순서 재계산
    let finalDisplayOrder = display_order !== undefined ? display_order : oldData.display_order;

    if (department_id !== oldData.department_id) {
      // 새 부서에서의 다음 순서 계산
      const { data: maxOrder } = await supabase
        .from('teams')
        .select('display_order')
        .eq('department_id', department_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      finalDisplayOrder = (maxOrder?.display_order || 0) + 1;
    }

    // 팀 수정
    const { data: updatedTeam, error } = await supabase
      .from('teams')
      .update({
        name,
        description,
        department_id,
        manager_user_id,
        display_order: finalDisplayOrder,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        department:departments(
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error('팀 수정 오류:', error);
      return NextResponse.json({ error: '팀을 수정할 수 없습니다.' }, { status: 500 });
    }

    // 부서 이동인지 확인
    const wasMoved = oldData.department_id !== department_id;
    let impactSummary = '팀 정보 수정';

    if (wasMoved) {
      impactSummary = `팀 이동: ${oldData.department.name} → ${newDepartment.name}`;

      // 관련 알림들의 타겟을 새 부서로 변경
      const { count: affectedNotifications } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('target_team_id', id);

      if (affectedNotifications > 0) {
        await supabase
          .from('notifications')
          .update({
            metadata: supabase.raw(`
              COALESCE(metadata, '{}') || '{"team_migration": "팀 이동으로 인한 알림 업데이트"}'
            `)
          })
          .eq('target_team_id', id);

        impactSummary += ` (알림 ${affectedNotifications}개 영향)`;
      }
    }

    // 변경 히스토리 기록
    await supabase.from('organization_changes').insert({
      change_type: wasMoved ? 'move' : 'update',
      entity_type: 'team',
      entity_id: id,
      old_data: oldData,
      new_data: updatedTeam,
      changed_by: user.id,
      impact_summary: impactSummary
    });

    return NextResponse.json({
      success: true,
      data: updatedTeam,
      message: '팀이 성공적으로 수정되었습니다.',
      moved: wasMoved
    });

  } catch (error) {
    console.error('팀 수정 중 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE: 팀 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { authorized, user } = await checkUserPermission(request);
    // 강화된 권한 검증 및 디버깅
    const userLevel = user?.permission_level;
    const hasValidLevel = userLevel !== undefined && userLevel !== null && userLevel >= 3;

    console.log('🔍 [ORGANIZATION] 권한 검증 상세:', {
      authorized,
      user: user ? {
        id: user.id,
        name: user.name,
        permission_level: user.permission_level,
        permission_level_type: typeof user.permission_level
      } : null,
      hasValidLevel,
      comparison: userLevel !== undefined ? `${userLevel} >= 3 = ${userLevel >= 3}` : 'userLevel is undefined'
    });

    if (!authorized || !user || !hasValidLevel) {
      console.error('❌ [ORGANIZATION] 조직 관리 권한 거부:', {
        reason: !authorized ? 'not_authorized' : !user ? 'no_user' : 'insufficient_level',
        authorized,
        userId: user?.id,
        userName: user?.name,
        userLevel: user?.permission_level,
        userLevelType: typeof user?.permission_level,
        requiredLevel: 1 // 임시로 레벨 1로 낮춤
      });

      return NextResponse.json({
        error: '권한이 없습니다. 조직 관리는 레벨 3 이상의 권한이 필요합니다.',
        debug: {
          userLevel: user?.permission_level,
          userLevelType: typeof user?.permission_level,
          requiredLevel: 1, // 임시로 레벨 1로 낮춤
          authorized,
          hasUser: !!user
        }
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const force = searchParams.get('force') === 'true';

    if (!id) {
      return NextResponse.json({ error: '팀 ID가 필요합니다.' }, { status: 400 });
    }

    // 영향도 분석
    const { data: team } = await supabase
      .from('teams')
      .select(`
        *,
        department:departments(id, name)
      `)
      .eq('id', id)
      .single();

    if (!team) {
      return NextResponse.json({ error: '팀을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 관련 알림 확인
    const { count: notificationCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('target_team_id', id);

    // 사용자 할당 확인 (users 테이블에 team_id가 있다면)
    let userCount = 0;
    try {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('team_id', id);
      userCount = count || 0;
    } catch {
      // users 테이블이 없거나 team_id 컬럼이 없으면 무시
    }

    const impact = {
      canDelete: true, // 팀은 항상 삭제 가능 (알림은 재할당)
      affectedNotifications: notificationCount || 0,
      affectedUsers: userCount
    };

    // force가 아닌 경우 영향도만 반환
    if (!force) {
      return NextResponse.json({
        success: true,
        impact,
        message: '삭제 가능합니다.'
      });
    }

    // 팀 삭제 (실제 삭제 - teams 테이블에 is_active 컬럼이 없음)
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('팀 삭제 오류:', {
        error: deleteError,
        teamId: id,
        userId: user.id
      });
      return NextResponse.json({
        error: '팀을 삭제할 수 없습니다.',
        details: deleteError.message
      }, { status: 500 });
    }

    // 관련 알림들을 부서 알림으로 변경
    if (impact.affectedNotifications > 0) {
      await supabase
        .from('notifications')
        .update({
          target_team_id: null,
          target_department_id: team.department_id,
          metadata: supabase.raw(`
            COALESCE(metadata, '{}') || '{"migration_note": "팀 삭제로 인한 부서 알림 변경"}'
          `)
        })
        .eq('target_team_id', id);
    }

    // 사용자들의 팀 할당 해제
    if (impact.affectedUsers > 0) {
      try {
        await supabase
          .from('users')
          .update({ team_id: null })
          .eq('team_id', id);
      } catch {
        // users 테이블 처리 실패 시 무시
      }
    }

    // 변경 히스토리 기록
    const entityId = parseInt(id);
    if (isNaN(entityId)) {
      console.error('팀 ID 변환 실패:', id);
      return NextResponse.json({ error: '유효하지 않은 팀 ID입니다.' }, { status: 400 });
    }

    const { error: historyError } = await supabase.from('organization_changes').insert({
      change_type: 'delete',
      entity_type: 'team',
      entity_id: entityId,
      old_data: team,
      changed_by: user.id,
      impact_summary: `팀 삭제 - 알림 ${impact.affectedNotifications}개, 사용자 ${impact.affectedUsers}명 영향`
    });

    if (historyError) {
      console.error('히스토리 기록 오류:', historyError);
      // 히스토리 기록 실패는 중요하지 않으므로 계속 진행
    }

    return NextResponse.json({
      success: true,
      impact,
      message: '팀이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('팀 삭제 중 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}