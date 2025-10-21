import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
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

    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, permission_level')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
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

    let query = supabaseAdmin
      .from('equipment_installation_cost')
      .select('*')
      .order('equipment_name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: costs, error } = await query;

    if (error) {
      console.error('❌ [INSTALLATION-COST] 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '기본 설치비 조회에 실패했습니다.'
      }, { status: 500 });
    }

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

    const { data: existingData } = await supabaseAdmin
      .from('equipment_installation_cost')
      .select('*')
      .eq('equipment_type', equipment_type)
      .eq('is_active', true)
      .single();

    const insertData = {
      equipment_type,
      equipment_name,
      base_installation_cost,
      effective_from,
      effective_to,
      notes,
      created_by: userId,
      is_active: true
    };

    const { data: newCost, error: insertError } = await supabaseAdmin
      .from('equipment_installation_cost')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [INSTALLATION-COST] 삽입 오류:', insertError);
      return NextResponse.json({
        success: false,
        message: '기본 설치비 저장에 실패했습니다.'
      }, { status: 500 });
    }

    if (existingData) {
      await supabaseAdmin
        .from('equipment_installation_cost')
        .update({
          is_active: false,
          effective_to: effective_from
        })
        .eq('id', existingData.id);
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

    // 기존 데이터 조회
    const { data: existingData, error: fetchError } = await supabaseAdmin
      .from('equipment_installation_cost')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 업데이트할 데이터 준비 (equipment_type은 수정 불가)
    const updateData: any = {};

    if (base_installation_cost !== undefined) updateData.base_installation_cost = base_installation_cost;
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

    // 레코드 업데이트
    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from('equipment_installation_cost')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [INSTALLATION-COST] 수정 오류:', updateError);
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

    const { data: existingData, error: fetchError } = await supabaseAdmin
      .from('equipment_installation_cost')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('equipment_installation_cost')
      .update({
        is_active: false,
        effective_to: new Date().toISOString().split('T')[0]
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ [INSTALLATION-COST] 삭제 오류:', updateError);
      return NextResponse.json({
        success: false,
        message: '기본 설치비 삭제에 실패했습니다.'
      }, { status: 500 });
    }

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
