// scripts/update-manufacturer-names.js - 제조사명 한글 업데이트
const { createClient } = require('@supabase/supabase-js');

// 환경변수 직접 설정
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateManufacturerNames() {
  try {
    console.log('🏭 제조사명 한글 업데이트 시작...');

    // 영어 → 한글 매핑
    const mappings = [
      { old: 'ecosense', new: '에코센스' },
      { old: 'gaia_cns', new: '가이아씨앤에스' },
      { old: 'evs', new: '이브이에스' }
    ];

    let totalUpdated = 0;

    for (const mapping of mappings) {
      console.log(`🔄 ${mapping.old} → ${mapping.new} 업데이트 중...`);
      
      const { count, error } = await supabase
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

      console.log(`✅ ${mapping.old} → ${mapping.new}: ${count || 0}개 업데이트`);
      totalUpdated += count || 0;
    }

    // 결과 확인
    console.log('📊 제조사명 분포 확인 중...');
    const { data: businesses } = await supabase
      .from('business_info')
      .select('manufacturer')
      .eq('is_active', true)
      .eq('is_deleted', false);

    const manufacturerCounts = businesses?.reduce((acc, item) => {
      const mfg = item.manufacturer || 'NULL';
      acc[mfg] = (acc[mfg] || 0) + 1;
      return acc;
    }, {}) || {};

    console.log('📋 최종 제조사 분포:', manufacturerCounts);
    console.log(`✅ 업데이트 완료: 총 ${totalUpdated}개 사업장`);

  } catch (error) {
    console.error('❌ 제조사명 업데이트 실패:', error);
    process.exit(1);
  }
}

updateManufacturerNames();