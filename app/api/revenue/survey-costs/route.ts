import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, query as pgQuery } from '@/lib/supabase-direct';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SurveyCostData {
  survey_type: 'estimate' | 'pre_construction' | 'completion';
  survey_name: string;
  base_cost: number;
  effective_from: string;
  effective_to?: string;
}

// 실사비용 조회
export async function GET(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    // 토큰에서 사용자 ID 추출
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '토큰에 사용자 정보가 없습니다.'
      }, { status: 401 });
    }

    // DB에서 사용자 권한 조회 - Direct PostgreSQL
    const user = await queryOne(
      'SELECT id, permission_level FROM employees WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (!user) {
      console.log('❌ [SURVEY-COSTS] 사용자 조회 실패');
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 401 });
    }

    const permissionLevel = user.permission_level;

    console.log('🔍 [SURVEY-COSTS] 토큰 검증:', { userId, permissionLevel });

    // 권한 2 이상 확인 (매출 조회)
    if (!permissionLevel || permissionLevel < 2) {
      console.log('❌ [SURVEY-COSTS] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '매출 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    // URL 파라미터 처리
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    const surveyType = url.searchParams.get('survey_type');

    // 실사비용 조회 - Direct PostgreSQL
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (!includeInactive) {
      whereClauses.push(`is_active = true`);
    }

    if (surveyType) {
      whereClauses.push(`survey_type = $${paramIndex}`);
      params.push(surveyType);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const sqlQuery = `
      SELECT * FROM survey_cost_settings
      ${whereClause}
      ORDER BY survey_type ASC, effective_from DESC
    `;

    const costs = await queryAll(sqlQuery, params);

    // 실사 유형별로 그룹화하여 최신 설정만 반환
    const groupedCosts = costs?.reduce((acc, cost) => {
      if (!acc[cost.survey_type] ||
          new Date(cost.effective_from) > new Date(acc[cost.survey_type].effective_from)) {
        acc[cost.survey_type] = cost;
      }
      return acc;
    }, {} as Record<string, any>);

    const result = Object.values(groupedCosts || {});

    console.log(`📊 [SURVEY-COSTS] 조회 완료: ${result.length}개 실사비용`);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ [SURVEY-COSTS] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 실사비용 생성/수정
export async function POST(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    // 토큰에서 사용자 정보 추출
    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    console.log('🔍 [SURVEY-COSTS] 토큰 검증:', { userId, permissionLevel });

    // 권한 3 이상 확인 (원가 관리)
    if (!permissionLevel || permissionLevel < 3) {
      console.log('❌ [SURVEY-COSTS] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      survey_type,
      survey_name,
      base_cost,
      effective_from,
      effective_to,
      change_reason
    }: SurveyCostData & { change_reason?: string } = body;

    // 입력 값 검증
    if (!survey_type || !survey_name || base_cost === undefined || !effective_from) {
      return NextResponse.json({
        success: false,
        message: '필수 필드가 누락되었습니다.'
      }, { status: 400 });
    }

    // 유효한 실사 유형인지 확인
    const validTypes = ['estimate', 'pre_construction', 'completion'];
    if (!validTypes.includes(survey_type)) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 실사 유형입니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 (히스토리 용) - Direct PostgreSQL
    const existingData = await queryOne(
      'SELECT * FROM survey_cost_settings WHERE survey_type = $1 AND is_active = true',
      [survey_type]
    );

    // 새 데이터 삽입 - Direct PostgreSQL
    const newCost = await queryOne(
      `INSERT INTO survey_cost_settings (
        survey_type, survey_name, base_cost, effective_from, effective_to,
        created_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *`,
      [
        survey_type,
        survey_name,
        base_cost,
        effective_from,
        effective_to || null,
        userId
      ]
    );

    if (!newCost) {
      console.error('❌ [SURVEY-COSTS] 삽입 오류');
      return NextResponse.json({
        success: false,
        message: '실사비용 저장에 실패했습니다.'
      }, { status: 500 });
    }

    // 기존 데이터가 있다면 비활성화 - Direct PostgreSQL
    if (existingData) {
      await pgQuery(
        `UPDATE survey_cost_settings
         SET is_active = false, effective_to = $1
         WHERE id = $2`,
        [effective_from, existingData.id]
      );

      // 원가 변경 히스토리 기록 - Direct PostgreSQL
      await pgQuery(
        `INSERT INTO pricing_change_history (
          table_name, record_id, change_type, old_values, new_values,
          changed_fields, change_reason, user_id, user_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'survey_cost_settings',
          newCost.id,
          'cost_update',
          JSON.stringify(existingData),
          JSON.stringify(newCost),
          JSON.stringify(['base_cost']),
          change_reason || '실사비용 업데이트',
          userId,
          decoded.name || decoded.username || '알 수 없음'
        ]
      );
    }

    // 감사 로그 기록 - Direct PostgreSQL
    await pgQuery(
      `INSERT INTO revenue_audit_log (
        table_name, record_id, action_type, new_values, action_description,
        user_id, user_name, user_permission_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'survey_cost_settings',
        newCost.id,
        'INSERT',
        JSON.stringify(newCost),
        `실사비용 ${existingData ? '수정' : '생성'}: ${survey_name}`,
        userId,
        decoded.name || decoded.username || '알 수 없음',
        permissionLevel
      ]
    );

    console.log(`✅ [SURVEY-COSTS] ${existingData ? '수정' : '생성'} 완료:`, survey_name);

    return NextResponse.json({
      success: true,
      data: newCost,
      message: `실사비용이 성공적으로 ${existingData ? '수정' : '생성'}되었습니다.`
    });

  } catch (error) {
    console.error('❌ [SURVEY-COSTS] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 실사비용 수정 (기존 레코드 업데이트)
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 3 이상 확인 (원가 관리)
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      survey_name,
      base_cost,
      effective_from,
      effective_to
    } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'ID가 필요합니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 - Direct PostgreSQL
    const existingData = await queryOne(
      'SELECT * FROM survey_cost_settings WHERE id = $1',
      [id]
    );

    if (!existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 업데이트할 데이터 준비 (survey_type은 수정 불가)
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    const updateData: any = {};
    let paramIndex = 1;

    if (survey_name !== undefined) {
      updateFields.push(`survey_name = $${paramIndex}`);
      updateValues.push(survey_name);
      updateData.survey_name = survey_name;
      paramIndex++;
    }
    if (base_cost !== undefined) {
      updateFields.push(`base_cost = $${paramIndex}`);
      updateValues.push(base_cost);
      updateData.base_cost = base_cost;
      paramIndex++;
    }
    if (effective_from !== undefined) {
      updateFields.push(`effective_from = $${paramIndex}`);
      updateValues.push(effective_from);
      updateData.effective_from = effective_from;
      paramIndex++;
    }
    if (effective_to !== undefined) {
      updateFields.push(`effective_to = $${paramIndex}`);
      updateValues.push(effective_to);
      updateData.effective_to = effective_to;
      paramIndex++;
    }

    // 수정할 내용이 없으면 에러
    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        message: '수정할 내용이 없습니다.'
      }, { status: 400 });
    }

    // 레코드 업데이트 - Direct PostgreSQL
    updateValues.push(id);
    const updatedData = await queryOne(
      `UPDATE survey_cost_settings
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    if (!updatedData) {
      console.error('❌ [SURVEY-COSTS] 수정 오류');
      return NextResponse.json({
        success: false,
        message: '실사비용 수정에 실패했습니다.'
      }, { status: 500 });
    }

    // 변경 이력 기록 - Direct PostgreSQL
    await pgQuery(
      `INSERT INTO pricing_change_history (
        table_name, record_id, change_type, old_values, new_values,
        changed_fields, change_reason, user_id, user_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        'survey_cost_settings',
        id,
        'cost_update',
        JSON.stringify(existingData),
        JSON.stringify(updatedData),
        JSON.stringify(Object.keys(updateData)),
        '실사비용 수정',
        userId,
        decoded.name || decoded.username || '알 수 없음'
      ]
    );

    console.log(`✏️ [SURVEY-COSTS] 수정 완료:`, existingData.survey_name);

    return NextResponse.json({
      success: true,
      data: updatedData,
      message: '실사비용이 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('❌ [SURVEY-COSTS] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 실사비용 삭제 (비활성화)
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 3 이상 확인
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'ID가 필요합니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 - Direct PostgreSQL
    const existingData = await queryOne(
      'SELECT * FROM survey_cost_settings WHERE id = $1',
      [id]
    );

    if (!existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 비활성화 (실제 삭제하지 않음) - Direct PostgreSQL
    const today = new Date().toISOString().split('T')[0];
    await pgQuery(
      `UPDATE survey_cost_settings
       SET is_active = false, effective_to = $1
       WHERE id = $2`,
      [today, id]
    );

    // 감사 로그 기록 - Direct PostgreSQL
    await pgQuery(
      `INSERT INTO revenue_audit_log (
        table_name, record_id, action_type, old_values, action_description,
        user_id, user_name, user_permission_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'survey_cost_settings',
        id,
        'DELETE',
        JSON.stringify(existingData),
        `실사비용 삭제: ${existingData.survey_name}`,
        userId,
        decoded.name || decoded.username || '알 수 없음',
        permissionLevel
      ]
    );

    console.log(`🗑️ [SURVEY-COSTS] 삭제 완료:`, existingData.survey_name);

    return NextResponse.json({
      success: true,
      message: '실사비용이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('❌ [SURVEY-COSTS] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
