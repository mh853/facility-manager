// app/api/measurement-devices/route.ts - 측정기기 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 측정기기 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const businessName = searchParams.get('businessName');
    const deviceType = searchParams.get('deviceType');
    const status = searchParams.get('status');

    if (!businessId && !businessName) {
      return NextResponse.json({
        success: false,
        message: '사업장 ID 또는 사업장명이 필요합니다.'
      }, { status: 400 });
    }

    console.log(`📡 [DEVICES] 측정기기 조회:`, { businessId, businessName, deviceType, status });

    let actualBusinessId = businessId;

    // businessName으로 조회하는 경우 businessId 찾기
    if (!businessId && businessName) {
      const { data: business, error: businessError } = await supabaseAdmin
        .from('business_info')
        .select('id')
        .eq('business_name', businessName)
        .single();

      if (businessError || !business) {
        return NextResponse.json({
          success: true,
          data: [],
          message: '사업장을 찾을 수 없습니다.'
        });
      }

      actualBusinessId = business.id;
    }

    // 측정기기 조회
    let query = supabaseAdmin
      .from('measurement_devices')
      .select('*')
      .eq('business_id', actualBusinessId)
      .eq('is_active', true);

    if (deviceType) {
      query = query.eq('device_type', deviceType);
    }

    if (status) {
      query = query.eq('device_status', status);
    }

    const { data: devices, error: devicesError } = await query.order('created_at', { ascending: true });

    if (devicesError) {
      throw devicesError;
    }

    console.log(`✅ [DEVICES] 측정기기 조회 완료: ${devices.length}개`);

    return NextResponse.json({
      success: true,
      data: devices,
      count: devices.length
    });

  } catch (error) {
    console.error('❌ [DEVICES] 측정기기 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: '측정기기 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

// 측정기기 추가 (POST)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      business_id,
      device_type,
      device_name,
      model_number,
      serial_number,
      manufacturer,
      installation_location,
      measurement_range,
      accuracy,
      ct_ratio,
      primary_current,
      secondary_current,
      ip_address,
      mac_address,
      firmware_version,
      communication_protocol,
      device_status,
      calibration_date,
      next_calibration_date,
      last_maintenance_date,
      next_maintenance_date,
      additional_settings
    } = body;

    if (!business_id || !device_type || !device_name) {
      return NextResponse.json({
        success: false,
        message: '필수 필드가 누락되었습니다: business_id, device_type, device_name'
      }, { status: 400 });
    }

    console.log(`📡 [DEVICES] 측정기기 추가:`, { business_id, device_type, device_name });

    // 중복 확인 (같은 사업장, 같은 기기 타입, 같은 시리얼 번호)
    if (serial_number) {
      const { data: existingDevice } = await supabaseAdmin
        .from('measurement_devices')
        .select('id')
        .eq('business_id', business_id)
        .eq('device_type', device_type)
        .eq('serial_number', serial_number)
        .single();

      if (existingDevice) {
        return NextResponse.json({
          success: false,
          message: '동일한 시리얼 번호의 측정기기가 이미 등록되어 있습니다.'
        }, { status: 409 });
      }
    }

    // 측정기기 추가
    const { data: newDevice, error: insertError } = await supabaseAdmin
      .from('measurement_devices')
      .insert({
        business_id,
        device_type,
        device_name,
        model_number,
        serial_number,
        manufacturer,
        installation_location,
        measurement_range,
        accuracy,
        ct_ratio,
        primary_current,
        secondary_current,
        ip_address,
        mac_address,
        firmware_version,
        communication_protocol,
        device_status: device_status || 'normal',
        calibration_date,
        next_calibration_date,
        last_maintenance_date,
        next_maintenance_date,
        additional_settings: additional_settings || {},
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log(`✅ [DEVICES] 측정기기 추가 완료: ${newDevice.id} (${device_name})`);

    return NextResponse.json({
      success: true,
      data: newDevice,
      message: '측정기기가 추가되었습니다.'
    });

  } catch (error) {
    console.error('❌ [DEVICES] 측정기기 추가 실패:', error);
    return NextResponse.json({
      success: false,
      message: '측정기기 추가 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

// 측정기기 수정 (PUT)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      device_type,
      device_name,
      model_number,
      serial_number,
      manufacturer,
      installation_location,
      measurement_range,
      accuracy,
      ct_ratio,
      primary_current,
      secondary_current,
      ip_address,
      mac_address,
      firmware_version,
      communication_protocol,
      device_status,
      current_value,
      unit,
      calibration_date,
      next_calibration_date,
      last_maintenance_date,
      next_maintenance_date,
      additional_settings
    } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: '측정기기 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log(`📡 [DEVICES] 측정기기 수정: ${id}`);

    // 기존 측정기기 확인
    const { data: existingDevice, error: selectError } = await supabaseAdmin
      .from('measurement_devices')
      .select('business_id, serial_number')
      .eq('id', id)
      .single();

    if (selectError || !existingDevice) {
      return NextResponse.json({
        success: false,
        message: '측정기기를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 시리얼 번호 중복 확인 (다른 기기와)
    if (serial_number && serial_number !== existingDevice.serial_number) {
      const { data: duplicateDevice } = await supabaseAdmin
        .from('measurement_devices')
        .select('id')
        .eq('business_id', existingDevice.business_id)
        .eq('device_type', device_type)
        .eq('serial_number', serial_number)
        .neq('id', id)
        .single();

      if (duplicateDevice) {
        return NextResponse.json({
          success: false,
          message: '동일한 시리얼 번호의 측정기기가 이미 등록되어 있습니다.'
        }, { status: 409 });
      }
    }

    // 측정기기 수정
    const { data: updatedDevice, error: updateError } = await supabaseAdmin
      .from('measurement_devices')
      .update({
        device_type,
        device_name,
        model_number,
        serial_number,
        manufacturer,
        installation_location,
        measurement_range,
        accuracy,
        ct_ratio,
        primary_current,
        secondary_current,
        ip_address,
        mac_address,
        firmware_version,
        communication_protocol,
        device_status,
        current_value,
        unit,
        calibration_date,
        next_calibration_date,
        last_maintenance_date,
        next_maintenance_date,
        additional_settings: additional_settings || {},
        measurement_timestamp: current_value !== undefined ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log(`✅ [DEVICES] 측정기기 수정 완료: ${id} (${device_name})`);

    return NextResponse.json({
      success: true,
      data: updatedDevice,
      message: '측정기기가 수정되었습니다.'
    });

  } catch (error) {
    console.error('❌ [DEVICES] 측정기기 수정 실패:', error);
    return NextResponse.json({
      success: false,
      message: '측정기기 수정 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

// 측정기기 삭제 (DELETE)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('id');

    if (!deviceId) {
      return NextResponse.json({
        success: false,
        message: '측정기기 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log(`📡 [DEVICES] 측정기기 삭제: ${deviceId}`);

    // 측정기기 존재 확인
    const { data: existingDevice, error: selectError } = await supabaseAdmin
      .from('measurement_devices')
      .select('device_name')
      .eq('id', deviceId)
      .single();

    if (selectError || !existingDevice) {
      return NextResponse.json({
        success: false,
        message: '측정기기를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 소프트 삭제 (is_active = false)
    const { error: deleteError } = await supabaseAdmin
      .from('measurement_devices')
      .update({
        is_active: false,
        device_status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`✅ [DEVICES] 측정기기 삭제 완료: ${deviceId} (${existingDevice.device_name})`);

    return NextResponse.json({
      success: true,
      message: `측정기기 "${existingDevice.device_name}"가 삭제되었습니다.`
    });

  } catch (error) {
    console.error('❌ [DEVICES] 측정기기 삭제 실패:', error);
    return NextResponse.json({
      success: false,
      message: '측정기기 삭제 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}