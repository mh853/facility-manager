// scripts/check-all-businesses.js
// 모든 테이블에서 (유)태현환경 관련 데이터 확인

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllBusinesses() {
  const businessName = '(유)태현환경';

  console.log(`🔍 전체 테이블 스캔: ${businessName}\n`);

  // 1. businesses 테이블 (구 테이블)
  console.log('1️⃣ [businesses] 구 테이블 확인');
  const { data: oldBiz, error: oldError } = await supabase
    .from('businesses')
    .select('*')
    .eq('name', businessName);

  if (oldError) {
    console.error('   ❌ 조회 실패:', oldError.message);
  } else {
    console.log(`   ✅ 발견: ${oldBiz?.length || 0}개`);
    if (oldBiz && oldBiz.length > 0) {
      oldBiz.forEach(b => {
        console.log('   -', { id: b.id, name: b.name, status: b.status });
      });

      // 구 테이블 ID로 uploaded_files 확인
      const oldIds = oldBiz.map(b => b.id);
      const { data: oldFiles } = await supabase
        .from('uploaded_files')
        .select('id, filename, business_id')
        .in('business_id', oldIds);

      console.log(`   📷 연결된 파일: ${oldFiles?.length || 0}개`);
      if (oldFiles && oldFiles.length > 0) {
        oldFiles.forEach(f => {
          console.log(`      - ${f.filename} (business_id: ${f.business_id})`);
        });
      }
    }
  }

  console.log();

  // 2. business_info 테이블 (신규 테이블)
  console.log('2️⃣ [business_info] 신규 테이블 확인');
  const { data: newBiz, error: newError } = await supabase
    .from('business_info')
    .select('*')
    .eq('business_name', businessName)
    .eq('is_deleted', false);

  if (newError) {
    console.error('   ❌ 조회 실패:', newError.message);
  } else {
    console.log(`   ✅ 발견: ${newBiz?.length || 0}개`);
    if (newBiz && newBiz.length > 0) {
      newBiz.forEach(b => {
        console.log('   -', {
          id: b.id,
          business_name: b.business_name,
          실사자: b.presurvey_inspector_name || '없음',
          실사일: b.presurvey_inspector_date || '없음'
        });
      });

      // 신규 테이블 ID로 uploaded_files 확인
      const newIds = newBiz.map(b => b.id);
      const { data: newFiles } = await supabase
        .from('uploaded_files')
        .select('id, filename, business_id')
        .in('business_id', newIds);

      console.log(`   📷 연결된 파일: ${newFiles?.length || 0}개`);
      if (newFiles && newFiles.length > 0) {
        newFiles.forEach(f => {
          console.log(`      - ${f.filename} (business_id: ${f.business_id})`);
        });
      }
    }
  }

  console.log();

  // 3. uploaded_files 테이블에서 사업장명 직접 검색
  console.log('3️⃣ [uploaded_files] 전체 검색 (사업장명 패턴)');
  const { data: allFiles, error: filesError } = await supabase
    .from('uploaded_files')
    .select('id, filename, file_path, business_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filesError) {
    console.error('   ❌ 조회 실패:', filesError.message);
  } else {
    // 파일 경로에서 "태현환경" 포함된 것 찾기
    const taehyunFiles = allFiles?.filter(f =>
      f.file_path?.includes('태현') ||
      f.file_path?.includes('taehyun') ||
      f.file_path?.includes('taehyeon')
    ) || [];

    console.log(`   ✅ 최근 100개 파일 중 태현환경 관련: ${taehyunFiles.length}개`);
    if (taehyunFiles.length > 0) {
      taehyunFiles.forEach(f => {
        console.log(`      - ${f.filename}`);
        console.log(`        경로: ${f.file_path}`);
        console.log(`        business_id: ${f.business_id}`);
        console.log(`        업로드: ${f.created_at}`);
      });
    }
  }

  console.log('\n\n📊 [진단]');
  console.log('문제: uploaded_files 테이블에 (유)태현환경 사진이 없음');
  console.log('가능한 원인:');
  console.log('1. 업로드 시 브라우저에서 성공 메시지가 나왔지만 실제로는 업로드 실패');
  console.log('2. Supabase Storage에는 파일이 있지만 DB 메타데이터 저장 실패');
  console.log('3. business_id 매칭이 잘못되어 다른 ID로 저장됨');
  console.log('\n해결 방법:');
  console.log('1. 브라우저 콘솔 로그 확인 필요');
  console.log('2. 업로드 재시도 후 실시간 로그 모니터링');
}

checkAllBusinesses().catch(console.error);
