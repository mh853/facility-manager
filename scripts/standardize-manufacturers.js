const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 제조사 정규화 매핑
const manufacturerMapping = {
  '1. 에코센스': '에코센스',
  '2. 크린어스': '크린어스',
  '3. 가이아씨앤에스': '가이아씨앤에스',
  '4. 이브이에스': '이브이에스',
};

async function standardizeManufacturers(dryRun = true) {
  console.log('🔍 제조사 데이터 정규화 작업 시작...\n');
  console.log(`모드: ${dryRun ? '테스트 모드 (실제 변경 없음)' : '실행 모드 (실제 변경)'}\n`);

  const results = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const [oldName, newName] of Object.entries(manufacturerMapping)) {
    console.log(`\n📝 처리중: "${oldName}" → "${newName}"`);

    // 해당 제조사명을 가진 레코드 조회
    const { data: businesses, error: fetchError } = await supabase
      .from('business_info')
      .select('id, business_name, manufacturer')
      .eq('manufacturer', oldName);

    if (fetchError) {
      console.error(`❌ 조회 오류: ${fetchError.message}`);
      results.errors.push({ oldName, error: fetchError.message });
      continue;
    }

    if (!businesses || businesses.length === 0) {
      console.log(`   ℹ️  해당 제조사명을 가진 레코드 없음`);
      continue;
    }

    console.log(`   📊 발견된 레코드: ${businesses.length}개`);
    results.total += businesses.length;

    if (dryRun) {
      console.log(`   ⏭️  테스트 모드 - 실제 업데이트 건너뜀`);
      console.log(`   샘플 레코드: ${businesses.slice(0, 3).map(b => b.business_name).join(', ')}`);
      results.skipped += businesses.length;
    } else {
      // 실제 업데이트 수행
      const { data: updated, error: updateError } = await supabase
        .from('business_info')
        .update({ manufacturer: newName })
        .eq('manufacturer', oldName)
        .select();

      if (updateError) {
        console.error(`   ❌ 업데이트 오류: ${updateError.message}`);
        results.errors.push({ oldName, newName, error: updateError.message });
        continue;
      }

      console.log(`   ✅ 성공적으로 업데이트: ${updated.length}개`);
      results.updated += updated.length;
    }
  }

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('📊 작업 결과 요약');
  console.log('='.repeat(60));
  console.log(`총 처리 대상: ${results.total}개`);
  console.log(`업데이트 완료: ${results.updated}개`);
  console.log(`건너뜀: ${results.skipped}개`);
  console.log(`오류 발생: ${results.errors.length}개`);

  if (results.errors.length > 0) {
    console.log('\n❌ 오류 목록:');
    results.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.oldName} → ${err.newName}: ${err.error}`);
    });
  }

  if (dryRun) {
    console.log('\n⚠️  테스트 모드로 실행되었습니다. 실제 데이터는 변경되지 않았습니다.');
    console.log('실제 업데이트를 실행하려면 다음 명령어를 사용하세요:');
    console.log('node scripts/standardize-manufacturers.js --execute');
  } else {
    console.log('\n✅ 데이터 정규화가 완료되었습니다!');
  }

  return results;
}

// 실행 모드 확인
const executeMode = process.argv.includes('--execute');
standardizeManufacturers(!executeMode)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 치명적 오류:', error);
    process.exit(1);
  });
