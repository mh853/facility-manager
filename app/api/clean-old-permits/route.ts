import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function DELETE() {
  try {
    console.log('🧹 각 사업장별 중복 대기필증 정리 시작...');

    // 1. 모든 대기필증을 사업장별로 그룹화하고 최신 것만 선별
    const { data: allPermits, error: permitsError } = await supabaseAdmin
      .from('air_permit_info')
      .select('id, created_at, business_id, business:business_info(business_name)')
      .order('created_at', { ascending: false });

    if (permitsError) {
      console.error('❌ 대기필증 조회 실패:', permitsError);
      return NextResponse.json({
        success: false,
        message: '대기필증을 조회할 수 없습니다.'
      }, { status: 500 });
    }

    console.log(`📊 전체 대기필증: ${allPermits?.length || 0}개`);

    // 2. 사업장별로 그룹화하여 최신 것만 보존
    const businessGroups = new Map();
    
    allPermits?.forEach(permit => {
      const businessId = permit.business_id;
      if (!businessGroups.has(businessId)) {
        businessGroups.set(businessId, []);
      }
      businessGroups.get(businessId).push(permit);
    });

    console.log(`🏢 사업장 수: ${businessGroups.size}개`);

    // 3. 각 사업장별로 가장 최근 대기필증만 보존, 나머지 삭제 대상으로 수집
    const preservedPermits: any[] = [];
    const permitsToDelete: any[] = [];

    businessGroups.forEach((permits, businessId) => {
      // 생성일 기준 내림차순 정렬 (가장 최근이 첫 번째)
      permits.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const latest = permits[0];
      const duplicates = permits.slice(1);
      
      preservedPermits.push(latest);
      permitsToDelete.push(...duplicates);
      
      if (duplicates.length > 0) {
        console.log(`🔄 ${latest.business?.business_name}: 최신 1개 보존, ${duplicates.length}개 삭제 예정`);
      }
    });

    console.log(`✅ 보존할 대기필증: ${preservedPermits.length}개`);
    console.log(`🗑️ 삭제할 대기필증: ${permitsToDelete.length}개`);

    if (permitsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: '삭제할 중복 대기필증이 없습니다.',
        data: { 
          deletedCount: 0, 
          preservedCount: preservedPermits.length,
          totalBusinesses: businessGroups.size 
        }
      });
    }

    // 4. 보존할 모든 대기필증의 배출구 ID들 조회
    const preservedPermitIds = preservedPermits.map(p => p.id);
    const { data: preservedOutlets } = await supabaseAdmin
      .from('discharge_outlets')
      .select('id')
      .in('air_permit_id', preservedPermitIds);

    const preservedOutletIds = preservedOutlets?.map(outlet => outlet.id) || [];
    console.log(`🎯 보존할 배출구 ${preservedOutletIds.length}개`);

    // 5. 삭제할 대기필증 ID들
    const deletePermitIds = permitsToDelete.map(p => p.id);
    console.log(`🗑️ 삭제할 대기필증 ID: ${deletePermitIds.slice(0, 5).join(', ')}...`);

    // 6. 연관 데이터 순서대로 삭제 (FK 제약조건 고려)
    const deleteResults = [];

    // 삭제할 대기필증의 배출구들 조회
    const { data: outletsToDelete } = await supabaseAdmin
      .from('discharge_outlets')
      .select('id')
      .in('air_permit_id', deletePermitIds);

    const deleteOutletIds = outletsToDelete?.map(outlet => outlet.id) || [];
    console.log(`🗑️ 삭제할 배출구 ${deleteOutletIds.length}개`);

    // 시설 데이터 삭제 (삭제할 배출구의 시설들만)
    if (deleteOutletIds.length > 0) {
      const dischargeFacilitiesResult = await supabaseAdmin
        .from('discharge_facilities')
        .delete()
        .in('outlet_id', deleteOutletIds);
      
      const preventionFacilitiesResult = await supabaseAdmin
        .from('prevention_facilities')
        .delete()
        .in('outlet_id', deleteOutletIds);

      deleteResults.push(dischargeFacilitiesResult, preventionFacilitiesResult);
    }

    // 배출구 삭제 (삭제할 대기필증의 배출구들만)
    const outletsResult = await supabaseAdmin
      .from('discharge_outlets')
      .delete()
      .in('air_permit_id', deletePermitIds);
    deleteResults.push(outletsResult);

    // 중복 대기필증 삭제
    const permitsResult = await supabaseAdmin
      .from('air_permit_info')
      .delete()
      .in('id', deletePermitIds);
    deleteResults.push(permitsResult);
    
    // 오류 체크
    const errors = deleteResults.filter(result => result.error);
    if (errors.length > 0) {
      console.error('❌ 삭제 중 오류 발생:', errors);
      return NextResponse.json({
        success: false,
        message: '삭제 중 오류가 발생했습니다.',
        errors: errors.map(e => e.error)
      }, { status: 500 });
    }

    console.log('✅ 구 대기필증 및 연관 데이터 삭제 완료');

    return NextResponse.json({
      success: true,
      message: `각 사업장별 중복 대기필증 ${permitsToDelete.length}개와 연관 데이터를 삭제했습니다.`,
      data: {
        deletedCount: permitsToDelete.length,
        preservedCount: preservedPermits.length,
        totalBusinesses: businessGroups.size,
        deletedFacilities: {
          discharge: deleteResults[0]?.count || 0,
          prevention: deleteResults[1]?.count || 0
        },
        deletedOutlets: deleteResults[deleteResults.length - 2]?.count || 0,
        deletedPermits: deleteResults[deleteResults.length - 1]?.count || 0
      }
    });

  } catch (error) {
    console.error('❌ 대기필증 정리 중 오류:', error);
    return NextResponse.json({
      success: false,
      message: '대기필증 정리 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}