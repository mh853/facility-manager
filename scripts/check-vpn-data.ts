/**
 * VPN 데이터 현황 확인 스크립트
 *
 * 용도: business_info 테이블의 vpn, vpn_wired, vpn_wireless 컬럼 값 분석
 * 실행: npx tsx scripts/check-vpn-data.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { queryAll } from '@/lib/supabase-direct';

async function checkVpnData() {
  console.log('🔍 VPN 데이터 현황 확인 중...\n');

  try {
    // 1. VPN 컬럼 값 분포 조회
    console.log('📊 VPN 타입 (vpn 컬럼) 분포:');
    const vpnTypeResult = await queryAll(
      `SELECT
        vpn,
        COUNT(*) as count
      FROM business_info
      WHERE is_deleted = false
      GROUP BY vpn
      ORDER BY count DESC`,
      []
    );

    vpnTypeResult?.forEach((row: any) => {
      console.log(`  - "${row.vpn || 'NULL'}": ${row.count}개`);
    });

    // 2. VPN(유선) 값 분포 조회
    console.log('\n📊 VPN(유선) 값 분포:');
    const vpnWiredResult = await queryAll(
      `SELECT
        vpn_wired,
        COUNT(*) as count
      FROM business_info
      WHERE is_deleted = false
        AND vpn_wired IS NOT NULL
      GROUP BY vpn_wired
      ORDER BY vpn_wired`,
      []
    );

    vpnWiredResult?.forEach((row: any) => {
      console.log(`  - ${row.vpn_wired}: ${row.count}개`);
    });

    // 3. VPN(무선) 값 분포 조회
    console.log('\n📊 VPN(무선) 값 분포:');
    const vpnWirelessResult = await queryAll(
      `SELECT
        vpn_wireless,
        COUNT(*) as count
      FROM business_info
      WHERE is_deleted = false
        AND vpn_wireless IS NOT NULL
      GROUP BY vpn_wireless
      ORDER BY vpn_wireless`,
      []
    );

    vpnWirelessResult?.forEach((row: any) => {
      console.log(`  - ${row.vpn_wireless}: ${row.count}개`);
    });

    // 4. VPN 타입이 NULL이지만 vpn_wired 또는 vpn_wireless에 값이 있는 경우
    console.log('\n🔍 VPN 타입이 비어있지만 VPN(유선)/VPN(무선)에 값이 있는 사업장:');
    const missingVpnType = await queryAll(
      `SELECT
        id,
        business_name,
        vpn,
        vpn_wired,
        vpn_wireless
      FROM business_info
      WHERE is_deleted = false
        AND vpn IS NULL
        AND (vpn_wired > 0 OR vpn_wireless > 0)
      ORDER BY business_name
      LIMIT 20`,
      []
    );

    if (!missingVpnType || missingVpnType.length === 0) {
      console.log('  ✅ 해당 사항 없음');
    } else {
      console.log(`  ⚠️ 총 ${missingVpnType.length}개 발견 (상위 20개 표시):\n`);
      missingVpnType.forEach((row: any) => {
        console.log(`    - ${row.business_name || '이름없음'}`);
        console.log(`      VPN타입: ${row.vpn || 'NULL'}`);
        console.log(`      VPN(유선): ${row.vpn_wired || 0}, VPN(무선): ${row.vpn_wireless || 0}`);
        console.log('');
      });
    }

    // 5. 전체 카운트
    const totalCount = await queryAll(
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN vpn IS NULL AND (vpn_wired > 0 OR vpn_wireless > 0) THEN 1 END) as missing_vpn_type
      FROM business_info
      WHERE is_deleted = false`,
      []
    );

    const stats = totalCount?.[0];
    console.log('\n📈 전체 통계:');
    console.log(`  - 총 사업장: ${stats.total}개`);
    console.log(`  - VPN 타입 미지정 (VPN 장비는 있음): ${stats.missing_vpn_type}개`);
    console.log(`  - 정규화 대상: ${stats.missing_vpn_type}개\n`);

  } catch (error) {
    console.error('❌ 조회 실패:', error);
  }
}

checkVpnData()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });
