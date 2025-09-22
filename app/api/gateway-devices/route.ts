// app/api/gateway-devices/route.ts - 게이트웨이 기기 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 게이트웨이 목록 조회 (GET)
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

    console.log(`🔍 [GATEWAY-DEVICES] 게이트웨이 조회: ${businessId}`);

    // 측정기기 테이블에서 게이트웨이 타입만 조회
    const { data, error } = await supabaseAdmin
      .from('measurement_devices')
      .select('*')
      .eq('business_id', businessId)
      .eq('device_type', 'gateway')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 게이트웨이 데이터를 프론트엔드 형식으로 변환
    const gateways = data.map((device: any) => ({
      id: device.id,
      business_id: device.business_id,
      gateway_name: device.device_name,
      ip_address: device.ip_address || '',
      mac_address: device.mac_address || '',
      firmware_version: device.firmware_version,
      location: device.installation_location,
      assigned_outlets: device.facility_association?.outlet_ids || [],
      connection_status: device.device_status === 'normal' ? 'connected' : 
                        device.device_status === 'error' ? 'error' : 'disconnected',
      last_seen: device.measurement_timestamp,
      network_config: device.network_config || {},
      device_counts: {
        total_sensors: device.additional_settings?.total_sensors || 0,
        active_sensors: device.additional_settings?.active_sensors || 0
      },
      notes: device.additional_settings?.notes
    }));

    console.log(`✅ [GATEWAY-DEVICES] 조회 완료: ${gateways.length}개 게이트웨이`);

    return NextResponse.json({
      success: true,
      gateways
    });

  } catch (error) {
    console.error('❌ [GATEWAY-DEVICES] 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: '게이트웨이 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

// 게이트웨이 추가 (POST)
export async function POST(request: NextRequest) {
  try {
    const gatewayData = await request.json();

    console.log(`➕ [GATEWAY-DEVICES] 게이트웨이 추가:`, gatewayData);

    // 측정기기 테이블에 게이트웨이로 저장
    const deviceData = {
      business_id: gatewayData.business_id,
      device_type: 'gateway',
      device_name: gatewayData.gateway_name,
      ip_address: gatewayData.ip_address,
      mac_address: gatewayData.mac_address,
      firmware_version: gatewayData.firmware_version,
      installation_location: gatewayData.location,
      facility_association: {
        outlet_ids: gatewayData.assigned_outlets || []
      },
      device_status: gatewayData.connection_status === 'connected' ? 'normal' : 
                   gatewayData.connection_status === 'error' ? 'error' : 'inactive',
      network_config: gatewayData.network_config || {},
      additional_settings: {
        notes: gatewayData.notes,
        total_sensors: gatewayData.device_counts?.total_sensors || 0,
        active_sensors: gatewayData.device_counts?.active_sensors || 0
      },
      is_active: true
    };

    const { data, error } = await supabaseAdmin
      .from('measurement_devices')
      .insert([deviceData])
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`✅ [GATEWAY-DEVICES] 추가 완료: ${data.id}`);

    return NextResponse.json({
      success: true,
      message: '게이트웨이가 성공적으로 추가되었습니다.',
      gateway: data
    });

  } catch (error) {
    console.error('❌ [GATEWAY-DEVICES] 추가 실패:', error);
    return NextResponse.json({
      success: false,
      message: '게이트웨이 추가 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

// 게이트웨이 수정 (PUT)
export async function PUT(request: NextRequest) {
  try {
    const gatewayData = await request.json();

    if (!gatewayData.id) {
      return NextResponse.json({
        success: false,
        message: '게이트웨이 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log(`✏️ [GATEWAY-DEVICES] 게이트웨이 수정: ${gatewayData.id}`);

    // 측정기기 테이블 업데이트
    const updateData = {
      device_name: gatewayData.gateway_name,
      ip_address: gatewayData.ip_address,
      mac_address: gatewayData.mac_address,
      firmware_version: gatewayData.firmware_version,
      installation_location: gatewayData.location,
      facility_association: {
        outlet_ids: gatewayData.assigned_outlets || []
      },
      device_status: gatewayData.connection_status === 'connected' ? 'normal' : 
                   gatewayData.connection_status === 'error' ? 'error' : 'inactive',
      network_config: gatewayData.network_config || {},
      additional_settings: {
        notes: gatewayData.notes,
        total_sensors: gatewayData.device_counts?.total_sensors || 0,
        active_sensors: gatewayData.device_counts?.active_sensors || 0
      },
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('measurement_devices')
      .update(updateData)
      .eq('id', gatewayData.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`✅ [GATEWAY-DEVICES] 수정 완료: ${data.id}`);

    return NextResponse.json({
      success: true,
      message: '게이트웨이가 성공적으로 수정되었습니다.',
      gateway: data
    });

  } catch (error) {
    console.error('❌ [GATEWAY-DEVICES] 수정 실패:', error);
    return NextResponse.json({
      success: false,
      message: '게이트웨이 수정 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

// 게이트웨이 삭제 (DELETE)
export async function DELETE(request: NextRequest) {
  try {
    const { gatewayId } = await request.json();

    if (!gatewayId) {
      return NextResponse.json({
        success: false,
        message: '게이트웨이 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log(`🗑️ [GATEWAY-DEVICES] 게이트웨이 삭제: ${gatewayId}`);

    // 측정기기 테이블에서 논리 삭제
    const { error } = await supabaseAdmin
      .from('measurement_devices')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', gatewayId);

    if (error) {
      throw error;
    }

    console.log(`✅ [GATEWAY-DEVICES] 삭제 완료: ${gatewayId}`);

    return NextResponse.json({
      success: true,
      message: '게이트웨이가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('❌ [GATEWAY-DEVICES] 삭제 실패:', error);
    return NextResponse.json({
      success: false,
      message: '게이트웨이 삭제 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}