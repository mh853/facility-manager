// app/api/business-list/route.ts - business_info 테이블 기반 대기필증 사업장 목록
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenHybrid } from '@/lib/secure-jwt'

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    console.log('🏢 [BUSINESS-LIST] 대기필증이 등록된 사업장 목록 조회');

    // 대기필증이 있는 business_id만 먼저 조회
    const { data: businessIdsWithPermits, error: permitError } = await supabaseAdmin
      .from('air_permit_info')
      .select('business_id')
      .not('business_id', 'is', null);

    if (permitError) {
      console.error('🔴 [BUSINESS-LIST] air_permit_info 조회 오류:', permitError);
      throw permitError;
    }

    // 대기필증이 있는 business_id 목록 추출 (중복 제거)
    const businessIdsSet = new Set(
      (businessIdsWithPermits || []).map((p: any) => p.business_id).filter(Boolean)
    );
    const businessIds = Array.from(businessIdsSet);

    console.log(`🏢 [BUSINESS-LIST] 대기필증 보유 사업장 수: ${businessIds.length}개`);

    if (businessIds.length === 0) {
      console.log('📋 [BUSINESS-LIST] 대기필증 보유 사업장이 없음');
      return createSuccessResponse({
        businesses: [],
        count: 0,
        metadata: {
          message: '대기필증 정보가 등록된 사업장이 없습니다',
          source: 'air_permit_info',
          hasPhotoData: true,
          criteriaUsed: 'air_permit_required'
        }
      });
    }

    // 대기필증이 있는 사업장만 business_info에서 조회
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
      .in('id', businessIds)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .not('business_name', 'is', null)
      .order('business_name');
    
    console.log(`🏢 [BUSINESS-LIST] 조회 결과:`, {
      permitBusinessesCount: businessIds.length,
      retrievedBusinesses: businessWithPermits?.length || 0,
      error: businessError?.message,
      sampleData: businessWithPermits?.slice(0, 3)?.map((b: any) => ({
        name: b.business_name,
        id: b.id
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
    
    // 대기필증이 등록된 BusinessInfo 객체만 반환
    console.log(`📋 [BUSINESS-LIST] 대기필증 보유 사업장 객체 반환: ${businessWithPermits.length}개`);

    return createSuccessResponse({
      businesses: businessWithPermits,
      count: businessWithPermits.length,
      metadata: {
        source: 'business_info_with_air_permits',
        totalCount: businessWithPermits.length,
        airPermitBusinessCount: businessIds.length,
        hasPhotoData: true,
        includesFullData: true,
        dataType: 'BusinessInfo[]',
        criteriaUsed: 'air_permit_required',
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

// POST: 신규 사업장 생성 (라우터 할당 시 사용)
export const POST = withApiHandler(
  async (request: NextRequest) => {
    try {
      // 인증 확인
      const authHeader = request.headers.get('authorization')
      let token: string | null = null

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '')
      } else {
        const cookieToken = request.cookies.get('auth_token')?.value
        if (cookieToken) token = cookieToken
      }

      if (!token) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const result = await verifyTokenHybrid(token)
      if (!result.user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const body = await request.json()
      const { business_name } = body

      if (!business_name || !business_name.trim()) {
        return createErrorResponse('사업장 이름은 필수입니다', 400)
      }

      console.log('[BUSINESS-LIST] 신규 사업장 생성:', {
        user: result.user.name,
        business_name
      })

      // 중복 확인
      const { data: existing } = await supabaseAdmin
        .from('business_info')
        .select('id, business_name')
        .eq('business_name', business_name.trim())
        .eq('is_deleted', false)
        .single()

      if (existing) {
        console.log('[BUSINESS-LIST] 이미 존재하는 사업장:', existing)
        return createSuccessResponse({
          id: existing.id,
          business_name: existing.business_name,
          message: '이미 존재하는 사업장입니다'
        })
      }

      // 신규 생성
      const { data: newBusiness, error } = await supabaseAdmin
        .from('business_info')
        .insert({
          business_name: business_name.trim(),
          is_deleted: false,
          is_active: true
        })
        .select('id, business_name')
        .single()

      if (error) {
        console.error('[BUSINESS-LIST] 생성 오류:', error)
        return createErrorResponse('사업장 생성 중 오류가 발생했습니다', 500)
      }

      console.log('[BUSINESS-LIST] 신규 사업장 생성 완료:', newBusiness)

      return createSuccessResponse({
        id: newBusiness.id,
        business_name: newBusiness.business_name,
        message: '신규 사업장이 등록되었습니다'
      })
    } catch (error: any) {
      console.error('[BUSINESS-LIST] POST 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)