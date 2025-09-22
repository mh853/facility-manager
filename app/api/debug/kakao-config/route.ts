import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // 보안을 위해 일부 정보만 노출
  const config = {
    KAKAO_CLIENT_ID: process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID ?
      process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID.substring(0, 8) + '...' : 'NOT_SET',
    KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET ? 'SET' : 'NOT_SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT_SET',
    REDIRECT_URI: (process.env.NEXTAUTH_URL || '') + '/api/auth/social/kakao/callback',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV || 'NOT_SET'
  };

  return NextResponse.json({
    success: true,
    config,
    timestamp: new Date().toISOString()
  });
}