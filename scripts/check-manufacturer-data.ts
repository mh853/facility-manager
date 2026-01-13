/**
 * 제조사 데이터 현황 확인 스크립트
 *
 * 용도: business_info 테이블의 manufacturer 컬럼 값 분포 확인
 * 실행: npx tsx scripts/check-manufacturer-data.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { queryAll } from '@/lib/supabase-direct';

async function checkManufacturerData() {
  console.log('🔍 제조사 데이터 현황 확인 중...\n');

  try {
    // 제조사 값 분포 조회
    const result = await queryAll(
      `SELECT
        manufacturer,
        COUNT(*) as count,
        COUNT(*) * 100.0 / (SELECT COUNT(*) FROM business_info WHERE manufacturer IS NOT NULL) as percentage
      FROM business_info
      WHERE manufacturer IS NOT NULL
        AND is_deleted = false
      GROUP BY manufacturer
      ORDER BY count DESC`,
      []
    );

    console.log('📊 제조사 값 분포:\n');
    console.log('제조사 값'.padEnd(30), '개수'.padEnd(10), '비율');
    console.log('='.repeat(60));

    result?.forEach((row: any) => {
      console.log(
        `${row.manufacturer}`.padEnd(30),
        `${row.count}`.padEnd(10),
        `${parseFloat(row.percentage).toFixed(2)}%`
      );
    });

    console.log('\n📋 샘플 데이터 (각 제조사별 5개씩):');

    const distinctManufacturers = result?.map((r: any) => r.manufacturer) || [];

    for (const mfr of distinctManufacturers.slice(0, 10)) {
      const samples = await queryAll(
        `SELECT id, business_name, manufacturer
        FROM business_info
        WHERE manufacturer = $1
          AND is_deleted = false
        LIMIT 5`,
        [mfr]
      );

      console.log(`\n"${mfr}" 샘플:`);
      samples?.forEach((s: any, i: number) => {
        console.log(`  ${i + 1}. ${s.business_name} (ID: ${s.id.substring(0, 8)}...)`);
      });
    }

    // 정규화가 필요한 값 확인
    console.log('\n\n⚠️ 정규화가 필요한 값:');
    const needsNormalization = result?.filter((r: any) =>
      !['에코센스', '크린어스', '가이아씨앤에스', '이브이에스'].includes(r.manufacturer)
    );

    if (needsNormalization && needsNormalization.length > 0) {
      console.log('다음 값들이 정규화 대상입니다:');
      needsNormalization.forEach((r: any) => {
        console.log(`  - "${r.manufacturer}" (${r.count}개)`);
      });
    } else {
      console.log('✅ 모든 제조사 값이 정규화되어 있습니다.');
    }

  } catch (error) {
    console.error('❌ 조회 실패:', error);
  }
}

checkManufacturerData()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });
