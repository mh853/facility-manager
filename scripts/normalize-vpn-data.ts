/**
 * VPN 데이터 정규화 스크립트
 *
 * 용도: vpn_wired, vpn_wireless 값을 기반으로 vpn 컬럼 자동 설정
 * 규칙:
 *   - vpn_wired >= 1 이고 vpn_wireless = 0 → vpn = 'wired'
 *   - vpn_wireless >= 1 이고 vpn_wired = 0 → vpn = 'wireless'
 *   - 둘 다 >= 1 → vpn_wired가 더 크면 'wired', vpn_wireless가 더 크면 'wireless', 같으면 'wired' 우선
 *   - 둘 다 0 또는 NULL → vpn = NULL
 * 실행: npx tsx scripts/normalize-vpn-data.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query as pgQuery, queryAll } from '@/lib/supabase-direct';

async function normalizeVpnData() {
  console.log('🔄 VPN 데이터 정규화 시작...\n');

  try {
    // 1. 정규화 전 현황 확인
    console.log('📊 정규화 전 상태:');
    const beforeResult = await queryAll(
      `SELECT
        vpn,
        COUNT(*) as count
      FROM business_info
      WHERE is_deleted = false
      GROUP BY vpn
      ORDER BY count DESC`,
      []
    );

    beforeResult?.forEach((row: any) => {
      console.log(`  - VPN타입 "${row.vpn || 'NULL'}": ${row.count}개`);
    });

    const beforeMissing = await queryAll(
      `SELECT COUNT(*) as count
      FROM business_info
      WHERE is_deleted = false
        AND vpn IS NULL
        AND (vpn_wired > 0 OR vpn_wireless > 0)`,
      []
    );

    console.log(`\n  ⚠️ VPN 타입 미지정 (VPN 장비는 있음): ${beforeMissing?.[0]?.count || 0}개\n`);

    console.log('🔧 정규화 실행 중...\n');

    // 2. VPN(유선)만 있는 경우 (vpn_wired >= 1, vpn_wireless = 0)
    const updateWired = await pgQuery(
      `UPDATE business_info
      SET vpn = 'wired'
      WHERE is_deleted = false
        AND vpn IS NULL
        AND vpn_wired >= 1
        AND (vpn_wireless IS NULL OR vpn_wireless = 0)`,
      []
    );

    console.log(`✅ VPN(유선)만 있는 경우 → 'wired': ${updateWired.rowCount}개 업데이트`);

    // 3. VPN(무선)만 있는 경우 (vpn_wireless >= 1, vpn_wired = 0)
    const updateWireless = await pgQuery(
      `UPDATE business_info
      SET vpn = 'wireless'
      WHERE is_deleted = false
        AND vpn IS NULL
        AND vpn_wireless >= 1
        AND (vpn_wired IS NULL OR vpn_wired = 0)`,
      []
    );

    console.log(`✅ VPN(무선)만 있는 경우 → 'wireless': ${updateWireless.rowCount}개 업데이트`);

    // 4. 둘 다 있는 경우 - 더 많은 쪽으로 설정 (같으면 유선 우선)
    const updateBoth = await pgQuery(
      `UPDATE business_info
      SET vpn = CASE
        WHEN vpn_wired > vpn_wireless THEN 'wired'
        WHEN vpn_wireless > vpn_wired THEN 'wireless'
        ELSE 'wired'  -- 같은 경우 유선 우선
      END
      WHERE is_deleted = false
        AND vpn IS NULL
        AND vpn_wired >= 1
        AND vpn_wireless >= 1`,
      []
    );

    console.log(`✅ VPN(유선), VPN(무선) 둘 다 있는 경우 → 수량 많은 쪽: ${updateBoth.rowCount}개 업데이트`);

    // 5. 정규화 후 현황 확인
    console.log('\n📊 정규화 후 상태:');
    const afterResult = await queryAll(
      `SELECT
        vpn,
        COUNT(*) as count
      FROM business_info
      WHERE is_deleted = false
      GROUP BY vpn
      ORDER BY count DESC`,
      []
    );

    afterResult?.forEach((row: any) => {
      console.log(`  - VPN타입 "${row.vpn || 'NULL'}": ${row.count}개`);
    });

    // 6. 검증
    console.log('\n🔍 검증 중...');
    const afterMissing = await queryAll(
      `SELECT COUNT(*) as count
      FROM business_info
      WHERE is_deleted = false
        AND vpn IS NULL
        AND (vpn_wired > 0 OR vpn_wireless > 0)`,
      []
    );

    const remainingMissing = afterMissing?.[0]?.count || 0;

    if (remainingMissing === 0) {
      console.log('✅ 모든 VPN 타입이 정규화되었습니다!');
    } else {
      console.log(`⚠️ 아직 ${remainingMissing}개의 사업장이 VPN 타입 미지정 상태입니다.`);

      // 미정규화 샘플 표시
      const samples = await queryAll(
        `SELECT
          business_name,
          vpn,
          vpn_wired,
          vpn_wireless
        FROM business_info
        WHERE is_deleted = false
          AND vpn IS NULL
          AND (vpn_wired > 0 OR vpn_wireless > 0)
        LIMIT 5`,
        []
      );

      console.log('\n  샘플:');
      samples?.forEach((row: any) => {
        console.log(`    - ${row.business_name}: VPN(유선)=${row.vpn_wired}, VPN(무선)=${row.vpn_wireless}`);
      });
    }

    // 7. 통계 요약
    console.log('\n📈 정규화 통계:');
    console.log(`  - VPN(유선)만: ${updateWired.rowCount}개`);
    console.log(`  - VPN(무선)만: ${updateWireless.rowCount}개`);
    console.log(`  - 둘 다 있음: ${updateBoth.rowCount}개`);
    console.log(`  - 총 업데이트: ${(updateWired.rowCount || 0) + (updateWireless.rowCount || 0) + (updateBoth.rowCount || 0)}개`);

  } catch (error) {
    console.error('❌ 정규화 실패:', error);
    throw error;
  }
}

normalizeVpnData()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });
