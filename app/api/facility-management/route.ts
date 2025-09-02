// app/api/facility-management/route.ts - 시설 관리 통합 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 사업장 시설 관리 정보 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessName = searchParams.get('businessName');
    const businessId = searchParams.get('businessId');

    if (!businessName && !businessId) {
      return NextResponse.json({
        success: false,
        message: '사업장명 또는 사업장 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log(`📋 [FACILITY-MGMT] 시설 관리 정보 조회: ${businessName || businessId}`);

    // 1. 사업장 기본 정보 조회
    let businessQuery = supabaseAdmin.from('business_info').select(`
      id,
      business_name,
      installation_phase,
      surveyor_name,
      surveyor_contact,
      surveyor_company,
      survey_date,
      installation_date,
      completion_date,
      special_notes,
      created_at,
      updated_at
    `);

    if (businessId) {
      businessQuery = businessQuery.eq('id', businessId);
    } else {
      businessQuery = businessQuery.eq('business_name', businessName);
    }

    const { data: business, error: businessError } = await businessQuery.single();

    if (businessError || !business) {
      console.log(`❌ [FACILITY-MGMT] 사업장을 찾을 수 없음: ${businessName || businessId}`);
      return NextResponse.json({
        success: true,
        data: {
          business: null,
          phases: [],
          devices: [],
          files: {
            presurvey: 0,
            installation: 0,
            completion: 0
          }
        },
        message: '사업장을 찾을 수 없습니다.'
      });
    }

    const foundBusinessId = business.id;

    // 2. 프로젝트 진행 단계 조회
    const { data: phases, error: phasesError } = await supabaseAdmin
      .from('project_phases')
      .select('*')
      .eq('business_id', foundBusinessId)
      .order('created_at', { ascending: true });

    if (phasesError) {
      console.warn('⚠️ [FACILITY-MGMT] 프로젝트 단계 조회 실패:', phasesError);
    }

    // 3. 측정기기 정보 조회
    const { data: devices, error: devicesError } = await supabaseAdmin
      .from('measurement_devices')
      .select('*')
      .eq('business_id', foundBusinessId)
      .order('created_at', { ascending: true });

    if (devicesError) {
      console.warn('⚠️ [FACILITY-MGMT] 측정기기 조회 실패:', devicesError);
    }

    // 4. 업로드 파일 통계 조회
    const { data: fileStats, error: fileStatsError } = await supabaseAdmin
      .from('uploaded_files')
      .select('project_phase')
      .eq('business_id', foundBusinessId);

    let fileCounts = { presurvey: 0, installation: 0, completion: 0 };
    if (fileStats && !fileStatsError) {
      fileCounts = fileStats.reduce((acc: any, file: any) => {
        if (file.project_phase === 'presurvey') acc.presurvey++;
        else if (file.project_phase === 'installation') acc.installation++;
        else if (file.project_phase === 'completion') acc.completion++;
        return acc;
      }, fileCounts);
    }

    console.log(`✅ [FACILITY-MGMT] 시설 관리 정보 조회 완료:`, {
      business: business.business_name,
      phase: business.installation_phase,
      phases: phases?.length || 0,
      devices: devices?.length || 0,
      files: fileCounts
    });

    return NextResponse.json({
      success: true,
      data: {
        business,
        phases: phases || [],
        devices: devices || [],
        files: fileCounts
      }
    });

  } catch (error) {
    console.error('❌ [FACILITY-MGMT] 시설 관리 정보 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: '시설 관리 정보 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

// 사업장 시설 관리 정보 업데이트 (PUT)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      businessId, 
      businessName,
      installation_phase,
      surveyor_name,
      surveyor_contact,
      surveyor_company,
      survey_date,
      installation_date,
      completion_date,
      special_notes
    } = body;

    if (!businessId && !businessName) {
      return NextResponse.json({
        success: false,
        message: '사업장 ID 또는 사업장명이 필요합니다.'
      }, { status: 400 });
    }

    console.log(`📝 [FACILITY-MGMT] 시설 관리 정보 업데이트:`, {
      businessId,
      businessName,
      installation_phase,
      surveyor_name
    });

    // 1. 사업장 기본 정보 업데이트
    let updateQuery = supabaseAdmin.from('business_info').update({
      installation_phase,
      surveyor_name,
      surveyor_contact,
      surveyor_company,
      survey_date,
      installation_date,
      completion_date,
      special_notes,
      updated_at: new Date().toISOString()
    });

    if (businessId) {
      updateQuery = updateQuery.eq('id', businessId);
    } else {
      updateQuery = updateQuery.eq('business_name', businessName);
    }

    const { data: updatedBusiness, error: updateError } = await updateQuery.select().single();

    if (updateError) {
      throw updateError;
    }

    // 2. 단계 변경 시 프로젝트 단계 기록 업데이트
    if (installation_phase) {
      const phaseNames = {
        'presurvey': '설치 전 실사',
        'installation': '장비 설치',
        'completed': '설치 후 검수'
      };

      await supabaseAdmin
        .from('project_phases')
        .upsert({
          business_id: updatedBusiness.id,
          phase_type: installation_phase,
          phase_name: phaseNames[installation_phase as keyof typeof phaseNames] || installation_phase,
          status: 'in_progress',
          start_date: new Date().toISOString().split('T')[0],
          assigned_to: surveyor_name,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'business_id,phase_type'
        });
    }

    console.log(`✅ [FACILITY-MGMT] 시설 관리 정보 업데이트 완료: ${updatedBusiness.business_name}`);

    return NextResponse.json({
      success: true,
      data: updatedBusiness,
      message: '시설 관리 정보가 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('❌ [FACILITY-MGMT] 시설 관리 정보 업데이트 실패:', error);
    return NextResponse.json({
      success: false,
      message: '시설 관리 정보 업데이트 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}