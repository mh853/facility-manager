const { supabaseAdmin } = require('./supabase-client.js');
const fs = require('fs').promises;
const path = require('path');

async function applyTaskCategories() {
  try {
    console.log('🟡 업무 카테고리 업데이트 시작...');

    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, 'update-task-categories.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');

    // SQL을 문장별로 분리 (세미콜론 기준)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 ${statements.length}개의 SQL 문장을 실행합니다...`);

    // 각 SQL 문장 실행
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`📤 [${i + 1}/${statements.length}] SQL 실행 중...`);

      try {
        const { data, error } = await supabaseAdmin.rpc('execute_sql', {
          sql_query: statement
        });

        if (error) {
          // Supabase에서 직접 SQL 실행이 지원되지 않을 수 있으므로 개별 작업으로 처리
          console.log('⚠️ RPC 방식 실패, 개별 작업으로 전환...');
          break;
        }

        console.log(`✅ [${i + 1}/${statements.length}] 완료`);
      } catch (error) {
        console.log('⚠️ RPC 방식 실패, 개별 작업으로 전환...');
        break;
      }
    }

    // 개별 작업으로 카테고리 업데이트
    console.log('🔄 개별 작업으로 카테고리 업데이트...');

    // 기존 카테고리 비활성화
    const { error: deactivateError } = await supabaseAdmin
      .from('task_categories')
      .update({ is_active: false })
      .eq('is_active', true);

    if (deactivateError) {
      console.error('❌ 기존 카테고리 비활성화 실패:', deactivateError);
      return;
    }

    // 시스템 사용자 ID 조회 (없으면 첫 번째 관리자 사용자 사용)
    const { data: systemUser } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('permission_level', 3)
      .eq('is_active', true)
      .limit(1)
      .single();

    const createdBy = systemUser?.id || '00000000-0000-0000-0000-000000000000';

    // 새 카테고리 추가
    const categories = [
      // 자비 진행 업무
      { name: '고객 상담', description: '초기 연락 및 거래 의사 확인', color: '#3B82F6', icon: 'users', sort_order: 1, min_permission_level: 1, is_active: true, created_by: createdBy },
      { name: '현장 실사', description: '시설 현황 확인 및 조사', color: '#10B981', icon: 'search', sort_order: 2, min_permission_level: 1, is_active: true, created_by: createdBy },
      { name: '견적 작성', description: '견적서 작성 및 발송', color: '#F59E0B', icon: 'file-text', sort_order: 3, min_permission_level: 1, is_active: true, created_by: createdBy },
      { name: '계약 체결', description: '계약서 작성 및 계약금 수령', color: '#8B5CF6', icon: 'file-signature', sort_order: 4, min_permission_level: 2, is_active: true, created_by: createdBy },
      { name: '제품 발주', description: '제품 주문 및 출고 관리', color: '#06B6D4', icon: 'package', sort_order: 5, min_permission_level: 2, is_active: true, created_by: createdBy },
      { name: '설치 진행', description: '설치 일정 조율 및 시공', color: '#EF4444', icon: 'wrench', sort_order: 6, min_permission_level: 1, is_active: true, created_by: createdBy },
      { name: '잔금 정산', description: '잔금 수령 및 완료 서류 발송', color: '#84CC16', icon: 'dollar-sign', sort_order: 7, min_permission_level: 2, is_active: true, created_by: createdBy },

      // 보조금 지원 업무
      { name: '지원 신청', description: '부착지원신청서 지자체 제출', color: '#F97316', icon: 'file-plus', sort_order: 8, min_permission_level: 2, is_active: true, created_by: createdBy },
      { name: '서류 보완', description: '지자체 서류 보완 요청 대응', color: '#6366F1', icon: 'file-edit', sort_order: 9, min_permission_level: 1, is_active: true, created_by: createdBy },
      { name: '착공 전 실사', description: '지자체 담당자와 공동 실사', color: '#14B8A6', icon: 'clipboard-check', sort_order: 10, min_permission_level: 2, is_active: true, created_by: createdBy },
      { name: '착공 실사 보완', description: '착공 전 실사 보완 사항 처리', color: '#F43F5E', icon: 'alert-triangle', sort_order: 11, min_permission_level: 1, is_active: true, created_by: createdBy },
      { name: '준공 실사', description: '지자체와 공동 준공 실사', color: '#22C55E', icon: 'check-circle', sort_order: 12, min_permission_level: 2, is_active: true, created_by: createdBy },
      { name: '준공 보완', description: '준공 실사 보완 사항 처리', color: '#A855F7', icon: 'refresh-cw', sort_order: 13, min_permission_level: 1, is_active: true, created_by: createdBy },
      { name: '서류 제출', description: '그린링크전송확인서, 부착완료통보서, 보조금지급신청서 제출', color: '#0EA5E9', icon: 'upload', sort_order: 14, min_permission_level: 2, is_active: true, created_by: createdBy },
      { name: '보조금 수령', description: '지자체 입금 확인 및 완료', color: '#16A34A', icon: 'check-circle-2', sort_order: 15, min_permission_level: 2, is_active: true, created_by: createdBy },

      // 공통 업무
      { name: '기타', description: '기타 업무', color: '#6B7280', icon: 'more-horizontal', sort_order: 99, min_permission_level: 1, is_active: true, created_by: createdBy }
    ];

    const { error: insertError } = await supabaseAdmin
      .from('task_categories')
      .insert(categories);

    if (insertError) {
      console.error('❌ 카테고리 추가 실패:', insertError);
      return;
    }

    console.log('✅ 새 카테고리 추가 완료');

    // 기본 상태 확인 및 추가
    const statuses = [
      { name: '신규', description: '새로 생성된 업무', color: '#3B82F6', icon: 'clock', status_type: 'pending', sort_order: 1, is_active: true },
      { name: '진행 중', description: '현재 작업 중인 업무', color: '#F59E0B', icon: 'play-circle', status_type: 'active', sort_order: 2, is_active: true },
      { name: '검토 중', description: '검토가 필요한 업무', color: '#8B5CF6', icon: 'eye', status_type: 'active', sort_order: 3, is_active: true },
      { name: '보류', description: '일시 중단된 업무', color: '#6B7280', icon: 'pause-circle', status_type: 'on_hold', sort_order: 4, is_active: true },
      { name: '완료', description: '성공적으로 완료된 업무', color: '#10B981', icon: 'check-circle', status_type: 'completed', sort_order: 5, is_active: true },
      { name: '취소', description: '취소된 업무', color: '#EF4444', icon: 'x-circle', status_type: 'cancelled', sort_order: 6, is_active: true }
    ];

    for (const status of statuses) {
      const { data: existing } = await supabaseAdmin
        .from('task_statuses')
        .select('id')
        .eq('name', status.name)
        .single();

      if (!existing) {
        const { error: statusError } = await supabaseAdmin
          .from('task_statuses')
          .insert(status);

        if (statusError) {
          console.error(`❌ 상태 '${status.name}' 추가 실패:`, statusError);
        } else {
          console.log(`✅ 상태 '${status.name}' 추가 완료`);
        }
      }
    }

    // 결과 확인
    const { data: finalCategories } = await supabaseAdmin
      .from('task_categories')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('sort_order');

    const { data: finalStatuses } = await supabaseAdmin
      .from('task_statuses')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('sort_order');

    console.log('📊 업데이트 결과:');
    console.log(`✅ 활성 카테고리: ${finalCategories?.length || 0}개`);
    console.log(`✅ 활성 상태: ${finalStatuses?.length || 0}개`);

    if (finalCategories && finalCategories.length > 0) {
      console.log('\n📋 카테고리 목록:');
      finalCategories.forEach((cat, index) => {
        console.log(`  ${index + 1}. ${cat.name}`);
      });
    }

    console.log('\n🎉 업무 카테고리 업데이트 완료!');

  } catch (error) {
    console.error('❌ 업무 카테고리 업데이트 오류:', error);
  }
}

// 스크립트 실행
if (require.main === module) {
  applyTaskCategories();
}

module.exports = { applyTaskCategories };