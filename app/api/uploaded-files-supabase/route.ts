// app/api/uploaded-files-supabase/route.ts - Supabase 기반 파일 조회/삭제 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

    console.log(`📂 [FILES-SUPABASE] 파일 조회 시작: ${businessName}, 시스템=${systemType}, 강제새로고침=${forceRefresh}`);

    // 사업장 조회
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

    // 업로드된 파일들 조회
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
      .order('created_at', { ascending: false });

    if (filesError) {
      throw filesError;
    }

    // 파일 URL 생성 및 실제 스토리지 파일 존재 여부 검증
    const filesWithUrls = [];
    const filesToCleanup = []; // DB에는 있지만 스토리지에 없는 파일들
    
    for (const file of files || []) {
      // 스토리지에서 파일 존재 여부 확인
      const { data: fileExists, error: checkError } = await supabaseAdmin.storage
        .from('facility-files')
        .list(file.file_path.split('/').slice(0, -1).join('/'), {
          search: file.file_path.split('/').pop()
        });

      const actualFileExists = fileExists && fileExists.length > 0;

      if (!actualFileExists && !checkError) {
        console.warn(`⚠️ [SYNC-CHECK] DB에는 있지만 스토리지에 없는 파일: ${file.file_path}`);
        filesToCleanup.push(file.id);
        continue; // 존재하지 않는 파일은 목록에서 제외
      }

      const { data: publicUrl } = supabaseAdmin.storage
        .from('facility-files')
        .getPublicUrl(file.file_path);

      // 폴더명 추출 (새로운 시설별 구조 반영)
      const pathParts = file.file_path.split('/');
      let folderName = '기본사진';
      
      if (pathParts.length > 1) {
        const folderPart = pathParts[1];
        if (folderPart === 'discharge') folderName = '배출시설';
        else if (folderPart === 'prevention') folderName = '방지시설';
        else if (folderPart === 'basic') folderName = '기본사진';
      }

      filesWithUrls.push({
        id: file.id,
        name: file.filename,
        originalName: file.original_filename,
        mimeType: file.mime_type,
        size: file.file_size,
        createdTime: file.created_at,
        modifiedTime: file.created_at,
        webViewLink: publicUrl.publicUrl,
        downloadUrl: publicUrl.publicUrl,
        thumbnailUrl: publicUrl.publicUrl,
        publicUrl: publicUrl.publicUrl,
        directUrl: publicUrl.publicUrl,
        folderName,
        uploadStatus: file.upload_status,
        syncedAt: file.synced_at,
        googleFileId: file.google_file_id,
        facilityInfo: file.facility_info,
        filePath: file.file_path // 시설별 경로 정보 추가
      });
    }

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

    return NextResponse.json({
      success: true,
      data: {
        files: filesWithUrls,
        totalCount: filesWithUrls.length,
        businessName,
        systemType
      }
    });

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
    const { fileId, fileName } = await request.json();

    if (!fileId) {
      return NextResponse.json({
        success: false,
        message: '파일 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log(`🗑️ [DELETE-SUPABASE] 파일 삭제 시작: ${fileId} (${fileName})`);

    // 파일 정보 조회
    const { data: file, error: selectError } = await supabaseAdmin
      .from('uploaded_files')
      .select('file_path, google_file_id, filename')
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

    // 3. Google Drive 삭제 큐에 추가 (Google 파일이 있는 경우)
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