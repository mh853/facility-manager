// app/api/business-equipment-counts/route.ts - 사업장 측정기기 수량 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 측정기기 수량 업데이트 (PUT)
export async function PUT(request: NextRequest) {
  try {
    const { businessId, equipmentCounts } = await request.json();

    if (!businessId) {
      return NextResponse.json({
        success: false,
        message: '사업장 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log(`📊 [EQUIPMENT-COUNTS] 측정기기 수량 업데이트: ${businessId}`, equipmentCounts);

    // 사업장 정보에 측정기기 수량 업데이트
    const { data, error } = await supabaseAdmin
      .from('business_info')
      .update({
        // 개별 센서 수량
        ph_meter: equipmentCounts.phSensor || 0,
        differential_pressure_meter: equipmentCounts.differentialPressureMeter || 0,
        temperature_meter: equipmentCounts.temperatureMeter || 0,
        discharge_current_meter: equipmentCounts.dischargeCT || 0,
        fan_current_meter: equipmentCounts.fanCT || 0,
        pump_current_meter: equipmentCounts.pumpCT || 0,
        gateway: equipmentCounts.gateway || 0,
        
        // 총 기기 수량을 additional_info에 저장
        additional_info: {
          equipment_summary: {
            total_devices: equipmentCounts.totalDevices || 0,
            last_calculated: new Date().toISOString(),
            breakdown: equipmentCounts
          }
        },
        
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId)
      .select();

    if (error) {
      throw error;
    }

    console.log(`✅ [EQUIPMENT-COUNTS] 수량 업데이트 완료: 총 ${equipmentCounts.totalDevices}개 기기`);

    return NextResponse.json({
      success: true,
      message: '측정기기 수량이 성공적으로 업데이트되었습니다.',
      data: {
        businessId,
        equipmentCounts,
        updatedBusiness: data?.[0]
      }
    });

  } catch (error) {
    console.error('❌ [EQUIPMENT-COUNTS] 수량 업데이트 실패:', error);
    return NextResponse.json({
      success: false,
      message: '측정기기 수량 업데이트 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

// 측정기기 수량 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({
        success: false,
        message: '사업장 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log(`📊 [EQUIPMENT-COUNTS] 측정기기 수량 조회: ${businessId}`);

    // 사업장 정보에서 측정기기 수량 조회
    const { data, error } = await supabaseAdmin
      .from('business_info')
      .select(`
        id,
        business_name,
        ph_meter,
        differential_pressure_meter,
        temperature_meter,
        discharge_current_meter,
        fan_current_meter,
        pump_current_meter,
        gateway,
        additional_info
      `)
      .eq('id', businessId)
      .single();

    if (error) {
      throw error;
    }

    const equipmentCounts = {
      phSensor: data.ph_meter || 0,
      differentialPressureMeter: data.differential_pressure_meter || 0,
      temperatureMeter: data.temperature_meter || 0,
      dischargeCT: data.discharge_current_meter || 0,
      fanCT: data.fan_current_meter || 0,
      pumpCT: data.pump_current_meter || 0,
      gateway: data.gateway || 0,
      totalDevices: (data.additional_info?.equipment_summary?.total_devices) || 0
    };

    console.log(`✅ [EQUIPMENT-COUNTS] 수량 조회 완료: 총 ${equipmentCounts.totalDevices}개 기기`);

    return NextResponse.json({
      success: true,
      data: {
        businessId,
        businessName: data.business_name,
        equipmentCounts,
        lastCalculated: data.additional_info?.equipment_summary?.last_calculated
      }
    });

  } catch (error) {
    console.error('❌ [EQUIPMENT-COUNTS] 수량 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: '측정기기 수량 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}