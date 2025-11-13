// scripts/verify-api-responses.js
// API 응답 실제 테스트 스크립트

const businessName = '(유)태현환경';

async function verifyAPIs() {
  console.log('🧪 [VERIFY] API 응답 테스트\n');

  try {
    // 1. /api/business-list 테스트
    console.log('1️⃣ /api/business-list 테스트');
    const listResponse = await fetch('http://localhost:3000/api/business-list', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });

    const listData = await listResponse.json();
    const taehyunBiz = listData.data?.businesses?.find(
      (b) => b.business_name === businessName
    );

    if (taehyunBiz) {
      console.log(`✅ 사업장 발견: ${taehyunBiz.business_name}`);
      console.log(`   - photo_count: ${taehyunBiz.photo_count}`);
      console.log(`   - has_photos: ${taehyunBiz.has_photos}`);
    } else {
      console.log('❌ 사업장을 찾을 수 없음');
    }

    // 2. /api/uploaded-files-supabase 테스트
    console.log('\n2️⃣ /api/uploaded-files-supabase 테스트');
    const filesResponse = await fetch(
      `http://localhost:3000/api/uploaded-files-supabase?businessName=${encodeURIComponent(businessName)}&systemType=presurvey&refresh=true`,
      {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      }
    );

    const filesData = await filesResponse.json();

    if (filesData.success) {
      console.log(`✅ API 응답 성공`);
      console.log(`   - 파일 개수: ${filesData.data?.files?.length || 0}개`);

      if (filesData.data?.files?.length > 0) {
        console.log('\n   파일 목록:');
        filesData.data.files.forEach((file, i) => {
          console.log(`   ${i + 1}. ${file.originalName} (${file.folderName})`);
        });
      }
    } else {
      console.log('❌ API 실패:', filesData.message);
    }

    console.log('\n📊 [결과 요약]');
    console.log(`   - business-list API: ${taehyunBiz ? '✅ 정상' : '❌ 문제'}`);
    console.log(`   - uploaded-files API: ${filesData.success ? '✅ 정상' : '❌ 문제'}`);
    console.log(`   - photo_count: ${taehyunBiz?.photo_count || 0}`);
    console.log(`   - files returned: ${filesData.data?.files?.length || 0}`);

    if (taehyunBiz?.photo_count > 0 && filesData.data?.files?.length > 0) {
      console.log('\n🎉 [성공] API가 정상 작동하고 있습니다!');
      console.log('   브라우저를 강제 새로고침(Cmd+Shift+R)하면 사진이 보일 것입니다.');
    } else {
      console.log('\n⚠️ [주의] API 응답에 문제가 있습니다.');
    }

  } catch (error) {
    console.error('❌ [오류]', error.message);
  }
}

verifyAPIs().catch(console.error);
