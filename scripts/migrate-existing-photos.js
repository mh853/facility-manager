// scripts/migrate-existing-photos.js
// 기존 사진들을 설치 전 실사(presurvey) 폴더로 마이그레이션하는 스크립트

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// 환경 변수 로드
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateExistingPhotos() {
  console.log('🚀 기존 사진 마이그레이션 시작...');
  
  try {
    // 1. 모든 업로드된 파일 조회 (presurvey 또는 completion이 포함되지 않은 경로)
    console.log('📂 기존 파일 조회 중...');
    const { data: files, error: filesError } = await supabase
      .from('uploaded_files')
      .select('id, file_path, original_filename, business_id')
      .not('file_path', 'like', '%/presurvey/%')
      .not('file_path', 'like', '%/completion/%')
      .order('created_at', { ascending: true });

    if (filesError) {
      throw filesError;
    }

    console.log(`📊 마이그레이션 대상 파일: ${files?.length || 0}개`);
    
    if (!files || files.length === 0) {
      console.log('✅ 마이그레이션할 파일이 없습니다.');
      return;
    }

    // 2. 각 파일별로 마이그레이션 수행
    const migrationResults = {
      success: [],
      failed: []
    };

    for (const file of files) {
      try {
        console.log(`🔄 처리 중: ${file.original_filename} (${file.file_path})`);
        
        // 기존 경로에서 새 경로로 변환
        // 예: business_name/discharge/facility_discharge1/file.jpg 
        // -> business_name/presurvey/discharge/facility_discharge1/file.jpg
        const pathParts = file.file_path.split('/');
        if (pathParts.length >= 3) {
          // 두 번째 위치(인덱스 1)에 'presurvey' 삽입
          pathParts.splice(1, 0, 'presurvey');
          const newPath = pathParts.join('/');
          
          console.log(`  📁 기존 경로: ${file.file_path}`);
          console.log(`  📁 새 경로: ${newPath}`);
          
          // 3. Supabase Storage에서 파일 복사 (move 대신 copy 사용으로 안전성 확보)
          const { data: moveData, error: moveError } = await supabase.storage
            .from('facility-files')
            .copy(file.file_path, newPath);

          if (moveError) {
            throw new Error(`Storage 파일 복사 실패: ${moveError.message}`);
          }

          // 4. 데이터베이스 업데이트
          const { error: updateError } = await supabase
            .from('uploaded_files')
            .update({ file_path: newPath })
            .eq('id', file.id);

          if (updateError) {
            throw new Error(`DB 업데이트 실패: ${updateError.message}`);
          }

          // 5. 기존 파일 삭제 (복사가 성공한 경우에만)
          const { error: deleteError } = await supabase.storage
            .from('facility-files')
            .remove([file.file_path]);

          if (deleteError) {
            console.warn(`⚠️ 기존 파일 삭제 실패 (무시): ${deleteError.message}`);
          }

          migrationResults.success.push({
            id: file.id,
            originalPath: file.file_path,
            newPath: newPath,
            filename: file.original_filename
          });
          
          console.log(`  ✅ 성공적으로 마이그레이션됨`);
          
        } else {
          throw new Error(`예상하지 못한 경로 형식: ${file.file_path}`);
        }

      } catch (error) {
        console.error(`  ❌ 파일 마이그레이션 실패: ${error.message}`);
        migrationResults.failed.push({
          id: file.id,
          path: file.file_path,
          filename: file.original_filename,
          error: error.message
        });
      }
    }

    // 결과 리포트
    console.log('\n📋 마이그레이션 완료 리포트:');
    console.log(`✅ 성공: ${migrationResults.success.length}개`);
    console.log(`❌ 실패: ${migrationResults.failed.length}개`);
    
    if (migrationResults.success.length > 0) {
      console.log('\n✅ 성공한 파일들:');
      migrationResults.success.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.filename}`);
        console.log(`     ${item.originalPath} → ${item.newPath}`);
      });
    }
    
    if (migrationResults.failed.length > 0) {
      console.log('\n❌ 실패한 파일들:');
      migrationResults.failed.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.filename} (${item.error})`);
      });
    }

    console.log('\n🎉 마이그레이션 프로세스 완료!');
    
  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateExistingPhotos();
}

export default migrateExistingPhotos;