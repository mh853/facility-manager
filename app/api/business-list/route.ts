// app/api/business-list/route.ts - Supabase 기반 사업장 목록
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    console.log('🔍 [BUSINESS-LIST] Supabase에서 사업장 목록 조회');
    
    // business_info 테이블에서 사업장 목록 가져오기
    const { data: businesses, error } = await supabaseAdmin
      .from('business_info')
      .select('business_name')
      .eq('is_deleted', false)
      .order('business_name');
    
    console.log(`🔍 [BUSINESS-LIST] 조회 결과:`, { 
      businesses: businesses?.length || 0, 
      error: error?.message,
      sampleData: businesses?.slice(0, 3)
    });
    
    if (error) {
      console.error('🔴 [BUSINESS-LIST] Supabase 조회 오류:', error);
      throw error;
    }
    
    if (!businesses || businesses.length === 0) {
      console.log('📋 [BUSINESS-LIST] 등록된 사업장이 없음 - 샘플 데이터 반환');
      return createSuccessResponse({
        businesses: [
          '(주)조양(전체)',
          '오메가칼라',
          '테스트 사업장'
        ],
        count: 3,
        metadata: {
          message: '등록된 사업장이 없어 샘플 데이터를 반환합니다',
          fallback: true
        }
      });
    }
    
    const businessNames = businesses.map((b: any) => b.business_name).filter(Boolean);
    
    return createSuccessResponse({
      businesses: businessNames,
      count: businessNames.length,
      metadata: {
        source: 'supabase',
        totalCount: businessNames.length
      }
    });
    
  } catch (error: any) {
    console.error('🔴 [BUSINESS-LIST] 오류:', error?.message || error);
    
    // 오류 시 샘플 데이터 반환
    return createSuccessResponse({
      businesses: [
        '(주)조양(전체)',
        '오메가칼라',
        '테스트 사업장'
      ],
      count: 3,
      metadata: {
        error: 'DATABASE_ERROR',
        message: error?.message || 'Supabase 연결에 실패했습니다',
        fallback: true
      }
    });
  }
}, { logLevel: 'debug' });