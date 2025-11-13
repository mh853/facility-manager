#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUSINESS_ID = '727c5a4d-5d46-46a7-95ec-eab2d80992c6'; // (유)태현환경

async function main() {
  console.log('🔍 사진 업로드 후 표시 문제 분석...\n');

  // 1. DB에서 최근 업로드된 파일 확인
  const { data: files, error } = await supabase
    .from('uploaded_files')
    .select('id, filename, file_path, facility_info, created_at')
    .eq('business_id', BUSINESS_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ DB 조회 실패:', error);
    return;
  }

  console.log(`📊 DB에 저장된 최근 파일: ${files.length}개\n`);
  files.forEach((file, idx) => {
    console.log(`${idx + 1}. ${file.filename}`);
    console.log(`   ID: ${file.id}`);
    console.log(`   경로: ${file.file_path}`);
    console.log(`   시설정보: ${file.facility_info || '⚠️ NULL'}`);
    console.log(`   생성일: ${file.created_at}\n`);
  });

  // 2. facility_info가 NULL인 파일 개수 확인
  const nullFacilityInfo = files.filter(f => !f.facility_info);
  if (nullFacilityInfo.length > 0) {
    console.log(`⚠️ facility_info가 NULL인 파일: ${nullFacilityInfo.length}개`);
    console.log('이 파일들은 business 페이지에서 표시되지 않습니다!\n');
    
    nullFacilityInfo.forEach(file => {
      console.log(`- ${file.filename}`);
      console.log(`  경로: ${file.file_path}`);
      console.log(`  해결: 경로에서 시설 정보를 추출하여 facility_info 설정 필요\n`);
    });
  }

  // 3. API 응답 시뮬레이션
  console.log('=' .repeat(60));
  console.log('API 응답 확인');
  console.log('='.repeat(60) + '\n');

  try {
    const response = await fetch(`http://localhost:3000/api/facility-photos?businessName=${encodeURIComponent('(유)태현환경')}&phase=presurvey`);
    const apiData = await response.json();

    console.log('📡 /api/facility-photos 응답:');
    console.log(JSON.stringify(apiData.data.statistics, null, 2));
    console.log(`\nAPI 반환 파일 수: ${apiData.data.files.length}개`);
    console.log(`DB 실제 파일 수: ${files.length}개`);

    if (apiData.data.files.length < files.length) {
      console.log(`\n⚠️ 불일치! API가 ${files.length - apiData.data.files.length}개 파일을 누락하고 있습니다.`);
      console.log('원인: facility_info가 NULL이어서 photoTracker가 분류하지 못함\n');
    }
  } catch (error) {
    console.error('❌ API 호출 실패:', error.message);
  }
}

main().catch(console.error);
