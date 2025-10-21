// app/api/business-list/route.ts - business_info 테이블 기반 대기필증 사업장 목록
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    console.log('🏢 [BUSINESS-LIST] business_info에서 전체 사업장 목록 조회 (대기필증 여부 무관)');

    // business_info 테이블에서 모든 사업장 조회 (측정기기 정보 포함, 대기필증 여부 무관)
    const { data: businessWithPermits, error: businessError } = await supabaseAdmin
      .from('business_info')
      .select(`
        id,
        business_name,
        address,
        manager_name,
        manager_contact,
        sales_office,
        manufacturer,
        business_category,
        progress_status,
        ph_meter,
        differential_pressure_meter,
        temperature_meter,
        discharge_current_meter,
        fan_current_meter,
        pump_current_meter,
        gateway,
        vpn_wired,
        vpn_wireless,
        explosion_proof_differential_pressure_meter_domestic,
        explosion_proof_temperature_meter_domestic,
        expansion_device,
        relay_8ch,
        relay_16ch,
        main_board_replacement,
        multiple_stack,
        additional_cost,
        negotiation
      `)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .not('business_name', 'is', null)
      .order('business_name');
    
    console.log(`🏢 [BUSINESS-LIST] 조회 결과:`, { 
      businesses: businessWithPermits?.length || 0, 
      error: businessError?.message,
      sampleData: businessWithPermits?.slice(0, 3)?.map((b: any) => ({ 
        name: b.business_name, 
        permits: b.air_permit_info?.length || 0 
      }))
    });
    
    if (businessError) {
      console.error('🔴 [BUSINESS-LIST] business_info 조회 오류:', businessError);
      
      // 폴백: air_permit_management 테이블에서 조회
      console.log('🔍 [BUSINESS-LIST] 폴백: air_permit_management에서 조회');
      
      const { data: airPermits, error: airError } = await supabaseAdmin
        .from('air_permit_management')
        .select('business_name, business_id')
        .not('business_name', 'is', null)
        .order('business_name');
      
      if (airError) {
        throw airError;
      }
      
      const uniqueBusinessNames = Array.from(new Set(
        (airPermits || []).map((permit: any) => permit.business_name).filter(Boolean)
      ));
      
      return createSuccessResponse({
        businesses: uniqueBusinessNames,
        count: uniqueBusinessNames.length,
        metadata: {
          source: 'air_permit_management_fallback',
          totalCount: uniqueBusinessNames.length,
          hasPhotoData: false
        }
      });
    }
    
    if (!businessWithPermits || businessWithPermits.length === 0) {
      console.log('📋 [BUSINESS-LIST] 대기필증 보유 사업장이 없음');
      return createSuccessResponse({
        businesses: [],
        count: 0,
        metadata: {
          message: '대기필증 정보가 등록된 사업장이 없습니다',
          source: 'business_info',
          hasPhotoData: true,
          criteriaUsed: 'air_permit_required'
        }
      });
    }
    
    // 전체 BusinessInfo 객체 반환 (문자열 배열이 아닌 객체 배열)
    console.log(`📋 [BUSINESS-LIST] 사업장 객체 반환: ${businessWithPermits.length}개`);

    return createSuccessResponse({
      businesses: businessWithPermits, // 전체 객체 반환으로 변경
      count: businessWithPermits.length,
      metadata: {
        source: 'business_info_full_objects',
        totalCount: businessWithPermits.length,
        hasPhotoData: true,
        includesFullData: true,
        dataType: 'BusinessInfo[]', // 반환 타입 명시
        additionalInfo: {
          avgDevicesPerBusiness: businessWithPermits.reduce((sum: number, b: any) =>
            sum + (b.ph_meter || 0) + (b.differential_pressure_meter || 0) +
            (b.temperature_meter || 0) + (b.discharge_current_meter || 0) +
            (b.fan_current_meter || 0) + (b.pump_current_meter || 0) +
            (b.gateway || 0), 0) / businessWithPermits.length
        }
      }
    });
    
  } catch (error: any) {
    console.error('🔴 [BUSINESS-LIST] 오류:', error?.message || error);
    
    // 오류 시 빈 목록 반환 (대기필증 필수 조건)
    return createSuccessResponse({
      businesses: [],
      count: 0,
      metadata: {
        error: 'DATABASE_ERROR',
        message: error?.message || '데이터베이스 연결에 실패했습니다',
        source: 'business_info_error',
        hasPhotoData: false,
        fallback: true
      }
    });
  }
}, { logLevel: 'debug' });