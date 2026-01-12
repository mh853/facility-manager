/**
 * 0원 순이익 사업장 분석 스크립트
 *
 * 용도: 순이익이 0원으로 계산된 사업장들의 데이터를 조회하고 원인 분석
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const zeroBusinessIds = [
  'dcc60057-46a1-4046-9d26-658d16febd36',
  '061d3f5c-3197-4ef9-995c-7d0d9fa55fd8',
  'd619f578-3066-4cf9-9967-78bafa44aaec',
  '7d9d5b00-8616-4675-9207-367e62050fdd',
  '5f54e907-5a8f-4a76-8b15-8db96ac27899',
  'c4e8f931-607a-48f7-97d1-9676fc5ac00a',
  '7a28be5b-7f9d-4936-8c66-fe5dbc26bde0',
  'de8320e9-80c3-4f13-838c-a664f0396daf',
  'd1190ae3-6518-46b9-820e-3a0826d5368b',
  '50a52c98-5117-4bcf-8b9b-a4cff5ce54e0',
  '98e0b24a-b639-452f-861a-5e0075a8346d',
  'e476c133-761a-45ef-b0d3-a859c997f08f',
  '3fc3d013-9343-4582-94bf-b284e8a93a7b',
  '723b7603-b2cb-4a64-8047-f50623778c68',
  '91c14759-c179-4952-a8c4-59d3d6ab063a'
];

async function analyzeZeroProfitBusinesses() {
  console.log('🔍 0원 순이익 사업장 분석 시작...\n');
  console.log(`📊 분석 대상: ${zeroBusinessIds.length}개 사업장\n`);

  for (const calcId of zeroBusinessIds) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔢 계산 ID: ${calcId}`);
    console.log('='.repeat(80));

    // 1. 계산 결과로 사업장 ID 찾기
    const { data: calculations, error: calcError } = await supabase
      .from('revenue_calculations')
      .select('*')
      .eq('id', calcId);

    if (calcError || !calculations || calculations.length === 0) {
      console.error(`❌ 계산 결과 조회 실패:`, calcError?.message || '데이터 없음');
      continue;
    }

    const calculation = calculations[0];
    const businessId = calculation.business_id;

    console.log(`📊 사업장 ID: ${businessId}`);

    // 2. 사업장 기본 정보 조회
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId);

    if (businessError || !businesses || businesses.length === 0) {
      console.error(`❌ 사업장 조회 실패:`, businessError?.message || '데이터 없음');
      continue;
    }

    const business = businesses[0];

    console.log(`\n📋 기본 정보:`);
    console.log(`  - 사업장명: ${business.business_name}`);
    console.log(`  - 영업점: ${business.sales_office || '미배정'}`);
    console.log(`  - 진행구분: ${business.progress_status || '미지정'}`);
    console.log(`  - 설치일: ${business.installation_date || '미설치'}`);
    console.log(`  - 프로젝트년도: ${business.project_year || '미지정'}`);

    // 3. 계산 결과 출력
    console.log(`\n💰 계산 결과:`);
      console.log(`  - 총 매출: ${calculation.total_revenue?.toLocaleString() || 0}원`);
      console.log(`  - 총 비용: ${calculation.total_cost?.toLocaleString() || 0}원`);
      console.log(`  - 매출총이익: ${calculation.gross_profit?.toLocaleString() || 0}원`);
      console.log(`  - 영업비용: ${calculation.sales_commission?.toLocaleString() || 0}원`);
      console.log(`  - 조사비용: ${calculation.survey_costs?.toLocaleString() || 0}원`);
      console.log(`  - 설치비용: ${calculation.installation_costs?.toLocaleString() || 0}원`);
      console.log(`  - 추가설치비: ${calculation.installation_extra_cost?.toLocaleString() || 0}원`);
      console.log(`  - 순이익: ${calculation.net_profit?.toLocaleString() || 0}원`);

    // 4. 기기 수량 확인
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

    console.log(`\n🔧 기기 수량:`);
    console.log(`  - 총 기기 수: ${totalEquipment}개`);
    if (totalEquipment === 0) {
      console.log(`  ⚠️ 기기 수량이 0개입니다!`);
    }

    // 5. 계산서 발행 정보 확인
    console.log(`\n📄 계산서 정보:`);
    if (business.progress_status === '보조금' || business.progress_status === '보조금 동시진행') {
      console.log(`  - 1차 계산서: ${business.invoice_1st_amount?.toLocaleString() || 0}원`);
      console.log(`  - 2차 계산서: ${business.invoice_2nd_amount?.toLocaleString() || 0}원`);
      console.log(`  - 추가공사비: ${business.additional_cost?.toLocaleString() || 0}원`);
    } else if (business.progress_status === '자비' || business.progress_status === '대리점' || business.progress_status === 'AS') {
      console.log(`  - 선금 계산서: ${business.invoice_advance_amount?.toLocaleString() || 0}원`);
      console.log(`  - 잔금 계산서: ${business.invoice_balance_amount?.toLocaleString() || 0}원`);
    }

    // 6. 0원 원인 분석
    console.log(`\n🔍 0원 원인 분석:`);
    const issues = [];

    if (totalEquipment === 0) {
      issues.push('기기 수량이 0개 (매출 발생 불가)');
    }

    if (business.progress_status === '보조금' || business.progress_status === '보조금 동시진행') {
      const invoice1st = business.invoice_1st_amount || 0;
      const invoice2nd = business.invoice_2nd_amount || 0;
      if (invoice1st === 0 && invoice2nd === 0) {
        issues.push('계산서 미발행 (매출 인식 불가)');
      }
    } else if (business.progress_status === '자비' || business.progress_status === '대리점' || business.progress_status === 'AS') {
      const invoiceAdvance = business.invoice_advance_amount || 0;
      const invoiceBalance = business.invoice_balance_amount || 0;
      if (invoiceAdvance === 0 && invoiceBalance === 0) {
        issues.push('계산서 미발행 (매출 인식 불가)');
      }
    }

    if (!business.installation_date) {
      issues.push('설치일 미입력 (설치 미완료로 추정)');
    }

    if (!business.progress_status || business.progress_status === '') {
      issues.push('진행구분 미지정 (매출 계산 불가)');
    }

    if (calculation && calculation.total_revenue === 0) {
      issues.push('총 매출 0원 (매출 데이터 부재)');
    }

    if (issues.length > 0) {
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    } else {
      console.log(`  ⚠️ 명확한 원인 미확인 - 수동 점검 필요`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ 분석 완료');
  console.log('='.repeat(80));
}

analyzeZeroProfitBusinesses()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });
