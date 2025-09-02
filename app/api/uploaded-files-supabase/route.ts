// app/api/uploaded-files-supabase/route.ts - Supabase 기반 파일 조회/삭제 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { memoryCache } from '@/lib/cache';

// 파일 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessName = searchParams.get('businessName');
    const systemType = searchParams.get('systemType') || 'completion';
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (!businessName) {
      return NextResponse.json({
        success: false,
        message: '사업장명이 필요합니다.'
      }, { status: 400 });
    }

    // 스마트 캐싱: 5분 캐시 적용
    const cacheKey = `files_${businessName}_${systemType}`;
    
    if (!forceRefresh) {
      const cachedResult = memoryCache.get(cacheKey);
      if (cachedResult) {
        console.log(`💾 [CACHE-HIT] 캐시된 파일 목록 반환: ${businessName}_${systemType}`);
        return NextResponse.json(cachedResult);
      }
    }

    console.log(`📂 [FILES-SUPABASE] 파일 조회 시작: ${businessName}, 시스템=${systemType}, 강제새로고침=${forceRefresh}`);

    // 사업장 조회 - ✅ FIXED: businesses 테이블 사용 (업로드 API와 일치)
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('name', businessName)
      .single();

    if (businessError) {
      console.log(`❌ [FILES-SUPABASE] 사업장을 찾을 수 없음: ${businessName}`);
      return NextResponse.json({
        success: true,
        data: { files: [] },
        message: '사업장을 찾을 수 없습니다.'
      });
    }

    // systemType별로 파일 경로 필터링을 위한 패턴 생성
    const systemPrefix = systemType === 'presurvey' ? 'presurvey' : 'completion';
    
    // 업로드된 파일들 조회 (systemType 기반 필터링)
    const { data: files, error: filesError } = await supabaseAdmin
      .from('uploaded_files')
      .select(`
        id,
        filename,
        original_filename,
        file_path,
        file_size,
        mime_type,
        upload_status,
        created_at,
        synced_at,
        google_file_id,
        facility_info
      `)
      .eq('business_id', business.id)
      .like('file_path', `%/${systemPrefix}/%`)
      .order('created_at', { ascending: false });

    if (filesError) {
      throw filesError;
    }

    // 파일 URL 생성 및 배치 처리로 최적화
    const filesWithUrls: any[] = [];
    const filesToCleanup: string[] = [];
    
    if (!files || files.length === 0) {
      return NextResponse.json({
        success: true,
        data: { files: [], totalCount: 0, businessName, systemType }
      });
    }

    // 배치 처리: 모든 파일의 Signed URL을 병렬로 생성
    const urlGenerationPromises = files.map(async (file: any) => {
      try {
        // Public URL 생성 (빠른 대안)
        const { data: publicUrl } = supabaseAdmin.storage
          .from('facility-files')
          .getPublicUrl(file.file_path);

        // Signed URL은 선택적으로만 생성 (보안이 필요한 경우)
        let signedUrl = null;
        if (file.file_size > 5 * 1024 * 1024) { // 5MB 이상 파일만 Signed URL 사용
          const { data: signed } = await supabaseAdmin.storage
            .from('facility-files')
            .createSignedUrl(file.file_path, 7200); // 2시간 유효
          signedUrl = signed;
        }

        const actualUrl = signedUrl?.signedUrl || publicUrl.publicUrl;

        // 폴더명 추출 (새로운 시설별 구조 반영 - systemType 포함)
        const pathParts = file.file_path.split('/');
        let folderName = '기본사진';
        
        // 새 구조: business/presurvey/discharge/ 또는 business/completion/discharge/
        if (pathParts.includes('discharge')) {
          folderName = '배출시설';
        } else if (pathParts.includes('prevention')) {
          folderName = '방지시설';
        } else if (pathParts.includes('basic')) {
          folderName = '기본사진';
        }

        return {
          id: file.id,
          name: file.filename,
          originalName: file.original_filename,
          mimeType: file.mime_type,
          size: file.file_size,
          createdTime: file.created_at,
          modifiedTime: file.created_at,
          webViewLink: actualUrl,
          downloadUrl: actualUrl,
          thumbnailUrl: actualUrl,
          publicUrl: actualUrl,
          directUrl: actualUrl,
          folderName,
          uploadStatus: file.upload_status,
          syncedAt: file.synced_at,
          googleFileId: file.google_file_id,
          facilityInfo: file.facility_info,
          filePath: file.file_path
        };
      } catch (error) {
        console.error(`❌ [URL-ERROR] URL 생성 실패: ${file.file_path}`, error);
        return null;
      }
    });

    // 병렬 처리 실행
    const urlResults = await Promise.allSettled(urlGenerationPromises);
    
    urlResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        filesWithUrls.push(result.value);
      } else {
        const file = files[index];
        console.warn(`⚠️ [BATCH-PROCESS] 파일 처리 실패: ${file.file_path}`);
        filesToCleanup.push(file.id);
      }
    });

    // DB 정리: 스토리지에 없는 파일 레코드들 삭제
    if (filesToCleanup.length > 0) {
      console.log(`🧹 [CLEANUP] DB 정리: ${filesToCleanup.length}개 파일 레코드 삭제`);
      
      const { error: cleanupError } = await supabaseAdmin
        .from('uploaded_files')
        .delete()
        .in('id', filesToCleanup);

      if (cleanupError) {
        console.error('🧹 [CLEANUP] DB 정리 실패:', cleanupError);
      } else {
        console.log('🧹 [CLEANUP] DB 정리 완료');
      }
    }

    console.log(`✅ [FILES-SUPABASE] 조회 완료: ${filesWithUrls.length}개 파일`);

    const response = {
      success: true,
      data: {
        files: filesWithUrls,
        totalCount: filesWithUrls.length,
        businessName,
        systemType
      }
    };

    // 캐시에 저장 (5분 TTL)
    memoryCache.set(cacheKey, response, 5);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [FILES-SUPABASE] 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: '파일 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

