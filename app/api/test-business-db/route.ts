// app/api/test-business-db/route.ts - Supabase 비즈니스 데이터베이스 연결 테스트
import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import {
  getAllBusinesses,
  getBusinessStats,
  createBusiness,
  getBusinessNamesList
} from '@/lib/supabase-business';

export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    console.log('🔍 [TEST-BUSINESS-DB] Supabase 비즈니스 데이터베이스 연결 테스트 시작');

    const testResults: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // 1. 기본 연결 테스트 - 사업장명 목록 조회
    try {
      const businessNames = await getBusinessNamesList();
      testResults.tests.push({
        name: '사업장명 목록 조회',
        status: 'success',
        result: {
          count: businessNames.length,
          samples: businessNames.slice(0, 3)
        }
      });
      console.log(`✅ [TEST] 사업장명 목록: ${businessNames.length}개`);
    } catch (error) {
      testResults.tests.push({
        name: '사업장명 목록 조회',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('❌ [TEST] 사업장명 목록 실패:', error);
    }

    // 2. 상세 사업장 정보 조회
    try {
      const businesses = await getAllBusinesses({ limit: 5 });
      testResults.tests.push({
        name: '상세 사업장 정보 조회',
        status: 'success',
        result: {
          count: businesses.length,
          sample: businesses[0] ? {
            id: businesses[0].id,
            name: businesses[0].business_name,
            manufacturer: businesses[0].manufacturer,
            phase: businesses[0].installation_phase
          } : null
        }
      });
      console.log(`✅ [TEST] 상세 사업장 정보: ${businesses.length}개`);
    } catch (error) {
      testResults.tests.push({
        name: '상세 사업장 정보 조회',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('❌ [TEST] 상세 사업장 정보 실패:', error);
    }

    // 3. 통계 정보 조회
    try {
      const stats = await getBusinessStats();
      testResults.tests.push({
        name: '통계 정보 조회',
        status: 'success',
        result: stats
      });
      console.log('✅ [TEST] 통계 정보 조회 성공');
    } catch (error) {
      testResults.tests.push({
        name: '통계 정보 조회',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('❌ [TEST] 통계 정보 실패:', error);
    }

    // 4. 테스트 사업장 생성 (옵셔널)
    const url = new URL(request.url);
    if (url.searchParams.get('create_test') === 'true') {
      try {
        const testBusiness = {
          business_name: `테스트 사업장 ${Date.now()}`,
          business_registration_number: '999-99-99999',
          local_government: '테스트시',
          address: '테스트 주소',
          manager_name: '테스트 관리자',
          manager_contact: '010-0000-0000',
          manufacturer: 'ecosense' as const,
          vpn: 'wired' as const,
          installation_phase: 'presurvey' as const,
          ph_meter: 1,
          differential_pressure_meter: 1,
          temperature_meter: 1,
          discharge_current_meter: 0,
          fan_current_meter: 0,
          pump_current_meter: 0,
          gateway: 1,
          vpn_wired: 1,
          vpn_wireless: 0,
          explosion_proof_differential_pressure_meter_domestic: 0,
          explosion_proof_temperature_meter_domestic: 0,
          expansion_device: 0,
          relay_8ch: 0,
          relay_16ch: 0,
          main_board_replacement: 0,
          multiple_stack: 0,
          additional_info: { test: true },
          is_active: true,
          is_deleted: false
        };

        const newBusiness = await createBusiness(testBusiness);
        testResults.tests.push({
          name: '테스트 사업장 생성',
          status: 'success',
          result: {
            id: newBusiness.id,
            name: newBusiness.business_name
          }
        });
        console.log(`✅ [TEST] 테스트 사업장 생성: ${newBusiness.id}`);
      } catch (error) {
        testResults.tests.push({
          name: '테스트 사업장 생성',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error('❌ [TEST] 테스트 사업장 생성 실패:', error);
      }
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

    console.log(`📊 [TEST-BUSINESS-DB] 테스트 완료: ${successCount}/${totalCount} 성공`);

    return createSuccessResponse(testResults);

  } catch (error) {
    console.error('❌ [TEST-BUSINESS-DB] 전체 테스트 실패:', error);
    return createErrorResponse(
      `테스트 실행 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}, { logLevel: 'debug' });