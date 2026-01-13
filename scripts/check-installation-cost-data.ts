/**
 * 설치비 데이터 확인 스크립트
 *
 * 용도: equipment_installation_cost 테이블의 데이터 확인
 * 실행: npx tsx scripts/check-installation-cost-data.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { queryAll } from '@/lib/supabase-direct';

async function checkInstallationCostData() {
  console.log('🔍 설치비 데이터 확인 중...\n');

  try {
    // 현재 날짜
    const today = new Date().toISOString();

    // 활성화된 설치비 데이터 조회
    const installationCosts = await queryAll(
      `SELECT * FROM equipment_installation_cost
       WHERE is_active = $1
       AND effective_from <= $2
       AND (effective_to IS NULL OR effective_to >= $2)
       ORDER BY equipment_type`,
      [true, today]
    );

    console.log(`📊 활성화된 설치비 데이터: ${installationCosts?.length || 0}개\n`);

    if (!installationCosts || installationCosts.length === 0) {
      console.log('❌ 설치비 데이터가 없습니다!');
      console.log('\n💡 해결 방법:');
      console.log('   1. admin/revenue/pricing 페이지 접속');
      console.log('   2. "기본 설치비" 탭에서 각 기기별 설치비 입력');
      console.log('   3. 저장 후 다시 확인\n');
      return;
    }

    // 설치비 데이터 출력
    console.log('📋 설치비 데이터 목록:\n');
    console.log('기기 타입'.padEnd(50), '기본 설치비'.padEnd(15), '적용 시작일');
    console.log('='.repeat(80));

    installationCosts.forEach((cost: any) => {
      const equipmentType = cost.equipment_type.padEnd(50);
      const baseCost = `₩${(cost.base_installation_cost || 0).toLocaleString()}`.padEnd(15);
      const effectiveFrom = new Date(cost.effective_from).toLocaleDateString('ko-KR');

      console.log(equipmentType, baseCost, effectiveFrom);
    });

    // 게이트웨이 관련 데이터 특별 확인
    console.log('\n🔍 게이트웨이 관련 설치비:');
    const gatewayData = installationCosts.filter((c: any) =>
      c.equipment_type.includes('gateway')
    );

    if (gatewayData.length === 0) {
      console.log('❌ 게이트웨이 설치비 데이터가 없습니다!');
      console.log('\n💡 필요한 데이터:');
      console.log('   - gateway: 게이트웨이 기본 설치비');
      console.log('   - gateway_1_2: 게이트웨이(1,2) 설치비 (선택사항)');
      console.log('   - gateway_3_4: 게이트웨이(3,4) 설치비 (선택사항)\n');
    } else {
      gatewayData.forEach((gw: any) => {
        console.log(`   ✅ ${gw.equipment_type}: ₩${(gw.base_installation_cost || 0).toLocaleString()}`);
      });
    }

    // VPN 관련 데이터 확인
    console.log('\n🔍 VPN 관련 설치비:');
    const vpnData = installationCosts.filter((c: any) =>
      c.equipment_type.includes('vpn')
    );

    if (vpnData.length === 0) {
      console.log('❌ VPN 설치비 데이터가 없습니다!');
    } else {
      vpnData.forEach((vpn: any) => {
        console.log(`   ✅ ${vpn.equipment_type}: ₩${(vpn.base_installation_cost || 0).toLocaleString()}`);
      });
    }

    // 전체 설치비 데이터 조회 (비활성 포함)
    console.log('\n📊 전체 설치비 레코드 (비활성 포함):');
    const allCosts = await queryAll(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN is_active = true THEN 1 END) as active,
              COUNT(CASE WHEN is_active = false THEN 1 END) as inactive
       FROM equipment_installation_cost`,
      []
    );

    const stats = allCosts?.[0];
    console.log(`   - 전체: ${stats?.total || 0}개`);
    console.log(`   - 활성: ${stats?.active || 0}개`);
    console.log(`   - 비활성: ${stats?.inactive || 0}개\n`);

  } catch (error) {
    console.error('❌ 조회 실패:', error);
  }
}

checkInstallationCostData()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });
