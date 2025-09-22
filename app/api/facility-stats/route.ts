// app/api/facility-stats/route.ts - 시설 데이터 통계 및 검증 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


interface FacilityStats {
  totalBusinesses: number;
  totalDischarge: number;
  totalPrevention: number;
  outletDistribution: Record<number, { discharge: number; prevention: number }>;
  businessBreakdown: Array<{
    businessName: string;
    discharge: number;
    prevention: number;
    outlets: number[];
  }>;
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [FACILITY-STATS] 시설 데이터 통계 조회 시작');

    // 배출시설 데이터 조회 (제한 없이 모든 데이터)
    const { data: dischargeData, error: dischargeError } = await supabaseAdmin
      .from('discharge_facilities')
      .select('business_name, outlet_number, facility_name, capacity, quantity')
      .limit(50000);

    if (dischargeError) {
      console.error('❌ [FACILITY-STATS] 배출시설 조회 오류:', dischargeError);
      throw dischargeError;
    }

    // 방지시설 데이터 조회 (제한 없이 모든 데이터)
    const { data: preventionData, error: preventionError } = await supabaseAdmin
      .from('prevention_facilities')
      .select('business_name, outlet_number, facility_name, capacity, quantity')
      .limit(50000);

    if (preventionError) {
      console.error('❌ [FACILITY-STATS] 방지시설 조회 오류:', preventionError);
      throw preventionError;
    }

    console.log('📊 [FACILITY-STATS] 조회 완료:', {
      discharge: dischargeData?.length || 0,
      prevention: preventionData?.length || 0
    });
    
    // 디버깅: 샘플 데이터 확인
    console.log('📊 [FACILITY-STATS] 배출시설 샘플:', dischargeData?.slice(0, 3).map((f: any) => ({
      business: f.business_name, 
      outlet: f.outlet_number, 
      facility: f.facility_name
    })));
    
    // 배출구별 개수 디버깅
    const outletDebug: any = {};
    (dischargeData || []).forEach((facility: any) => {
      const outlet = facility.outlet_number || 1;
      outletDebug[outlet] = (outletDebug[outlet] || 0) + 1;
    });
    console.log('📊 [FACILITY-STATS] 실제 배출구별 개수:', outletDebug);

    // 통계 계산
    const businessSet = new Set<string>();
    const outletDistribution: Record<number, { discharge: number; prevention: number }> = {};
    const businessMap = new Map<string, { discharge: number; prevention: number; outlets: Set<number> }>();

    // 배출시설 처리
    (dischargeData || []).forEach((facility: any) => {
      businessSet.add(facility.business_name);
      
      const outlet = facility.outlet_number || 1;
      if (!outletDistribution[outlet]) {
        outletDistribution[outlet] = { discharge: 0, prevention: 0 };
      }
      outletDistribution[outlet].discharge++;

      if (!businessMap.has(facility.business_name)) {
        businessMap.set(facility.business_name, { 
          discharge: 0, 
          prevention: 0, 
          outlets: new Set() 
        });
      }
      const business = businessMap.get(facility.business_name)!;
      business.discharge++;
      business.outlets.add(outlet);
    });

    // 방지시설 처리
    (preventionData || []).forEach((facility: any) => {
      businessSet.add(facility.business_name);
      
      const outlet = facility.outlet_number || 1;
      if (!outletDistribution[outlet]) {
        outletDistribution[outlet] = { discharge: 0, prevention: 0 };
      }
      outletDistribution[outlet].prevention++;

      if (!businessMap.has(facility.business_name)) {
        businessMap.set(facility.business_name, { 
          discharge: 0, 
          prevention: 0, 
          outlets: new Set() 
        });
      }
      const business = businessMap.get(facility.business_name)!;
      business.prevention++;
      business.outlets.add(outlet);
    });

    // 사업장별 요약
    const businessBreakdown = Array.from(businessMap.entries()).map(([name, data]) => ({
      businessName: name,
      discharge: data.discharge,
      prevention: data.prevention,
      outlets: Array.from(data.outlets).sort((a, b) => a - b)
    })).sort((a, b) => a.businessName.localeCompare(b.businessName));

    const stats: FacilityStats = {
      totalBusinesses: businessSet.size,
      totalDischarge: dischargeData?.length || 0,
      totalPrevention: preventionData?.length || 0,
      outletDistribution,
      businessBreakdown
    };

    console.log('📊 [FACILITY-STATS] 통계 계산 완료:', {
      totalBusinesses: stats.totalBusinesses,
      totalDischarge: stats.totalDischarge,
      totalPrevention: stats.totalPrevention,
      outlets: Object.keys(outletDistribution).length
    });

    return NextResponse.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        source: 'supabase',
        tables: ['discharge_facilities', 'prevention_facilities']
      }
    });

  } catch (error) {
    console.error('📊 [FACILITY-STATS] ❌ 오류:', error);
    
    return NextResponse.json({
      success: false,
      message: '시설 데이터 통계 조회 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}