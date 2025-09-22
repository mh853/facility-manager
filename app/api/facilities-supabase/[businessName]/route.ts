// app/api/facilities-supabase/[businessName]/route.ts - Supabase 기반 시설 정보 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { memoryCache } from '@/lib/cache';
import { FacilitiesData, Facility } from '@/types';
import { generateFacilityNumbering, type FacilityNumberingResult } from '@/utils/facility-numbering';
import { AirPermitWithOutlets } from '@/types/database';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// HTTP 캐시 헤더 설정
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=60', // 5분 캐시, 1분 stale
  'CDN-Cache-Control': 'public, max-age=600', // CDN에서 10분 캐시
};

export async function GET(
  request: NextRequest,
  { params }: { params: { businessName: string } }
) {
  const startTime = Date.now();
  
  try {
    const businessName = decodeURIComponent(params.businessName);
    console.log('🏭 [FACILITIES-SUPABASE] API 시작:', businessName);
    
    // 입력 검증
    if (!businessName || businessName.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: '사업장명이 유효하지 않습니다.' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }
    
    const cacheKey = `facilities-supabase:${businessName}`;
    
    // 강제 캐시 무효화 옵션
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    if (forceRefresh) {
      console.log('🔄 [FACILITIES-SUPABASE] 강제 캐시 클리어');
      memoryCache.delete(cacheKey);
    }
    
    // 캐시 확인
    const cached = memoryCache.get(cacheKey);
    if (cached && !forceRefresh) {
      console.log(`🏭 [FACILITIES-SUPABASE] 캐시에서 데이터 반환 (${Date.now() - startTime}ms)`);
      return NextResponse.json({ success: true, data: cached }, { headers: CACHE_HEADERS });
    }

    console.log('🏭 [FACILITIES-SUPABASE] 대기필증 관리 데이터에서 조회 시작');
    
    // 1. 사업장 정보 조회 (전체 정보 포함)
    console.log(`🔍 [FACILITIES-SUPABASE] 사업장 조회: "${businessName}"`);
    const { data: business, error: businessError } = await supabaseAdmin
      .from('business_info')
      .select(`
        id,
        business_name,
        address,
        business_contact,
        manager_name,
        manager_contact,
        manager_position,
        representative_name,
        business_registration_number,
        business_type,
        manufacturer
      `)
      .eq('business_name', businessName)
      .single();

    console.log(`🔍 [FACILITIES-SUPABASE] 사업장 조회 결과:`, { business, businessError });

    if (businessError || !business) {
      console.log(`🏭 [FACILITIES-SUPABASE] ⚠️ "${businessName}" 사업장을 찾을 수 없습니다`);
      const emptyResult = {
        facilities: { discharge: [], prevention: [] },
        outlets: { outlets: [1], count: 1, maxOutlet: 1, minOutlet: 1 },
        dischargeCount: 0,
        preventionCount: 0,
        businessInfo: {
          businessName: businessName,
          사업장명: businessName,
          주소: '정보 없음',
          사업장연락처: '정보 없음',
          담당자명: '정보 없음',
          담당자연락처: '정보 없음',
          담당자직급: '정보 없음',
          대표자: '정보 없음',
          사업자등록번호: '정보 없음',
          업종: '정보 없음'
        },
        note: '해당 사업장을 찾을 수 없습니다.',
        source: 'air-permit-management'
      };
      memoryCache.set(cacheKey, emptyResult, 1);
      return NextResponse.json({ success: true, data: emptyResult }, { headers: CACHE_HEADERS });
    }

    // 2. 대기필증 정보 조회 (가장 최근 것)
    console.log(`🔍 [FACILITIES-SUPABASE] 대기필증 조회: business_id="${business.id}"`);
    const { data: airPermit, error: permitError } = await supabaseAdmin
      .from('air_permit_info')
      .select('id')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log(`🔍 [FACILITIES-SUPABASE] 대기필증 조회 결과:`, { airPermit, permitError });

    if (permitError || !airPermit) {
      console.log(`🏭 [FACILITIES-SUPABASE] ⚠️ "${businessName}" 대기필증을 찾을 수 없습니다`);
      const emptyResult = {
        facilities: { discharge: [], prevention: [] },
        outlets: { outlets: [1], count: 1, maxOutlet: 1, minOutlet: 1 },
        dischargeCount: 0,
        preventionCount: 0,
        note: '해당 사업장의 대기필증을 찾을 수 없습니다.',
        source: 'air-permit-management'
      };
      memoryCache.set(cacheKey, emptyResult, 1);
      return NextResponse.json({ success: true, data: emptyResult }, { headers: CACHE_HEADERS });
    }

    // 3. 배출구 및 시설 정보 조회 (대기필증 관리 구조 사용)
    const { data: outlets, error: outletsError } = await supabaseAdmin
      .from('discharge_outlets')
      .select(`
        id,
        outlet_number,
        outlet_name,
        discharge_facilities (
          id,
          facility_name,
          capacity,
          quantity,
          facility_number,
          notes
        ),
        prevention_facilities (
          id,
          facility_name,
          capacity,
          quantity,
          facility_number,
          notes
        )
      `)
      .eq('air_permit_id', airPermit.id)
      .order('outlet_number');

    if (outletsError) {
      console.error('🏭 [FACILITIES-SUPABASE] 배출구 조회 실패:', outletsError);
      throw new Error('배출구 정보 조회 실패');
    }

    const dischargeData: any[] = [];
    const preventionData: any[] = [];

    // 배출구별 시설 데이터 변환
    outlets?.forEach((outlet: any) => {
      outlet.discharge_facilities?.forEach((facility: any) => {
        dischargeData.push({
          outlet_number: outlet.outlet_number,
          facility_number: facility.facility_number,
          facility_name: facility.facility_name,
          capacity: facility.capacity,
          quantity: facility.quantity,
          notes: facility.notes
        });
      });

      outlet.prevention_facilities?.forEach((facility: any) => {
        preventionData.push({
          outlet_number: outlet.outlet_number,
          facility_number: facility.facility_number,
          facility_name: facility.facility_name,
          capacity: facility.capacity,
          quantity: facility.quantity,
          notes: facility.notes
        });
      });
    });

    console.log('🏭 [FACILITIES-SUPABASE] 대기필증 관리에서 조회 완료:', {
      discharge: dischargeData.length,
      prevention: preventionData.length,
      outlets: outlets?.length || 0
    });

    // 🎯 시설 데이터 변환 (어드민과 동일한 데이터베이스 번호 사용)
    const facilities: FacilitiesData = {
      discharge: dischargeData.map(facility => ({
        outlet: facility.outlet_number,
        number: facility.facility_number, // 🔧 어드민과 동일한 데이터베이스 값 사용
        name: facility.facility_name,
        capacity: facility.capacity,
        quantity: facility.quantity,
        displayName: `배출구${facility.outlet_number}-배출시설${facility.facility_number}`,
        notes: facility.notes
      })),
      prevention: preventionData.map(facility => ({
        outlet: facility.outlet_number,
        number: facility.facility_number, // 🔧 어드민과 동일한 데이터베이스 값 사용
        name: facility.facility_name,
        capacity: facility.capacity,
        quantity: facility.quantity,
        displayName: `배출구${facility.outlet_number}-방지시설${facility.facility_number}`,
        notes: facility.notes
      }))
    };

    // 🎯 어드민 시스템과 동일한 시설번호 생성 (AirPermitWithOutlets 구조 변환)
    const airPermitData: AirPermitWithOutlets = {
      id: airPermit.id,
      business_id: business.id,
      business_type: business.business_type || '',
      annual_emission_amount: null,
      pollutants: [],
      emission_limits: {},
      additional_info: {},
      is_active: true,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      outlets: outlets?.map(outlet => ({
        id: outlet.id,
        air_permit_id: airPermit.id,
        outlet_number: outlet.outlet_number,
        outlet_name: outlet.outlet_name || `배출구 ${outlet.outlet_number}`,
        stack_height: null,
        stack_diameter: null,
        flow_rate: null,
        additional_info: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        discharge_facilities: outlet.discharge_facilities?.map(facility => ({
          id: facility.id,
          outlet_id: outlet.id,
          facility_name: facility.facility_name,
          facility_code: null,
          capacity: facility.capacity,
          quantity: facility.quantity,
          operating_conditions: {},
          measurement_points: [],
          device_ids: [],
          additional_info: { notes: facility.notes },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })) || [],
        prevention_facilities: outlet.prevention_facilities?.map(facility => ({
          id: facility.id,
          outlet_id: outlet.id,
          facility_name: facility.facility_name,
          facility_code: null,
          capacity: facility.capacity,
          quantity: facility.quantity,
          efficiency_rating: null,
          media_type: null,
          maintenance_interval: null,
          operating_conditions: {},
          measurement_points: [],
          device_ids: [],
          additional_info: { notes: facility.notes },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })) || []
      })) || []
    };

    // 🎯 어드민 시스템과 동일한 시설번호 생성
    const facilityNumbering = generateFacilityNumbering(airPermitData);

    // 🔧 생성된 번호로 null 값 보정 (모든 사업장에서 일관된 번호 표시)
    facilities.discharge.forEach(facility => {
      if (facility.number === null || facility.number === undefined) {
        // 생성된 번호에서 해당 시설의 번호 찾기
        const facilityInfo = facilityNumbering.outlets
          .flatMap(outlet => outlet.dischargeFacilities)
          .find(f => (f.facilityName === facility.name && f.outletNumber === facility.outlet));
        
        if (facilityInfo) {
          facility.number = facilityInfo.facilityNumber;
          facility.displayName = `배출구${facility.outlet}-배출시설${facility.number}`;
        }
      }
    });

    facilities.prevention.forEach(facility => {
      if (facility.number === null || facility.number === undefined) {
        // 생성된 번호에서 해당 시설의 번호 찾기
        const facilityInfo = facilityNumbering.outlets
          .flatMap(outlet => outlet.preventionFacilities)
          .find(f => (f.facilityName === facility.name && f.outletNumber === facility.outlet));
        
        if (facilityInfo) {
          facility.number = facilityInfo.facilityNumber;
          facility.displayName = `배출구${facility.outlet}-방지시설${facility.number}`;
        }
      }
    });

    console.log('🏭 [FACILITIES-SUPABASE] 변환 결과:', {
      discharge: facilities.discharge.length,
      prevention: facilities.prevention.length,
      facilityNumbering: {
        totalDischarge: facilityNumbering.totalDischargeFacilities,
        totalPrevention: facilityNumbering.totalPreventionFacilities
      },
      번호보정: {
        discharge: facilities.discharge.map(f => `${f.name}: ${f.number}`),
        prevention: facilities.prevention.map(f => `${f.name}: ${f.number}`)
      },
      시간: `${Date.now() - startTime}ms`
    });
    
    // 시설 수량 계산 (quantity 고려)
    const dischargeCount = facilities.discharge.reduce((total, facility) => total + facility.quantity, 0);
    const preventionCount = facilities.prevention.reduce((total, facility) => total + facility.quantity, 0);
    
    // 사업장 정보 구성
    const businessInfo = {
      businessName: business.business_name,
      사업장명: business.business_name,
      주소: business.address || '정보 없음',
      사업장연락처: business.business_contact || '정보 없음',
      담당자명: business.manager_name || '정보 없음',
      담당자연락처: business.manager_contact || '정보 없음',
      담당자직급: business.manager_position || '정보 없음',
      대표자: business.representative_name || '정보 없음',
      사업자등록번호: business.business_registration_number || '정보 없음',
      업종: business.business_type || '정보 없음'
    };
    
    // 🎯 결과 데이터 구성 (어드민 시설번호 정보 포함)
    const resultData = {
      facilities,
      outlets: analyzeOutlets(facilities),
      dischargeCount,
      preventionCount,
      businessInfo,
      facilityNumbering, // 🎯 어드민과 동일한 시설번호 정보 포함
      lastUpdated: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      source: 'air-permit-management'
    };

    // 데이터가 없는 경우 처리
    if (facilities.discharge.length === 0 && facilities.prevention.length === 0) {
      console.log(`🏭 [FACILITIES-SUPABASE] ⚠️ "${businessName}" 사업장에서 시설을 찾을 수 없습니다`);
      const emptyResult = {
        facilities: { discharge: [], prevention: [] },
        outlets: { outlets: [1], count: 1, maxOutlet: 1, minOutlet: 1 },
        dischargeCount: 0,
        preventionCount: 0,
        businessInfo,
        note: '해당 사업장의 대기필증 시설 정보를 찾을 수 없습니다.',
        source: 'air-permit-management'
      };
      
      // 짧은 시간 캐시 (재시도 가능하도록)
      memoryCache.set(cacheKey, emptyResult, 1);
      
      return NextResponse.json(
        { success: true, data: emptyResult },
        { headers: CACHE_HEADERS }
      );
    }
    
    // 캐시 저장 (성공 시 긴 시간)
    memoryCache.set(cacheKey, resultData, 10);
    
    console.log(`🏭 [FACILITIES-SUPABASE] ✅ 성공적으로 완료 (${Date.now() - startTime}ms)`);

    return NextResponse.json(
      { success: true, data: resultData },
      { headers: CACHE_HEADERS }
    );
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`🏭 [FACILITIES-SUPABASE] ❌ 오류 발생 (${processingTime}ms):`, error);
    
    // 구체적인 에러 메시지 제공
    let errorMessage = '시설 정보 조회 실패';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('database') || error.message.includes('supabase')) {
        errorMessage = '데이터베이스 접근 오류';
        statusCode = 503;
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorMessage = '네트워크 연결 오류';
        statusCode = 503;
      } else if (error.message.includes('authorization') || error.message.includes('permission')) {
        errorMessage = '접근 권한 오류';
        statusCode = 403;
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined,
        processingTime
      },
      { 
        status: statusCode,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate', // 에러는 캐시하지 않음
        }
      }
    );
  }
}

// POST: 시설 정보 추가/수정
export async function POST(
  request: NextRequest,
  { params }: { params: { businessName: string } }
) {
  try {
    const businessName = decodeURIComponent(params.businessName);
    const body = await request.json();
    
    console.log('🏭 [FACILITIES-SUPABASE] 시설 정보 저장 시작:', businessName);
    
    const { discharge = [], prevention = [] } = body;
    
    // 기존 데이터 삭제 (전체 교체)
    const [deleteDischarge, deletePrevention] = await Promise.allSettled([
      supabaseAdmin
        .from('discharge_facilities')
        .delete()
        .eq('business_name', businessName),
      supabaseAdmin
        .from('prevention_facilities')
        .delete()
        .eq('business_name', businessName)
    ]);

    if (deleteDischarge.status === 'rejected') {
      console.error('🏭 [FACILITIES-SUPABASE] 기존 배출시설 삭제 실패:', deleteDischarge.reason);
    }
    if (deletePrevention.status === 'rejected') {
      console.error('🏭 [FACILITIES-SUPABASE] 기존 방지시설 삭제 실패:', deletePrevention.reason);
    }
    
    // 새 데이터 삽입
    const promises = [];
    
    if (discharge.length > 0) {
      const dischargeInsertData = discharge.map((facility: any) => ({
        business_name: businessName,
        outlet_number: facility.outlet,
        facility_number: facility.number,
        facility_name: facility.name,
        capacity: facility.capacity,
        quantity: facility.quantity || 1,
        notes: facility.notes || null
      }));
      
      promises.push(
        supabaseAdmin
          .from('discharge_facilities')
          .insert(dischargeInsertData)
      );
    }
    
    if (prevention.length > 0) {
      const preventionInsertData = prevention.map((facility: any) => ({
        business_name: businessName,
        outlet_number: facility.outlet,
        facility_number: facility.number,
        facility_name: facility.name,
        capacity: facility.capacity,
        quantity: facility.quantity || 1,
        notes: facility.notes || null
      }));
      
      promises.push(
        supabaseAdmin
          .from('prevention_facilities')
          .insert(preventionInsertData)
      );
    }
    
    const results = await Promise.allSettled(promises);
    
    // 에러 체크
    const errors = results.filter(result => result.status === 'rejected');
    if (errors.length > 0) {
      console.error('🏭 [FACILITIES-SUPABASE] 저장 중 일부 실패:', errors);
      throw new Error('일부 시설 정보 저장에 실패했습니다.');
    }
    
    // 캐시 무효화
    memoryCache.delete(`facilities-supabase:${businessName}`);
    
    console.log('🏭 [FACILITIES-SUPABASE] ✅ 시설 정보 저장 완료');
    
    return NextResponse.json({
      success: true,
      message: '시설 정보가 성공적으로 저장되었습니다.',
      savedCounts: {
        discharge: discharge.length,
        prevention: prevention.length
      }
    });
    
  } catch (error) {
    console.error('🏭 [FACILITIES-SUPABASE] ❌ 저장 실패:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '시설 정보 저장 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
      },
      { status: 500 }
    );
  }
}

// 배출구 분석 함수
function analyzeOutlets(facilities: FacilitiesData) {
  const allOutlets = [
    ...facilities.discharge.map(f => f.outlet || 1),
    ...facilities.prevention.map(f => f.outlet || 1)
  ];
  
  const uniqueOutlets = [...new Set(allOutlets)].sort((a, b) => a - b);
  
  if (uniqueOutlets.length === 0) uniqueOutlets.push(1);

  return {
    outlets: uniqueOutlets,
    count: uniqueOutlets.length,
    maxOutlet: Math.max(...uniqueOutlets),
    minOutlet: Math.min(...uniqueOutlets)
  };
}