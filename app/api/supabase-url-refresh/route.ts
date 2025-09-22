// API for refreshing expired Supabase storage URLs
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    
    if (!filePath) {
      return NextResponse.json({
        success: false,
        message: '파일 경로가 필요합니다.'
      }, { status: 400 });
    }

    console.log('🔄 [URL-REFRESH] 파일 URL 새로고침 요청:', filePath);

    // Supabase Storage에서 새로운 공개 URL 생성
    const { data } = supabase.storage
      .from('facility-files')
      .getPublicUrl(filePath);

    if (data?.publicUrl) {
      console.log('✅ [URL-REFRESH] 새 URL 생성 성공:', data.publicUrl);
      
      return NextResponse.json({
        success: true,
        url: data.publicUrl,
        filePath
      });
    } else {
      console.error('❌ [URL-REFRESH] URL 생성 실패');
      return NextResponse.json({
        success: false,
        message: 'URL 생성에 실패했습니다.'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [URL-REFRESH] 서버 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}