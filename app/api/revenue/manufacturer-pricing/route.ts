import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, query as pgQuery } from '@/lib/supabase-direct';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ManufacturerPricingData {
  equipment_type: string;
  equipment_name: string;
  manufacturer: 'ecosense' | 'cleanearth' | 'gaia_cns' | 'evs';
  cost_price: number;
  effective_from: string;
  effective_to?: string;
  notes?: string;
}

// 제조사별 원가 목록 조회
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
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 401 });
    }

    const permissionLevel = user.permission_level;

    // 권한 2 이상 확인 (매출 조회)
    if (!permissionLevel || permissionLevel < 2) {
      return NextResponse.json({
        success: false,
        message: '매출 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    // URL 파라미터 처리
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    const manufacturer = url.searchParams.get('manufacturer');
    const equipmentType = url.searchParams.get('equipment_type');

    // 제조사별 원가 조회 - Direct PostgreSQL
    console.log('🔍 [MANUFACTURER-PRICING] Direct PostgreSQL 조회 시작');

    // Build WHERE clause dynamically
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // is_active filter
    if (!includeInactive) {
      whereClauses.push(`is_active = true`);
    }

    // 날짜 조건 제거: 시스템이 is_active=true인 최신 데이터만 사용
    // (revenue-calculate-api-date-filter-fix.md 참조)

    // manufacturer filter
    if (manufacturer) {
      whereClauses.push(`manufacturer = $${paramIndex}`);
      params.push(manufacturer);
      paramIndex++;
    }

    // equipment_type filter
    if (equipmentType) {
      whereClauses.push(`equipment_type = $${paramIndex}`);
      params.push(equipmentType);
      paramIndex++;
    }

    const whereClause = whereClauses.join(' AND ');

    const queryText = `
      SELECT *
      FROM manufacturer_pricing
      WHERE ${whereClause}
      ORDER BY manufacturer ASC, equipment_name ASC
    `;

    const pricing = await queryAll(queryText, params);
    console.log(`✅ [MANUFACTURER-PRICING] 조회 완료: ${pricing.length}개 항목`);

    return NextResponse.json({
      success: true,
      data: {
        pricing: pricing || [],
        total_count: pricing?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ [MANUFACTURER-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 제조사별 원가 생성/수정
export async function POST(request: NextRequest) {
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
      equipment_type,
      equipment_name,
      manufacturer,
      cost_price,
      effective_from,
      effective_to,
      notes
    }: ManufacturerPricingData = body;

    // 입력 값 검증
    if (!equipment_type || !equipment_name || !manufacturer || !cost_price || !effective_from) {
      return NextResponse.json({
        success: false,
        message: '필수 필드가 누락되었습니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 - Direct PostgreSQL
    console.log('🔍 [MANUFACTURER-PRICING] POST - 기존 데이터 조회');
    const existingData = await queryOne(
      `SELECT * FROM manufacturer_pricing
       WHERE equipment_type = $1 AND manufacturer = $2 AND is_active = true`,
      [equipment_type, manufacturer]
    );

    // 새 데이터 삽입 - Direct PostgreSQL
    console.log('📝 [MANUFACTURER-PRICING] POST - 새 데이터 삽입');
    const insertQuery = `
      INSERT INTO manufacturer_pricing (
        equipment_type, equipment_name, manufacturer, cost_price,
        effective_from, effective_to, notes, created_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *
    `;

    const insertResult = await pgQuery(insertQuery, [
      equipment_type,
      equipment_name,
      manufacturer,
      cost_price,
      effective_from,
      effective_to || null,
      notes || null,
      userId
    ]);

    if (!insertResult.rows || insertResult.rows.length === 0) {
      console.error('❌ [MANUFACTURER-PRICING] 삽입 실패');
      return NextResponse.json({
        success: false,
        message: '제조사별 원가 저장에 실패했습니다.'
      }, { status: 500 });
    }

    const newPricing = insertResult.rows[0];
    console.log('✅ [MANUFACTURER-PRICING] POST - 삽입 완료:', newPricing.id);

    // 기존 데이터가 있다면 비활성화 - Direct PostgreSQL
    if (existingData) {
      console.log('🔄 [MANUFACTURER-PRICING] POST - 기존 데이터 비활성화');
      await pgQuery(
        `UPDATE manufacturer_pricing
         SET is_active = false, effective_to = $1
         WHERE id = $2`,
        [effective_from, existingData.id]
      );

      // 원가 변경 히스토리 기록 - Direct PostgreSQL
      console.log('📊 [MANUFACTURER-PRICING] POST - 히스토리 기록');
      await pgQuery(
        `INSERT INTO pricing_change_history (
          table_name, record_id, change_type, old_values, new_values,
          changed_fields, change_reason, user_id, user_name
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'manufacturer_pricing',
          newPricing.id,
          'cost_update',
          JSON.stringify(existingData),
          JSON.stringify(newPricing),
          JSON.stringify(['cost_price']),
          notes || '제조사 원가 업데이트',
          userId,
          decoded.name || decoded.username || '알 수 없음'
        ]
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        pricing: newPricing,
        is_update: !!existingData
      },
      message: `제조사별 원가가 성공적으로 ${existingData ? '수정' : '생성'}되었습니다.`
    });

  } catch (error) {
    console.error('❌ [MANUFACTURER-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 제조사별 원가 수정 (기존 레코드 업데이트)
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
      cost_price,
      effective_from,
      effective_to,
      notes
    } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'ID가 필요합니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 - Direct PostgreSQL
    console.log('🔍 [MANUFACTURER-PRICING] PATCH - 기존 데이터 조회:', id);
    const existingData = await queryOne(
      'SELECT * FROM manufacturer_pricing WHERE id = $1',
      [id]
    );

    if (!existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 업데이트할 데이터 준비 (equipment_type, manufacturer는 수정 불가)
    const updateData: any = {};

    if (cost_price !== undefined) updateData.cost_price = cost_price;
    if (effective_from !== undefined) updateData.effective_from = effective_from;
    if (effective_to !== undefined) updateData.effective_to = effective_to;
    if (notes !== undefined) updateData.notes = notes;

    // 수정할 내용이 없으면 에러
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: false,
        message: '수정할 내용이 없습니다.'
      }, { status: 400 });
    }

    // 레코드 업데이트 - Direct PostgreSQL
    console.log('📝 [MANUFACTURER-PRICING] PATCH - 데이터 업데이트');
    const updateFields = Object.keys(updateData);
    const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = updateFields.map(field => updateData[field]);
    values.push(id); // Add id as the last parameter

    const updateQuery = `
      UPDATE manufacturer_pricing
      SET ${setClause}
      WHERE id = $${values.length}
      RETURNING *
    `;

    const updateResult = await pgQuery(updateQuery, values);

    if (!updateResult.rows || updateResult.rows.length === 0) {
      console.error('❌ [MANUFACTURER-PRICING] 수정 실패');
      return NextResponse.json({
        success: false,
        message: '제조사별 원가 수정에 실패했습니다.'
      }, { status: 500 });
    }

    const updatedData = updateResult.rows[0];
    console.log('✅ [MANUFACTURER-PRICING] PATCH - 업데이트 완료:', id);

    // 변경 이력 기록 (원가가 변경된 경우에만) - Direct PostgreSQL
    if (cost_price !== undefined && cost_price !== existingData.cost_price) {
      console.log('📊 [MANUFACTURER-PRICING] PATCH - 히스토리 기록');
      await pgQuery(
        `INSERT INTO pricing_change_history (
          table_name, record_id, change_type, old_values, new_values,
          changed_fields, change_reason, user_id, user_name
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'manufacturer_pricing',
          id,
          'cost_update',
          JSON.stringify({
            cost_price: existingData.cost_price,
            effective_from: existingData.effective_from,
            effective_to: existingData.effective_to,
            notes: existingData.notes
          }),
          JSON.stringify({
            cost_price: updatedData.cost_price,
            effective_from: updatedData.effective_from,
            effective_to: updatedData.effective_to,
            notes: updatedData.notes
          }),
          JSON.stringify(['cost_price']),
          notes || `원가 변경: ${existingData.cost_price} → ${cost_price}`,
          userId,
          decoded.name || decoded.username || '알 수 없음'
        ]
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedData,
      message: '제조사별 원가가 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('❌ [MANUFACTURER-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 제조사별 원가 삭제 (비활성화)
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

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'ID가 필요합니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 - Direct PostgreSQL
    console.log('🔍 [MANUFACTURER-PRICING] DELETE - 기존 데이터 조회:', id);
    const existingData = await queryOne(
      'SELECT * FROM manufacturer_pricing WHERE id = $1',
      [id]
    );

    if (!existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 비활성화 처리 - Direct PostgreSQL
    console.log('📝 [MANUFACTURER-PRICING] DELETE - 비활성화 처리');
    const today = new Date().toISOString().split('T')[0];

    const deleteResult = await pgQuery(
      `UPDATE manufacturer_pricing
       SET is_active = false, effective_to = $1
       WHERE id = $2`,
      [today, id]
    );

    if (!deleteResult.rowCount || deleteResult.rowCount === 0) {
      console.error('❌ [MANUFACTURER-PRICING] 삭제 실패');
      return NextResponse.json({
        success: false,
        message: '제조사별 원가 삭제에 실패했습니다.'
      }, { status: 500 });
    }

    console.log('✅ [MANUFACTURER-PRICING] DELETE - 삭제 완료:', id);

    return NextResponse.json({
      success: true,
      message: '제조사별 원가가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('❌ [MANUFACTURER-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
