// app/api/test-air-permit-db/route.ts - 대기필증 데이터베이스 연결 테스트
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { getSupabaseAdminClient } from '@/lib/supabase';

export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    console.log('🔍 [TEST-AIR-PERMIT-DB] 대기필증 데이터베이스 연결 테스트 시작');

    const adminClient = getSupabaseAdminClient();
    const testResults: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // 1. 대기필증 정보 테이블 조회
    try {
      const { data: airPermits, error } = await adminClient
        .from('air_permit_info')
        .select('*')
        .limit(5);

      if (error) {
        testResults.tests.push({
          name: '대기필증 정보 조회',
          status: 'failed',
          error: error.message
        });
      } else {
        testResults.tests.push({
          name: '대기필증 정보 조회',
          status: 'success',
          result: {
            count: airPermits.length,
            sample: airPermits[0] ? {
              id: airPermits[0].id,
              business_id: airPermits[0].business_id,
              permit_number: airPermits[0].permit_number,
              business_type: airPermits[0].business_type
            } : null
          }
        });
        console.log(`✅ [TEST] 대기필증 정보: ${airPermits.length}개`);
      }
    } catch (error) {
      testResults.tests.push({
        name: '대기필증 정보 조회',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('❌ [TEST] 대기필증 정보 실패:', error);
    }

    // 2. 전체 대기필증 개수 조회
    try {
      const { count, error } = await adminClient
        .from('air_permit_info')
        .select('*', { count: 'exact', head: true });

      if (error) {
        testResults.tests.push({
          name: '대기필증 총 개수 조회',
          status: 'failed',
          error: error.message
        });
      } else {
        testResults.tests.push({
          name: '대기필증 총 개수 조회',
          status: 'success',
          result: {
            totalCount: count
          }
        });
        console.log(`✅ [TEST] 대기필증 총 개수: ${count}개`);
      }
    } catch (error) {
      testResults.tests.push({
        name: '대기필증 총 개수 조회',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('❌ [TEST] 대기필증 개수 실패:', error);
    }

    // 3. 사업장-대기필증 관계 조회
    try {
      const { data: businessWithPermits, error } = await adminClient
        .from('air_permit_info')
        .select(`
          id,
          permit_number,
          business_type,
          business_info!inner(
            id,
            business_name,
            local_government
          )
        `)
        .limit(5);

      if (error) {
        testResults.tests.push({
          name: '사업장-대기필증 관계 조회',
          status: 'failed',
          error: error.message
        });
      } else {
        testResults.tests.push({
          name: '사업장-대기필증 관계 조회',
          status: 'success',
          result: {
            count: businessWithPermits.length,
            sample: businessWithPermits[0] ? {
              permit_id: businessWithPermits[0].id,
              permit_number: businessWithPermits[0].permit_number,
              business_name: businessWithPermits[0].business_info?.business_name,
              business_type: businessWithPermits[0].business_type
            } : null
          }
        });
        console.log(`✅ [TEST] 사업장-대기필증 관계: ${businessWithPermits.length}개`);
      }
    } catch (error) {
      testResults.tests.push({
        name: '사업장-대기필증 관계 조회',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('❌ [TEST] 사업장-대기필증 관계 실패:', error);
    }

    // 4. 배출구 정보 조회 (있다면)
    try {
      const { data: outlets, error } = await adminClient
        .from('discharge_outlets')
        .select('*')
        .limit(3);

      if (error) {
        testResults.tests.push({
          name: '배출구 정보 조회',
          status: 'failed',
          error: error.message
        });
      } else {
        testResults.tests.push({
          name: '배출구 정보 조회',
          status: 'success',
          result: {
            count: outlets.length,
            sample: outlets[0] ? {
              id: outlets[0].id,
              outlet_number: outlets[0].outlet_number,
              outlet_name: outlets[0].outlet_name
            } : null
          }
        });
        console.log(`✅ [TEST] 배출구 정보: ${outlets.length}개`);
      }
    } catch (error) {
      testResults.tests.push({
        name: '배출구 정보 조회',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('❌ [TEST] 배출구 정보 실패:', error);
    }

    // 전체 결과 평가
    const successCount = testResults.tests.filter((t: any) => t.status === 'success').length;
    const totalCount = testResults.tests.length;

    testResults.summary = {
      success: successCount,
      total: totalCount,
      successRate: `${Math.round((successCount / totalCount) * 100)}%`,
      overall: successCount === totalCount ? 'ALL_PASSED' : 'SOME_FAILED'
    };

    console.log(`📊 [TEST-AIR-PERMIT-DB] 테스트 완료: ${successCount}/${totalCount} 성공`);

    return createSuccessResponse(testResults);

  } catch (error) {
    console.error('❌ [TEST-AIR-PERMIT-DB] 전체 테스트 실패:', error);
    return createErrorResponse(
      `테스트 실행 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}, { logLevel: 'debug' });