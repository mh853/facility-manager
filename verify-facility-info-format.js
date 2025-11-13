#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUSINESS_ID = '727c5a4d-5d46-46a7-95ec-eab2d80992c6';

async function main() {
  const { data: files } = await supabase
    .from('uploaded_files')
    .select('id, filename, facility_info')
    .eq('business_id', BUSINESS_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('📊 최근 업로드된 파일의 facility_info 형식:\n');
  files.forEach((file, idx) => {
    const type = typeof file.facility_info;
    const value = file.facility_info;
    console.log(`${idx + 1}. ${file.filename.substring(0, 40)}...`);
    console.log(`   Type: ${type}`);
    console.log(`   Value: ${JSON.stringify(value)}`);
    
    if (type === 'object') {
      console.log(`   ❌ JSON 객체 형식 (photoTracker가 파싱 못함)`);
      const correctFormat = `${value.type}_${value.outlet}_${value.number}`;
      console.log(`   ✅ 올바른 형식: "${correctFormat}"`);
    } else if (type === 'string') {
      if (/^(discharge|prevention)_\d+_\d+$/.test(value)) {
        console.log(`   ✅ 올바른 문자열 형식 (photoTracker가 파싱 가능)`);
      } else {
        console.log(`   ⚠️ 문자열이지만 형식이 다름`);
      }
    }
    console.log();
  });
}

main().catch(console.error);
