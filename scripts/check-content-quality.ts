#!/usr/bin/env tsx

/**
 * 추출된 본문 품질 확인
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkContentQuality() {
  console.log('🔍 본문 품질 확인...\n');

  // 계룡시 공고 가져오기
  const { data: announcement } = await supabase
    .from('subsidy_announcements')
    .select('id, title, content')
    .eq('region_name', '계룡시')
    .single();

  if (!announcement) {
    console.error('❌ 계룡시 공고를 찾을 수 없습니다.');
    return;
  }

  console.log(`📋 제목: ${announcement.title}`);
  console.log(`📏 본문 길이: ${announcement.content?.length || 0}자\n`);
  console.log(`📄 본문 내용 (처음 1000자):`);
  console.log('──────────────────────────────────────────────');
  console.log(announcement.content?.substring(0, 1000) || '없음');
  console.log('──────────────────────────────────────────────\n');

  // 중요 키워드 확인
  const keywords = ['신청기간', '접수기간', '예산', '지원금액', '지원대상'];
  console.log('🔍 키워드 포함 여부:');
  keywords.forEach(keyword => {
    const included = announcement.content?.includes(keyword) ? '✅' : '❌';
    console.log(`  ${included} ${keyword}`);
  });
}

checkContentQuality();
