// app/api/business-list/route.ts - business_info 테이블 기반 대기필증 사업장 목록
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    console.log('🏢 [BUSINESS-LIST] business_info에서 대기필증 보유 사업장 목록 조회');
    
    // business_info 테이블에서 대기필증 정보가 있는 사업장만 조회
    const { data: businessWithPermits, error: businessError } = await supabaseAdmin
      .from('business_info')
      .select(`
        id,
        business_name,
        address,
        manager_name,
        manager_contact,
        ph_meter,
        differential_pressure_meter,
        temperature_meter,
        discharge_current_meter,
        fan_current_meter,
        pump_current_meter,
        gateway,
        air_permit_info!inner(
          id,
          is_active
        )
      `)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .eq('air_permit_info.is_active', true)
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
    
    // 사업장명만 추출하여 반환
    const businessNames = businessWithPermits
      .map((business: any) => business.business_name)
      .filter(Boolean);
    
    return createSuccessResponse({
      businesses: businessNames,
      count: businessNames.length,
      metadata: {
        source: 'business_info_with_air_permits',
        totalCount: businessNames.length,
        hasPhotoData: true,
        criteriaUsed: 'air_permit_required',
        additionalInfo: {
          avgDevicesPerBusiness: businessWithPermits.reduce((sum: number, b: any) => 
            sum + (b.ph_meter || 0) + (b.differential_pressure_meter || 0) + 
            (b.temperature_meter || 0) + (b.discharge_current_meter || 0) + 
            (b.fan_current_meter || 0) + (b.pump_current_meter || 0) + 
            (b.gateway || 0), 0) / businessNames.length
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