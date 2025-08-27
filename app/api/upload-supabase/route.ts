// app/api/upload-supabase/route.ts - Supabase 기반 업로드 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createHash } from 'crypto';

// 파일 해시 계산
async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

// 사업장 ID 가져오기 또는 생성
async function getOrCreateBusiness(businessName: string): Promise<string> {
  // 기존 사업장 조회
  const { data: existingBusiness, error: selectError } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('name', businessName)
    .single();

  if (existingBusiness) {
    console.log(`✅ [BUSINESS] 기존 사업장 사용: ${businessName} (${existingBusiness.id})`);
    return existingBusiness.id;
  }

  if (selectError?.code !== 'PGRST116') { // 'PGRST116'은 데이터가 없음을 의미
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
      console.log(`⚠️ [BUSINESS] 중복 생성 시도, 기존 사업장 재조회: ${businessName}`);
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

  console.log(`✅ [BUSINESS] 새 사업장 생성: ${businessName} (${newBusiness.id})`);
  return newBusiness.id;
}

// 파일 타입에 따른 폴더 경로 생성 (Supabase Storage 호환 - ASCII만 사용)
function getFilePath(businessName: string, fileType: string, facilityInfo: string, filename: string): string {
  // Supabase Storage는 ASCII 문자만 허용하므로 한글 제거
  const sanitizedBusiness = businessName
    .replace(/[가-힣]/g, '')          // 한글 완전 제거
    .replace(/[^\w\-]/g, '_')         // 영문, 숫자, 하이픈, 언더스코어만 허용
    .replace(/\s+/g, '_')             // 공백을 언더스코어로 변경
    .replace(/_+/g, '_')              // 연속 언더스코어를 하나로 통합
    .replace(/^_|_$/g, '')            // 앞뒤 언더스코어 제거
    || 'business';                    // 빈 문자열인 경우 기본값
    
  const sanitizedFacility = facilityInfo
    .replace(/[가-힣]/g, '')
    .replace(/[^\w\-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'facility';
    
  const sanitizedFilename = filename
    .replace(/[가-힣]/g, '')
    .replace(/[^\w\-\.]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'file';
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  
  let folder = 'basic';
  if (fileType === 'discharge') folder = 'discharge';
  if (fileType === 'prevention') folder = 'prevention';

  const path = `${sanitizedBusiness}/${folder}/${timestamp}_${sanitizedFilename}`;
  
  console.log('🔧 [PATH] Storage 경로 생성 (ASCII만):', {
    원본: { businessName, fileType, facilityInfo, filename },
    정리후: { sanitizedBusiness, folder, sanitizedFilename },
    최종경로: path
  });

  return path;
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`🚀 [SUPABASE-UPLOAD] 업로드 시작: ${requestId}`);

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const businessName = formData.get('businessName') as string;
    const fileType = formData.get('fileType') as string;
    const facilityInfo = formData.get('facilityInfo') as string | null;
    const systemType = formData.get('type') as string || 'completion';

    if (!files.length) {
      return NextResponse.json({
        success: false,
        message: '업로드할 파일이 없습니다.'
      }, { status: 400 });
    }

    if (!businessName) {
      return NextResponse.json({
        success: false,
        message: '사업장명이 필요합니다.'
      }, { status: 400 });
    }

    console.log(`📋 [INFO] 업로드 정보: 사업장=${businessName}, 파일수=${files.length}, 타입=${fileType}`);

    // 1. 사업장 ID 가져오기/생성
    const businessId = await getOrCreateBusiness(businessName);

    // 2. 파일 해시 계산 (병렬)
    console.log(`🔐 [HASH] 해시 계산 시작: ${files.length}개 파일 (병렬)`);
    const fileHashPromises = files.map(async (file, index) => {
      const hash = await calculateFileHash(file);
      console.log(`✅ [HASH] ${index + 1}/${files.length} 완료: ${hash.substring(0, 12)}...`);
      return { file, hash };
    });

    const fileHashInfos = await Promise.all(fileHashPromises);
    console.log(`✅ [HASH] 모든 해시 계산 완료`);

    // 3. 중복 파일 검사
    const duplicateFiles = [];
    const validFiles = [];

    for (const { file, hash } of fileHashInfos) {
      const { data: existing } = await supabaseAdmin
        .from('uploaded_files')
        .select('id, filename')
        .eq('business_id', businessId)
        .eq('file_hash', hash)
        .single();

      if (existing) {
        duplicateFiles.push({
          name: file.name,
          hash: hash.substring(0, 12) + '...',
          size: file.size
        });
      } else {
        validFiles.push({ file, hash });
      }
    }

    if (validFiles.length === 0) {
      return NextResponse.json({
        success: false,
        message: `모든 파일이 중복입니다. ${duplicateFiles.length}개 파일이 이미 업로드되어 있습니다: ${duplicateFiles.map(f => f.name).join(', ')}`,
        duplicateFiles,
        totalFiles: files.length,
        uploadedFiles: 0,
        duplicatedFiles: duplicateFiles.length
      });
    }

    console.log(`📤 [UPLOAD] Supabase Storage 업로드 시작: ${validFiles.length}개 파일`);

    // 4. Supabase Storage에 업로드 (병렬)
    const uploadPromises = validFiles.map(async ({ file, hash }, index) => {
      try {
        const filePath = getFilePath(businessName, fileType, facilityInfo || '기본사진', file.name);
        
        // Storage에 업로드
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('facility-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Storage 업로드 실패: ${uploadError.message}`);
        }

        console.log(`📁 [STORAGE] ${index + 1}/${validFiles.length} 업로드 완료: ${filePath}`);

        // 5. DB에 파일 정보 저장
        const { data: fileRecord, error: dbError } = await supabaseAdmin
          .from('uploaded_files')
          .insert({
            business_id: businessId,
            filename: uploadData.path.split('/').pop() || file.name,
            original_filename: file.name,
            file_hash: hash,
            file_path: uploadData.path,
            file_size: file.size,
            mime_type: file.type,
            upload_status: 'uploaded',
            facility_info: facilityInfo // 시설 정보 추가
          })
          .select()
          .single();

        if (dbError) {
          // Storage에서 파일 삭제 (롤백)
          await supabaseAdmin.storage
            .from('facility-files')
            .remove([uploadData.path]);
          throw new Error(`DB 저장 실패: ${dbError.message}`);
        }

        console.log(`💾 [DATABASE] ${index + 1}/${validFiles.length} DB 저장 완료`);

        // 6. Google 동기화 큐에 추가
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

        // 7. 공개 URL 생성
        const { data: publicUrl } = supabaseAdmin.storage
          .from('facility-files')
          .getPublicUrl(uploadData.path);

        return {
          id: fileRecord.id,
          name: fileRecord.filename,
          originalName: file.name,
          url: publicUrl.publicUrl,
          downloadUrl: publicUrl.publicUrl,
          thumbnailUrl: publicUrl.publicUrl,
          size: file.size,
          mimeType: file.type,
          uploadStatus: 'uploaded',
          hash: hash.substring(0, 12) + '...'
        };

      } catch (error) {
        console.error(`❌ [UPLOAD] 파일 업로드 실패 ${index + 1}:`, error);
        throw error;
      }
    });

    // 모든 업로드 실행
    const uploadResults = await Promise.allSettled(uploadPromises);
    
    const successfulUploads = uploadResults
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as any).value);
    
    const failedUploads = uploadResults
      .filter(result => result.status === 'rejected')
      .map(result => (result as any).reason);

    // 8. 응답 생성
    let message = `${successfulUploads.length}장의 파일이 업로드되었습니다.`;
    
    if (duplicateFiles.length > 0) {
      message += ` (${duplicateFiles.length}장 중복으로 제외됨)`;
    }
    
    if (failedUploads.length > 0) {
      message += ` (${failedUploads.length}장 실패)`;
    }

    message += ' Google Drive 동기화가 백그라운드에서 진행됩니다.';

    console.log(`✅ [SUPABASE-UPLOAD] 완료: ${requestId}, 성공=${successfulUploads.length}, 실패=${failedUploads.length}, 중복=${duplicateFiles.length}`);

    return NextResponse.json({
      success: successfulUploads.length > 0,
      message,
      files: successfulUploads,
      totalUploaded: successfulUploads.length,
      duplicateFiles,
      stats: {
        total: files.length,
        success: successfulUploads.length,
        failed: failedUploads.length,
        duplicated: duplicateFiles.length
      },
      errors: failedUploads.length > 0 ? failedUploads.map(e => e.message) : undefined
    });

  } catch (error) {
    console.error(`❌ [SUPABASE-UPLOAD] 전체 실패: ${requestId}`, error);
    
    return NextResponse.json({
      success: false,
      message: '업로드 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'),
      requestId
    }, { status: 500 });
  }
}