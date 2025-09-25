// JWT 토큰 마이그레이션 전략
const jwt = require('jsonwebtoken');

const OLD_SECRET = 'your-secret-key-change-this-in-production';
const NEW_SECRET = process.env.JWT_SECRET || 'your-new-secure-secret-key';

/**
 * 기존 토큰과 새 토큰을 모두 지원하는 검증 함수
 */
async function verifyTokenWithMigration(token) {
  try {
    // 먼저 새 시크릿으로 검증 시도
    const decoded = jwt.verify(token, NEW_SECRET);
    return { decoded, isOldToken: false };
  } catch (newSecretError) {
    try {
      // 실패하면 기존 시크릿으로 검증 시도
      const decoded = jwt.verify(token, OLD_SECRET);
      return { decoded, isOldToken: true };
    } catch (oldSecretError) {
      throw new Error('Invalid token');
    }
  }
}

/**
 * 기존 토큰을 새 토큰으로 업그레이드
 */
function upgradeToken(oldTokenPayload) {
  return jwt.sign(oldTokenPayload, NEW_SECRET, {
    expiresIn: '7d' // 7일 만료
  });
}

module.exports = {
  verifyTokenWithMigration,
  upgradeToken,
  OLD_SECRET,
  NEW_SECRET
};