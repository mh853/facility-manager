import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/subsidy-crawler/registered-regions
 * URL 데이터관리에 등록된 활성화된 지역 목록 조회
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // URL 데이터관리에서 활성화된 지역 목록 조회
    const { data, error } = await supabase
      .from('direct_url_sources')
      .select('region_name')
      .eq('is_active', true);

    if (error) {
      console.error('[REGISTERED-REGIONS] Supabase 오류:', error);
      throw error;
    }

    // 중복 제거 및 정렬
    const uniqueRegions = [...new Set(data.map(d => d.region_name))]
      .filter(region => region && region.trim()) // null, undefined, 빈 문자열 제거
      .sort((a, b) => a.localeCompare(b, 'ko'));

    console.log(`[REGISTERED-REGIONS] 등록된 지역 ${uniqueRegions.length}곳 조회 성공`);

    return NextResponse.json({
      success: true,
      data: uniqueRegions,
    });
  } catch (error: any) {
    console.error('[REGISTERED-REGIONS] 오류:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
