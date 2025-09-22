import { NextResponse } from 'next/server';
import { createToken, verifyToken, findUserByEmail } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET() {
  try {
    console.log('🔐 [TEST-AUTH] 인증 시스템 테스트 시작');

    // 1. Mock 사용자 조회
    const adminUser = await findUserByEmail('admin@facility.blueon-iot.com');
    if (!adminUser) {
      return NextResponse.json({
        success: false,
        error: '관리자 사용자를 찾을 수 없습니다.'
      });
    }

    console.log('👤 [TEST-AUTH] 관리자 사용자 발견:', {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role
    });

    // 2. 토큰 생성
    const token = await createToken(adminUser);
    console.log('🎫 [TEST-AUTH] 토큰 생성 완료:', {
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...'
    });

    // 3. 토큰 검증
    const tokenPayload = await verifyToken(token);
    console.log('🔍 [TEST-AUTH] 토큰 검증 결과:', {
      valid: !!tokenPayload,
      payload: tokenPayload
    });

    // 4. 사용자 재조회 (토큰 기반)
    if (tokenPayload) {
      const userFromToken = await findUserByEmail(tokenPayload.email);
      console.log('👤 [TEST-AUTH] 토큰으로부터 사용자 재조회:', {
        found: !!userFromToken,
        email: userFromToken?.email,
        role: userFromToken?.role
      });
    }

    // 5. 권한 체크
    const isAdmin = adminUser.role === 3;
    const canAccessAdmin = adminUser.role >= 2;

    console.log('🔐 [TEST-AUTH] 권한 확인:', {
      isAdmin,
      canAccessAdmin,
      userRole: adminUser.role
    });

    return NextResponse.json({
      success: true,
      testResults: {
        userFound: !!adminUser,
        tokenGenerated: !!token,
        tokenValid: !!tokenPayload,
        tokenPayload,
        permissions: {
          isAdmin,
          canAccessAdmin,
          role: adminUser.role
        }
      },
      generatedToken: token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        department: adminUser.department
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [TEST-AUTH] 인증 테스트 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    });
  }
}