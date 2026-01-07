// app/api/revenue/dealer-pricing/route.ts - 대리점 가격 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, query as pgQuery } from '@/lib/supabase-direct';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [DEALER-PRICING] GET 요청 시작');

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

    // 활성 상태인 대리점 가격 목록 조회 - Direct PostgreSQL
    const data = await queryAll(
      `SELECT * FROM dealer_pricing
       WHERE is_active = true
       ORDER BY equipment_type ASC, equipment_name ASC`
    );

    console.log(`✅ [DEALER-PRICING] 조회 성공: ${data?.length || 0}개`);

    return NextResponse.json({
      success: true,
      data: data || [],
      message: `대리점 가격 ${data?.length || 0}개 조회 완료`
    });

  } catch (error) {
    console.error('❌ [DEALER-PRICING] GET 오류:', error);
    return NextResponse.json({
      success: false,
      message: '대리점 가격 조회 중 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('📊 [DEALER-PRICING] POST 요청 시작');

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
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 3 이상 확인 (원가 관리)
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();

    // 필수 필드 검증
    if (!body.equipment_type || !body.equipment_name ||
        !body.cost_price || !body.dealer_cost_price || !body.dealer_selling_price ||
        !body.effective_from) {
      return NextResponse.json({
        success: false,
        message: '필수 항목을 모두 입력해주세요 (기기 유형, 기기명, 원가, 공급가, 판매가, 시행일)'
      }, { status: 400 });
    }

    // 마진율 자동 계산
    const margin_rate = ((body.dealer_selling_price - body.dealer_cost_price) / body.dealer_cost_price * 100).toFixed(2);

    // 새 데이터 삽입 - Direct PostgreSQL
    const insertQuery = `
      INSERT INTO dealer_pricing (
        equipment_type, equipment_name, cost_price, dealer_cost_price, dealer_selling_price,
        margin_rate, manufacturer, effective_from, effective_to, notes, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const insertResult = await pgQuery(insertQuery, [
      body.equipment_type,
      body.equipment_name,
      parseInt(body.cost_price),
      parseInt(body.dealer_cost_price),
      parseInt(body.dealer_selling_price),
      parseFloat(margin_rate),
      body.manufacturer || null,
      body.effective_from,
      body.effective_to || null,
      body.notes || null,
      body.is_active !== undefined ? body.is_active : true
    ]);

    if (!insertResult.rows || insertResult.rows.length === 0) {
      console.error('❌ [DEALER-PRICING] 삽입 실패');
      return NextResponse.json({
        success: false,
        message: '대리점 가격 추가 실패'
      }, { status: 500 });
    }

    const data = insertResult.rows[0];
    console.log('✅ [DEALER-PRICING] 삽입 성공:', data.id);

    return NextResponse.json({
      success: true,
      data,
      message: '대리점 가격이 성공적으로 추가되었습니다'
    });

  } catch (error) {
    console.error('❌ [DEALER-PRICING] POST 오류:', error);
    return NextResponse.json({
      success: false,
      message: '대리점 가격 추가 중 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    console.log('📊 [DEALER-PRICING] PUT 요청 시작');

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
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 3 이상 확인
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({
        success: false,
        message: '수정할 항목의 ID가 필요합니다'
      }, { status: 400 });
    }

    // 마진율 재계산
    let margin_rate = null;
    if (body.dealer_cost_price && body.dealer_selling_price) {
      margin_rate = parseFloat(((body.dealer_selling_price - body.dealer_cost_price) / body.dealer_cost_price * 100).toFixed(2));
    }

    // Dynamic UPDATE 필드 구성 - Direct PostgreSQL
    const updateFields: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (body.equipment_type !== undefined) {
      updateFields.push(`equipment_type = $${paramIndex}`);
      params.push(body.equipment_type);
      paramIndex++;
    }
    if (body.equipment_name !== undefined) {
      updateFields.push(`equipment_name = $${paramIndex}`);
      params.push(body.equipment_name);
      paramIndex++;
    }
    if (body.cost_price !== undefined) {
      updateFields.push(`cost_price = $${paramIndex}`);
      params.push(parseInt(body.cost_price));
      paramIndex++;
    }
    if (body.dealer_cost_price !== undefined) {
      updateFields.push(`dealer_cost_price = $${paramIndex}`);
      params.push(parseInt(body.dealer_cost_price));
      paramIndex++;
    }
    if (body.dealer_selling_price !== undefined) {
      updateFields.push(`dealer_selling_price = $${paramIndex}`);
      params.push(parseInt(body.dealer_selling_price));
      paramIndex++;
    }
    if (margin_rate !== null) {
      updateFields.push(`margin_rate = $${paramIndex}`);
      params.push(margin_rate);
      paramIndex++;
    }
    if (body.manufacturer !== undefined) {
      updateFields.push(`manufacturer = $${paramIndex}`);
      params.push(body.manufacturer);
      paramIndex++;
    }
    if (body.effective_from !== undefined) {
      updateFields.push(`effective_from = $${paramIndex}`);
      params.push(body.effective_from);
      paramIndex++;
    }
    if (body.effective_to !== undefined) {
      updateFields.push(`effective_to = $${paramIndex}`);
      params.push(body.effective_to);
      paramIndex++;
    }
    if (body.notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`);
      params.push(body.notes);
      paramIndex++;
    }
    if (body.is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      params.push(body.is_active);
      paramIndex++;
    }

    if (updateFields.length === 1) {
      return NextResponse.json({
        success: false,
        message: '수정할 내용이 없습니다.'
      }, { status: 400 });
    }

    // WHERE 조건용 파라미터 추가
    params.push(body.id);

    const updateQuery = `
      UPDATE dealer_pricing
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await pgQuery(updateQuery, params);

    if (!updateResult.rows || updateResult.rows.length === 0) {
      console.error('❌ [DEALER-PRICING] 업데이트 실패');
      return NextResponse.json({
        success: false,
        message: '대리점 가격 수정 실패'
      }, { status: 500 });
    }

    const data = updateResult.rows[0];
    console.log('✅ [DEALER-PRICING] 업데이트 성공:', data.id);

    return NextResponse.json({
      success: true,
      data,
      message: '대리점 가격이 성공적으로 수정되었습니다'
    });

  } catch (error) {
    console.error('❌ [DEALER-PRICING] PUT 오류:', error);
    return NextResponse.json({
      success: false,
      message: '대리점 가격 수정 중 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('📊 [DEALER-PRICING] DELETE 요청 시작');

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
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

    // 권한 3 이상 확인
    if (!permissionLevel || permissionLevel < 3) {
      return NextResponse.json({
        success: false,
        message: '원가 관리 권한이 필요합니다.'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        message: '삭제할 항목의 ID가 필요합니다'
      }, { status: 400 });
    }

    // 소프트 삭제 (is_active = false) - Direct PostgreSQL
    const deleteResult = await pgQuery(
      `UPDATE dealer_pricing
       SET is_active = false
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (!deleteResult.rowCount || deleteResult.rowCount === 0) {
      console.error('❌ [DEALER-PRICING] 삭제 실패:', id);
      return NextResponse.json({
        success: false,
        message: '대리점 가격 삭제 실패'
      }, { status: 500 });
    }

    console.log('✅ [DEALER-PRICING] 삭제 성공:', id);

    return NextResponse.json({
      success: true,
      message: '대리점 가격이 성공적으로 삭제되었습니다'
    });

  } catch (error) {
    console.error('❌ [DEALER-PRICING] DELETE 오류:', error);
    return NextResponse.json({
      success: false,
      message: '대리점 가격 삭제 중 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}
