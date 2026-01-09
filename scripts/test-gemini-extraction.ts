#!/usr/bin/env tsx

/**
 * Gemini AI 정보 추출 테스트 스크립트
 *
 * 용도: 신청기간과 예산 정보가 제대로 추출되는지 테스트
 * 실행: npx tsx scripts/test-gemini-extraction.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { analyzeAnnouncement } from '../lib/gemini';

const testAnnouncement = {
  title: '2025년 시흥인터넷(IoT) 설치 지원사업 5차 공고',
  content: `
    [공고 내용]

    1. 사업 개요
    - 사업명: 소규모 대기배출시설 IoT 설치 지원사업
    - 지원대상: 시흥시 소재 소규모 대기배출사업장
    - 총 예산: 5억원

    2. 신청기간
    - 접수기간: 2025년 1월 10일 ~ 2025년 3월 15일
    - 접수방법: 온라인 접수

    3. 지원내용
    - 지원금액: 최대 1,000만원 (설치비용의 70% 지원)
    - 지원장비: IoT 기반 대기오염 측정기기

    4. 신청자격
    - 시흥시 소재 소규모 대기배출사업장
    - 사업장 등록 후 1년 이상 경과

    자세한 내용은 홈페이지를 참고하세요.
  `,
};

async function testExtraction() {
  console.log('🧪 Gemini AI 정보 추출 테스트 시작...\n');
  console.log('📋 테스트 공고:', testAnnouncement.title);
  console.log('🔑 API 키 상태:', process.env.GOOGLE_AI_KEY ? `있음 (길이: ${process.env.GOOGLE_AI_KEY.length})` : '❌ 없음');
  console.log('');

  try {
    const result = await analyzeAnnouncement(
      testAnnouncement.title,
      testAnnouncement.content
    );

    console.log('\n✅ 분석 결과:');
    console.log('─────────────────────────────────────');
    console.log('관련성:', result.is_relevant ? '✅ 관련 있음' : '❌ 무관');
    console.log('점수:', result.relevance_score);
    console.log('매칭 키워드:', result.keywords_matched.join(', '));
    console.log('');
    console.log('📅 추출된 정보:');
    console.log('  신청기간 시작:', result.extracted_info.application_period_start || '❌ 없음');
    console.log('  신청기간 마감:', result.extracted_info.application_period_end || '❌ 없음');
    console.log('  예산:', result.extracted_info.budget || '❌ 없음');
    console.log('  지원대상:', result.extracted_info.target_description || '❌ 없음');
    console.log('  지원금액:', result.extracted_info.support_amount || '❌ 없음');
    console.log('');
    console.log('💭 판단 근거:', result.reasoning);
    console.log('─────────────────────────────────────');

    // 검증
    const hasAllInfo =
      result.extracted_info.application_period_start &&
      result.extracted_info.application_period_end &&
      result.extracted_info.budget;

    if (hasAllInfo) {
      console.log('\n✅ 테스트 통과: 모든 핵심 정보가 추출되었습니다!');
    } else {
      console.log('\n⚠️  테스트 실패: 일부 정보가 누락되었습니다.');
      if (!result.extracted_info.application_period_start) {
        console.log('   - 신청 시작일 누락');
      }
      if (!result.extracted_info.application_period_end) {
        console.log('   - 신청 마감일 누락');
      }
      if (!result.extracted_info.budget) {
        console.log('   - 예산 정보 누락');
      }
    }

  } catch (error: any) {
    console.error('\n❌ 테스트 실패:', error.message);
    process.exit(1);
  }
}

testExtraction();
