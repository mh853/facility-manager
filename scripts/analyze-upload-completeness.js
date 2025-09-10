// scripts/analyze-upload-completeness.js - 업로드 완성도 분석 스크립트
// Supabase 클라이언트 직접 생성 (스크립트용)
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경변수 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeUploadCompleteness() {
  console.log('🔍 [ANALYSIS] 업로드 완성도 분석 시작');
  
  try {
    // 1. 모든 사업장 조회
    const { data: businesses, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id, name, status, facility_info, created_at')
      .order('name');

    if (businessError) {
      throw businessError;
    }

    console.log(`📋 [ANALYSIS] 총 사업장 수: ${businesses.length}개`);

    // 2. 각 사업장별 파일 수 조회
    const uploadStats = [];
    
    for (const business of businesses) {
      // presurvey 파일 수
      const { count: presurveyCount, error: presurveyError } = await supabaseAdmin
        .from('uploaded_files')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .like('file_path', '%/presurvey/%');

      // completion 파일 수
      const { count: completionCount, error: completionError } = await supabaseAdmin
        .from('uploaded_files')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .like('file_path', '%/completion/%');

      const totalFiles = (presurveyCount || 0) + (completionCount || 0);
      
      // 시설 정보가 있는지 확인 (시설이 있어야 사진도 있어야 함)
      const hasFacilityInfo = business.facility_info && 
        (business.facility_info.discharge_facilities?.length > 0 ||
         business.facility_info.prevention_facilities?.length > 0 ||
         business.facility_info.basic_facilities?.length > 0);

      uploadStats.push({
        name: business.name,
        status: business.status,
        presurveyFiles: presurveyCount || 0,
        completionFiles: completionCount || 0,
        totalFiles,
        hasFacilityInfo,
        createdAt: business.created_at,
        facilityCount: hasFacilityInfo ? 
          (business.facility_info.discharge_facilities?.length || 0) +
          (business.facility_info.prevention_facilities?.length || 0) +
          (business.facility_info.basic_facilities?.length || 0) : 0
      });
    }

    // 3. 통계 분석
    const stats = {
      totalBusinesses: uploadStats.length,
      withFiles: uploadStats.filter(b => b.totalFiles > 0).length,
      withoutFiles: uploadStats.filter(b => b.totalFiles === 0).length,
      withFacilityInfo: uploadStats.filter(b => b.hasFacilityInfo).length,
      shouldHaveFilesButDont: uploadStats.filter(b => b.hasFacilityInfo && b.totalFiles === 0).length
    };

    // 4. 결과 출력
    console.log('\n📊 [STATS] 업로드 통계:');
    console.log(`전체 사업장: ${stats.totalBusinesses}개`);
    console.log(`파일 있는 사업장: ${stats.withFiles}개`);
    console.log(`파일 없는 사업장: ${stats.withoutFiles}개`);
    console.log(`시설정보 있는 사업장: ${stats.withFacilityInfo}개`);
    console.log(`시설정보는 있지만 파일은 없는 사업장: ${stats.shouldHaveFilesButDont}개`);

    // 5. 파일이 많은 상위 사업장
    console.log('\n🏆 [TOP-UPLOADS] 파일 업로드가 많은 사업장:');
    const topUploads = uploadStats
      .filter(b => b.totalFiles > 0)
      .sort((a, b) => b.totalFiles - a.totalFiles)
      .slice(0, 10);

    topUploads.forEach((business, index) => {
      console.log(`${index + 1}. ${business.name}: ${business.totalFiles}개 (사전:${business.presurveyFiles}, 완료:${business.completionFiles})`);
    });

    // 6. 시설정보는 있지만 파일이 없는 사업장 (우선 업로드 대상)
    console.log('\n⚠️ [PRIORITY] 우선 업로드 대상 (시설정보 있음, 파일 없음):');
    const priorityBusinesses = uploadStats
      .filter(b => b.hasFacilityInfo && b.totalFiles === 0)
      .sort((a, b) => b.facilityCount - a.facilityCount)
      .slice(0, 15);

    priorityBusinesses.forEach((business, index) => {
      console.log(`${index + 1}. ${business.name}: ${business.facilityCount}개 시설`);
    });

    // 7. 파일 없는 전체 사업장 목록
    console.log('\n📝 [NO-FILES] 파일이 없는 사업장 전체 목록:');
    const noFileBusinesses = uploadStats
      .filter(b => b.totalFiles === 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    noFileBusinesses.forEach((business, index) => {
      const facilityStatus = business.hasFacilityInfo ? `(${business.facilityCount}개 시설)` : '(시설정보 없음)';
      console.log(`${index + 1}. ${business.name} ${facilityStatus}`);
    });

    // 8. CSV 형태로 결과 저장
    const csvContent = [
      'Name,Status,PresurveyFiles,CompletionFiles,TotalFiles,HasFacilityInfo,FacilityCount,CreatedAt',
      ...uploadStats.map(b => 
        `"${b.name}","${b.status}",${b.presurveyFiles},${b.completionFiles},${b.totalFiles},${b.hasFacilityInfo},${b.facilityCount},"${b.createdAt}"`
      )
    ].join('\n');

    // 임시 파일로 저장
    const fs = require('fs');
    const path = require('path');
    const csvPath = path.join(__dirname, '..', 'upload-completeness-analysis.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    
    console.log(`\n💾 [EXPORT] 분석 결과 저장: ${csvPath}`);

    return {
      stats,
      topUploads,
      priorityBusinesses,
      noFileBusinesses,
      allBusinesses: uploadStats
    };

  } catch (error) {
    console.error('❌ [ANALYSIS] 분석 실패:', error);
    throw error;
  }
}

// 직접 실행 시
if (require.main === module) {
  analyzeUploadCompleteness()
    .then((result) => {
      console.log('\n✅ 업로드 완성도 분석 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 업로드 완성도 분석 실패:', error);
      process.exit(1);
    });
}

module.exports = { analyzeUploadCompleteness };