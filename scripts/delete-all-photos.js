// scripts/delete-all-photos.js
// (유)태현환경의 모든 사진 완전 삭제

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllPhotos() {
  const businessName = '(유)태현환경';

  console.log('🗑️  [DELETE-ALL] 모든 사진 삭제 시작\n');

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
    .eq('business_id', business.id);

  console.log(`📂 삭제 대상 파일: ${files?.length || 0}개\n`);

  if (!files || files.length === 0) {
    console.log('✅ 이미 파일이 없습니다.');
    return;
  }

  // 3. 파일 목록 표시
  console.log('삭제될 파일 목록:');
  files.forEach((f, i) => {
    console.log(`${i + 1}. ${f.filename}`);
    console.log(`   경로: ${f.file_path}`);
    console.log(`   업로드: ${f.created_at}\n`);
  });

  console.log('⚠️  정말 모든 파일을 삭제하시겠습니까?');
  console.log('   계속하려면 스크립트를 다시 실행하세요.\n');

  // 4. 스토리지에서 파일 삭제
  console.log('🧹 스토리지에서 파일 삭제 중...');
  const storagePaths = files.map(f => f.file_path);

  const { error: storageError } = await supabase.storage
    .from('facility-files')
    .remove(storagePaths);

  if (storageError) {
    console.warn('⚠️  스토리지 삭제 일부 실패:', storageError.message);
  } else {
    console.log('✅ 스토리지 삭제 완료');
  }

  // 5. DB에서 파일 레코드 삭제
  console.log('\n🗑️  DB 레코드 삭제 중...');
  const { error: dbError } = await supabase
    .from('uploaded_files')
    .delete()
    .eq('business_id', business.id);

  if (dbError) {
    console.error('❌ DB 삭제 실패:', dbError);
  } else {
    console.log('✅ DB 레코드 삭제 완료');
  }

  // 6. 최종 확인
  console.log('\n📊 최종 상태:');
  const { data: remaining } = await supabase
    .from('uploaded_files')
    .select('id')
    .eq('business_id', business.id);

  console.log(`   - 남은 파일: ${remaining?.length || 0}개`);

  if ((remaining?.length || 0) === 0) {
    console.log('\n🎉 모든 파일이 완전히 삭제되었습니다!');
  } else {
    console.log('\n⚠️  일부 파일이 남아있습니다.');
  }
}

deleteAllPhotos().catch(console.error);
