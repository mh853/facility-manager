// 샘플 업무 데이터 생성 스크립트
const { supabaseAdmin } = require('./supabase-client.js');

async function createSampleTasks() {
  try {
    console.log('🟡 샘플 업무 데이터 생성 시작...');

    // 필요한 데이터 조회
    const [categoriesResult, statusesResult, employeesResult] = await Promise.all([
      supabaseAdmin.from('task_categories').select('id, name').eq('is_active', true).limit(5),
      supabaseAdmin.from('task_statuses').select('id, name').eq('is_active', true),
      supabaseAdmin.from('employees').select('id, name').eq('is_active', true).eq('is_deleted', false).limit(3)
    ]);

    if (categoriesResult.error || statusesResult.error || employeesResult.error) {
      console.error('❌ 기본 데이터 조회 실패');
      return;
    }

    const categories = categoriesResult.data || [];
    const statuses = statusesResult.data || [];
    const employees = employeesResult.data || [];

    if (categories.length === 0 || statuses.length === 0 || employees.length === 0) {
      console.error('❌ 기본 데이터가 부족합니다.');
      console.log('Categories:', categories.length, 'Statuses:', statuses.length, 'Employees:', employees.length);
      return;
    }

    console.log('📊 기본 데이터 확인:');
    console.log(`  - 카테고리: ${categories.length}개`);
    console.log(`  - 상태: ${statuses.length}개`);
    console.log(`  - 직원: ${employees.length}개`);

    // 신규 상태 찾기
    const newStatus = statuses.find(s => s.name === '신규') || statuses[0];
    const inProgressStatus = statuses.find(s => s.name === '진행 중') || statuses[1];
    const completedStatus = statuses.find(s => s.name === '완료') || statuses[2];

    // 샘플 업무 생성
    const sampleTasks = [
      {
        title: '건양아울렛 현장 실사',
        description: '건양아울렛 시설 현황 확인 및 방지시설 설치 가능성 조사',
        category_id: categories.find(c => c.name === '현장 실사')?.id || categories[0].id,
        status_id: inProgressStatus.id,
        priority: 3,
        start_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7일 후
        estimated_hours: 4,
        created_by: employees[0].id,
        assigned_to: employees[0].id,
        tags: ['현장조사', '건양아울렛', '방지시설'],
        is_urgent: false,
        is_private: false,
        progress_percentage: 30
      },
      {
        title: '대우백화점 견적서 작성',
        description: '대우백화점 대기방지시설 설치 견적서 작성 및 발송',
        category_id: categories.find(c => c.name === '견적 작성')?.id || categories[1].id,
        status_id: newStatus.id,
        priority: 2,
        start_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3일 후
        estimated_hours: 2,
        created_by: employees[0].id,
        assigned_to: employees[1] ? employees[1].id : employees[0].id,
        tags: ['견적', '대우백화점', '대기방지시설'],
        is_urgent: false,
        is_private: false,
        progress_percentage: 0
      },
      {
        title: '롯데마트 계약 체결',
        description: '롯데마트 방지시설 설치 계약서 작성 및 계약금 수령 확인',
        category_id: categories.find(c => c.name === '계약 체결')?.id || categories[2].id,
        status_id: inProgressStatus.id,
        priority: 4,
        start_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2일 전
        due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1일 후
        estimated_hours: 3,
        created_by: employees[0].id,
        assigned_to: employees[0].id,
        tags: ['계약', '롯데마트', '긴급'],
        is_urgent: true,
        is_private: false,
        progress_percentage: 70
      },
      {
        title: '이마트 설치 진행',
        description: '이마트 트레이더 방지시설 설치 일정 조율 및 시공 진행',
        category_id: categories.find(c => c.name === '설치 진행')?.id || categories[3].id,
        status_id: inProgressStatus.id,
        priority: 3,
        start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5일 전
        due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10일 후
        estimated_hours: 16,
        created_by: employees[0].id,
        assigned_to: employees[2] ? employees[2].id : employees[0].id,
        tags: ['설치', '이마트', '트레이더'],
        is_urgent: false,
        is_private: false,
        progress_percentage: 45
      },
      {
        title: '홈플러스 보조금 신청서류 제출',
        description: '홈플러스 부착지원신청서 광주시청 제출',
        category_id: categories.find(c => c.name === '지원 신청')?.id || categories[4].id,
        status_id: completedStatus.id,
        priority: 2,
        start_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10일 전
        due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3일 전
        estimated_hours: 1,
        created_by: employees[0].id,
        assigned_to: employees[1] ? employees[1].id : employees[0].id,
        tags: ['보조금', '홈플러스', '광주시청'],
        is_urgent: false,
        is_private: false,
        progress_percentage: 100
      }
    ];

    console.log('📝 샘플 업무 생성 중...');

    for (let i = 0; i < sampleTasks.length; i++) {
      const task = sampleTasks[i];
      console.log(`📤 [${i + 1}/${sampleTasks.length}] "${task.title}" 생성 중...`);

      const { data, error } = await supabaseAdmin
        .from('tasks')
        .insert(task)
        .select('id, title')
        .single();

      if (error) {
        console.error(`❌ [${i + 1}] 생성 실패:`, error.message);
      } else {
        console.log(`✅ [${i + 1}] "${data.title}" 생성 완료 (ID: ${data.id})`);
      }
    }

    // 결과 확인
    const { data: finalTasks, error: countError } = await supabaseAdmin
      .from('tasks')
      .select('id, title, status:task_statuses(name), category:task_categories(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10);

    if (countError) {
      console.error('❌ 결과 확인 실패:', countError);
    } else {
      console.log('\n📊 샘플 업무 생성 결과:');
      console.log(`✅ 총 업무 수: ${finalTasks?.length || 0}개`);

      if (finalTasks && finalTasks.length > 0) {
        console.log('\n📋 최근 생성된 업무 목록:');
        finalTasks.forEach((task, index) => {
          console.log(`  ${index + 1}. ${task.title} (${task.category?.name} - ${task.status?.name})`);
        });
      }
    }

    console.log('\n🎉 샘플 업무 데이터 생성 완료!');

  } catch (error) {
    console.error('❌ 샘플 업무 생성 오류:', error);
  }
}

// 스크립트 실행
if (require.main === module) {
  createSampleTasks();
}

module.exports = { createSampleTasks };