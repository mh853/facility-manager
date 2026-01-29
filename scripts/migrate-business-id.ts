#!/usr/bin/env ts-node

/**
 * Business ID 마이그레이션 스크립트
 *
 * 목적: facility_tasks 테이블의 business_name을 기반으로 business_id를 자동 매핑
 *
 * 사용법:
 *   npx ts-node scripts/migrate-business-id.ts [--dry-run]
 *
 * 옵션:
 *   --dry-run  실제 업데이트 없이 미리보기만 실행
 */

import { queryAll, queryOne, query } from '../lib/supabase-direct.js';

const isDryRun = process.argv.includes('--dry-run');

interface PreviewRow {
  task_id: string;
  title: string;
  business_name: string;
  current_business_id: string | null;
  resolved_business_id: string | null;
  resolved_business_name: string | null;
}

interface StatsRow {
  with_business_id: string;
  without_business_id: string;
  total: string;
}

async function migrateBusiness() {
  console.log('🚀 Business ID 마이그레이션 시작...\n');

  try {
    // 1. 현재 상태 확인
    console.log('📊 1단계: 현재 상태 확인');
    const stats = await queryOne(`
      SELECT
        COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END) as with_business_id,
        COUNT(CASE WHEN business_id IS NULL THEN 1 END) as without_business_id,
        COUNT(*) as total
      FROM facility_tasks
      WHERE is_deleted = FALSE
    `);

    console.log(`   전체 업무: ${stats.total}개`);
    console.log(`   business_id 있음: ${stats.with_business_id}개`);
    console.log(`   business_id 없음: ${stats.without_business_id}개\n`);

    if (stats.without_business_id === 0) {
      console.log('✅ 모든 업무에 business_id가 이미 설정되어 있습니다.');
      return;
    }

    // 2. 매핑 미리보기
    console.log('🔍 2단계: 매핑 미리보기');
    const preview = await queryAll(`
      SELECT
        ft.id as task_id,
        ft.title,
        ft.business_name,
        ft.business_id as current_business_id,
        bi.id as resolved_business_id,
        bi.business_name as resolved_business_name
      FROM facility_tasks ft
      LEFT JOIN business_info bi ON ft.business_name = bi.business_name
        AND bi.is_active = TRUE
        AND bi.is_deleted = FALSE
      WHERE ft.business_id IS NULL
        AND ft.is_deleted = FALSE
      ORDER BY ft.created_at DESC
    `);

    const canMap = preview.filter((p: PreviewRow) => p.resolved_business_id).length;
    const cannotMap = preview.filter((p: PreviewRow) => !p.resolved_business_id).length;

    console.log(`   매핑 가능: ${canMap}개`);
    console.log(`   매핑 불가: ${cannotMap}개\n`);

    if (cannotMap > 0) {
      console.log('⚠️  매핑 불가 업무 목록:');
      preview
        .filter((p: PreviewRow) => !p.resolved_business_id)
        .forEach((p: PreviewRow) => {
          console.log(`   - ${p.business_name} (업무: ${p.title})`);
        });
      console.log('');
    }

    if (canMap === 0) {
      console.log('❌ 매핑 가능한 업무가 없습니다.');
      return;
    }

    // 3. Dry-run 체크
    if (isDryRun) {
      console.log('🔍 [DRY-RUN] 실제 업데이트는 실행하지 않습니다.');
      console.log(`   ${canMap}개의 업무가 업데이트됩니다.\n`);

      console.log('   업데이트될 업무 샘플 (최대 10개):');
      preview
        .filter((p: PreviewRow) => p.resolved_business_id)
        .slice(0, 10)
        .forEach((p: PreviewRow) => {
          console.log(`   - ${p.business_name} → ${p.resolved_business_id!.substring(0, 8)}...`);
        });

      console.log('\n💡 실제 마이그레이션을 실행하려면 --dry-run 옵션 없이 실행하세요.');
      return;
    }

    // 4. 실제 업데이트
    console.log('⚙️  3단계: business_id 업데이트 실행');
    const updateResult = await query(`
      UPDATE facility_tasks ft
      SET
        business_id = bi.id,
        updated_at = NOW(),
        last_modified_by_name = 'system_migration'
      FROM business_info bi
      WHERE ft.business_name = bi.business_name
        AND bi.is_active = TRUE
        AND bi.is_deleted = FALSE
        AND ft.business_id IS NULL
        AND ft.is_deleted = FALSE
    `);

    console.log(`   ✅ ${updateResult.rowCount}개 업무 업데이트 완료\n`);

    // 5. 최종 결과 확인
    console.log('📊 4단계: 최종 결과 확인');
    const finalStats = await queryOne(`
      SELECT
        COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END) as with_business_id,
        COUNT(CASE WHEN business_id IS NULL THEN 1 END) as without_business_id,
        COUNT(*) as total
      FROM facility_tasks
      WHERE is_deleted = FALSE
    `);

    console.log(`   전체 업무: ${finalStats.total}개`);
    console.log(`   business_id 있음: ${finalStats.with_business_id}개`);
    console.log(`   business_id 없음: ${finalStats.without_business_id}개\n`);

    console.log('✅ 마이그레이션 완료!');

  } catch (error: any) {
    console.error('❌ 마이그레이션 실패:', error?.message || error);
    console.error(error);
    process.exit(1);
  }
}

// 스크립트 실행
migrateBusiness()
  .then(() => {
    console.log('\n🎉 스크립트 종료');
    process.exit(0);
  })
  .catch((error: any) => {
    console.error('\n💥 치명적 오류:', error?.message || error);
    process.exit(1);
  });
