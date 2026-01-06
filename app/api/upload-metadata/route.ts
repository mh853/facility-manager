// app/api/upload-metadata/route.ts
// Supabase 직접 업로드 후 메타데이터 저장 API
// 파일은 이미 Supabase Storage에 업로드된 상태
// DB에 메타데이터만 저장

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, query } from '@/lib/supabase-direct';
import { memoryCache } from '@/lib/cache';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 사업장 ID 가져오기 또는 생성
 * ✅ business_info 테이블 기준 (신규 시스템)
 */
async function getOrCreateBusiness(businessName: string): Promise<string> {
  // 기존 사업장 조회 (business_info 테이블)
  const existingBusiness = await queryOne(
    `SELECT id FROM business_info
     WHERE business_name = $1 AND is_deleted = false`,
    [businessName]
  );

  if (existingBusiness) {
    console.log(`✅ [METADATA] 기존 사업장 사용: ${businessName} (${existingBusiness.id})`);
    return existingBusiness.id;
  }

  // 새 사업장 생성 (중복 방지)
  try {
    const newBusiness = await queryOne(
      `INSERT INTO business_info (business_name, is_deleted, is_active)
       VALUES ($1, false, true)
       RETURNING id`,
      [businessName]
    );

    console.log(`✅ [METADATA] 새 사업장 생성: ${businessName} (${newBusiness.id})`);
    return newBusiness.id;
  } catch (error: any) {
    // 중복 키 오류인 경우 다시 조회해서 반환
    if (error.code === '23505') {
      console.log(`⚠️ [METADATA] 중복 생성 시도, 기존 사업장 재조회: ${businessName}`);
      const retryBusiness = await queryOne(
        `SELECT id FROM business_info
         WHERE business_name = $1 AND is_deleted = false`,
        [businessName]
      );

      if (retryBusiness) {
        return retryBusiness.id;
      }
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`💾 [METADATA-API] 메타데이터 저장 시작: ${requestId}`);

  try {
    const body = await request.json();
    const {
      businessName,
      systemType,
      fileType,
      facilityInfo,
      facilityId,
      facilityNumber,
      filename,
      originalFilename,
      filePath,
      fileSize,
      originalSize,
      mimeType,
      publicUrl
    } = body;

    console.log(`📋 [METADATA-API] 받은 데이터:`, {
      businessName,
      systemType,
      fileType,
      filename,
      fileSize: `${(fileSize/1024/1024).toFixed(2)}MB`,
      originalSize: originalSize ? `${(originalSize/1024/1024).toFixed(2)}MB` : 'N/A'
    });

    // 필수 필드 검증
    if (!businessName || !filename || !filePath) {
      return NextResponse.json(
        {
          success: false,
          error: '필수 필드 누락: businessName, filename, filePath'
        },
        { status: 400 }
      );
    }

    // 1. 사업장 ID 가져오기/생성
    const businessId = await getOrCreateBusiness(businessName);

    // 2. 파일 해시 계산 (간단한 버전 - 파일명 + 크기 + 타임스탬프)
    const fileHash = `${filename}-${fileSize}-${Date.now()}`;

    // 3. DB에 파일 정보 저장
    const fileRecord = await queryOne(
      `INSERT INTO uploaded_files (
        business_id, filename, original_filename, file_path,
        file_size, mime_type, file_hash, upload_status, facility_info
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, filename, original_filename, file_path, file_size,
                mime_type, upload_status, created_at, facility_info`,
      [
        businessId,
        filename,
        originalFilename || filename,
        filePath,
        fileSize,
        mimeType,
        fileHash,
        'uploaded',
        facilityInfo || null
      ]
    );

    console.log(`✅ [METADATA-API] 메타데이터 저장 완료: ${fileRecord.id}`);

    // 4. Google 동기화 큐에 추가 (선택사항)
    try {
      await query(
        `INSERT INTO sync_queue (operation_type, payload)
         VALUES ($1, $2)`,
        [
          'upload_to_drive',
          JSON.stringify({
            file_id: fileRecord.id,
            business_name: businessName,
            file_type: fileType,
            facility_info: facilityInfo,
            system_type: systemType
          })
        ]
      );
      console.log(`📤 [METADATA-API] Google 동기화 큐 추가 완료`);
    } catch (syncError) {
      console.warn(`⚠️ [METADATA-API] Google 동기화 큐 추가 실패 (무시):`, syncError);
    }

    // 5. 캐시 무효화 (즉시 새 데이터 반영)
    memoryCache.delete(`files_${businessName}_completion`);
    memoryCache.delete(`files_${businessName}_presurvey`);
    console.log(`💾 [METADATA-API] 캐시 무효화: ${businessName}`);

    // 6. 폴더명 추출 (uploaded-files-supabase API와 동일한 로직)
    const pathParts = filePath.split('/');
    let folderName = '기본사진';

    if (pathParts.includes('discharge')) {
      folderName = '배출시설';
    } else if (pathParts.includes('prevention')) {
      folderName = '방지시설';
    } else if (pathParts.includes('basic')) {
      folderName = '기본사진';
    } else if (facilityInfo) {
      const facilityLower = facilityInfo.toLowerCase();
      if (facilityLower.includes('배출') || facilityLower.includes('도장') || facilityLower.includes('건조') || facilityLower.includes('탈사')) {
        folderName = '배출시설';
      } else if (facilityLower.includes('방지') || facilityLower.includes('집진') || facilityLower.includes('세정') || facilityLower.includes('흡착')) {
        folderName = '방지시설';
      }
    }

    // 7. 완전한 파일 객체 반환 (uploaded-files-supabase API 응답 형식과 동일)
    const completeFileData = {
      id: fileRecord.id,
      name: fileRecord.filename,
      originalName: fileRecord.original_filename,
      mimeType: fileRecord.mime_type,
      size: fileRecord.file_size,
      createdTime: fileRecord.created_at,
      modifiedTime: fileRecord.created_at,
      webViewLink: publicUrl,
      downloadUrl: publicUrl,
      thumbnailUrl: publicUrl,
      publicUrl: publicUrl,
      directUrl: publicUrl,
      folderName,
      uploadStatus: fileRecord.upload_status,
      facilityInfo: fileRecord.facility_info,
      filePath: fileRecord.file_path,
      justUploaded: true
    };

    return NextResponse.json({
      success: true,
      fileId: fileRecord.id,
      fileData: completeFileData,
      message: '메타데이터 저장 완료'
    });

  } catch (error) {
    console.error(`❌ [METADATA-API] 저장 실패 (${requestId}):`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        requestId
      },
      { status: 500 }
    );
  }
}
