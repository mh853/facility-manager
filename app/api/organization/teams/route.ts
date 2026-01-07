import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, query as pgQuery } from '@/lib/supabase-direct';
import { verifyTokenHybrid } from '@/lib/secure-jwt';

// 사용자 권한 확인 헬퍼
async function checkUserPermission(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, user: null };
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const result = await verifyTokenHybrid(token);

    if (!result.user) {
      return { authorized: false, user: null };
    }

    return {
      authorized: true,
      user: result.user
    };
  } catch (error) {
    console.error('❌ [TEAMS] 권한 확인 오류:', error);
    return { authorized: false, user: null };
  }
}

// GET: 팀 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // 팀 목록 조회 - Direct PostgreSQL
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (departmentId) {
      whereClauses.push(`department_id = $${paramIndex}`);
      params.push(departmentId);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const teams = await queryAll(
      `SELECT * FROM teams ${whereClause} ORDER BY id ASC`,
      params
    );

    if (!teams) {
      console.error('팀 조회 오류');
      return NextResponse.json({ error: '팀 목록을 불러올 수 없습니다.' }, { status: 500 });
    }

    // 각 팀에 대한 부서 정보 조회
    const teamsWithDepartment = await Promise.all(
      teams.map(async (team) => {
        const department = await queryOne(
          'SELECT id, name FROM departments WHERE id = $1',
          [team.department_id]
        );
        return {
          ...team,
          department: department || null
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: teamsWithDepartment
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

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
    const { name, description, department_id } = body;

    if (!name || !department_id) {
      return NextResponse.json({ error: '팀명과 소속 부서는 필수입니다.' }, { status: 400 });
    }

    // 부서 존재 확인 - Direct PostgreSQL
    const department = await queryOne(
      'SELECT id, name FROM departments WHERE id = $1',
      [department_id]
    );

    if (!department) {
      return NextResponse.json({ error: '존재하지 않는 부서입니다.' }, { status: 404 });
    }

    // 같은 부서 내 중복 팀명 체크 - Direct PostgreSQL
    const existing = await queryOne(
      'SELECT id FROM teams WHERE name = $1 AND department_id = $2 LIMIT 1',
      [name, department_id]
    );

    if (existing) {
      return NextResponse.json({ error: '해당 부서에 이미 존재하는 팀명입니다.' }, { status: 409 });
    }

    // 다음 표시 순서 계산 (부서 내에서) - Direct PostgreSQL
    const maxOrder = await queryOne(
      'SELECT display_order FROM teams WHERE department_id = $1 ORDER BY display_order DESC LIMIT 1',
      [department_id]
    );

    const nextOrder = (maxOrder?.display_order || 0) + 1;

    // 팀 생성 - Direct PostgreSQL
    const newTeam = await queryOne(
      `INSERT INTO teams (name, description, department_id, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description || null, department_id, nextOrder]
    );

    if (!newTeam) {
      console.error('팀 생성 오류');
      return NextResponse.json({ error: '팀을 생성할 수 없습니다.' }, { status: 500 });
    }

    // 팀에 부서 정보 추가
    newTeam.department = department;

    // 변경 히스토리 기록 - Direct PostgreSQL
    await pgQuery(
      `INSERT INTO organization_changes (change_type, entity_type, entity_id, new_data, changed_by, impact_summary)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['create', 'team', newTeam.id, JSON.stringify(newTeam), user.id, `새 팀 생성 - ${department.name} 부서`]
    );

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
    const { id, name, description, department_id, display_order } = body;

    if (!id || !name || !department_id) {
      return NextResponse.json({ error: '팀 ID, 팀명, 소속 부서는 필수입니다.' }, { status: 400 });
    }

    // 기존 데이터 조회 (히스토리용) - Direct PostgreSQL
    const oldTeam = await queryOne(
      'SELECT * FROM teams WHERE id = $1',
      [id]
    );

    if (!oldTeam) {
      return NextResponse.json({ error: '팀을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 기존 팀의 부서 정보 조회
    const oldDepartment = await queryOne(
      'SELECT id, name FROM departments WHERE id = $1',
      [oldTeam.department_id]
    );
    const oldData = { ...oldTeam, department: oldDepartment };

    // 새 부서 존재 확인 - Direct PostgreSQL
    const newDepartment = await queryOne(
      'SELECT id, name FROM departments WHERE id = $1',
      [department_id]
    );

    if (!newDepartment) {
      return NextResponse.json({ error: '존재하지 않는 부서입니다.' }, { status: 404 });
    }

    // 같은 부서 내 중복 팀명 체크 (자기 자신 제외) - Direct PostgreSQL
    const existing = await queryOne(
      'SELECT id FROM teams WHERE name = $1 AND department_id = $2 AND id != $3 LIMIT 1',
      [name, department_id, id]
    );

    if (existing) {
      return NextResponse.json({ error: '해당 부서에 이미 존재하는 팀명입니다.' }, { status: 409 });
    }

    // 부서 이동 시 순서 재계산
    let finalDisplayOrder = display_order !== undefined ? display_order : oldData.display_order;

    if (department_id !== oldData.department_id) {
      // 새 부서에서의 다음 순서 계산 - Direct PostgreSQL
      const maxOrder = await queryOne(
        'SELECT display_order FROM teams WHERE department_id = $1 ORDER BY display_order DESC LIMIT 1',
        [department_id]
      );

      finalDisplayOrder = (maxOrder?.display_order || 0) + 1;
    }

    // 팀 수정 - Direct PostgreSQL
    const updatedTeam = await queryOne(
      `UPDATE teams
       SET name = $1, description = $2, department_id = $3, display_order = $4, updated_at = $5
       WHERE id = $6
       RETURNING *`,
      [name, description || null, department_id, finalDisplayOrder, new Date().toISOString(), id]
    );

    if (!updatedTeam) {
      console.error('팀 수정 오류');
      return NextResponse.json({ error: '팀을 수정할 수 없습니다.' }, { status: 500 });
    }

    // 팀에 부서 정보 추가
    updatedTeam.department = newDepartment;

    // 부서 이동인지 확인
    const wasMoved = oldData.department_id !== department_id;
    let impactSummary = '팀 정보 수정';

    if (wasMoved) {
      impactSummary = `팀 이동: ${oldDepartment.name} → ${newDepartment.name}`;

      // 관련 알림들의 타겟을 새 부서로 변경 - Direct PostgreSQL
      const notificationCountResult = await queryOne(
        'SELECT COUNT(*) as count FROM notifications WHERE target_team_id = $1',
        [id]
      );
      const affectedNotifications = parseInt(notificationCountResult?.count || '0');

      if (affectedNotifications > 0) {
        await pgQuery(
          `UPDATE notifications
           SET metadata = COALESCE(metadata, '{}')::jsonb || '{"team_migration": "팀 이동으로 인한 알림 업데이트"}'::jsonb
           WHERE target_team_id = $1`,
          [id]
        );

        impactSummary += ` (알림 ${affectedNotifications}개 영향)`;
      }
    }

    // 변경 히스토리 기록 - Direct PostgreSQL
    await pgQuery(
      `INSERT INTO organization_changes (change_type, entity_type, entity_id, old_data, new_data, changed_by, impact_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [wasMoved ? 'move' : 'update', 'team', id, JSON.stringify(oldData), JSON.stringify(updatedTeam), user.id, impactSummary]
    );

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

    // 영향도 분석 - Direct PostgreSQL
    const team = await queryOne(
      'SELECT * FROM teams WHERE id = $1',
      [id]
    );

    if (!team) {
      return NextResponse.json({ error: '팀을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 관련 알림 확인 - Direct PostgreSQL
    const notificationCountResult = await queryOne(
      'SELECT COUNT(*) as count FROM notifications WHERE target_team_id = $1',
      [id]
    );
    const notificationCount = parseInt(notificationCountResult?.count || '0');

    // 사용자 할당 확인 (users 테이블에 team_id가 있다면)
    let userCount = 0;
    try {
      const userCountResult = await queryOne(
        'SELECT COUNT(*) as count FROM users WHERE team_id = $1',
        [id]
      );
      userCount = parseInt(userCountResult?.count || '0');
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

    // 팀 삭제 (실제 삭제 - teams 테이블에 is_active 컬럼이 없음) - Direct PostgreSQL
    await pgQuery(
      'DELETE FROM teams WHERE id = $1',
      [id]
    );

    // 관련 알림들을 부서 알림으로 변경 - Direct PostgreSQL
    if (impact.affectedNotifications > 0) {
      await pgQuery(
        `UPDATE notifications
         SET target_team_id = NULL,
             target_department_id = $1,
             metadata = COALESCE(metadata, '{}')::jsonb || '{"migration_note": "팀 삭제로 인한 부서 알림 변경"}'::jsonb
         WHERE target_team_id = $2`,
        [team.department_id, id]
      );
    }

    // 사용자들의 팀 할당 해제 - Direct PostgreSQL
    if (impact.affectedUsers > 0) {
      try {
        await pgQuery(
          'UPDATE users SET team_id = NULL WHERE team_id = $1',
          [id]
        );
      } catch {
        // users 테이블 처리 실패 시 무시
      }
    }

    // 변경 히스토리 기록 - Direct PostgreSQL
    const entityId = parseInt(id);
    if (isNaN(entityId)) {
      console.error('팀 ID 변환 실패:', id);
      return NextResponse.json({ error: '유효하지 않은 팀 ID입니다.' }, { status: 400 });
    }

    await pgQuery(
      `INSERT INTO organization_changes (change_type, entity_type, entity_id, old_data, changed_by, impact_summary)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'delete',
        'team',
        entityId,
        JSON.stringify(team),
        user.id,
        `팀 삭제 - 알림 ${impact.affectedNotifications}개, 사용자 ${impact.affectedUsers}명 영향`
      ]
    );

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