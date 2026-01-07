import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, query as pgQuery } from '@/lib/supabase-direct';
import { verifyTokenString } from '@/utils/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface InstallationCostData {
  equipment_type: string;
  equipment_name: string;
  base_installation_cost: number;
  effective_from: string;
  effective_to?: string;
  notes?: string;
}

// 기기별 기본 설치비 조회
export async function GET(request: NextRequest) {
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

    if (!permissionLevel || permissionLevel < 2) {
      return NextResponse.json({
        success: false,
        message: '매출 조회 권한이 필요합니다.'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    const today = new Date().toISOString().split('T')[0];

    // 기본 설치비 조회 - Direct PostgreSQL
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (!includeInactive) {
      whereClauses.push(`is_active = true`);
    }

    // effective date filters
    whereClauses.push(`effective_from <= $${paramIndex}`);
    params.push(today);
    paramIndex++;

    whereClauses.push(`(effective_to IS NULL OR effective_to >= $${paramIndex})`);
    params.push(today);
    paramIndex++;

    const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const sqlQuery = `
      SELECT * FROM equipment_installation_cost
      ${whereClause}
      ORDER BY equipment_name ASC
    `;

    const costs = await queryAll(sqlQuery, params);

    return NextResponse.json({
      success: true,
      data: {
        costs: costs || [],
        total_count: costs?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ [INSTALLATION-COST] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 기본 설치비 생성/수정
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
      base_installation_cost,
      effective_from,
      effective_to,
      notes
    }: InstallationCostData = body;

    if (!equipment_type || !equipment_name || base_installation_cost === undefined || !effective_from) {
      return NextResponse.json({
        success: false,
        message: '필수 필드가 누락되었습니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 - Direct PostgreSQL
    const existingData = await queryOne(
      'SELECT * FROM equipment_installation_cost WHERE equipment_type = $1 AND is_active = true',
      [equipment_type]
    );

    // 새 데이터 삽입 - Direct PostgreSQL
    const newCost = await queryOne(
      `INSERT INTO equipment_installation_cost (
        equipment_type, equipment_name, base_installation_cost,
        effective_from, effective_to, notes, created_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *`,
      [
        equipment_type,
        equipment_name,
        base_installation_cost,
        effective_from,
        effective_to || null,
        notes || null,
        userId
      ]
    );

    if (!newCost) {
      console.error('❌ [INSTALLATION-COST] 삽입 오류');
      return NextResponse.json({
        success: false,
        message: '기본 설치비 저장에 실패했습니다.'
      }, { status: 500 });
    }

    // 기존 데이터가 있다면 비활성화 - Direct PostgreSQL
    if (existingData) {
      await pgQuery(
        `UPDATE equipment_installation_cost
         SET is_active = false, effective_to = $1
         WHERE id = $2`,
        [effective_from, existingData.id]
      );
    }

    console.log(`✅ [INSTALLATION-COST] ${existingData ? '수정' : '생성'} 완료:`, equipment_name);

    return NextResponse.json({
      success: true,
      data: {
        cost: newCost,
        is_update: !!existingData
      },
      message: `기본 설치비가 성공적으로 ${existingData ? '수정' : '생성'}되었습니다.`
    });

  } catch (error) {
    console.error('❌ [INSTALLATION-COST] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 기본 설치비 수정 (기존 레코드 업데이트)
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
      base_installation_cost,
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
    const existingData = await queryOne(
      'SELECT * FROM equipment_installation_cost WHERE id = $1',
      [id]
    );

    if (!existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 업데이트할 데이터 준비 (equipment_type은 수정 불가)
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (base_installation_cost !== undefined) {
      updateFields.push(`base_installation_cost = $${paramIndex}`);
      updateValues.push(base_installation_cost);
      paramIndex++;
    }
    if (effective_from !== undefined) {
      updateFields.push(`effective_from = $${paramIndex}`);
      updateValues.push(effective_from);
      paramIndex++;
    }
    if (effective_to !== undefined) {
      updateFields.push(`effective_to = $${paramIndex}`);
      updateValues.push(effective_to);
      paramIndex++;
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`);
      updateValues.push(notes);
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
      `UPDATE equipment_installation_cost
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    if (!updatedData) {
      console.error('❌ [INSTALLATION-COST] 수정 오류');
      return NextResponse.json({
        success: false,
        message: '기본 설치비 수정에 실패했습니다.'
      }, { status: 500 });
    }

    console.log(`✏️ [INSTALLATION-COST] 수정 완료:`, existingData.equipment_name);

    return NextResponse.json({
      success: true,
      data: updatedData,
      message: '기본 설치비가 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('❌ [INSTALLATION-COST] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 기본 설치비 삭제
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
    const existingData = await queryOne(
      'SELECT * FROM equipment_installation_cost WHERE id = $1',
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
      `UPDATE equipment_installation_cost
       SET is_active = false, effective_to = $1
       WHERE id = $2`,
      [today, id]
    );

    console.log(`🗑️ [INSTALLATION-COST] 삭제 완료:`, existingData.equipment_name);

    return NextResponse.json({
      success: true,
      message: '기본 설치비가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('❌ [INSTALLATION-COST] API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
