// API for cleaning up database records of missing files
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 [CLEANUP] 누락된 파일 정리 시작');

    // 1. 모든 업로드된 파일 목록 조회
    const { data: allFiles, error: selectError } = await supabaseAdmin
      .from('uploaded_files')
      .select('id, filename, file_path, business_id');

    if (selectError) {
      throw selectError;
    }

    console.log(`📋 [CLEANUP] 총 ${allFiles?.length || 0}개 파일 검사 시작`);

    const missingFiles: any[] = [];
    const existingFiles: any[] = [];

    // 2. 각 파일이 실제로 Storage에 존재하는지 확인
    for (const file of allFiles || []) {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from('facility-files')
          .download(file.file_path);

        if (error || !data) {
          console.log(`❌ [MISSING] 파일 없음: ${file.filename} (${file.file_path})`);
          missingFiles.push(file);
        } else {
          console.log(`✅ [EXISTS] 파일 존재: ${file.filename}`);
          existingFiles.push(file);
        }
      } catch (error) {
        console.log(`💥 [ERROR] 파일 검사 실패: ${file.filename}`, error);
        missingFiles.push(file);
      }
    }

    console.log(`📊 [CLEANUP] 검사 완료: 존재=${existingFiles.length}, 누락=${missingFiles.length}`);

    // 3. 누락된 파일들을 데이터베이스에서 제거 (선택적)
    const { cleanup } = await request.json().catch(() => ({ cleanup: false }));
    
    let deletedCount = 0;
    if (cleanup && missingFiles.length > 0) {
      console.log(`🗑️ [CLEANUP] ${missingFiles.length}개 누락 파일 DB에서 삭제 시작`);
      
      for (const file of missingFiles) {
        const { error: deleteError } = await supabaseAdmin
          .from('uploaded_files')
          .delete()
          .eq('id', file.id);

        if (!deleteError) {
          deletedCount++;
          console.log(`✅ [DELETED] DB에서 삭제: ${file.filename}`);
        } else {
          console.error(`❌ [DELETE-FAILED] 삭제 실패: ${file.filename}`, deleteError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '파일 정리 완료',
      data: {
        totalFiles: allFiles?.length || 0,
        existingFiles: existingFiles.length,
        missingFiles: missingFiles.length,
        deletedFromDB: deletedCount,
        missingFilesList: missingFiles.map(f => ({
          id: f.id,
          filename: f.filename,
          path: f.file_path
        })),
        existingFilesList: existingFiles.map(f => ({
          id: f.id,
          filename: f.filename,
          path: f.file_path
        }))
      }
    });

  } catch (error) {
    console.error('❌ [CLEANUP] 정리 작업 실패:', error);
    
    return NextResponse.json({
      success: false,
      message: '파일 정리 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}