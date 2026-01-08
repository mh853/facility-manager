#!/usr/bin/env tsx

/**
 * Gemini AI 추출 테스트 - 계룡시 공고
 */

import { createClient } from '@supabase/supabase-js';
import { analyzeAnnouncement, normalizeDate } from '@/lib/gemini';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 오류: SUPABASE_URL 또는 SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testGeminiExtraction() {
  console.log('🔍 계룡시 공고 Gemini 추출 테스트...\n');

  // 계룡시 공고 가져오기
  const { data: announcement } = await supabase
    .from('subsidy_announcements')
    .select('id, title, content, source_url')
    .eq('region_name', '계룡시')
    .single();

  if (!announcement) {
    console.error('❌ 계룡시 공고를 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log('📋 공고 정보:');
  console.log('──────────────────────────────────────────────');
  console.log(`제목: ${announcement.title}`);
  console.log(`URL: ${announcement.source_url}`);
  console.log(`내용 길이: ${announcement.content?.length || 0} 글자`);
  console.log('\n🤖 Gemini AI 분석 시작...\n');

  try {
    const analysisResult = await analyzeAnnouncement(
      announcement.title,
      announcement.content || '',
      announcement.source_url
    );

    console.log('✅ Gemini AI 분석 완료\n');
    console.log('📊 분석 결과:');
    console.log('──────────────────────────────────────────────');
    console.log(`관련도: ${analysisResult?.is_relevant ? '✓ 관련있음' : '✗ 관련없음'}`);
    console.log(`관련도 점수: ${analysisResult?.relevance_score || 0}`);
    console.log(`키워드: ${analysisResult?.keywords_matched?.join(', ') || '없음'}`);

    console.log('\n📅 추출된 정보:');
    console.log('──────────────────────────────────────────────');

    const extractedInfo = analysisResult?.extracted_info || {};

    console.log(`신청기간 시작 (원본): ${extractedInfo.application_period_start || 'NULL'}`);
    console.log(`신청기간 종료 (원본): ${extractedInfo.application_period_end || 'NULL'}`);

    const startDate = normalizeDate(extractedInfo.application_period_start);
    const endDate = normalizeDate(extractedInfo.application_period_end);

    console.log(`신청기간 시작 (정규화): ${startDate || 'NULL'}`);
    console.log(`신청기간 종료 (정규화): ${endDate || 'NULL'}`);
    console.log(`예산: ${extractedInfo.budget || 'NULL'}`);
    console.log(`지원대상: ${extractedInfo.target_description || 'NULL'}`);
    console.log(`지원금액: ${extractedInfo.support_amount || 'NULL'}`);

    console.log('\n💭 Gemini 분석 이유:');
    console.log('──────────────────────────────────────────────');
    console.log(analysisResult?.reasoning || '없음');

    // 공고 내용 일부 출력 (디버깅용)
    console.log('\n📄 공고 내용 (처음 500자):');
    console.log('──────────────────────────────────────────────');
    console.log(announcement.content?.substring(0, 500) || '내용 없음');

  } catch (error: any) {
    console.error('❌ Gemini AI 분석 실패:', error.message);
    process.exit(1);
  }
}

testGeminiExtraction()
  .then(() => {
    console.log('\n✅ 테스트 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  });
