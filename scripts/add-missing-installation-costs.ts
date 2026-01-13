/**
 * 누락된 설치비 데이터 추가 스크립트
 *
 * 용도: gateway_1_2, gateway_3_4, vpn_wired, vpn_wireless 설치비 추가
 * 실행: npx tsx scripts/add-missing-installation-costs.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query as pgQuery, queryAll } from '@/lib/supabase-direct';

async function addMissingInstallationCosts() {
  console.log('🔧 누락된 설치비 데이터 추가 시작...\n');

  try {
    // 1. 현재 gateway 기본 설치비 조회
    const gatewayData = await queryAll(
      `SELECT base_installation_cost FROM equipment_installation_cost
       WHERE equipment_type = $1 AND is_active = true
       LIMIT 1`,
      ['gateway']
    );

    const gatewayBaseCost = gatewayData?.[0]?.base_installation_cost || 290000;
    console.log(`📊 gateway 기본 설치비: ₩${Number(gatewayBaseCost).toLocaleString()}\n`);

    // 2. gateway_1_2 설치비 추가/업데이트
    console.log('🔧 gateway_1_2 설치비 추가 중...');
    const gateway12Check = await queryAll(
      `SELECT id FROM equipment_installation_cost
       WHERE equipment_type = $1`,
      ['gateway_1_2']
    );

    if (!gateway12Check || gateway12Check.length === 0) {
      // 신규 추가
      await pgQuery(
        `INSERT INTO equipment_installation_cost
         (equipment_type, equipment_name, base_installation_cost, effective_from, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        ['gateway_1_2', '게이트웨이(1,2)', gatewayBaseCost, '2025-01-01', true]
      );
      console.log(`   ✅ gateway_1_2 추가 완료: ₩${Number(gatewayBaseCost).toLocaleString()}`);
    } else {
      // 기존 데이터 업데이트
      await pgQuery(
        `UPDATE equipment_installation_cost
         SET base_installation_cost = $1, equipment_name = $2, is_active = true, updated_at = NOW()
         WHERE equipment_type = $3`,
        [gatewayBaseCost, '게이트웨이(1,2)', 'gateway_1_2']
      );
      console.log(`   ✅ gateway_1_2 업데이트 완료: ₩${Number(gatewayBaseCost).toLocaleString()}`);
    }

    // 3. gateway_3_4 설치비 추가/업데이트
    console.log('🔧 gateway_3_4 설치비 추가 중...');
    const gateway34Check = await queryAll(
      `SELECT id FROM equipment_installation_cost
       WHERE equipment_type = $1`,
      ['gateway_3_4']
    );

    if (!gateway34Check || gateway34Check.length === 0) {
      // 신규 추가
      await pgQuery(
        `INSERT INTO equipment_installation_cost
         (equipment_type, equipment_name, base_installation_cost, effective_from, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        ['gateway_3_4', '게이트웨이(3,4)', gatewayBaseCost, '2025-01-01', true]
      );
      console.log(`   ✅ gateway_3_4 추가 완료: ₩${Number(gatewayBaseCost).toLocaleString()}`);
    } else {
      // 기존 데이터 업데이트
      await pgQuery(
        `UPDATE equipment_installation_cost
         SET base_installation_cost = $1, equipment_name = $2, is_active = true, updated_at = NOW()
         WHERE equipment_type = $3`,
        [gatewayBaseCost, '게이트웨이(3,4)', 'gateway_3_4']
      );
      console.log(`   ✅ gateway_3_4 업데이트 완료: ₩${Number(gatewayBaseCost).toLocaleString()}`);
    }

    // 4. VPN 설치비는 현재 0원이 정상인지 확인 필요
    console.log('\n📊 VPN 설치비 현황:');
    const vpnWiredData = await queryAll(
      `SELECT base_installation_cost FROM equipment_installation_cost
       WHERE equipment_type = $1 AND is_active = true`,
      ['vpn_wired']
    );
    const vpnWirelessData = await queryAll(
      `SELECT base_installation_cost FROM equipment_installation_cost
       WHERE equipment_type = $1 AND is_active = true`,
      ['vpn_wireless']
    );

    console.log(`   - vpn_wired: ₩${Number(vpnWiredData?.[0]?.base_installation_cost || 0).toLocaleString()}`);
    console.log(`   - vpn_wireless: ₩${Number(vpnWirelessData?.[0]?.base_installation_cost || 0).toLocaleString()}`);
    console.log('\n   ℹ️ VPN 설치비가 0원이면 추가 비용이 없는 것으로 간주됩니다.');

    // 5. 최종 확인
    console.log('\n✅ 설치비 데이터 추가 완료!');
    console.log('\n📋 다음 단계:');
    console.log('   1. 개발 서버 재시작 (설치비 맵 캐싱 때문)');
    console.log('   2. admin/revenue 페이지에서 모달 다시 열어보기');
    console.log('   3. 설치비가 표시되는지 확인\n');

  } catch (error) {
    console.error('❌ 실행 실패:', error);
    throw error;
  }
}

addMissingInstallationCosts()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });
