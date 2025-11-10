// app/api/upload-metadata/route.ts
// Supabase 직접 업로드 후 메타데이터 저장 API
// 파일은 이미 Supabase Storage에 업로드된 상태
// DB에 메타데이터만 저장

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { memoryCache } from '@/lib/cache';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 사업장 ID 가져오기 또는 생성
 */
async function getOrCreateBusiness(businessName: string): Promise<string> {
  // 기존 사업장 조회
  const { data: existingBusiness, error: selectError } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('name', businessName)
    .single();

  if (existingBusiness) {
    console.log(`✅ [METADATA] 기존 사업장 사용: ${businessName} (${existingBusiness.id})`);
    return existingBusiness.id;
  }

  if (selectError?.code !== 'PGRST116') {
    // 'PGRST116'은 데이터가 없음을 의미
    throw selectError;
  }

  // 새 사업장 생성 (중복 방지)
  const { data: newBusiness, error: insertError } = await supabaseAdmin
    .from('businesses')
    .insert({
      name: businessName,
      status: 'active'
    })
    .select('id')
    .single();

  if (insertError) {
    // 중복 키 오류인 경우 다시 조회해서 반환
    if (insertError.code === '23505') {
      console.log(`⚠️ [METADATA] 중복 생성 시도, 기존 사업장 재조회: ${businessName}`);
      const { data: retryBusiness, error: retryError } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('name', businessName)
        .single();

      if (retryBusiness) {
        return retryBusiness.id;
      }
      if (retryError) {
        throw retryError;
      }
    }
    throw insertError;
  }

  console.log(`✅ [METADATA] 새 사업장 생성: ${businessName} (${newBusiness.id})`);
  return newBusiness.id;
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
    const { data: fileRecord, error: dbError } = await supabaseAdmin
      .from('uploaded_files')
      .insert({
        business_id: businessId,
        filename,
        original_filename: originalFilename || filename,
        file_path: filePath,
        file_size: fileSize,
        mime_type: mimeType,
        file_hash: fileHash,
        upload_status: 'uploaded',
        facility_info: facilityInfo || null
      })
      .select()
      .single();

    if (dbError) {
      console.error(`❌ [METADATA-API] DB 저장 실패:`, dbError);
      throw new Error(`DB 저장 실패: ${dbError.message}`);
    }

    console.log(`✅ [METADATA-API] 메타데이터 저장 완료: ${fileRecord.id}`);

    // 4. Google 동기화 큐에 추가 (선택사항)
    try {
      await supabaseAdmin
        .from('sync_queue')
        .insert({
          operation_type: 'upload_to_drive',
          payload: {
            file_id: fileRecord.id,
            business_name: businessName,
            file_type: fileType,
            facility_info: facilityInfo,
            system_type: systemType
          }
        });
      console.log(`📤 [METADATA-API] Google 동기화 큐 추가 완료`);
    } catch (syncError) {
      console.warn(`⚠️ [METADATA-API] Google 동기화 큐 추가 실패 (무시):`, syncError);
    }

    // 5. 캐시 무효화 (즉시 새 데이터 반영)
    memoryCache.delete(`files_${businessName}_completion`);
    memoryCache.delete(`files_${businessName}_presurvey`);
    console.log(`💾 [METADATA-API] 캐시 무효화: ${businessName}`);

    return NextResponse.json({
      success: true,
      fileId: fileRecord.id,
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
