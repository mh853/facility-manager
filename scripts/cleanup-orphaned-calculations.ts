/**
 * 고아 레코드 정리 스크립트
 *
 * 용도: businesses 테이블에 없는 business_id를 가진 revenue_calculations 레코드 삭제
 * 실행: npx tsx scripts/cleanup-orphaned-calculations.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { queryAll, query as pgQuery } from '@/lib/supabase-direct';

async function cleanupOrphanedCalculations() {
  console.log('🧹 고아 레코드 정리 시작...\n');

  // 1. 모든 계산 결과 조회 (Direct PostgreSQL)
  const calculations = await queryAll(
    'SELECT id, business_id FROM revenue_calculations',
    []
  );

  console.log(`📊 총 계산 결과: ${calculations?.length || 0}개\n`);

  if (!calculations || calculations.length === 0) {
    console.log('✅ 정리할 데이터가 없습니다.');
    return;
  }

  // 2. 모든 비삭제 사업장 ID 조회 (Direct PostgreSQL)
  const businesses = await queryAll(
    'SELECT id FROM business_info WHERE is_deleted = false',
    []
  );

  const businessIds = new Set(businesses?.map((b: any) => b.id) || []);
  console.log(`🏢 존재하는 사업장: ${businessIds.size}개\n`);

  // 3. 고아 레코드 찾기 (삭제되지 않은 사업장에만 속하지 않는 것)
  const orphanedCalculations = calculations.filter((calc: any) => !businessIds.has(calc.business_id));

  console.log(`🔍 발견된 고아 레코드: ${orphanedCalculations.length}개\n`);

  if (orphanedCalculations.length === 0) {
    console.log('✅ 고아 레코드가 없습니다.');
    return;
  }

  // 4. 고아 레코드 상세 정보 출력
  console.log('📋 고아 레코드 목록:');
  orphanedCalculations.slice(0, 10).forEach((calc: any, index: number) => {
    console.log(`  ${index + 1}. 계산 ID: ${calc.id} | 사업장 ID: ${calc.business_id}`);
  });

  if (orphanedCalculations.length > 10) {
    console.log(`  ... 외 ${orphanedCalculations.length - 10}개\n`);
  } else {
    console.log('');
  }

  // 5. 사용자 확인
  console.log('⚠️ 위의 고아 레코드를 삭제하시겠습니까?');
  console.log('⚠️ 이 작업은 되돌릴 수 없습니다!\n');

  // 실제 삭제 로직
  const orphanedIds = orphanedCalculations.map((calc: any) => calc.id);

  console.log('🗑️ 삭제 시작...\n');

  // Batch 삭제 (한 번에 100개씩 - PostgreSQL의 IN 제한 고려)
  const batchSize = 100;
  let deletedCount = 0;

  for (let i = 0; i < orphanedIds.length; i += batchSize) {
    const batch = orphanedIds.slice(i, i + batchSize);

    // Build dynamic IN clause with placeholders
    const placeholders = batch.map((_: any, idx: number) => `$${idx + 1}`).join(', ');

    try {
      const result = await pgQuery(
        `DELETE FROM revenue_calculations WHERE id IN (${placeholders})`,
        batch
      );

      deletedCount += result.rowCount || 0;
      console.log(`✓ ${deletedCount}/${orphanedIds.length}개 삭제 완료`);
    } catch (deleteError) {
      console.error(`❌ 삭제 실패 (batch ${Math.floor(i / batchSize) + 1}):`, deleteError);
    }
  }

  console.log(`\n✅ 고아 레코드 정리 완료: ${deletedCount}개 삭제됨`);
}

cleanupOrphanedCalculations()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });
