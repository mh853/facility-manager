// 데이터베이스 연결 및 스키마 테스트 스크립트
// 환경변수 로드
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDatabaseSchema() {
  console.log('🔍 데이터베이스 스키마 테스트 시작...\n');

  try {
    // 1. 업무 카테고리 테이블 테스트
    console.log('1️⃣ Task Categories 테이블 테스트...');
    const { data: categories, error: categoriesError } = await supabase
      .from('task_categories')
      .select('*')
      .limit(5);

    if (categoriesError) {
      console.error('❌ Categories 조회 실패:', categoriesError.message);
    } else {
      console.log(`✅ Categories 조회 성공: ${categories.length}개`);
      if (categories.length > 0) {
        console.log(`   예시: ${categories[0].name} (${categories[0].color})`);
      }
    }

    // 2. 업무 상태 테이블 테스트
    console.log('\n2️⃣ Task Statuses 테이블 테스트...');
    const { data: statuses, error: statusesError } = await supabase
      .from('task_statuses')
      .select('*')
      .limit(5);

    if (statusesError) {
      console.error('❌ Statuses 조회 실패:', statusesError.message);
    } else {
      console.log(`✅ Statuses 조회 성공: ${statuses.length}개`);
      if (statuses.length > 0) {
        console.log(`   예시: ${statuses[0].name} (${statuses[0].status_type})`);
      }
    }

    // 3. 직원 테이블 테스트
    console.log('\n3️⃣ Employees 테이블 테스트...');
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, name, email, permission_level')
      .eq('is_active', true)
      .limit(5);

    if (employeesError) {
      console.error('❌ Employees 조회 실패:', employeesError.message);
    } else {
      console.log(`✅ Employees 조회 성공: ${employees.length}개`);
      if (employees.length > 0) {
        console.log(`   예시: ${employees[0].name} (권한레벨: ${employees[0].permission_level})`);
      }
    }

    // 4. 업무 테이블 테스트
    console.log('\n4️⃣ Tasks 테이블 테스트...');
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .limit(5);

    if (tasksError) {
      console.error('❌ Tasks 조회 실패:', tasksError.message);
    } else {
      console.log(`✅ Tasks 조회 성공: ${tasks.length}개`);
      if (tasks.length > 0) {
        console.log(`   예시: ${tasks[0].title} (우선순위: ${tasks[0].priority})`);
      }
    }

    // 5. 업무 상세 뷰 테스트
    console.log('\n5️⃣ Task Details 뷰 테스트...');
    const { data: taskDetails, error: detailsError } = await supabase
      .from('task_details')
      .select('id, title, category_name, status_name, assigned_to_name')
      .limit(3);

    if (detailsError) {
      console.error('❌ Task Details 조회 실패:', detailsError.message);
    } else {
      console.log(`✅ Task Details 조회 성공: ${taskDetails.length}개`);
      if (taskDetails.length > 0) {
        console.log(`   예시: ${taskDetails[0].title}`);
        console.log(`   카테고리: ${taskDetails[0].category_name || 'N/A'}`);
        console.log(`   상태: ${taskDetails[0].status_name}`);
        console.log(`   담당자: ${taskDetails[0].assigned_to_name}`);
      }
    }

    // 6. 히스토리 테이블 테스트
    console.log('\n6️⃣ Task History 테이블 테스트...');
    const { data: history, error: historyError } = await supabase
      .from('task_history')
      .select('*')
      .limit(3);

    if (historyError) {
      console.error('❌ Task History 조회 실패:', historyError.message);
    } else {
      console.log(`✅ Task History 조회 성공: ${history.length}개`);
      if (history.length > 0) {
        console.log(`   예시: ${history[0].action} (${history[0].created_at})`);
      }
    }

    console.log('\n✅ 모든 데이터베이스 스키마 테스트 완료!');
    return true;

  } catch (error) {
    console.error('\n❌ 데이터베이스 테스트 중 오류 발생:', error.message);
    return false;
  }
}

// 테스트 데이터 생성 함수
async function createTestTask() {
  console.log('\n🧪 테스트 업무 생성...');

  try {
    // 관리자 사용자 찾기
    const { data: admin, error: adminError } = await supabase
      .from('employees')
      .select('id, name')
      .eq('permission_level', 3)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (adminError || !admin) {
      console.error('❌ 관리자 사용자를 찾을 수 없습니다.');
      return false;
    }

    // 기본 카테고리와 상태 찾기
    const { data: category } = await supabase
      .from('task_categories')
      .select('id')
      .limit(1)
      .single();

    const { data: status } = await supabase
      .from('task_statuses')
      .select('id')
      .eq('name', '신규')
      .single();

    if (!category || !status) {
      console.error('❌ 기본 카테고리나 상태를 찾을 수 없습니다.');
      return false;
    }

    // 테스트 업무 생성
    const testTask = {
      title: `테스트 업무 ${new Date().toISOString()}`,
      description: '데이터베이스 테스트용 업무입니다.',
      category_id: category.id,
      status_id: status.id,
      priority: 2,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimated_hours: 2,
      created_by: admin.id,
      assigned_to: admin.id,
      tags: ['테스트', '데이터베이스'],
      is_urgent: false,
      progress_percentage: 0
    };

    const { data: newTask, error: createError } = await supabase
      .from('tasks')
      .insert(testTask)
      .select('*')
      .single();

    if (createError) {
      console.error('❌ 테스트 업무 생성 실패:', createError.message);
      return false;
    }

    console.log('✅ 테스트 업무 생성 성공!');
    console.log(`   ID: ${newTask.id}`);
    console.log(`   제목: ${newTask.title}`);
    console.log(`   담당자: ${admin.name}`);

    return newTask;

  } catch (error) {
    console.error('❌ 테스트 업무 생성 중 오류:', error.message);
    return false;
  }
}

// 메인 실행 함수
async function main() {
  console.log('🚀 Task Management 데이터베이스 테스트\n');

  // 환경변수 확인
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
    console.error('   .env.local 파일을 확인하세요.');
    return;
  }

  console.log('🔗 Supabase 연결 정보:');
  console.log(`   URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`   Service Role: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 50)}...`);

  // 스키마 테스트
  const schemaTestResult = await testDatabaseSchema();

  if (schemaTestResult) {
    // 테스트 데이터 생성
    await createTestTask();
  }

  console.log('\n🎯 다음 단계: API 엔드포인트 테스트를 진행하세요.');
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = {
  testDatabaseSchema,
  createTestTask
};