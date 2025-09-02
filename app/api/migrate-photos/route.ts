// app/api/migrate-photos/route.ts - 기존 사진을 설치 전 실사로 마이그레이션하는 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`🚀 [MIGRATION] 기존 사진 마이그레이션 시작: ${requestId}`);

  try {
    // 1. 기존 파일들 조회 (presurvey 또는 completion이 경로에 포함되지 않은 파일들)
    console.log('📂 기존 파일 조회 중...');
    const { data: files, error: filesError } = await supabaseAdmin
      .from('uploaded_files')
      .select('id, file_path, original_filename, business_id')
      .not('file_path', 'like', '%/presurvey/%')
      .not('file_path', 'like', '%/completion/%')
      .order('created_at', { ascending: true });

    if (filesError) {
      throw filesError;
    }

    console.log(`📊 마이그레이션 대상: ${files?.length || 0}개 파일`);
    
    if (!files || files.length === 0) {
      return NextResponse.json({
        success: true,
        message: '마이그레이션할 파일이 없습니다.',
        stats: {
          total: 0,
          success: 0,
          failed: 0
        }
      });
    }

    // 2. 마이그레이션 수행
    const migrationResults = {
      success: [] as any[],
      failed: [] as any[]
    };

    console.log(`🔄 ${files.length}개 파일 마이그레이션 시작...`);

    for (const [index, file] of files.entries()) {
      try {
        console.log(`[${index + 1}/${files.length}] 처리: ${file.original_filename}`);
        
        // 경로 변환: business/folder -> business/presurvey/folder
        const pathParts = file.file_path.split('/');
        if (pathParts.length >= 2) {
          // 두 번째 위치에 'presurvey' 삽입
          pathParts.splice(1, 0, 'presurvey');
          const newPath = pathParts.join('/');
          
          console.log(`  기존: ${file.file_path}`);
          console.log(`  신규: ${newPath}`);
          
          // Storage에서 파일 복사 (안전성을 위해 copy 사용)
          const { error: copyError } = await supabaseAdmin.storage
            .from('facility-files')
            .copy(file.file_path, newPath);

          if (copyError) {
            throw new Error(`Storage 복사 실패: ${copyError.message}`);
          }

          // DB 업데이트
          const { error: updateError } = await supabaseAdmin
            .from('uploaded_files')
            .update({ file_path: newPath })
            .eq('id', file.id);

          if (updateError) {
            // 복사된 파일 정리
            await supabaseAdmin.storage
              .from('facility-files')
              .remove([newPath]);
            throw new Error(`DB 업데이트 실패: ${updateError.message}`);
          }

          // 기존 파일 삭제
          const { error: deleteError } = await supabaseAdmin.storage
            .from('facility-files')
            .remove([file.file_path]);

          if (deleteError) {
            console.warn(`  ⚠️ 기존 파일 삭제 실패 (무시): ${deleteError.message}`);
          }

          migrationResults.success.push({
            id: file.id,
            filename: file.original_filename,
            oldPath: file.file_path,
            newPath: newPath
          });
          
          console.log(`  ✅ 성공`);
        } else {
          throw new Error(`예상하지 못한 경로 형식: ${file.file_path}`);
        }

      } catch (error) {
        console.error(`  ❌ 실패: ${error instanceof Error ? error.message : String(error)}`);
        migrationResults.failed.push({
          id: file.id,
          filename: file.original_filename,
          path: file.file_path,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const message = `마이그레이션 완료: ${migrationResults.success.length}개 성공, ${migrationResults.failed.length}개 실패`;
    console.log(`✅ [MIGRATION] ${message}: ${requestId}`);

    return NextResponse.json({
      success: true,
      message,
      stats: {
        total: files.length,
        success: migrationResults.success.length,
        failed: migrationResults.failed.length
      },
      results: {
        success: migrationResults.success,
        failed: migrationResults.failed
      }
    });

  } catch (error) {
    console.error(`❌ [MIGRATION] 실패: ${requestId}`, error);
    
    return NextResponse.json({
      success: false,
      message: '마이그레이션 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'),
      requestId
    }, { status: 500 });
  }
}

// GET 요청으로 마이그레이션 대상 파일 조회
export async function GET(request: NextRequest) {
  try {
    const { data: files, error: filesError } = await supabaseAdmin
      .from('uploaded_files')
      .select('id, file_path, original_filename, created_at, businesses(name)')
      .not('file_path', 'like', '%/presurvey/%')
      .not('file_path', 'like', '%/completion/%')
      .order('created_at', { ascending: false });

    if (filesError) {
      throw filesError;
    }

    return NextResponse.json({
      success: true,
      message: `마이그레이션 대상: ${files?.length || 0}개 파일`,
      files: files || [],
      count: files?.length || 0
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: '파일 조회 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}