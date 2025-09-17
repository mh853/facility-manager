// app/api/check-air-permit-schema/route.ts - 대기필증 테이블 스키마 확인
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse } from '@/lib/api-utils';
import { getSupabaseAdminClient } from '@/lib/supabase';

export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    console.log('🔍 [CHECK-SCHEMA] 대기필증 스키마 구조 확인 시작');

    const adminClient = getSupabaseAdminClient();

    // 1. air_permit_info 테이블 스키마 조회
    const { data: airPermitSample, error: airPermitError } = await adminClient
      .from('air_permit_info')
      .select('*')
      .limit(1)
      .single();

    // 2. business_info 테이블 스키마 조회
    const { data: businessSample, error: businessError } = await adminClient
      .from('business_info')
      .select('*')
      .limit(1)
      .single();

    // 3. discharge_outlets 테이블 스키마 조회
    const { data: outletSample, error: outletError } = await adminClient
      .from('discharge_outlets')
      .select('*')
      .limit(1)
      .single();

    const schemaInfo = {
      air_permit_info: {
        available: !airPermitError,
        columns: airPermitSample ? Object.keys(airPermitSample) : [],
        sample: airPermitSample,
        error: airPermitError?.message
      },
      business_info: {
        available: !businessError,
        columns: businessSample ? Object.keys(businessSample) : [],
        sample: businessSample ? {
          id: businessSample.id,
          business_name: businessSample.business_name,
          local_government: businessSample.local_government
        } : null,
        error: businessError?.message
      },
      discharge_outlets: {
        available: !outletError,
        columns: outletSample ? Object.keys(outletSample) : [],
        sample: outletSample,
        error: outletError?.message
      }
    };

    console.log('✅ [CHECK-SCHEMA] 스키마 확인 완료');

    return createSuccessResponse({
      schemaInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [CHECK-SCHEMA] 스키마 확인 실패:', error);
    throw error;
  }
}, { logLevel: 'debug' });