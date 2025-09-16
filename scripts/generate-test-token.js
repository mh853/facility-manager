// 테스트용 JWT 토큰 생성 스크립트
require('dotenv').config({ path: '.env.local' });

const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const JWT_SECRET = process.env.JWT_SECRET || 'facility-manager-super-secure-jwt-secret-key-2025-256-bits-recommended-for-production-use';

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateTestToken() {
  console.log('🔐 테스트용 JWT 토큰 생성...\n');

  try {
    // 관리자 사용자 조회
    const { data: user, error } = await supabase
      .from('employees')
      .select('*')
      .eq('permission_level', 3)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !user) {
      console.error('❌ 관리자 사용자를 찾을 수 없습니다.');
      return null;
    }

    console.log('👤 사용자 정보:');
    console.log(`   이름: ${user.name}`);
    console.log(`   이메일: ${user.email}`);
    console.log(`   권한레벨: ${user.permission_level}`);
    console.log(`   부서: ${user.department || 'N/A'}`);
    console.log(`   직급: ${user.position || 'N/A'}\n`);

    // JWT 토큰 생성
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      permissionLevel: user.permission_level,
      department: user.department,
      position: user.position,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24시간 유효
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET);

    console.log('🎫 생성된 JWT 토큰:');
    console.log(token);
    console.log('\n📋 테스트 방법:');
    console.log('1. 위 토큰을 복사하세요');
    console.log('2. scripts/test-task-api.js 파일의 authToken 변수에 붙여넣기');
    console.log('3. node scripts/test-task-api.js 실행');
    console.log('\n🔍 토큰 검증:');

    // 토큰 검증 테스트
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ 토큰 검증 성공');
      console.log(`   사용자: ${decoded.name} (${decoded.email})`);
      console.log(`   권한: ${decoded.permissionLevel}`);
      console.log(`   만료시간: ${new Date(decoded.exp * 1000).toLocaleString('ko-KR')}`);
    } catch (verifyError) {
      console.error('❌ 토큰 검증 실패:', verifyError.message);
    }

    return token;

  } catch (error) {
    console.error('❌ 토큰 생성 중 오류:', error.message);
    return null;
  }
}

// 스크립트 실행
if (require.main === module) {
  generateTestToken();
}

module.exports = { generateTestToken };