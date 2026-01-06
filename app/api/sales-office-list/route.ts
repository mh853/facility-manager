import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { queryAll } from '@/lib/supabase-direct';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 영업점 목록 조회 (자동완성용 - 권한 불필요)
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [SALES-OFFICE-LIST] Direct PostgreSQL 영업점 목록 조회 시작');

    // 활성화된 영업점 목록 조회 - Direct PostgreSQL
    const settings = await queryAll(
      `SELECT sales_office, commission_percentage, commission_type
       FROM sales_office_cost_settings
       WHERE is_active = true
       ORDER BY sales_office ASC`,
      []
    );

    if (!settings) {
      console.error('❌ [SALES-OFFICE-LIST] 조회 오류: No data returned');
      return NextResponse.json({
        success: false,
        message: '영업점 목록 조회에 실패했습니다.'
      }, { status: 500 });
    }

    // 영업점별로 중복 제거하고 최신 설정만 유지
    const uniqueOffices = new Map<string, any>();

    settings?.forEach(setting => {
      const existing = uniqueOffices.get(setting.sales_office);
      if (!existing) {
        uniqueOffices.set(setting.sales_office, {
          name: setting.sales_office,
          commission_type: setting.commission_type,
          commission_percentage: setting.commission_percentage
        });
      }
    });

    const result = Array.from(uniqueOffices.values());

    console.log(`✅ [SALES-OFFICE-LIST] 조회 완료: ${result.length}개 영업점`);

    return NextResponse.json({
      success: true,
      data: {
        sales_offices: result,
        total_count: result.length
      }
    });

  } catch (error) {
    console.error('❌ [SALES-OFFICE-LIST] 예외 발생:', error);
    return NextResponse.json({
      success: false,
      message: '영업점 목록 조회 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
