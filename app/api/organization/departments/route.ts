import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyTokenHybrid } from '@/lib/secure-jwt';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    console.error('❌ [DEPARTMENTS] 권한 확인 오류:', error);
    return { authorized: false, user: null };
  }
}

// GET: 부서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = supabase
      .from('departments')
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        teams:teams(
          id,
          name,
          description,
          department_id
        )
      `)
      .order('id', { ascending: true });

    // is_active 컬럼이 없을 수 있으므로 일단 모든 데이터를 조회
    // if (!includeInactive) {
    //   query = query.eq('is_active', true);
    // }

    const { data: departments, error } = await query;

    if (error) {
      console.error('부서 조회 오류:', error);
      return NextResponse.json({ error: '부서 목록을 불러올 수 없습니다.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        data: departments || []
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
    console.error('부서 목록 조회 중 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST: 부서 생성
export async function POST(request: NextRequest) {
  try {
    // 권한 확인
    const { authorized, user } = await checkUserPermission(request);
    if (!authorized || !user || user.permission_level < 3) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: '부서명은 필수입니다.' }, { status: 400 });
    }

    // 중복 체크
    const { data: existing } = await supabase
      .from('departments')
      .select('id')
      .eq('name', name)
      .eq('is_active', true)
      .single();

    if (existing) {
      return NextResponse.json({ error: '이미 존재하는 부서명입니다.' }, { status: 409 });
    }

    // 다음 표시 순서 계산
    const { data: maxOrder } = await supabase
      .from('departments')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrder?.display_order || 0) + 1;

    // 부서 생성
    const { data: newDepartment, error } = await supabase
      .from('departments')
      .insert({
        name,
        description,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('부서 생성 오류:', error);
      return NextResponse.json({ error: '부서를 생성할 수 없습니다.' }, { status: 500 });
    }

    // 변경 히스토리 기록
    await supabase.from('organization_changes').insert({
      change_type: 'create',
      entity_type: 'department',
      entity_id: newDepartment.id,
      new_data: newDepartment,
      changed_by: user.id,
      impact_summary: '새 부서 생성'
    });

    return NextResponse.json({
      success: true,
      data: newDepartment,
      message: '부서가 성공적으로 생성되었습니다.'
    });

  } catch (error) {
    console.error('부서 생성 중 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT: 부서 수정
export async function PUT(request: NextRequest) {
  try {
    const { authorized, user } = await checkUserPermission(request);
    if (!authorized || !user || user.permission_level < 3) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, display_order } = body;

    if (!id || !name) {
      return NextResponse.json({ error: '부서 ID와 부서명은 필수입니다.' }, { status: 400 });
    }

    // 기존 데이터 조회 (히스토리용)
    const { data: oldData } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldData) {
      return NextResponse.json({ error: '부서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 중복 체크 (자기 자신 제외)
    const { data: existing } = await supabase
      .from('departments')
      .select('id')
      .eq('name', name)
      .eq('is_active', true)
      .neq('id', id)
      .single();

    if (existing) {
      return NextResponse.json({ error: '이미 존재하는 부서명입니다.' }, { status: 409 });
    }

    // 부서 수정
    const { data: updatedDepartment, error } = await supabase
      .from('departments')
      .update({
        name,
        description,
        display_order: display_order !== undefined ? display_order : oldData.display_order,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('부서 수정 오류:', error);
      return NextResponse.json({ error: '부서를 수정할 수 없습니다.' }, { status: 500 });
    }

    // 변경 히스토리 기록
    await supabase.from('organization_changes').insert({
      change_type: 'update',
      entity_type: 'department',
      entity_id: id,
      old_data: oldData,
      new_data: updatedDepartment,
      changed_by: user.id,
      impact_summary: '부서 정보 수정'
    });

    return NextResponse.json({
      success: true,
      data: updatedDepartment,
      message: '부서가 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('부서 수정 중 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE: 부서 삭제 (영향도 분석 포함)
export async function DELETE(request: NextRequest) {
  try {
    const { authorized, user } = await checkUserPermission(request);
    if (!authorized || !user || user.permission_level < 3) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const force = searchParams.get('force') === 'true';

    if (!id) {
      return NextResponse.json({ error: '부서 ID가 필요합니다.' }, { status: 400 });
    }

    // 영향도 분석
    const { data: department } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single();

    if (!department) {
      return NextResponse.json({ error: '부서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 하위 팀 확인
    const { data: teams, count: teamCount } = await supabase
      .from('teams')
      .select('id, name', { count: 'exact' })
      .eq('department_id', id)
      .eq('is_active', true);

    // 관련 알림 확인
    const { count: notificationCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('target_department_id', id);

    const impact = {
      canDelete: teamCount === 0,
      affectedTeams: teamCount || 0,
      affectedNotifications: notificationCount || 0,
      teams: teams || []
    };

    // force가 아닌 경우 영향도만 반환
    if (!force) {
      return NextResponse.json({
        success: true,
        impact,
        message: impact.canDelete ? '삭제 가능합니다.' : '하위 팀이 있어 삭제할 수 없습니다.'
      });
    }

    // 강제 삭제 또는 안전한 삭제
    if (impact.affectedTeams > 0 && !force) {
      return NextResponse.json({
        error: '하위 팀이 있는 부서는 삭제할 수 없습니다.',
        impact
      }, { status: 409 });
    }

    // 트랜잭션으로 안전하게 삭제
    const { error: deleteError } = await supabase
      .from('departments')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (deleteError) {
      console.error('부서 삭제 오류:', deleteError);
      return NextResponse.json({ error: '부서를 삭제할 수 없습니다.' }, { status: 500 });
    }

    // 하위 팀들도 비활성화
    if (impact.affectedTeams > 0) {
      await supabase
        .from('teams')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('department_id', id);
    }

    // 관련 알림들 처리 (다른 부서로 재할당 또는 전사 알림으로 변경)
    if (impact.affectedNotifications > 0) {
      await supabase
        .from('notifications')
        .update({
          target_department_id: null,
          notification_tier: 'company', // 전사 알림으로 변경
          metadata: supabase.raw(`
            COALESCE(metadata, '{}') || '{"migration_note": "부서 삭제로 인한 전사 알림 변경"}'
          `)
        })
        .eq('target_department_id', id);
    }

    // 변경 히스토리 기록
    await supabase.from('organization_changes').insert({
      change_type: 'delete',
      entity_type: 'department',
      entity_id: parseInt(id),
      old_data: department,
      changed_by: user.id,
      impact_summary: `부서 삭제 - 팀 ${impact.affectedTeams}개, 알림 ${impact.affectedNotifications}개 영향`
    });

    return NextResponse.json({
      success: true,
      impact,
      message: '부서가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('부서 삭제 중 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}