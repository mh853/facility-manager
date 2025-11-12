// scripts/check-taehyun-photos.js
// (유)태현환경 사업장의 사진 업로드 상태 확인

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTaehyunPhotos() {
  const businessName = '(유)태현환경';

  console.log(`🔍 [CHECK] ${businessName} 사진 업로드 상태 확인\n`);

  // 1. business_info 테이블에서 사업장 ID 조회
  const { data: business, error: businessError } = await supabase
    .from('business_info')
    .select('id, business_name, presurvey_inspector_name, presurvey_inspector_date')
    .eq('business_name', businessName)
    .eq('is_deleted', false)
    .single();

  if (businessError) {
    console.error('❌ [business_info] 조회 실패:', businessError);

    // businesses 테이블에서도 확인
    const { data: oldBusiness, error: oldError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('name', businessName)
      .single();

    if (oldError) {
      console.error('❌ [businesses] 조회 실패:', oldError);
      return;
    }

    console.log('✅ [businesses] 구 테이블에서 발견:', oldBusiness);
    console.log('\n⚠️ business_info 테이블에 데이터가 없습니다!');
    console.log('⚠️ /facility 페이지는 business_info 테이블만 조회합니다.');
    return;
  }

  console.log('✅ [business_info] 사업장 정보:');
  console.log('   - ID:', business.id);
  console.log('   - 이름:', business.business_name);
  console.log('   - 실사자:', business.presurvey_inspector_name || '없음');
  console.log('   - 실사일:', business.presurvey_inspector_date || '없음');
  console.log();

  // 2. uploaded_files 테이블에서 사진 개수 조회
  const { data: files, error: filesError } = await supabase
    .from('uploaded_files')
    .select('id, filename, file_path, facility_info, created_at')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false });

  if (filesError) {
    console.error('❌ [uploaded_files] 조회 실패:', filesError);
    return;
  }

  console.log(`📷 [uploaded_files] 업로드된 파일: ${files?.length || 0}개`);

  if (files && files.length > 0) {
    console.log('\n파일 목록:');
    files.forEach((file, index) => {
      console.log(`\n[${index + 1}] ${file.filename}`);
      console.log(`   - 경로: ${file.file_path}`);
      console.log(`   - 시설정보: ${file.facility_info || 'NULL'}`);
      console.log(`   - 업로드: ${file.created_at}`);
    });
  } else {
    console.log('⚠️ 업로드된 파일이 없습니다!');
  }

  // 3. API 응답 시뮬레이션
  console.log('\n\n🔬 [API 시뮬레이션] /api/business-list 응답 예상값:');
  const photoCount = files?.length || 0;
  const hasPhotos = photoCount > 0;

  console.log({
    id: business.id,
    business_name: business.business_name,
    photo_count: photoCount,
    has_photos: hasPhotos,
    presurvey_inspector_name: business.presurvey_inspector_name,
    presurvey_inspector_date: business.presurvey_inspector_date
  });

  // 4. 문제 진단
  console.log('\n\n📊 [진단 결과]');
  if (photoCount === 0) {
    console.log('❌ 문제: uploaded_files 테이블에 파일이 없습니다');
    console.log('   → 원인 1: 업로드가 실패했을 수 있음');
    console.log('   → 원인 2: business_id가 잘못 매칭됐을 수 있음');
    console.log('   → 원인 3: 메타데이터 저장 API가 실패했을 수 있음');
  } else if (!hasPhotos) {
    console.log('❌ 문제: photo_count는 있지만 has_photos가 false');
    console.log('   → API 로직 버그');
  } else {
    console.log('✅ 정상: DB에 파일이 있고 API 응답도 정상일 것으로 예상됨');
    console.log('   → 캐시 문제일 수 있음 (브라우저 새로고침 필요)');
  }
}

checkTaehyunPhotos().catch(console.error);
