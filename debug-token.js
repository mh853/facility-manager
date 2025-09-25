// debug-token.js - JWT 토큰 디버깅용 스크립트
const jwt = require('jsonwebtoken');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=== JWT Token Debug Tool ===');
console.log('브라우저에서 localStorage.getItem("auth_token")의 값을 입력하세요:');

rl.question('Token: ', (token) => {
  if (!token || token.trim() === '') {
    console.log('❌ 토큰이 입력되지 않았습니다.');
    rl.close();
    return;
  }

  try {
    // JWT 토큰 헤더와 페이로드 디코딩 (검증 없이)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('❌ 올바르지 않은 JWT 토큰 형식입니다.');
      rl.close();
      return;
    }

    // 헤더 디코딩
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    console.log('🔍 JWT Header:', JSON.stringify(header, null, 2));

    // 페이로드 디코딩
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('🔍 JWT Payload:', JSON.stringify(payload, null, 2));

    // JWT_SECRET 테스트 (기본값)
    const JWT_SECRET = 'your-secret-key-change-this-in-production';
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      console.log('✅ 로컬 JWT_SECRET으로 검증 성공:', JSON.stringify(verified, null, 2));
    } catch (verifyError) {
      console.log('❌ 로컬 JWT_SECRET으로 검증 실패:', verifyError.message);
    }

    // 토큰 만료 확인
    if (payload.exp) {
      const expDate = new Date(payload.exp * 1000);
      const now = new Date();
      console.log('⏰ 토큰 만료 시간:', expDate.toISOString());
      console.log('⏰ 현재 시간:', now.toISOString());
      console.log('⏰ 만료 여부:', now > expDate ? '만료됨' : '유효함');
    }

    // 사용자 ID 확인
    console.log('👤 사용자 ID 정보:', {
      userId: payload.userId,
      id: payload.id,
      decodedId: payload.userId || payload.id
    });

  } catch (error) {
    console.log('❌ 토큰 디코딩 오류:', error.message);
  }

  rl.close();
});