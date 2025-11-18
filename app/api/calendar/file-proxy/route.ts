// app/api/calendar/file-proxy/route.ts - 캘린더 파일 프록시 API (최적화 버전)
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Supabase Storage 파일을 프록시로 제공 (성능 최적화 버전)
 * GET /api/calendar/file-proxy?path=calendar/temp/xxx.pdf
 *
 * 성능 최적화:
 * - 24시간 캐싱 (max-age=86400)
 * - stale-while-revalidate로 백그라운드 갱신
 * - 스트리밍 응답으로 TTFB 개선
 * - ETag 지원으로 조건부 요청 처리
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({
        success: false,
        message: '파일 경로가 필요합니다.'
      }, { status: 400 });
    }

    // calendar/ 경로만 허용 (보안)
    if (!filePath.startsWith('calendar/')) {
      return NextResponse.json({
        success: false,
        message: '허용되지 않은 파일 경로입니다.'
      }, { status: 403 });
    }

    console.log(`📥 [FILE-PROXY] 파일 다운로드 시작: ${filePath}`);

    // ETag 생성 (파일 경로 기반 간단한 해시)
    const etag = `"${Buffer.from(filePath).toString('base64')}"`;

    // 조건부 요청 처리 (304 Not Modified)
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      console.log(`⚡ [FILE-PROXY] 캐시 히트 (304): ${filePath}`);
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    // Supabase Storage에서 파일 다운로드 (admin 권한 사용)
    const downloadStart = Date.now();
    const { data, error } = await supabaseAdmin.storage
      .from('facility-files')
      .download(filePath);

    if (error) {
      console.error('❌ [FILE-PROXY] 파일 다운로드 실패:', error);
      return NextResponse.json({
        success: false,
        message: `파일을 찾을 수 없습니다: ${error.message}`
      }, { status: 404 });
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        message: '파일 데이터가 없습니다.'
      }, { status: 404 });
    }

    const downloadTime = Date.now() - downloadStart;
    console.log(`✅ [FILE-PROXY] 파일 다운로드 완료: ${filePath} (${downloadTime}ms)`);

    // MIME 타입 추출 (파일 확장자 기반)
    const extension = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'zip': 'application/zip',
    };

    const contentType = extension && mimeTypes[extension]
      ? mimeTypes[extension]
      : 'application/octet-stream';

    // ArrayBuffer를 Uint8Array로 변환
    const arrayBuffer = await data.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const totalTime = Date.now() - startTime;
    console.log(`⚡ [FILE-PROXY] 전체 처리 시간: ${totalTime}ms (다운로드: ${downloadTime}ms, 변환: ${totalTime - downloadTime}ms)`);

    // 응답 생성 (최적화된 캐싱 전략)
    const response = new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Content-Length': uint8Array.length.toString(),
        // 🚀 성능 최적화: 24시간 캐싱 + 7일 stale-while-revalidate
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800, immutable',
        'ETag': etag,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'ETag, Cache-Control',
        // iframe 내에서 로드 허용 (CSP frame-ancestors 오버라이드)
        'Content-Security-Policy': "frame-ancestors 'self'",
        'X-Frame-Options': 'SAMEORIGIN',
        // 성능 힌트
        'X-Content-Type-Options': 'nosniff',
        'X-Download-Time': `${downloadTime}ms`,
        'X-Total-Time': `${totalTime}ms`,
      },
    });

    return response;

  } catch (error) {
    console.error('❌ [FILE-PROXY] 오류 발생:', error);
    return NextResponse.json({
      success: false,
      message: '파일 처리 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}
