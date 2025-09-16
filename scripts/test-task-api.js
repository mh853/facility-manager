// Task Management API 테스트 스크립트
// Node.js로 실행: node scripts/test-task-api.js

const baseUrl = 'http://localhost:3002';

// 테스트용 인증 토큰 (generate-test-token.js에서 생성된 토큰)
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MDJkYTJmMC1mZDgxLTQ0OWEtODdjMy01YmU5MjQwNjdkNGMiLCJlbWFpbCI6Im11bm9uZzJAZ21haWwuY29tIiwibmFtZSI6Iuy1nOusuO2YuCIsInBlcm1pc3Npb25MZXZlbCI6MywiZGVwYXJ0bWVudCI6IuyYgeyXhTHtjIAiLCJwb3NpdGlvbiI6IuywqOyepSIsImlhdCI6MTc1Nzk4NDMxOSwiZXhwIjoxNzU4MDcwNzE5fQ.zB8U4bJ8MAHPsAehUgxLmnci_Ud8cGxMUOcbc6Md1n0';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${authToken}`
};

// API 테스트 함수들
async function testTaskMetadata() {
  console.log('\n🔍 Testing Task Metadata API...');
  try {
    const response = await fetch(`${baseUrl}/api/tasks/metadata`, {
      method: 'GET',
      headers: headers
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ Metadata API 테스트 성공');
      console.log(`   - 카테고리: ${result.data.categories?.length || 0}개`);
      console.log(`   - 상태: ${result.data.statuses?.length || 0}개`);
      console.log(`   - 직원: ${result.data.employees?.length || 0}개`);
      return result.data;
    } else {
      console.log('❌ Metadata API 테스트 실패:', result.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Metadata API 에러:', error.message);
    return null;
  }
}

async function testTasksList() {
  console.log('\n📋 Testing Tasks List API...');
  try {
    const response = await fetch(`${baseUrl}/api/tasks?page=1&limit=10`, {
      method: 'GET',
      headers: headers
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ Tasks List API 테스트 성공');
      console.log(`   - 업무 개수: ${result.data.tasks?.length || 0}개`);
      console.log(`   - 전체 개수: ${result.data.pagination?.total || 0}개`);
      return result.data.tasks;
    } else {
      console.log('❌ Tasks List API 테스트 실패:', result.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Tasks List API 에러:', error.message);
    return null;
  }
}

async function testTaskCreate(metadata) {
  console.log('\n➕ Testing Task Create API...');

  if (!metadata || !metadata.categories?.length || !metadata.employees?.length) {
    console.log('❌ 메타데이터가 필요합니다. 먼저 metadata API를 테스트하세요.');
    return null;
  }

  const testTask = {
    title: 'API 테스트 업무',
    description: '자동 생성된 테스트 업무입니다.',
    category_id: metadata.categories[0].id,
    priority: 2,
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7일 후
    estimated_hours: 4,
    assigned_to: metadata.employees[0].id,
    tags: ['테스트', 'API'],
    is_urgent: false
  };

  try {
    const response = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(testTask)
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ Task Create API 테스트 성공');
      console.log(`   - 생성된 업무 ID: ${result.data.task?.id}`);
      console.log(`   - 제목: ${result.data.task?.title}`);
      return result.data.task;
    } else {
      console.log('❌ Task Create API 테스트 실패:', result.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Task Create API 에러:', error.message);
    return null;
  }
}

async function testTaskDetail(taskId) {
  if (!taskId) {
    console.log('❌ Task ID가 필요합니다.');
    return null;
  }

  console.log(`\n🔎 Testing Task Detail API for ID: ${taskId}...`);
  try {
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
      method: 'GET',
      headers: headers
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ Task Detail API 테스트 성공');
      console.log(`   - 업무 제목: ${result.data.task?.title}`);
      console.log(`   - 히스토리 개수: ${result.data.history?.length || 0}개`);
      return result.data;
    } else {
      console.log('❌ Task Detail API 테스트 실패:', result.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Task Detail API 에러:', error.message);
    return null;
  }
}

// 메인 테스트 실행
async function runTests() {
  console.log('🚀 Task Management API 테스트 시작...');

  if (authToken === 'YOUR_AUTH_TOKEN_HERE') {
    console.log('❌ 먼저 authToken 변수에 실제 인증 토큰을 설정하세요.');
    console.log('브라우저 개발자 도구에서 쿠키의 auth-token 값을 복사하여 사용하세요.');
    return;
  }

  // 1. 메타데이터 테스트
  const metadata = await testTaskMetadata();

  // 2. 업무 목록 테스트
  const tasksList = await testTasksList();

  // 3. 업무 생성 테스트
  const newTask = await testTaskCreate(metadata);

  // 4. 업무 상세 테스트 (새로 생성된 업무 또는 목록의 첫 번째 업무)
  const taskId = newTask?.id || tasksList?.[0]?.id;
  await testTaskDetail(taskId);

  console.log('\n✅ 모든 API 테스트 완료!');
}

// 토큰 확인 메시지
if (authToken === 'YOUR_AUTH_TOKEN_HERE') {
  console.log('📝 사용 방법:');
  console.log('1. 웹 브라우저에서 http://localhost:3000/admin 에 로그인');
  console.log('2. 개발자 도구(F12) → Application → Cookies → auth-token 값 복사');
  console.log('3. 이 파일의 authToken 변수에 복사한 값 입력');
  console.log('4. npm run dev 실행 후 node scripts/test-task-api.js 실행');
} else {
  runTests();
}

module.exports = {
  testTaskMetadata,
  testTasksList,
  testTaskCreate,
  testTaskDetail
};