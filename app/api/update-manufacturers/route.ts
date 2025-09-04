// app/api/update-manufacturers/route.ts - 제조사명 한글 업데이트
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🏭 [UPDATE-MANUFACTURERS] 제조사명 한글 업데이트 시작...');

    const { supabaseAdmin } = await import('@/lib/supabase');
    
    // 영어 제조사명을 한글로 매핑
    const manufacturerMappings = [
      { old: 'ecosense', new: '에코센스' },
      { old: 'gaia_cns', new: '가이아씨앤에스' },
      { old: 'evs', new: '이브이에스' }
    ];
    
    let totalUpdated = 0;
    
    for (const mapping of manufacturerMappings) {
      console.log(`🔄 [UPDATE-MANUFACTURERS] ${mapping.old} → ${mapping.new} 업데이트 중...`);
      
      const { count, error } = await supabaseAdmin
        .from('business_info')
        .update({ 
          manufacturer: mapping.new,
          updated_at: new Date().toISOString()
        })
        .eq('manufacturer', mapping.old)
        .eq('is_active', true)
        .eq('is_deleted', false);
        
      if (error) {
        throw new Error(`${mapping.old} 업데이트 실패: ${error.message}`);
      }
      
      console.log(`✅ [UPDATE-MANUFACTURERS] ${mapping.old} → ${mapping.new}: ${count || 0}개 업데이트`);
      totalUpdated += count || 0;
    }
    
    // 최종 결과 확인
    const { data: manufacturers, error: checkError } = await supabaseAdmin
      .from('business_info')
      .select('manufacturer')
      .eq('is_active', true)
      .eq('is_deleted', false);
      
    if (checkError) {
      console.warn('⚠️ 결과 확인 실패:', checkError);
    }
    
    const manufacturerCounts = manufacturers?.reduce((acc: any, item: any) => {
      const mfg = item.manufacturer || 'NULL';
      acc[mfg] = (acc[mfg] || 0) + 1;
      return acc;
    }, {}) || {};
    
    console.log('📊 [UPDATE-MANUFACTURERS] 최종 제조사 분포:', manufacturerCounts);
    
    return NextResponse.json({
      success: true,
      message: `제조사명 한글 업데이트 완료: ${totalUpdated}개 사업장`,
      totalUpdated,
      manufacturerCounts
    });
    
  } catch (error) {
    console.error('❌ [UPDATE-MANUFACTURERS] 업데이트 실패:', error);
    return NextResponse.json({
      success: false,
      message: '제조사명 업데이트 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}