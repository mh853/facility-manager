// Phase 1 데이터베이스 마이그레이션 스크립트
const { supabaseAdmin } = require('../lib/supabase');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Phase 1 데이터베이스 마이그레이션 시작...\n');

  try {
    // SQL 마이그레이션 파일 읽기
    const migrationPath = path.join(__dirname, '../sql/03_phase1_departments_schema.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error('마이그레이션 파일을 찾을 수 없습니다: ' + migrationPath);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 마이그레이션 파일 로드 완료');
    console.log('🔄 데이터베이스 마이그레이션 실행 중...');

    // SQL 실행 (Supabase에서는 여러 구문을 한 번에 실행할 수 없으므로 분할)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        if (statement.includes('CREATE TABLE') ||
            statement.includes('ALTER TABLE') ||
            statement.includes('CREATE INDEX') ||
            statement.includes('INSERT INTO') ||
            statement.includes('UPDATE') ||
            statement.includes('CREATE OR REPLACE')) {

          const { error } = await supabaseAdmin.rpc('exec_sql', {
            sql_query: statement
          });

          if (error) {
            // 이미 존재하는 테이블/컬럼 등은 무시
            if (error.message.includes('already exists') ||
                error.message.includes('duplicate column name')) {
              console.log(`⏭️  건너뜀: ${statement.substring(0, 50)}...`);
            } else {
              console.error(`❌ 실행 실패: ${statement.substring(0, 50)}...`);
              console.error(`   오류: ${error.message}`);
              errorCount++;
            }
          } else {
            console.log(`✅ 실행 성공: ${statement.substring(0, 50)}...`);
            successCount++;
          }
        }
      } catch (err) {
        console.error(`❌ 예외 발생: ${statement.substring(0, 50)}...`);
        console.error(`   오류: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 마이그레이션 결과:');
    console.log('='.repeat(40));
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    console.log('='.repeat(40));

    // 마이그레이션 결과 검증
    await verifyMigration();

  } catch (error) {
    console.error('❌ 마이그레이션 실행 중 오류:', error.message);
    process.exit(1);
  }
}

async function verifyMigration() {
  console.log('\n🔍 마이그레이션 결과 검증...');

  try {
    // 1. departments 테이블 확인
    const { data: departments, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('*')
      .limit(1);

    if (deptError) {
      console.log('❌ departments 테이블 접근 실패:', deptError.message);
    } else {
      console.log('✅ departments 테이블 생성 확인');
    }

    // 2. employees 테이블 새 컬럼 확인
    const { data: employees, error: empError } = await supabaseAdmin
      .from('employees')
      .select('department_id, role, social_provider')
      .limit(1);

    if (empError) {
      console.log('❌ employees 테이블 확장 실패:', empError.message);
    } else {
      console.log('✅ employees 테이블 확장 확인');
    }

    // 3. 기본 부서 데이터 확인
    const { data: defaultDepts, error: defaultError } = await supabaseAdmin
      .from('departments')
      .select('name')
      .in('name', ['영업부', '설치부', '관리부']);

    if (defaultError) {
      console.log('❌ 기본 부서 데이터 확인 실패:', defaultError.message);
    } else {
      console.log(`✅ 기본 부서 데이터 확인: ${defaultDepts?.length || 0}개`);
    }

    console.log('\n🎉 Phase 1 마이그레이션 완료!');
    console.log('💡 다음 단계: npm run dev 후 Phase 1 테스트 실행');

  } catch (error) {
    console.error('❌ 검증 중 오류:', error.message);
  }
}

// 직접 실행된 경우
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration, verifyMigration };