// app/api/settings/delay-criteria/route.ts - 지연/위험 업무 기준 설정 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

// 지연/위험 기준 타입 정의
export interface DelayCriteria {
  self: {
    delayed: number;
    risky: number;
  };
  subsidy: {
    delayed: number;
    risky: number;
  };
  as: {
    delayed: number;
    risky: number;
  };
  etc: {
    delayed: number;
    risky: number;
  };
}

// 기본값
const DEFAULT_CRITERIA: DelayCriteria = {
  self: { delayed: 7, risky: 14 },
  subsidy: { delayed: 14, risky: 20 },
  as: { delayed: 3, risky: 7 },
  etc: { delayed: 7, risky: 10 }
};

// GET: 현재 설정 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    console.log('📊 [DELAY-CRITERIA] 설정 조회 요청');

    // settings 테이블에서 delay_criteria 조회
    const { data: settings, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'delay_criteria')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116은 "not found" 에러
      console.error('🔴 [DELAY-CRITERIA] 조회 오류:', error);
      throw error;
    }

    let criteria = DEFAULT_CRITERIA;
    if (settings?.value) {
      try {
        criteria = JSON.parse(settings.value);
      } catch (parseError) {
        console.warn('⚠️ [DELAY-CRITERIA] 설정 파싱 오류, 기본값 사용:', parseError);
      }
    }

    console.log('✅ [DELAY-CRITERIA] 조회 성공:', criteria);

    return createSuccessResponse({
      data: criteria,
      message: '설정을 성공적으로 조회했습니다.'
    });

  } catch (error: any) {
    console.error('🔴 [DELAY-CRITERIA] GET 오류:', error?.message || error);
    return createErrorResponse('설정 조회 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// POST: 설정 저장
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();

    console.log('💾 [DELAY-CRITERIA] 설정 저장 요청:', body);

    // 요청 데이터 검증
    if (!body || typeof body !== 'object') {
      return createErrorResponse('유효하지 않은 요청 데이터입니다', 400);
    }

    // 필수 필드 검증
    const requiredTypes = ['self', 'subsidy', 'as', 'etc'];
    for (const type of requiredTypes) {
      if (!body[type] || typeof body[type] !== 'object') {
        return createErrorResponse(`${type} 설정이 누락되었습니다`, 400);
      }
      if (typeof body[type].delayed !== 'number' || typeof body[type].risky !== 'number') {
        return createErrorResponse(`${type} 설정의 값이 유효하지 않습니다`, 400);
      }
      if (body[type].delayed < 1 || body[type].risky < 1) {
        return createErrorResponse('설정 값은 1 이상이어야 합니다', 400);
      }
    }

    const criteria: DelayCriteria = body;

    // settings 테이블에 upsert
    const { data: result, error } = await supabaseAdmin
      .from('settings')
      .upsert({
        key: 'delay_criteria',
        value: JSON.stringify(criteria),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (error) {
      console.error('🔴 [DELAY-CRITERIA] 저장 오류:', error);
      throw error;
    }

    console.log('✅ [DELAY-CRITERIA] 저장 성공:', result);

    return createSuccessResponse({
      data: criteria,
      message: '설정이 성공적으로 저장되었습니다.'
    });

  } catch (error: any) {
    console.error('🔴 [DELAY-CRITERIA] POST 오류:', error?.message || error);
    return createErrorResponse('설정 저장 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });