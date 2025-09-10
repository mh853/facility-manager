// scripts/migrate-file-structure.js - 파일 구조 마이그레이션 스크립트
// Supabase 클라이언트 직접 생성 (스크립트용)
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경변수 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function migrateFileStructure() {
  console.log('🚀 [MIGRATION] 파일 구조 마이그레이션 시작');
  
  try {
    // 1. 구버전 패턴의 파일들 조회 (숫자/presurvey/ 또는 숫자/completion/ 패턴)
    const { data: oldFiles, error: selectError } = await supabaseAdmin
      .from('uploaded_files')
      .select(`
        id,
        business_id,
        filename,
        file_path,
        facility_info,
        businesses!business_id(name)
      `)
      .like('file_path', '%/presurvey/%')
      .not('file_path', 'like', 'business/%');

    if (selectError) {
      throw selectError;
    }

    if (!oldFiles || oldFiles.length === 0) {
      console.log('✅ [MIGRATION] 마이그레이션할 구버전 파일이 없습니다.');
      return;
    }

    console.log(`📋 [MIGRATION] 발견된 구버전 파일: ${oldFiles.length}개`);

    // 2. 각 파일의 새로운 경로 생성
    const migrationPlans = [];
    
    for (const file of oldFiles) {
      const oldPath = file.file_path;
      const pathParts = oldPath.split('/');
      
      // 구버전 구조: "2/presurvey/discharge/filename.jpg"
      // 신버전 구조: "business/presurvey/discharge/facility_discharge1/filename.jpg"
      
      if (pathParts.length >= 3) {
        const businessId = pathParts[0];
        const systemType = pathParts[1]; // presurvey or completion
        const category = pathParts[2]; // basic, discharge, prevention
        const filename = pathParts[pathParts.length - 1];
        
        // facility_id 생성 (facility_info를 기반으로)
        let facilityId = 'facility_1';
        
        if (file.facility_info) {
          const facilityInfo = file.facility_info;
          
          // 배출구나 시설번호 추출 시도
          const facilityNumberMatch = facilityInfo.match(/시설번호:\s*(\d+)/);
          const dischargeNumberMatch = facilityInfo.match(/배출구:\s*(\d+)/);
          
          if (facilityNumberMatch) {
            const num = facilityNumberMatch[1];
            facilityId = category === 'discharge' ? `facility_discharge${num}` :
                       category === 'prevention' ? `facility_prevention${num}` :
                       `facility_${num}`;
          } else if (dischargeNumberMatch) {
            const num = dischargeNumberMatch[1];
            facilityId = category === 'discharge' ? `facility_discharge${num}` :
                       category === 'prevention' ? `facility_prevention${num}` :
                       `facility_${num}`;
          } else {
            // 기본값 사용
            facilityId = category === 'discharge' ? 'facility_discharge1' :
                       category === 'prevention' ? 'facility_prevention1' :
                       'facility_1';
          }
        }
        
        const newPath = `business/${systemType}/${category}/${facilityId}/${filename}`;
        
        migrationPlans.push({
          id: file.id,
          businessName: file.businesses?.name || 'Unknown',
          oldPath,
          newPath,
          facilityInfo: file.facility_info
        });
      }
    }

    console.log(`📝 [MIGRATION] 마이그레이션 계획 생성 완료: ${migrationPlans.length}개 파일`);
    
    // 3. 마이그레이션 미리보기
    console.log('\n🔍 [PREVIEW] 마이그레이션 계획:');
    migrationPlans.slice(0, 5).forEach((plan, index) => {
      console.log(`${index + 1}. [${plan.businessName}]`);
      console.log(`   구버전: ${plan.oldPath}`);
      console.log(`   신버전: ${plan.newPath}`);
      console.log(`   시설정보: ${plan.facilityInfo}`);
      console.log('');
    });
    
    if (migrationPlans.length > 5) {
      console.log(`... 및 ${migrationPlans.length - 5}개 추가 파일`);
    }

    // 4. Supabase Storage에서 파일 이동
    console.log('\n📦 [STORAGE] 파일 이동 시작');
    const movedFiles = [];
    
    for (let i = 0; i < migrationPlans.length; i++) {
      const plan = migrationPlans[i];
      
      try {
        // 파일 복사 (Supabase에는 move가 없어서 copy 후 delete)
        const { data: copyData, error: copyError } = await supabaseAdmin.storage
          .from('facility-files')
          .copy(plan.oldPath, plan.newPath);

        if (copyError) {
          console.warn(`⚠️ [STORAGE] 파일 복사 실패: ${plan.oldPath} -> ${copyError.message}`);
          continue;
        }

        // 원본 파일 삭제
        const { error: deleteError } = await supabaseAdmin.storage
          .from('facility-files')
          .remove([plan.oldPath]);

        if (deleteError) {
          console.warn(`⚠️ [STORAGE] 원본 파일 삭제 실패: ${plan.oldPath} -> ${deleteError.message}`);
        }

        movedFiles.push(plan);
        console.log(`✅ [${i + 1}/${migrationPlans.length}] ${plan.oldPath} -> ${plan.newPath}`);

      } catch (error) {
        console.error(`❌ [STORAGE] 파일 이동 실패: ${plan.oldPath}`, error);
      }
    }

    // 5. 데이터베이스 업데이트
    console.log('\n💾 [DATABASE] 파일 경로 업데이트 시작');
    
    for (const plan of movedFiles) {
      try {
        const { error: updateError } = await supabaseAdmin
          .from('uploaded_files')
          .update({ file_path: plan.newPath })
          .eq('id', plan.id);

        if (updateError) {
          console.error(`❌ [DATABASE] 경로 업데이트 실패: ${plan.id}`, updateError);
        } else {
          console.log(`✅ [DATABASE] 경로 업데이트 완료: ${plan.id}`);
        }
      } catch (error) {
        console.error(`❌ [DATABASE] 경로 업데이트 실패: ${plan.id}`, error);
      }
    }

    console.log(`\n🎉 [MIGRATION] 마이그레이션 완료!`);
    console.log(`📊 [STATS] 총 ${migrationPlans.length}개 계획, ${movedFiles.length}개 성공`);

  } catch (error) {
    console.error('❌ [MIGRATION] 마이그레이션 실패:', error);
    throw error;
  }
}

// 직접 실행 시
if (require.main === module) {
  migrateFileStructure()
    .then(() => {
      console.log('✅ 마이그레이션 스크립트 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 마이그레이션 스크립트 실패:', error);
      process.exit(1);
    });
}

module.exports = { migrateFileStructure };