// 파일 삭제 (DELETE)
export async function DELETE(request: NextRequest) {
  try {
    const { fileId, fileName, businessName } = await request.json();

    if (!fileId) {
      return NextResponse.json({
        success: false,
        message: '파일 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log(`🗑️ [DELETE-SUPABASE] 파일 삭제 시작: ${fileId} (${fileName})`);

    // 파일 정보 조회 (사업장 정보 포함)
    const { data: file, error: selectError } = await supabaseAdmin
      .from('uploaded_files')
      .select(`
        file_path, 
        google_file_id, 
        filename,
        businesses!business_id(name)
      `)
      .eq('id', fileId)
      .single();

    if (selectError || !file) {
      return NextResponse.json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 1. Supabase Storage에서 삭제
    const { error: storageError } = await supabaseAdmin.storage
      .from('facility-files')
      .remove([file.file_path]);

    if (storageError) {
      console.warn(`⚠️ [DELETE-SUPABASE] Storage 삭제 실패: ${storageError.message}`);
    } else {
      console.log(`✅ [DELETE-SUPABASE] Storage 삭제 완료: ${file.file_path}`);
    }

    // 2. DB에서 삭제
    const { error: dbError } = await supabaseAdmin
      .from('uploaded_files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      throw dbError;
    }

    console.log(`✅ [DELETE-SUPABASE] DB 삭제 완료: ${fileId}`);

    // 3. 캐시 무효화 (삭제 후 즉시 새 데이터 로드를 위해)
    if (businessName) {
      memoryCache.delete(`files_${businessName}_completion`);
      memoryCache.delete(`files_${businessName}_presurvey`);
      console.log(`💾 [CACHE-INVALIDATE] 캐시 무효화 완료: ${businessName}`);
    }

    // 4. Google Drive 삭제 큐에 추가 (Google 파일이 있는 경우)
    if (file.google_file_id) {
      await supabaseAdmin
        .from('sync_queue')
        .insert({
          operation_type: 'delete_file',
          payload: {
            google_file_id: file.google_file_id,
            file_name: file.filename
          }
        });
      
      console.log(`📋 [DELETE-SUPABASE] Google Drive 삭제 큐 추가: ${file.google_file_id}`);
    }

    return NextResponse.json({
      success: true,
      message: `파일이 삭제되었습니다: ${fileName}`,
      deletedFileId: fileId
    });

  } catch (error) {
    console.error('❌ [DELETE-SUPABASE] 삭제 실패:', error);
    return NextResponse.json({
      success: false,
      message: '파일 삭제 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}