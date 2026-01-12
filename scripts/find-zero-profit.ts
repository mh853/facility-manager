/**
 * 0원 순이익 사업장 조회 스크립트
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findZeroProfitBusinesses() {
  console.log('🔍 순이익 0원 사업장 조회 시작...\n');

  // revenue_calculations 테이블에서 net_profit = 0인 레코드 조회
  const { data: calculations, error } = await supabase
    .from('revenue_calculations')
    .select('*')
    .eq('net_profit', 0)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ 조회 실패:', error);
    return;
  }

  console.log(`📊 총 ${calculations?.length || 0}개 사업장 발견\n`);

  for (const calc of calculations || []) {
    console.log(`${'='.repeat(80)}`);
    console.log(`🏢 계산 ID: ${calc.id}`);
    console.log(`📊 사업장 ID: ${calc.business_id}`);

    // 사업장 정보 조회
    const { data: businesses } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', calc.business_id);

    const business = businesses?.[0];

    if (business) {
      console.log(`📋 사업장명: ${business.business_name}`);
      console.log(`💼 영업점: ${business.sales_office || '미배정'}`);
      console.log(`📌 진행구분: ${business.progress_status || '미지정'}`);
      console.log(`📅 설치일: ${business.installation_date || '미설치'}`);

      // 기기 수량 체크
      const equipmentFields = [
        'ph_meter', 'differential_pressure_meter', 'temperature_meter',
        'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
        'gateway_1_2', 'gateway_3_4', 'vpn_wired', 'vpn_wireless',
        'explosion_proof_differential_pressure_meter_domestic',
        'explosion_proof_temperature_meter_domestic', 'expansion_device',
        'relay_8ch', 'relay_16ch', 'main_board_replacement', 'multiple_stack'
      ];

      const totalEquipment = equipmentFields.reduce((sum, field) => {
        return sum + (business[field] || 0);
      }, 0);

      console.log(`🔧 총 기기 수: ${totalEquipment}개`);

      // 계산서 정보
      if (business.progress_status === '보조금' || business.progress_status === '보조금 동시진행') {
        const invoice1st = business.invoice_1st_amount || 0;
        const invoice2nd = business.invoice_2nd_amount || 0;
        console.log(`💵 1차 계산서: ${invoice1st.toLocaleString()}원`);
        console.log(`💵 2차 계산서: ${invoice2nd.toLocaleString()}원`);
      } else if (business.progress_status === '자비' || business.progress_status === '대리점' || business.progress_status === 'AS') {
        const invoiceAdvance = business.invoice_advance_amount || 0;
        const invoiceBalance = business.invoice_balance_amount || 0;
        console.log(`💵 선금 계산서: ${invoiceAdvance.toLocaleString()}원`);
        console.log(`💵 잔금 계산서: ${invoiceBalance.toLocaleString()}원`);
      }

      // 원인 분석
      const issues = [];
      if (totalEquipment === 0) issues.push('기기 수량 0개');
      if (!business.installation_date) issues.push('설치일 미입력');
      if (!business.progress_status) issues.push('진행구분 미지정');

      if (business.progress_status === '보조금' || business.progress_status === '보조금 동시진행') {
        if ((business.invoice_1st_amount || 0) === 0 && (business.invoice_2nd_amount || 0) === 0) {
          issues.push('계산서 미발행');
        }
      } else if (business.progress_status === '자비' || business.progress_status === '대리점' || business.progress_status === 'AS') {
        if ((business.invoice_advance_amount || 0) === 0 && (business.invoice_balance_amount || 0) === 0) {
          issues.push('계산서 미발행');
        }
      }

      if (issues.length > 0) {
        console.log(`⚠️ 0원 원인: ${issues.join(', ')}`);
      }
    } else {
      console.log(`❌ 사업장 정보 없음`);
    }

    console.log(`\n💰 계산 결과:`);
    console.log(`  - 총 매출: ${calc.total_revenue?.toLocaleString() || 0}원`);
    console.log(`  - 총 비용: ${calc.total_cost?.toLocaleString() || 0}원`);
    console.log(`  - 매출총이익: ${calc.gross_profit?.toLocaleString() || 0}원`);
    console.log(`  - 순이익: ${calc.net_profit?.toLocaleString() || 0}원`);
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ 조회 완료');
}

findZeroProfitBusinesses()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 오류:', error);
    process.exit(1);
  });
