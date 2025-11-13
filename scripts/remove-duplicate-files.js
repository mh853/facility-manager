// scripts/remove-duplicate-files.js
// 중복 파일 제거 스크립트

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function removeDuplicates() {
  const businessName = '(유)태현환경';

  console.log('🗑️  [DUPLICATE-REMOVAL] 중복 파일 제거 시작\n');

  // 1. 사업장 ID 조회
  const { data: business } = await supabase
    .from('business_info')
    .select('id')
    .eq('business_name', businessName)
    .eq('is_deleted', false)
    .single();

  if (!business) {
    console.error('❌ 사업장을 찾을 수 없습니다');
    return;
  }

  console.log(`✅ 사업장: ${businessName} (${business.id})\n`);

  // 2. 모든 파일 조회
  const { data: files } = await supabase
    .from('uploaded_files')
    .select('*')
    .eq('business_id', business.id)
    .order('filename, created_at');

  console.log(`📂 전체 파일: ${files?.length || 0}개\n`);

  if (!files || files.length === 0) {
    console.log('파일이 없습니다.');
    return;
  }

  // 3. 파일명별 그룹화
  const fileGroups = {};
  files.forEach(file => {
    if (!fileGroups[file.filename]) {
      fileGroups[file.filename] = [];
    }
    fileGroups[file.filename].push(file);
  });

  // 4. 중복 파일 분석
  console.log('🔍 중복 파일 분석:\n');
  const toDelete = [];

  for (const [filename, group] of Object.entries(fileGroups)) {
    if (group.length > 1) {
      console.log(`📄 ${filename}: ${group.length}개 발견`);

      // 최신 것 제외하고 나머지 삭제 대상
      const sorted = group.sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      );

      console.log(`   ✅ 유지: ${sorted[0].id} (${sorted[0].created_at})`);

      sorted.slice(1).forEach(f => {
        console.log(`   ❌ 삭제: ${f.id} (${f.created_at})`);
        toDelete.push(f);
      });

      console.log('');
    } else {
      console.log(`📄 ${filename}: 중복 없음`);
    }
  }

  console.log(`\n📊 요약:`);
  console.log(`   - 전체 파일: ${files.length}개`);
  console.log(`   - 고유 파일: ${Object.keys(fileGroups).length}개`);
  console.log(`   - 삭제 대상: ${toDelete.length}개`);

  // 5. 실제 삭제
  if (toDelete.length > 0) {
    console.log('\n🗑️  중복 파일 삭제 중...');

    const { error } = await supabase
      .from('uploaded_files')
      .delete()
      .in('id', toDelete.map(f => f.id));

    if (error) {
      console.error('❌ 삭제 실패:', error);
    } else {
      console.log(`✅ ${toDelete.length}개 중복 파일 삭제 완료`);

      // 삭제된 파일의 스토리지도 정리
      console.log('\n🧹 스토리지 정리 중...');
      const storagePaths = toDelete.map(f => f.file_path);

      const { error: storageError } = await supabase.storage
        .from('facility-files')
        .remove(storagePaths);

      if (storageError) {
        console.warn('⚠️  스토리지 정리 일부 실패:', storageError.message);
      } else {
        console.log('✅ 스토리지 정리 완료');
      }
    }
  } else {
    console.log('\n✅ 중복 파일이 없습니다.');
  }

  // 6. 최종 확인
  console.log('\n📊 최종 상태:');
  const { data: finalFiles } = await supabase
    .from('uploaded_files')
    .select('id')
    .eq('business_id', business.id);

  console.log(`   - 남은 파일: ${finalFiles?.length || 0}개`);
  console.log('\n🎉 작업 완료!');
}

removeDuplicates().catch(console.error);
