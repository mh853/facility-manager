/**
 * 제조사 데이터 정규화 스크립트
 *
 * 용도: business_info 테이블의 manufacturer 컬럼 값을 정규화
 * 실행: npx tsx scripts/normalize-manufacturer-data.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query as pgQuery, queryAll } from '@/lib/supabase-direct';

async function normalizeManufacturerData() {
  console.log('🔄 제조사 데이터 정규화 시작...\n');

  try {
    // 1. 정규화 전 현황 확인
    console.log('📊 정규화 전 상태:');
    const beforeResult = await queryAll(
      `SELECT manufacturer, COUNT(*) as count
      FROM business_info
      WHERE manufacturer IS NOT NULL AND is_deleted = false
      GROUP BY manufacturer
      ORDER BY count DESC`,
      []
    );

    beforeResult?.forEach((row: any) => {
      console.log(`  - "${row.manufacturer}": ${row.count}개`);
    });

    console.log('\n🔧 정규화 실행 중...\n');

    // 2. 영문 코드를 한글로 변환
    const updateEnglish = await pgQuery(
      `UPDATE business_info
      SET manufacturer = CASE
        WHEN LOWER(TRIM(manufacturer)) = 'ecosense' THEN '에코센스'
        WHEN LOWER(TRIM(manufacturer)) = 'cleanearth' THEN '크린어스'
        WHEN LOWER(TRIM(manufacturer)) = 'gaia_cns' THEN '가이아씨앤에스'
        WHEN LOWER(TRIM(manufacturer)) = 'evs' THEN '이브이에스'
        ELSE manufacturer
      END
      WHERE is_deleted = false
        AND manufacturer IS NOT NULL
        AND LOWER(TRIM(manufacturer)) IN ('ecosense', 'cleanearth', 'gaia_cns', 'evs')`,
      []
    );

    console.log(`✅ 영문 코드 변환: ${updateEnglish.rowCount}개 업데이트`);

    // 3. 공백 제거 및 정규화
    const trimSpaces = await pgQuery(
      `UPDATE business_info
      SET manufacturer = TRIM(manufacturer)
      WHERE is_deleted = false
        AND manufacturer IS NOT NULL
        AND manufacturer != TRIM(manufacturer)`,
      []
    );

    console.log(`✅ 공백 제거: ${trimSpaces.rowCount}개 업데이트`);

    // 4. 특수 케이스 처리
    const specialCases = await pgQuery(
      `UPDATE business_info
      SET manufacturer = CASE
        WHEN manufacturer LIKE '%크린어스%' THEN '크린어스'
        WHEN manufacturer LIKE '%에코센스%' THEN '에코센스'
        WHEN manufacturer LIKE '%가이아씨앤에스%' THEN '가이아씨앤에스'
        WHEN manufacturer LIKE '%이브이에스%' THEN '이브이에스'
        WHEN manufacturer IN ('위블레스', '확인필요', '0. 확인필요') THEN NULL
        ELSE manufacturer
      END
      WHERE is_deleted = false
        AND manufacturer IS NOT NULL
        AND manufacturer NOT IN ('에코센스', '크린어스', '가이아씨앤에스', '이브이에스')`,
      []
    );

    console.log(`✅ 특수 케이스 처리: ${specialCases.rowCount}개 업데이트`);

    // 5. 정규화 후 현황 확인
    console.log('\n📊 정규화 후 상태:');
    const afterResult = await queryAll(
      `SELECT manufacturer, COUNT(*) as count
      FROM business_info
      WHERE manufacturer IS NOT NULL AND is_deleted = false
      GROUP BY manufacturer
      ORDER BY count DESC`,
      []
    );

    afterResult?.forEach((row: any) => {
      console.log(`  - "${row.manufacturer}": ${row.count}개`);
    });

    // 6. 검증
    console.log('\n🔍 검증 중...');
    const invalidValues = await queryAll(
      `SELECT manufacturer, COUNT(*) as count
      FROM business_info
      WHERE manufacturer IS NOT NULL
        AND is_deleted = false
        AND manufacturer NOT IN ('에코센스', '크린어스', '가이아씨앤에스', '이브이에스')
      GROUP BY manufacturer`,
      []
    );

    if (!invalidValues || invalidValues.length === 0) {
      console.log('✅ 모든 제조사 값이 정규화되었습니다!');
    } else {
      console.log('⚠️ 다음 값들이 여전히 비정규 상태입니다:');
      invalidValues.forEach((row: any) => {
        console.log(`  - "${row.manufacturer}": ${row.count}개`);
      });
    }

    // 7. NULL 값 확인
    const nullCount = await queryAll(
      `SELECT COUNT(*) as count
      FROM business_info
      WHERE manufacturer IS NULL AND is_deleted = false`,
      []
    );

    console.log(`\nℹ️ 제조사 미지정: ${nullCount?.[0]?.count || 0}개`);

  } catch (error) {
    console.error('❌ 정규화 실패:', error);
    throw error;
  }
}

normalizeManufacturerData()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });
