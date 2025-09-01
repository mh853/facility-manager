// app/api/import-all-facilities-optimized/route.ts - 최적화된 전체 사업장 일괄 가져오기
import { NextRequest, NextResponse } from 'next/server';
import { sheets } from '@/lib/google-client';
import { supabaseAdmin } from '@/lib/supabase';

interface SheetFacility {
  businessName: string;
  facilityType: 'discharge' | 'prevention';
  facilityNumber: number;
  facilityName: string;
  capacity: string;
  quantity: number;
  outlet: number;
}

interface BusinessSummary {
  businessName: string;
  dischargeCount: number;
  preventionCount: number;
  outletCount: number;
  rowRange: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { dryRun = false, debug = false, searchBusiness = null } = await request.json().catch(() => ({}));
    
    console.log(`🚀 [OPTIMIZED-IMPORT] 최적화된 전체 사업장 일괄 가져오기 시작 ${dryRun ? '(DRY RUN)' : ''} ${debug ? '(DEBUG)' : ''}`);

    // 환경변수 확인
    const spreadsheetId = process.env.MAIN_SPREADSHEET_ID?.trim();
    const facilitySheetName = '대기필증 DB';

    if (!spreadsheetId) {
      throw new Error('MAIN_SPREADSHEET_ID 환경변수가 설정되지 않았습니다.');
    }

    // === 1단계: Google Sheets에서 데이터 가져오기 ===
    console.log('📊 [1단계] 구글시트에서 전체 데이터 조회 중...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${facilitySheetName}!A:HZ`,
    });

    const rows = response.data.values || [];
    console.log(`📊 총 데이터 행: ${rows.length}`);

    if (rows.length < 3) {
      return NextResponse.json({
        success: false,
        message: '구글시트에 충분한 데이터가 없습니다.'
      });
    }

    // === 2단계: 기존 사업장 정보 일괄 조회 ===
    console.log('🏢 [2단계] 기존 사업장 정보 조회 중...');
    const { data: existingBusinesses, error: businessError } = await supabaseAdmin
      .from('business_info')
      .select('id, business_name')
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (businessError) {
      throw new Error(`기존 사업장 조회 실패: ${businessError.message}`);
    }

    const existingBusinessMap = new Map();
    (existingBusinesses || []).forEach(b => {
      existingBusinessMap.set(b.business_name, b.id);
    });

    console.log(`🏢 기존 사업장: ${existingBusinesses?.length || 0}개`);

    // === 3단계: 시트 데이터 파싱 및 그룹핑 ===
    console.log('📋 [3단계] 시트 데이터 파싱 중...');
    
    const businessDataMap = new Map();
    const newBusinessesToInsert = [];
    const facilities = [];
    const businessSummaries = new Map();

    // 헤더 스킵하고 데이터 행부터 처리
    const businessRowTracker = new Map();
    
    // 사업장별 배출구 그룹 처리
    let currentBusiness = null;
    let currentBusinessStartRow = -1;

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i] || [];
      const businessName = (row[1] || '').toString().trim();
      const outlet = parseInt(row[2]) || 1;

      // 새로운 사업장이 시작되는 경우 (사업장명이 있는 행)
      if (businessName && businessName !== '사업장명') {
        currentBusiness = businessName;
        currentBusinessStartRow = i;
        
        // 건양 관련 모든 행 추적
        if (businessName.includes('건양')) {
          console.log(`🔍 건양 새 사업장 발견 - 행 ${i}: "${businessName}" -> 배출구 ${outlet}`);
        }

        // 디버깅: 처음 10개 행의 배출구 정보 출력
        if (debug && i < 20) {
          console.log(`🔍 행 ${i}: "${businessName}" -> 배출구 ${outlet}`);
        }
      }
      // 배출구 번호만 있는 행 (사업장명이 없지만 배출구 번호가 있는 경우)
      else if (!businessName && outlet > 1 && currentBusiness) {
        // 현재 사업장의 추가 배출구로 처리
        if (currentBusiness.includes('건양')) {
          console.log(`🔍 건양 추가 배출구 발견 - 행 ${i}: "${currentBusiness}" -> 배출구 ${outlet}`);
        }
        
        if (debug && i < 300) {
          console.log(`🔍 추가 배출구 행 ${i}: "${currentBusiness}" -> 배출구 ${outlet}`);
        }
      }
      // 빈 행이거나 배출구 1인 경우 - 새로운 사업장 시작일 수 있으므로 currentBusiness 초기화
      else if (!businessName && (outlet === 1 || !outlet)) {
        currentBusiness = null;
        continue;
      }

      // 처리할 사업장명 결정 (현재 행의 사업장명 또는 이전 사업장)
      const businessToProcess = businessName || currentBusiness;
      if (!businessToProcess) continue;

      // 사업장별 행 추적
      if (!businessRowTracker.has(businessToProcess)) {
        businessRowTracker.set(businessToProcess, []);
      }
      businessRowTracker.get(businessToProcess).push({ row: i, outlet });
      
      // 같은 사업장이 여러 배출구로 나뉜 경우 감지
      const businessRows = businessRowTracker.get(businessToProcess);
      if (businessRows.length > 1) {
        const outlets = [...new Set(businessRows.map(r => r.outlet))];
        if (outlets.length > 1) {
          console.log(`🔥 다중 배출구 발견 - ${businessToProcess}: 배출구 ${outlets.join(', ')} (행: ${businessRows.map(r => r.row).join(', ')})`);
        }
      }

      // 사업장 정보 처리
      let businessId = existingBusinessMap.get(businessToProcess);
      if (!businessId && !businessDataMap.has(businessToProcess)) {
        // 새 사업장 등록 준비 (실제 테이블 스키마에 맞춤)
        const newBusinessData = {
          business_name: businessToProcess,
          local_government: null,
          address: null,
          manager_name: null,
          manager_position: null,
          manager_contact: null,
          business_contact: null,
          fax_number: null,
          email: null,
          representative_name: null,
          representative_birth_date: null,
          business_registration_number: null,
          business_management_code: null,
          manufacturer: null,
          ph_meter: null,
          differential_pressure_meter: null,
          temperature_meter: null,
          discharge_ct: null,
          prevention_ct: null,
          gateway: null,
          vpn_wired: null,
          vpn_wireless: null,
          multiple_stack: null,
          additional_info: {},
          facility_summary: null,
          is_active: true,
          is_deleted: false
        };

        newBusinessesToInsert.push(newBusinessData);
        businessDataMap.set(businessToProcess, { data: newBusinessData, tempId: `temp_${businessToProcess}` });
      }

      // businessSummaries 초기화 (각 사업장당 한 번만)
      if (!businessSummaries.has(businessToProcess)) {
        businessSummaries.set(businessToProcess, {
          outlets: new Map(),
          totals: { discharge: 0, prevention: 0, outlets: new Set() }
        });
      }

      // 배출시설 파싱 (D~DD열, 컬럼 3부터 35개 * 3칸)
      for (let facilityIndex = 0; facilityIndex < 35; facilityIndex++) {
        const nameCol = 3 + (facilityIndex * 3);
        const capacityCol = nameCol + 1;
        const quantityCol = nameCol + 2;

        const facilityName = (row[nameCol] || '').toString().trim();
        const capacity = (row[capacityCol] || '').toString().trim();
        const quantity = parseInt(row[quantityCol]) || 0;

        if (facilityName && facilityName !== '-' && quantity > 0) {
          facilities.push({
            businessName: businessToProcess,
            facilityType: 'discharge',
            facilityName,
            capacity: capacity || '미정',
            quantity,
            outlet,
            business_name: businessToProcess,
            outlet_number: outlet,
            facility_number: facilityIndex + 1
          });

          // businessSummaries 업데이트
          const summary = businessSummaries.get(businessToProcess);
          summary.totals.outlets.add(outlet);
          summary.totals.discharge++;
          
          if (!summary.outlets.has(outlet)) {
            summary.outlets.set(outlet, {
              discharge_count: 0,
              prevention_count: 0,
              discharge_facilities: [],
              prevention_facilities: []
            });
          }
          const outletData = summary.outlets.get(outlet);
          outletData.discharge_count++;
          if (!outletData.discharge_facilities.includes(facilityName)) {
            outletData.discharge_facilities.push(facilityName);
          }
        }
      }

      // 방지시설 파싱 (DE~HE열, 컬럼 108부터 35개 * 3칸)
      for (let facilityIndex = 0; facilityIndex < 35; facilityIndex++) {
        const nameCol = 108 + (facilityIndex * 3);
        const capacityCol = nameCol + 1;
        const quantityCol = nameCol + 2;

        const facilityName = (row[nameCol] || '').toString().trim();
        const capacity = (row[capacityCol] || '').toString().trim();
        const quantity = parseInt(row[quantityCol]) || 0;

        if (facilityName && facilityName !== '-' && quantity > 0) {
          facilities.push({
            businessName: businessToProcess,
            facilityType: 'prevention',
            facilityName,
            capacity: capacity || '미정',
            quantity,
            outlet,
            business_name: businessToProcess,
            outlet_number: outlet,
            facility_number: facilityIndex + 1
          });

          // businessSummaries 업데이트
          const summary = businessSummaries.get(businessToProcess);
          summary.totals.outlets.add(outlet);
          summary.totals.prevention++;
          
          if (!summary.outlets.has(outlet)) {
            summary.outlets.set(outlet, {
              discharge_count: 0,
              prevention_count: 0,
              discharge_facilities: [],
              prevention_facilities: []
            });
          }
          const outletData = summary.outlets.get(outlet);
          outletData.prevention_count++;
          if (!outletData.prevention_facilities.includes(facilityName)) {
            outletData.prevention_facilities.push(facilityName);
          }
        }
      }
    }

    console.log(`📋 파싱 완료:`, {
      totalBusinesses: businessDataMap.size + existingBusinessMap.size,
      newBusinesses: newBusinessesToInsert.length,
      totalFacilities: facilities.length,
      dischargeCount: facilities.filter(f => f.facilityType === 'discharge').length,
      preventionCount: facilities.filter(f => f.facilityType === 'prevention').length
    });

    // 배출구별 분석 정보 출력
    console.log('📊 배출구별 사업장 분석:');
    const outletAnalysis = new Map();
    for (const [businessName, summary] of businessSummaries) {
      const outlets = Array.from(summary.outlets.keys()).sort();
      if (outlets.length > 1) {
        console.log(`🔥 다중 배출구 - ${businessName}: 배출구 ${outlets.join(', ')}`);
      }
      outletAnalysis.set(outlets.length, (outletAnalysis.get(outlets.length) || 0) + 1);
    }
    
    console.log('📈 배출구 수량별 사업장 분포:');
    for (const [outletCount, businessCount] of outletAnalysis) {
      console.log(`   배출구 ${outletCount}개: ${businessCount}개 사업장`);
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'DRY RUN - 파싱 결과만 확인',
        data: {
          summary: {
            totalBusinesses: businessSummaries.size,
            totalFacilities: facilities.length,
            dischargeTotal: facilities.filter(f => f.facilityType === 'discharge').length,
            preventionTotal: facilities.filter(f => f.facilityType === 'prevention').length,
            processingTime: Date.now() - startTime
          },
          outletAnalysis: Object.fromEntries(outletAnalysis),
          sampleFacilities: facilities.slice(0, 10)
        }
      });
    }

    // === 4단계: 새 사업장 일괄 삽입 ===
    if (newBusinessesToInsert.length > 0) {
      console.log(`🏢 [4단계] ${newBusinessesToInsert.length}개 새 사업장 일괄 삽입 중...`);
      
      const { data: insertedBusinesses, error: insertError } = await supabaseAdmin
        .from('business_info')
        .insert(newBusinessesToInsert)
        .select('id, business_name');

      if (insertError) {
        console.error('❌ 새 사업장 삽입 오류:', insertError);
        throw insertError;
      }

      // 새 사업장 ID 매핑 업데이트
      (insertedBusinesses || []).forEach(business => {
        existingBusinessMap.set(business.business_name, business.id);
      });

      console.log(`✅ 새 사업장 ${insertedBusinesses?.length || 0}개 삽입 완료`);
    }

    // === 5단계: 기존 시설 및 관련 데이터 전체 삭제 ===
    console.log('🗑️ [5단계] 기존 시설 및 관련 데이터 삭제 중...');
    
    const deletePromises = [
      supabaseAdmin.from('discharge_facilities').delete().gte('id', 0),
      supabaseAdmin.from('prevention_facilities').delete().gte('id', 0),
      supabaseAdmin.from('discharge_outlets').delete().gte('id', 0),
      supabaseAdmin.from('air_permit_info').delete().gte('id', 0)
    ];
    
    await Promise.all(deletePromises);
    console.log('✅ 기존 시설 및 관련 데이터 삭제 완료');

    // === 6단계: Air Permit 및 Discharge Outlets 먼저 생성 ===
    console.log('🎫 [6단계] Air Permit 및 Discharge Outlets 생성 중...');
    
    const outletToIdMap = new Map();
    
    for (const [businessName, summary] of businessSummaries) {
      const businessId = existingBusinessMap.get(businessName);
      if (!businessId) continue;

      // Air Permit 생성
      const airPermitData = {
        business_id: businessId,
        business_type: '일반',
        annual_emission_amount: null,
        first_report_date: null,
        operation_start_date: null,
        additional_info: {},
        is_active: true,
        is_deleted: false
      };

      const { data: airPermit, error: airPermitError } = await supabaseAdmin
        .from('air_permit_info')
        .insert(airPermitData)
        .select('id, business_id')
        .single();

      if (airPermitError) {
        console.error(`❌ ${businessName} air permit 생성 오류:`, airPermitError);
        continue;
      }

      // 각 배출구별로 DischargeOutlet 생성
      for (const [outlet, outletData] of summary.outlets) {
        const dischargeOutletData = {
          air_permit_id: airPermit.id,
          outlet_number: outlet,
          outlet_name: `배출구 ${outlet}`,
          additional_info: {}
        };

        const { data: dischargeOutlet, error: outletError } = await supabaseAdmin
          .from('discharge_outlets')
          .insert(dischargeOutletData)
          .select('id')
          .single();

        if (outletError) {
          console.error(`❌ ${businessName} 배출구 ${outlet} 생성 오류:`, outletError);
          continue;
        }

        // 매핑 저장
        outletToIdMap.set(`${businessName}_${outlet}`, dischargeOutlet.id);
      }
    }

    console.log('✅ Air Permit 및 Discharge Outlets 생성 완료');

    // === 7단계: 새 시설 데이터 배치 삽입 (올바른 outlet_id와 함께) ===
    const dischargeFacilities = facilities
      .filter(f => f.facilityType === 'discharge')
      .map(f => ({
        business_name: f.businessName,
        outlet_number: f.outlet,
        facility_number: f.facility_number,
        facility_name: f.facilityName,
        capacity: f.capacity,
        quantity: f.quantity,
        outlet_id: outletToIdMap.get(`${f.businessName}_${f.outlet}`) || null
      }));

    const preventionFacilities = facilities
      .filter(f => f.facilityType === 'prevention')
      .map(f => ({
        business_name: f.businessName,
        outlet_number: f.outlet,
        facility_number: f.facility_number,
        facility_name: f.facilityName,
        capacity: f.capacity,
        quantity: f.quantity,
        outlet_id: outletToIdMap.get(`${f.businessName}_${f.outlet}`) || null
      }));

    let insertedDischarge = 0;
    let insertedPrevention = 0;

    // 배치 사이즈로 나누어서 삽입 (타임아웃 방지)
    const BATCH_SIZE = 100;

    if (dischargeFacilities.length > 0) {
      console.log(`🏭 [7단계] 배출시설 ${dischargeFacilities.length}개 배치 삽입 중...`);
      
      for (let i = 0; i < dischargeFacilities.length; i += BATCH_SIZE) {
        const batch = dischargeFacilities.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabaseAdmin
          .from('discharge_facilities')
          .insert(batch)
          .select();

        if (error) {
          console.error(`❌ 배출시설 배치 ${Math.floor(i/BATCH_SIZE) + 1} 삽입 오류:`, error);
        } else {
          insertedDischarge += data?.length || 0;
          console.log(`✅ 배출시설 배치 ${Math.floor(i/BATCH_SIZE) + 1} 완료: ${data?.length}개`);
        }
      }
    }

    if (preventionFacilities.length > 0) {
      console.log(`🏭 [7단계] 방지시설 ${preventionFacilities.length}개 배치 삽입 중...`);
      
      for (let i = 0; i < preventionFacilities.length; i += BATCH_SIZE) {
        const batch = preventionFacilities.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabaseAdmin
          .from('prevention_facilities')
          .insert(batch)
          .select();

        if (error) {
          console.error(`❌ 방지시설 배치 ${Math.floor(i/BATCH_SIZE) + 1} 삽입 오류:`, error);
        } else {
          insertedPrevention += data?.length || 0;
          console.log(`✅ 방지시설 배치 ${Math.floor(i/BATCH_SIZE) + 1} 완료: ${data?.length}개`);
        }
      }
    }

    // === 8단계: facility_summary 업데이트 ===
    console.log('📊 [8단계] facility_summary 계산 및 업데이트 중...');

    // 사업장별 facility_summary 업데이트 (배치 처리)
    const summaryUpdates = [];
    for (const [businessName, summary] of businessSummaries) {
      const outlets = Array.from(summary.outlets.entries()).map(([outlet, data]) => ({
        outlet,
        discharge_count: data.discharge_count,
        prevention_count: data.prevention_count,
        discharge_facilities: data.discharge_facilities,
        prevention_facilities: data.prevention_facilities
      }));

      const facilitySummary = {
        outlets,
        totals: {
          total_outlets: summary.totals.outlets.size,
          total_discharge: summary.totals.discharge,
          total_prevention: summary.totals.prevention
        },
        last_updated: new Date().toISOString()
      };

      summaryUpdates.push({
        business_name: businessName,
        facility_summary: facilitySummary,
        updated_at: new Date().toISOString()
      });
    }

    // 배치 단위로 업데이트 (PostgreSQL upsert 사용)
    if (summaryUpdates.length > 0) {
      console.log(`📊 ${summaryUpdates.length}개 사업장 facility_summary 업데이트 중...`);
      
      for (let i = 0; i < summaryUpdates.length; i += 50) {
        const batch = summaryUpdates.slice(i, i + 50);
        
        for (const update of batch) {
          const { error: updateError } = await supabaseAdmin
            .from('business_info')
            .update({ 
              facility_summary: update.facility_summary,
              updated_at: update.updated_at 
            })
            .eq('business_name', update.business_name)
            .eq('is_active', true)
            .eq('is_deleted', false);

          if (updateError) {
            console.error(`❌ ${update.business_name} facility_summary 업데이트 오류:`, updateError);
          }
        }
        
        console.log(`✅ facility_summary 배치 ${Math.floor(i/50) + 1} 완료`);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`🚀 [OPTIMIZED-IMPORT] ✅ 최적화된 가져오기 완료 (${processingTime}ms)`);

    // 사업장 요약 정보 생성
    const businessSummaryList = Array.from(businessSummaries.entries()).map(([businessName, summary]) => ({
      businessName,
      dischargeCount: summary.totals.discharge,
      preventionCount: summary.totals.prevention,
      outletCount: summary.totals.outlets.size,
      rowRange: 'auto'
    }));

    return NextResponse.json({
      success: true,
      message: '최적화된 전체 사업장 데이터를 성공적으로 가져왔습니다.',
      data: {
        summary: {
          totalBusinesses: businessSummaries.size,
          totalFacilities: facilities.length,
          dischargeTotal: insertedDischarge,
          preventionTotal: insertedPrevention,
          processingTime
        },
        businesses: businessSummaryList.sort((a, b) => 
          a.businessName.localeCompare(b.businessName)
        )
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`🚀 [OPTIMIZED-IMPORT] ❌ 오류 (${processingTime}ms):`, error);
    
    return NextResponse.json({
      success: false,
      message: '최적화된 전체 사업장 가져오기 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'),
      processingTime
    }, { status: 500 });
  }
}