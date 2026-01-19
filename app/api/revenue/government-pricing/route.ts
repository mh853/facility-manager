import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, query as pgQuery } from '@/lib/supabase-direct';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GovernmentPricingData {
  equipment_type: string;
  equipment_name: string;
  official_price: number;
  manufacturer_price?: number;
  installation_cost?: number;
  effective_from: string;
  effective_to?: string;
  announcement_number?: string;
}

// 환경부 고시가 목록 조회
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
      console.log('❌ [GOVERNMENT-PRICING] 사용자 조회 실패');
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 401 });
    }

    const permissionLevel = user.permission_level;

    console.log('🔍 [GOVERNMENT-PRICING] 토큰 검증:', { userId, permissionLevel });

    // 권한 2 이상 확인 (매출 조회)
    if (!permissionLevel || permissionLevel < 2) {
      console.log('❌ [GOVERNMENT-PRICING] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '매출 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    // URL 파라미터 처리
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    const equipmentType = url.searchParams.get('equipment_type');

    // 환경부 고시가 조회 - Direct PostgreSQL
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // is_active filter
    if (!includeInactive) {
      whereClauses.push(`is_active = true`);
    }

    // 날짜 조건 제거: 시스템이 is_active=true인 최신 데이터만 사용
    // (revenue-calculate-api-date-filter-fix.md 참조)

    // equipment_type filter
    if (equipmentType) {
      whereClauses.push(`equipment_type = $${paramIndex}`);
      params.push(equipmentType);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const sqlQuery = `
      SELECT * FROM government_pricing
      ${whereClause}
      ORDER BY equipment_name ASC
    `;

    const pricing = await queryAll(sqlQuery, params);

    console.log(`📊 [GOVERNMENT-PRICING] 조회 완료: ${pricing?.length || 0}개`);

    return NextResponse.json({
      success: true,
      data: {
        pricing: pricing || [],
        total_count: pricing?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ [GOVERNMENT-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 환경부 고시가 생성/수정
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

    console.log('🔍 [GOVERNMENT-PRICING] 토큰 검증:', { userId, permissionLevel });

    // 권한 3 이상 확인 (원가 관리)
    if (!permissionLevel || permissionLevel < 3) {
      console.log('❌ [GOVERNMENT-PRICING] 권한 부족:', { permissionLevel });
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      equipment_type,
      equipment_name,
      official_price,
      manufacturer_price,
      installation_cost,
      effective_from,
      effective_to,
      announcement_number,
      change_reason
    }: GovernmentPricingData & { change_reason?: string } = body;

    // 입력 값 검증
    if (!equipment_type || !equipment_name || !official_price || !effective_from) {
      return NextResponse.json({
        success: false,
        message: '필수 필드가 누락되었습니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 (히스토리 용) - Direct PostgreSQL
    const existingData = await queryOne(
      'SELECT * FROM government_pricing WHERE equipment_type = $1 AND is_active = true',
      [equipment_type]
    );

    // 새 데이터 삽입 - Direct PostgreSQL
    const newPricing = await queryOne(
      `INSERT INTO government_pricing (
        equipment_type, equipment_name, official_price, manufacturer_price,
        installation_cost, effective_from, effective_to, announcement_number,
        created_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *`,
      [
        equipment_type,
        equipment_name,
        official_price,
        manufacturer_price || 0,
        installation_cost || 0,
        effective_from,
        effective_to || null,
        announcement_number || null,
        userId
      ]
    );

    if (!newPricing) {
      console.error('❌ [GOVERNMENT-PRICING] 삽입 오류');
      return NextResponse.json({
        success: false,
        message: '환경부 고시가 저장에 실패했습니다.'
      }, { status: 500 });
    }

    // 기존 데이터가 있다면 비활성화 - Direct PostgreSQL
    if (existingData) {
      await pgQuery(
        `UPDATE government_pricing
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
          'government_pricing',
          newPricing.id,
          'price_update',
          JSON.stringify(existingData),
          JSON.stringify(newPricing),
          JSON.stringify(['official_price', 'manufacturer_price', 'installation_cost']),
          change_reason || '원가 업데이트',
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
        'government_pricing',
        newPricing.id,
        'INSERT',
        JSON.stringify(newPricing),
        `환경부 고시가 ${existingData ? '수정' : '생성'}: ${equipment_name}`,
        userId,
        decoded.name || decoded.username || '알 수 없음',
        permissionLevel
      ]
    );

    console.log(`✅ [GOVERNMENT-PRICING] ${existingData ? '수정' : '생성'} 완료:`, equipment_name);

    return NextResponse.json({
      success: true,
      data: {
        pricing: newPricing,
        is_update: !!existingData
      },
      message: `환경부 고시가가 성공적으로 ${existingData ? '수정' : '생성'}되었습니다.`
    });

  } catch (error) {
    console.error('❌ [GOVERNMENT-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 환경부 고시가 삭제 (비활성화)
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

    // 권한 3 이상 확인
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();
    const { id, delete_reason } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'ID가 필요합니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 - Direct PostgreSQL
    const existingData = await queryOne(
      'SELECT * FROM government_pricing WHERE id = $1',
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
      `UPDATE government_pricing
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
        'government_pricing',
        id,
        'DELETE',
        JSON.stringify(existingData),
        `환경부 고시가 삭제: ${existingData.equipment_name}`,
        userId,
        decoded.name || decoded.username || '알 수 없음',
        permissionLevel
      ]
    );

    console.log(`🗑️ [GOVERNMENT-PRICING] 삭제 완료:`, existingData.equipment_name);

    return NextResponse.json({
      success: true,
      message: '환경부 고시가가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('❌ [GOVERNMENT-PRICING] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}