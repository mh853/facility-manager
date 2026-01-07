import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, query as pgQuery } from '@/lib/supabase-direct';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SalesOfficeSettingsData {
  sales_office: string;
  commission_type: 'percentage' | 'per_unit';
  commission_percentage?: number;
  commission_per_unit?: number;
  effective_from: string;
  effective_to?: string;
}

// 영업점별 비용 설정 조회
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
      console.log('❌ [SALES-OFFICE-SETTINGS] 사용자 조회 실패');
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 401 });
    }

    const permissionLevel = user.permission_level;

    console.log('🔍 [SALES-OFFICE-SETTINGS] 토큰 검증:', { userId, permissionLevel });

    // 권한 2 이상 확인 (매출 조회)
    if (!permissionLevel || permissionLevel < 2) {
      console.log('❌ [SALES-OFFICE-SETTINGS] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '매출 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    // URL 파라미터 처리
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    const salesOffice = url.searchParams.get('sales_office');

    // 영업점별 비용 설정 조회 - Direct PostgreSQL
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (!includeInactive) {
      whereClauses.push(`is_active = true`);
    }

    if (salesOffice) {
      whereClauses.push(`sales_office = $${paramIndex}`);
      params.push(salesOffice);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const sqlQuery = `
      SELECT * FROM sales_office_cost_settings
      ${whereClause}
      ORDER BY sales_office ASC
    `;

    const settings = await queryAll(sqlQuery, params);

    // 영업점별로 그룹화하여 최신 설정만 반환
    const groupedSettings = settings?.reduce((acc, setting) => {
      if (!acc[setting.sales_office] ||
          new Date(setting.effective_from) > new Date(acc[setting.sales_office].effective_from)) {
        acc[setting.sales_office] = setting;
      }
      return acc;
    }, {} as Record<string, any>);

    const result = Object.values(groupedSettings || {});

    console.log(`📊 [SALES-OFFICE-SETTINGS] 조회 완료: ${result.length}개 영업점`);

    return NextResponse.json({
      success: true,
      data: {
        settings: result,
        total_count: result.length
      }
    });

  } catch (error) {
    console.error('❌ [SALES-OFFICE-SETTINGS] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 영업점별 비용 설정 생성/수정
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

    console.log('🔍 [SALES-OFFICE-SETTINGS] 토큰 검증:', { userId, permissionLevel });

    // 권한 3 이상 확인 (원가 관리)
    if (!permissionLevel || permissionLevel < 3) {
      console.log('❌ [SALES-OFFICE-SETTINGS] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      sales_office,
      commission_type,
      commission_percentage,
      commission_per_unit,
      effective_from,
      effective_to,
      change_reason
    }: SalesOfficeSettingsData & { change_reason?: string } = body;

    // 입력 값 검증
    if (!sales_office || !commission_type || !effective_from) {
      return NextResponse.json({
        success: false,
        message: '필수 필드가 누락되었습니다.'
      }, { status: 400 });
    }

    // 방식별 필수 값 검증 (0도 유효한 값으로 처리)
    if (commission_type === 'percentage' && (commission_percentage === undefined || commission_percentage === null)) {
      return NextResponse.json({
        success: false,
        message: '퍼센트 방식의 경우 commission_percentage가 필요합니다.'
      }, { status: 400 });
    }

    if (commission_type === 'per_unit' && (commission_per_unit === undefined || commission_per_unit === null)) {
      return NextResponse.json({
        success: false,
        message: '단가 방식의 경우 commission_per_unit이 필요합니다.'
      }, { status: 400 });
    }

    // 기존 활성 데이터 조회 (히스토리 용) - Direct PostgreSQL
    const existingData = await queryOne(
      'SELECT * FROM sales_office_cost_settings WHERE sales_office = $1 AND is_active = true',
      [sales_office]
    );

    // 새 데이터 삽입 또는 업데이트 (UPSERT) - Direct PostgreSQL
    const newSettings = await queryOne(
      `INSERT INTO sales_office_cost_settings (
        sales_office, commission_type, commission_percentage, commission_per_unit,
        effective_from, effective_to, created_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      ON CONFLICT (sales_office, effective_from)
      DO UPDATE SET
        commission_type = EXCLUDED.commission_type,
        commission_percentage = EXCLUDED.commission_percentage,
        commission_per_unit = EXCLUDED.commission_per_unit,
        effective_to = EXCLUDED.effective_to,
        is_active = EXCLUDED.is_active
      RETURNING *`,
      [
        sales_office,
        commission_type,
        commission_type === 'percentage' ? commission_percentage : null,
        commission_type === 'per_unit' ? commission_per_unit : null,
        effective_from,
        effective_to || null,
        userId
      ]
    );

    if (!newSettings) {
      console.error('❌ [SALES-OFFICE-SETTINGS] 삽입 오류');
      return NextResponse.json({
        success: false,
        message: '영업점 비용 설정 저장에 실패했습니다.'
      }, { status: 500 });
    }

    // 기존 활성 데이터가 있고, 새로 생성/수정된 레코드와 다른 경우에만 비활성화
    // (UPSERT로 같은 레코드를 업데이트한 경우 비활성화하지 않음)
    if (existingData && existingData.id !== newSettings.id) {
      await pgQuery(
        `UPDATE sales_office_cost_settings
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
          'sales_office_cost_settings',
          newSettings.id,
          'commission_update',
          JSON.stringify(existingData),
          JSON.stringify(newSettings),
          JSON.stringify(['commission_type', 'commission_percentage', 'commission_per_unit']),
          change_reason || '영업비용 설정 업데이트',
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
        'sales_office_cost_settings',
        newSettings.id,
        'INSERT',
        JSON.stringify(newSettings),
        `영업점 비용 설정 ${existingData ? '수정' : '생성'}: ${sales_office}`,
        userId,
        decoded.name || decoded.username || '알 수 없음',
        permissionLevel
      ]
    );

    console.log(`✅ [SALES-OFFICE-SETTINGS] ${existingData ? '수정' : '생성'} 완료:`, sales_office);

    return NextResponse.json({
      success: true,
      data: {
        settings: newSettings,
        is_update: !!existingData
      },
      message: `영업점 비용 설정이 성공적으로 ${existingData ? '수정' : '생성'}되었습니다.`
    });

  } catch (error) {
    console.error('❌ [SALES-OFFICE-SETTINGS] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 영업점별 비용 설정 수정 (기존 레코드 업데이트)
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
      commission_type,
      commission_percentage,
      commission_per_unit,
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
      'SELECT * FROM sales_office_cost_settings WHERE id = $1',
      [id]
    );

    if (!existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 업데이트할 데이터 준비 (sales_office는 수정 불가)
    const updateData: any = {};
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (commission_type !== undefined) {
      updateFields.push(`commission_type = $${paramIndex}`);
      updateValues.push(commission_type);
      paramIndex++;
      updateData.commission_type = commission_type;

      // 방식 변경 시 해당 값만 업데이트
      if (commission_type === 'percentage') {
        updateFields.push(`commission_percentage = $${paramIndex}`);
        updateValues.push(commission_percentage);
        paramIndex++;
        updateFields.push(`commission_per_unit = NULL`);
        updateData.commission_percentage = commission_percentage;
        updateData.commission_per_unit = null;
      } else {
        updateFields.push(`commission_per_unit = $${paramIndex}`);
        updateValues.push(commission_per_unit);
        paramIndex++;
        updateFields.push(`commission_percentage = NULL`);
        updateData.commission_per_unit = commission_per_unit;
        updateData.commission_percentage = null;
      }
    } else {
      // 방식 변경 없이 값만 변경하는 경우
      if (commission_percentage !== undefined) {
        updateFields.push(`commission_percentage = $${paramIndex}`);
        updateValues.push(commission_percentage);
        paramIndex++;
        updateData.commission_percentage = commission_percentage;
      }
      if (commission_per_unit !== undefined) {
        updateFields.push(`commission_per_unit = $${paramIndex}`);
        updateValues.push(commission_per_unit);
        paramIndex++;
        updateData.commission_per_unit = commission_per_unit;
      }
    }

    if (effective_from !== undefined) {
      updateFields.push(`effective_from = $${paramIndex}`);
      updateValues.push(effective_from);
      paramIndex++;
      updateData.effective_from = effective_from;
    }

    if (effective_to !== undefined) {
      updateFields.push(`effective_to = $${paramIndex}`);
      updateValues.push(effective_to);
      paramIndex++;
      updateData.effective_to = effective_to;
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
      `UPDATE sales_office_cost_settings
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    if (!updatedData) {
      console.error('❌ [SALES-OFFICE-SETTINGS] 수정 오류');
      return NextResponse.json({
        success: false,
        message: '영업점 비용 설정 수정에 실패했습니다.'
      }, { status: 500 });
    }

    // 변경 이력 기록 - Direct PostgreSQL
    await pgQuery(
      `INSERT INTO pricing_change_history (
        table_name, record_id, change_type, old_values, new_values,
        changed_fields, change_reason, user_id, user_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        'sales_office_cost_settings',
        id,
        'commission_update',
        JSON.stringify(existingData),
        JSON.stringify(updatedData),
        JSON.stringify(Object.keys(updateData)),
        '영업점 수수료 설정 수정',
        userId,
        decoded.name || decoded.username || '알 수 없음'
      ]
    );

    console.log(`✏️ [SALES-OFFICE-SETTINGS] 수정 완료:`, existingData.sales_office);

    return NextResponse.json({
      success: true,
      data: updatedData,
      message: '영업점 비용 설정이 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('❌ [SALES-OFFICE-SETTINGS] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 다중 영업점 설정 업데이트
export async function PUT(request: NextRequest) {
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

    // 권한 3 이상 확인
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const { settings, change_reason } = body;

    if (!settings || !Array.isArray(settings) || settings.length === 0) {
      return NextResponse.json({
        success: false,
        message: '업데이트할 설정 목록이 필요합니다.'
      }, { status: 400 });
    }

    const results = [];
    const errors = [];

    // 각 설정을 순차적으로 처리
    for (const setting of settings) {
      try {
        const {
          sales_office,
          commission_type,
          commission_percentage,
          commission_per_unit,
          effective_from
        } = setting;

        const effectiveFromDate = effective_from || new Date().toISOString().split('T')[0];

        // 기존 활성 데이터 조회 - Direct PostgreSQL
        const existingData = await queryOne(
          'SELECT * FROM sales_office_cost_settings WHERE sales_office = $1 AND is_active = true',
          [sales_office]
        );

        // 새 데이터 삽입 또는 업데이트 (UPSERT) - Direct PostgreSQL
        const newSettings = await queryOne(
          `INSERT INTO sales_office_cost_settings (
            sales_office, commission_type, commission_percentage, commission_per_unit,
            effective_from, created_by, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, true)
          ON CONFLICT (sales_office, effective_from)
          DO UPDATE SET
            commission_type = EXCLUDED.commission_type,
            commission_percentage = EXCLUDED.commission_percentage,
            commission_per_unit = EXCLUDED.commission_per_unit,
            is_active = EXCLUDED.is_active
          RETURNING *`,
          [
            sales_office,
            commission_type,
            commission_type === 'percentage' ? commission_percentage : null,
            commission_type === 'per_unit' ? commission_per_unit : null,
            effectiveFromDate,
            userId
          ]
        );

        if (!newSettings) {
          errors.push(`${sales_office}: 저장 실패`);
          continue;
        }

        // 기존 활성 데이터가 있고, 새로 생성/수정된 레코드와 다른 경우에만 비활성화
        if (existingData && existingData.id !== newSettings.id) {
          await pgQuery(
            `UPDATE sales_office_cost_settings
             SET is_active = false, effective_to = $1
             WHERE id = $2`,
            [effectiveFromDate, existingData.id]
          );
        }

        results.push({
          sales_office,
          success: true,
          settings: newSettings
        });

      } catch (error) {
        console.error(`❌ [SALES-OFFICE-SETTINGS] ${setting.sales_office} 오류:`, error);
        errors.push(`${setting.sales_office}: 처리 중 오류 발생`);
      }
    }

    // 변경 히스토리 기록 (성공한 건만) - Direct PostgreSQL
    if (results.length > 0) {
      await pgQuery(
        `INSERT INTO pricing_change_history (
          table_name, record_id, change_type, new_values, changed_fields,
          change_reason, user_id, user_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'sales_office_cost_settings',
          results[0].settings.id,
          'commission_batch_update',
          JSON.stringify({ updated_offices: results.map(r => r.sales_office) }),
          JSON.stringify(['commission_type', 'commission_percentage', 'commission_per_unit']),
          change_reason || '영업점 비용 설정 일괄 업데이트',
          userId,
          decoded.name || decoded.username || '알 수 없음'
        ]
      );
    }

    console.log(`✅ [SALES-OFFICE-SETTINGS] 일괄 업데이트 완료: ${results.length}개 성공, ${errors.length}개 실패`);

    return NextResponse.json({
      success: true,
      data: {
        updated: results,
        errors: errors,
        total_processed: settings.length,
        success_count: results.length,
        error_count: errors.length
      },
      message: `${results.length}개 영업점 설정이 성공적으로 업데이트되었습니다.`
    });

  } catch (error) {
    console.error('❌ [SALES-OFFICE-SETTINGS] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 영업점별 비용 설정 삭제
export async function DELETE(request: NextRequest) {
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

    // 권한 3 이상 확인 (원가 관리)
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    // URL에서 ID 추출
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
      'SELECT * FROM sales_office_cost_settings WHERE id = $1',
      [id]
    );

    if (!existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 비활성화 처리 - Direct PostgreSQL
    const today = new Date().toISOString().split('T')[0];
    await pgQuery(
      `UPDATE sales_office_cost_settings
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
        'sales_office_cost_settings',
        id,
        'DELETE',
        JSON.stringify(existingData),
        `영업점 비용 설정 삭제: ${existingData.sales_office}`,
        userId,
        decoded.name || decoded.username || '알 수 없음',
        permissionLevel
      ]
    );

    console.log(`🗑️ [SALES-OFFICE-SETTINGS] 삭제 완료:`, existingData.sales_office);

    return NextResponse.json({
      success: true,
      message: '영업점 비용 설정이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('❌ [SALES-OFFICE-SETTINGS] DELETE API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}