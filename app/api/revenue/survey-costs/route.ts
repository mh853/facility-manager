import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
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

    // DB에서 사용자 정보 조회하여 최신 권한 확인
    const { data: user, error: userError } = await supabaseAdmin
      .from('employees')
      .select('id, permission_level')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      console.log('❌ [SURVEY-COSTS] 사용자 조회 실패:', userError);
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

    // 실사비용 조회
    let query = supabaseAdmin
      .from('survey_cost_settings')
      .select('*')
      .order('survey_type', { ascending: true })
      .order('effective_from', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (surveyType) {
      query = query.eq('survey_type', surveyType);
    }

    const { data: costs, error } = await query;

    if (error) {
      console.error('❌ [SURVEY-COSTS] 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '실사비용 조회에 실패했습니다.'
      }, { status: 500 });
    }

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

    // 기존 데이터 조회 (히스토리 용)
    const { data: existingData } = await supabaseAdmin
      .from('survey_cost_settings')
      .select('*')
      .eq('survey_type', survey_type)
      .eq('is_active', true)
      .single();

    // 새 데이터 삽입
    const insertData = {
      survey_type,
      survey_name,
      base_cost,
      effective_from,
      effective_to,
      created_by: userId,
      is_active: true
    };

    const { data: newCost, error: insertError } = await supabaseAdmin
      .from('survey_cost_settings')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [SURVEY-COSTS] 삽입 오류:', insertError);
      return NextResponse.json({
        success: false,
        message: '실사비용 저장에 실패했습니다.'
      }, { status: 500 });
    }

    // 기존 데이터가 있다면 비활성화
    if (existingData) {
      await supabaseAdmin
        .from('survey_cost_settings')
        .update({
          is_active: false,
          effective_to: effective_from
        })
        .eq('id', existingData.id);

      // 원가 변경 히스토리 기록
      await supabaseAdmin
        .from('pricing_change_history')
        .insert({
          table_name: 'survey_cost_settings',
          record_id: newCost.id,
          change_type: 'cost_update',
          old_values: existingData,
          new_values: newCost,
          changed_fields: ['base_cost'],
          change_reason: change_reason || '실사비용 업데이트',
          user_id: userId,
          user_name: decoded.name || decoded.username || '알 수 없음'
        });
    }

    // 감사 로그 기록
    await supabaseAdmin
      .from('revenue_audit_log')
      .insert({
        table_name: 'survey_cost_settings',
        record_id: newCost.id,
        action_type: 'INSERT',
        new_values: newCost,
        action_description: `실사비용 ${existingData ? '수정' : '생성'}: ${survey_name}`,
        user_id: userId,
        user_name: decoded.name || decoded.username || '알 수 없음',
        user_permission_level: permissionLevel
      });

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

    // 기존 데이터 조회
    const { data: existingData, error: fetchError } = await supabaseAdmin
      .from('survey_cost_settings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 업데이트할 데이터 준비 (survey_type은 수정 불가)
    const updateData: any = {};

    if (survey_name !== undefined) updateData.survey_name = survey_name;
    if (base_cost !== undefined) updateData.base_cost = base_cost;
    if (effective_from !== undefined) updateData.effective_from = effective_from;
    if (effective_to !== undefined) updateData.effective_to = effective_to;

    // 수정할 내용이 없으면 에러
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: false,
        message: '수정할 내용이 없습니다.'
      }, { status: 400 });
    }

    // 레코드 업데이트
    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from('survey_cost_settings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [SURVEY-COSTS] 수정 오류:', updateError);
      return NextResponse.json({
        success: false,
        message: '실사비용 수정에 실패했습니다.'
      }, { status: 500 });
    }

    // 변경 이력 기록
    await supabaseAdmin
      .from('pricing_change_history')
      .insert({
        table_name: 'survey_cost_settings',
        record_id: id,
        change_type: 'cost_update',
        old_values: existingData,
        new_values: updatedData,
        changed_fields: Object.keys(updateData),
        change_reason: '실사비용 수정',
        user_id: userId,
        user_name: decoded.name || decoded.username || '알 수 없음'
      });

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

    // 기존 데이터 조회
    const { data: existingData, error: fetchError } = await supabaseAdmin
      .from('survey_cost_settings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingData) {
      return NextResponse.json({
        success: false,
        message: '해당 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 비활성화 (실제 삭제하지 않음)
    const { error: deleteError } = await supabaseAdmin
      .from('survey_cost_settings')
      .update({
        is_active: false,
        effective_to: new Date().toISOString().split('T')[0]
      })
      .eq('id', id);

    if (deleteError) {
      console.error('❌ [SURVEY-COSTS] 삭제 오류:', deleteError);
      return NextResponse.json({
        success: false,
        message: '실사비용 삭제에 실패했습니다.'
      }, { status: 500 });
    }

    // 감사 로그 기록
    await supabaseAdmin
      .from('revenue_audit_log')
      .insert({
        table_name: 'survey_cost_settings',
        record_id: id,
        action_type: 'DELETE',
        old_values: existingData,
        action_description: `실사비용 삭제: ${existingData.survey_name}`,
        user_id: userId,
        user_name: decoded.name || decoded.username || '알 수 없음',
        user_permission_level: permissionLevel
      });

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
