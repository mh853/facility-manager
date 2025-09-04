// 데이터베이스 최적화 스크립트 실행 도구
const fs = require('fs');
const path = require('path');

// Supabase 클라이언트 import (ES 모듈 문법 사용 안함)
const { createClient } = require('@supabase/supabase-js');

// 환경변수 로드
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLFile(filePath) {
  try {
    console.log(`📖 SQL 파일 읽는 중: ${filePath}`);
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // SQL 스크립트를 개별 명령어로 분할 (세미콜론 기준)
    const sqlCommands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    console.log(`🔧 총 ${sqlCommands.length}개의 SQL 명령어 실행 예정`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      if (command.trim().length === 0) continue;
      
      try {
        console.log(`⚡ 실행 중 (${i + 1}/${sqlCommands.length}): ${command.substring(0, 50)}...`);
        
        const { data, error } = await supabase.rpc('exec_sql', { sql: command });
        
        if (error) {
          console.error(`❌ SQL 실행 오류 (${i + 1}):`, error.message);
          console.error('SQL:', command.substring(0, 200) + '...');
          errorCount++;
        } else {
          successCount++;
          if (data) {
            console.log(`✅ 완료 (${i + 1}): 결과 -`, JSON.stringify(data).substring(0, 100));
          }
        }
      } catch (execError) {
        console.error(`❌ 실행 예외 (${i + 1}):`, execError.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 실행 결과:`);
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    
    return { successCount, errorCount };
    
  } catch (error) {
    console.error('❌ SQL 파일 처리 오류:', error.message);
    throw error;
  }
}

async function testDatabaseConnection() {
  try {
    console.log('🔌 데이터베이스 연결 테스트 중...');
    const { data, error } = await supabase
      .from('business_info')
      .select('count(*)')
      .limit(1);
      
    if (error) {
      console.error('❌ 데이터베이스 연결 실패:', error.message);
      return false;
    }
    
    console.log('✅ 데이터베이스 연결 성공');
    return true;
  } catch (error) {
    console.error('❌ 연결 테스트 예외:', error.message);
    return false;
  }
}

async function getBusinessStats() {
  try {
    console.log('📊 현재 사업장 데이터 통계 조회 중...');
    
    const { data, error } = await supabase
      .from('business_info')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ 통계 조회 실패:', error.message);
      return null;
    }
    
    const totalCount = data || 0;
    
    // 활성 사업장 수 조회
    const { count: activeCount } = await supabase
      .from('business_info')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_deleted', false);
    
    // 담당자가 있는 사업장 수 조회
    const { count: withManagerCount } = await supabase
      .from('business_info')
      .select('*', { count: 'exact', head: true })
      .not('manager_name', 'is', null);
    
    const stats = {
      total: totalCount,
      active: activeCount,
      withManager: withManagerCount,
      timestamp: new Date().toISOString()
    };
    
    console.log('📈 현재 통계:');
    console.log(`   총 사업장: ${stats.total}개`);
    console.log(`   활성 사업장: ${stats.active}개`);
    console.log(`   담당자 보유: ${stats.withManager}개`);
    
    return stats;
    
  } catch (error) {
    console.error('❌ 통계 조회 예외:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 데이터베이스 최적화 스크립트 시작\n');
  
  // 1. 연결 테스트
  const isConnected = await testDatabaseConnection();
  if (!isConnected) {
    console.error('❌ 데이터베이스 연결에 실패하여 종료합니다.');
    process.exit(1);
  }
  
  // 2. 현재 상태 확인
  const beforeStats = await getBusinessStats();
  
  // 3. SQL 파일 경로 확인
  const sqlFilePath = path.join(__dirname, '../database/optimize_business_schema.sql');
  
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ SQL 파일을 찾을 수 없습니다: ${sqlFilePath}`);
    process.exit(1);
  }
  
  console.log(`\n🔧 최적화 스크립트 실행 중...\n`);
  
  try {
    // 4. SQL 스크립트 실행
    const result = await executeSQLFile(sqlFilePath);
    
    // 5. 결과 확인
    console.log(`\n✅ 데이터베이스 최적화 완료!`);
    console.log(`   성공한 명령어: ${result.successCount}개`);
    console.log(`   실패한 명령어: ${result.errorCount}개`);
    
    if (result.errorCount > 0) {
      console.log('\n⚠️  일부 명령어가 실패했습니다. 로그를 확인해주세요.');
    }
    
    // 6. 최적화 후 상태 확인
    const afterStats = await getBusinessStats();
    
    if (beforeStats && afterStats) {
      console.log('\n📊 최적화 전후 비교:');
      console.log(`   데이터 변화: ${beforeStats.total} → ${afterStats.total}`);
      console.log(`   최적화 완료 시각: ${afterStats.timestamp}`);
    }
    
    console.log('\n🎉 모든 작업이 완료되었습니다!');
    
  } catch (error) {
    console.error('\n❌ 최적화 실행 중 오류 발생:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 예상치 못한 오류:', error);
    process.exit(1);
  });
}

module.exports = { executeSQLFile, testDatabaseConnection, getBusinessStats };