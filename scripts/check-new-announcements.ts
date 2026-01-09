#!/usr/bin/env tsx

/**
 * 신규 추가된 공고 확인
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkNewAnnouncements() {
  console.log('🔍 신규 공고 확인\n');

  // 계룡시 최신 공고 가져오기
  const { data: announcements, error } = await supabase
    .from('subsidy_announcements')
    .select('id, title, content, region_name, source_url, created_at')
    .eq('region_name', '계룡시')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('❌ 조회 실패:', error.message);
    return;
  }

  if (!announcements || announcements.length === 0) {
    console.log('⚠️  계룡시 공고가 없습니다.');
    return;
  }

  console.log(`📋 계룡시 최신 공고 ${announcements.length}개\n`);

  announcements.forEach((ann, index) => {
    console.log(`\n[${ index + 1}] ════════════════════════════════════════`);
    console.log(`📌 제목: ${ann.title}`);
    console.log(`🏢 지자체: ${ann.region_name}`);
    console.log(`📏 본문 길이: ${ann.content?.length || 0}자`);
    console.log(`📅 등록일: ${new Date(ann.created_at).toLocaleString('ko-KR')}`);
    console.log(`🔗 URL: ${ann.source_url}`);

    // 키워드 체크
    const keywords = ['신청기간', '접수기간', '예산', '지원금액', '지원대상'];
    const foundKeywords = keywords.filter(k => ann.content?.includes(k));
    console.log(`🔑 키워드: ${foundKeywords.join(', ') || '없음'}`);

    // 본문 미리보기
    if (ann.content && ann.content.length > 0) {
      console.log(`\n📄 본문 미리보기:`);
      console.log(ann.content.substring(0, 300) + '...');
    } else {
      console.log(`\n⚠️  본문이 비어있습니다.`);
    }
  });

  console.log('\n════════════════════════════════════════\n');
}

checkNewAnnouncements();
