// scripts/supabase-client.js - 스크립트용 Supabase 클라이언트
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// 환경변수 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수 설정이 필요합니다: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// 서버용 (관리자 권한) 클라이언트
const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept-Charset': 'utf-8'
      }
    }
  }
);

console.log('✅ [SUPABASE] 스크립트 클라이언트 초기화 완료:', {
  url: supabaseUrl,
  hasServiceKey: !!supabaseServiceKey
});

module.exports = { supabaseAdmin };