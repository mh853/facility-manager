/**
 * 설치비 적용 시작일 수정 스크립트
 *
 * 용도: equipment_installation_cost의 effective_from을 과거 날짜로 변경
 * 이유: 2024년 사업장들이 설치비 데이터를 못 가져오는 문제 해결
 * 실행: npx tsx scripts/fix-installation-cost-dates.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query as pgQuery, queryAll } from '@/lib/supabase-direct';

async function fixInstallationCostDates() {
  console.log('🔧 설치비 적용 시작일 수정 중...\n');

  try {
    // 1. 현재 상태 확인
    const currentData = await queryAll(
      `SELECT equipment_type, effective_from, base_installation_cost
       FROM equipment_installation_cost
       WHERE is_active = true
       ORDER BY effective_from DESC
       LIMIT 5`,
      []
    );

    console.log('📊 현재 설치비 적용 시작일:');
    currentData?.forEach((row: any) => {
      console.log(`   - ${row.equipment_type}: ${row.effective_from} (₩${Number(row.base_installation_cost).toLocaleString()})`);
    });

    // 2. 가장 오래된 사업장 설치일 조회
    const oldestBusiness = await queryAll(
      `SELECT installation_date, completion_date
       FROM business_info
       WHERE is_deleted = false
         AND (installation_date IS NOT NULL OR completion_date IS NOT NULL)
       ORDER BY COALESCE(completion_date, installation_date) ASC
       LIMIT 1`,
      []
    );

    const oldestDate = oldestBusiness?.[0]?.completion_date || oldestBusiness?.[0]?.installation_date || '2024-01-01';
    console.log(`\n📅 가장 오래된 사업장 날짜: ${oldestDate}`);

    // 3. 안전한 적용 시작일 설정 (가장 오래된 사업장보다 1년 전)
    const safeDate = '2023-01-01';
    console.log(`✅ 설정할 적용 시작일: ${safeDate}\n`);

    // 4. 모든 활성 설치비 데이터의 effective_from 업데이트
    const updateResult = await pgQuery(
      `UPDATE equipment_installation_cost
       SET effective_from = $1, updated_at = NOW()
       WHERE is_active = true`,
      [safeDate]
    );

    console.log(`✅ 업데이트 완료: ${updateResult.rowCount}개 레코드 수정\n`);

    // 5. 결과 확인
    const updatedData = await queryAll(
      `SELECT equipment_type, effective_from, base_installation_cost
       FROM equipment_installation_cost
       WHERE is_active = true
       ORDER BY equipment_type
       LIMIT 10`,
      []
    );

    console.log('📊 업데이트 후 설치비 데이터:');
    updatedData?.forEach((row: any) => {
      console.log(`   - ${row.equipment_type}: ${row.effective_from} (₩${Number(row.base_installation_cost).toLocaleString()})`);
    });

    console.log('\n✅ 설치비 적용 시작일 수정 완료!');
    console.log('\n📋 다음 단계:');
    console.log('   1. 개발 서버 재시작');
    console.log('   2. admin/revenue 페이지에서 모달 다시 열어보기');
    console.log('   3. 설치비가 표시되는지 확인\n');

  } catch (error) {
    console.error('❌ 실행 실패:', error);
    throw error;
  }
}

fixInstallationCostDates()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });
