import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
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

    // 토큰에서 사용자 정보 추출
    const userId = decoded.userId || decoded.id;
    const permissionLevel = decoded.permissionLevel || decoded.permission_level;

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

    // 영업점별 비용 설정 조회
    let query = supabaseAdmin
      .from('sales_office_cost_settings')
      .select('*')
      .order('sales_office', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (salesOffice) {
      query = query.eq('sales_office', salesOffice);
    }

    const { data: settings, error } = await query;

    if (error) {
      console.error('❌ [SALES-OFFICE-SETTINGS] 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '영업점 비용 설정 조회에 실패했습니다.'
      }, { status: 500 });
    }

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

    // 방식별 필수 값 검증
    if (commission_type === 'percentage' && !commission_percentage) {
      return NextResponse.json({
        success: false,
        message: '퍼센트 방식의 경우 commission_percentage가 필요합니다.'
      }, { status: 400 });
    }

    if (commission_type === 'per_unit' && !commission_per_unit) {
      return NextResponse.json({
        success: false,
        message: '단가 방식의 경우 commission_per_unit이 필요합니다.'
      }, { status: 400 });
    }

    // 기존 데이터 조회 (히스토리 용)
    const { data: existingData } = await supabaseAdmin
      .from('sales_office_cost_settings')
      .select('*')
      .eq('sales_office', sales_office)
      .eq('is_active', true)
      .single();

    // 새 데이터 삽입
    const insertData = {
      sales_office,
      commission_type,
      commission_percentage: commission_type === 'percentage' ? commission_percentage : null,
      commission_per_unit: commission_type === 'per_unit' ? commission_per_unit : null,
      effective_from,
      effective_to,
      created_by: userId,
      is_active: true
    };

    const { data: newSettings, error: insertError } = await supabaseAdmin
      .from('sales_office_cost_settings')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [SALES-OFFICE-SETTINGS] 삽입 오류:', insertError);
      return NextResponse.json({
        success: false,
        message: '영업점 비용 설정 저장에 실패했습니다.'
      }, { status: 500 });
    }

    // 기존 데이터가 있다면 비활성화
    if (existingData) {
      await supabaseAdmin
        .from('sales_office_cost_settings')
        .update({
          is_active: false,
          effective_to: effective_from
        })
        .eq('id', existingData.id);

      // 원가 변경 히스토리 기록
      await supabaseAdmin
        .from('pricing_change_history')
        .insert({
          table_name: 'sales_office_cost_settings',
          record_id: newSettings.id,
          change_type: 'commission_update',
          old_values: existingData,
          new_values: newSettings,
          changed_fields: ['commission_type', 'commission_percentage', 'commission_per_unit'],
          change_reason: change_reason || '영업비용 설정 업데이트',
          user_id: userId,
          user_name: decoded.name || decoded.username || '알 수 없음'
        });
    }

    // 감사 로그 기록
    await supabaseAdmin
      .from('revenue_audit_log')
      .insert({
        table_name: 'sales_office_cost_settings',
        record_id: newSettings.id,
        action_type: 'INSERT',
        new_values: newSettings,
        action_description: `영업점 비용 설정 ${existingData ? '수정' : '생성'}: ${sales_office}`,
        user_id: userId,
        user_name: decoded.name || decoded.username || '알 수 없음',
        user_permission_level: permissionLevel
      });

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

        // 기존 데이터 조회
        const { data: existingData } = await supabaseAdmin
          .from('sales_office_cost_settings')
          .select('*')
          .eq('sales_office', sales_office)
          .eq('is_active', true)
          .single();

        // 새 데이터 삽입
        const insertData = {
          sales_office,
          commission_type,
          commission_percentage: commission_type === 'percentage' ? commission_percentage : null,
          commission_per_unit: commission_type === 'per_unit' ? commission_per_unit : null,
          effective_from: effective_from || new Date().toISOString().split('T')[0],
          created_by: userId,
          is_active: true
        };

        const { data: newSettings, error: insertError } = await supabaseAdmin
          .from('sales_office_cost_settings')
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          errors.push(`${sales_office}: ${insertError.message}`);
          continue;
        }

        // 기존 데이터 비활성화
        if (existingData) {
          await supabaseAdmin
            .from('sales_office_cost_settings')
            .update({
              is_active: false,
              effective_to: insertData.effective_from
            })
            .eq('id', existingData.id);
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

    // 변경 히스토리 기록 (성공한 건만)
    if (results.length > 0) {
      await supabaseAdmin
        .from('pricing_change_history')
        .insert({
          table_name: 'sales_office_cost_settings',
          record_id: results[0].settings.id, // 대표 ID
          change_type: 'commission_batch_update',
          new_values: { updated_offices: results.map(r => r.sales_office) },
          changed_fields: ['commission_type', 'commission_percentage', 'commission_per_unit'],
          change_reason: change_reason || '영업점 비용 설정 일괄 업데이트',
          user_id: userId,
          user_name: decoded.name || decoded.username || '알 수 없음'
        });
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