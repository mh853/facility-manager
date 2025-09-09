// app/api/upload-supabase/route.ts - Supabase 기반 업로드 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { memoryCache } from '@/lib/cache';
import { createHash } from 'crypto';
import { generateFacilityFileName, generateBasicFileName } from '@/utils/filename-generator';

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

// 시설별 세분화된 폴더 경로 생성 (Supabase Storage 호환 - ASCII만 사용)
function getFilePath(businessName: string, fileType: string, facilityInfo: string, filename: string, systemType: string = 'completion', displayName?: string): string {
  // Supabase Storage는 ASCII 문자만 허용하므로 한글 제거
  const sanitizedBusiness = businessName
    .replace(/[가-힣]/g, '')          // 한글 완전 제거
    .replace(/[^\w\-]/g, '_')         // 영문, 숫자, 하이픈, 언더스코어만 허용
    .replace(/\s+/g, '_')             // 공백을 언더스코어로 변경
    .replace(/_+/g, '_')              // 연속 언더스코어를 하나로 통합
    .replace(/^_|_$/g, '')            // 앞뒤 언더스코어 제거
    || 'business';                    // 빈 문자열인 경우 기본값
    
  // 시설 정보에서 배출구 번호와 시설명 추출
  const facilityName = extractFacilityName(facilityInfo);
  const outletNumber = extractOutletNumber(facilityInfo);
  
  // 시설명에서 숫자와 영문만 추출 (배출시설1 → discharge1, 방지시설2 → prevention2)
  const facilityNumber = facilityName.match(/(\d+)/)?.[1] || '0';
  const facilityType = fileType === 'discharge' ? 'discharge' : 
                      fileType === 'prevention' ? 'prevention' : 'facility';
  const sanitizedFacilityName = `${facilityType}${facilityNumber}`;
  
  console.log('🔢 [FACILITY-SANITIZE] 시설명 정리:', {
    원본시설명: facilityName,
    추출숫자: facilityNumber,
    시설타입: facilityType,
    정리후: sanitizedFacilityName
  });
    
  const sanitizedFilename = filename
    .replace(/[가-힣]/g, '')
    .replace(/[^\w\-\.]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'file';
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  
  // 기본 폴더 타입
  let baseFolder = 'basic';
  if (fileType === 'discharge') baseFolder = 'discharge';
  if (fileType === 'prevention') baseFolder = 'prevention';
  
  // 시스템 타입 기반 폴더 구조 추가 (설치 전/후 분리)
  const systemPrefix = systemType === 'presurvey' ? 'presurvey' : 'completion';
  
  // 시설명 기반 ASCII 호환 폴더 구조 (각 시설별 구분)
  // 예: business/presurvey/discharge/facility_discharge1/, business/completion/discharge/facility_discharge1/
  let facilityFolder = '';
  
  if (fileType === 'discharge') {
    // 배출시설: facility_discharge + 숫자 (displayName에서 마지막 숫자 추출)
    const facilityNumber = displayName ? displayName.match(/(\d+)$/)?.[1] || outletNumber : outletNumber;
    facilityFolder = `facility_discharge${facilityNumber}`;
  } else if (fileType === 'prevention') {
    // 방지시설: outlet_숫자_prev_facility (배출구 번호 기반)
    const facilityNumber = displayName ? displayName.match(/(\d+)$/)?.[1] || outletNumber : outletNumber;
    facilityFolder = `outlet_${facilityNumber}_prev_facility`;
  } else {
    // 기본시설: facility_숫자 (시설 인덱스 기반)
    const facilityIndex = getFacilityIndex(facilityInfo);
    facilityFolder = `facility_${facilityIndex}`;
  }
  
  const path = `${sanitizedBusiness}/${systemPrefix}/${baseFolder}/${facilityFolder}/${timestamp}_${sanitizedFilename}`;
  
  console.log('🔧 [PATH] 시설명 기반 안정적 경로 생성:', {
    원본: { businessName, fileType, facilityInfo, filename, displayName, systemType },
    추출됨: { facilityName, outletNumber, displayFacilityNumber: displayName ? displayName.match(/(\d+)/)?.[1] : null },
    정리후: { sanitizedBusiness, systemPrefix, baseFolder, facilityFolder, sanitizedFilename },
    최종경로: path,
    구조: 'systemType 분리된 ASCII 호환 구조'
  });

  return path;
}

// 시설 정보에서 시설명 추출 (숫자 포함)
function extractFacilityName(facilityInfo: string): string {
  // "배출시설1 (용량정보, 수량: N개, 배출구: N번)" 형식에서 시설명+숫자 추출
  const match = facilityInfo.match(/^([^(]+)/);
  const fullName = match ? match[1].trim() : 'facility';
  
  // 숫자가 포함된 전체 시설명 반환 (예: "배출시설1", "배출시설2")
  console.log('🏷️ [FACILITY-NAME] 시설명 추출:', {
    원본: facilityInfo,
    추출된시설명: fullName
  });
  
  return fullName;
}

// 시설 정보에서 배출구 번호 추출
function extractOutletNumber(facilityInfo: string): string {
  // "배출구: N번" 형식에서 번호 추출
  const match = facilityInfo.match(/배출구:\s*(\d+)번/);
  return match ? match[1] : '0';
}

// 기본시설의 고유 인덱스 생성 (시설명 및 시설번호 기반)
function getFacilityIndex(facilityInfo: string): string {
  console.log('🔢 [FACILITY-INDEX] 기본시설 인덱스 추출:', {
    facilityInfo,
  });
  
  // 먼저 시설번호가 명시되어 있는지 확인 (새로운 형식)
  const facilityNumberMatch = facilityInfo.match(/시설번호:\s*(\d+)번/);
  if (facilityNumberMatch) {
    const number = facilityNumberMatch[1];
    console.log('✅ [FACILITY-INDEX] 시설번호 직접 추출:', number);
    return number;
  }
  
  // 기존 방식: 시설명에 따른 고유 인덱스 생성
  const facilityName = facilityInfo.toLowerCase();
  
  let index = '0';
  if (facilityName.includes('게이트웨이') || facilityName.includes('gateway')) index = '1';
  else if (facilityName.includes('제어반') || facilityName.includes('배전함') || facilityName.includes('control')) index = '2';  
  else if (facilityName.includes('송풍기') || facilityName.includes('blower') || facilityName.includes('풍')) index = '3';
  else if (facilityName.includes('기타') || facilityName.includes('other')) index = '4';
  else {
    // 시설명에서 숫자 추출 시도
    const numberMatch = facilityName.match(/(\d+)/);
    if (numberMatch) {
      index = numberMatch[1];
    } else {
      // 기본값: 시설명의 해시값을 이용한 인덱스
      let hash = 0;
      for (let i = 0; i < facilityInfo.length; i++) {
        const char = facilityInfo.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      index = Math.abs(hash % 100).toString();
    }
  }
  
  console.log('✅ [FACILITY-INDEX] 시설명 기반 인덱스:', index);
  return index;
}

// 시설 정보 파싱 함수 (파일명 생성용)
function parseFacilityInfo(facilityInfo: string, fileType: string): {
  facilityName: string;
  capacity: string;
  outletNumber: string;
  facilityNumber: string;
  facilityIndex: number;
} {
  console.log('🔍 [PARSE-FACILITY] 시설 정보 파싱:', { facilityInfo, fileType });
  
  // 기본값
  let facilityName = fileType === 'discharge' ? '배출시설' : '방지시설';
  let capacity = '';
  let outletNumber = '1';
  let facilityNumber = '1';
  let facilityIndex = 1;
  
  // 배출구 번호 추출
  const outletMatch = facilityInfo.match(/배출구:\s*(\d+)번/);
  if (outletMatch) {
    outletNumber = outletMatch[1];
  }
  
  // 시설명과 용량 추출
  const facilityMatch = facilityInfo.match(/^([^(]+?)(\([^)]+\))?/);
  if (facilityMatch) {
    const fullFacilityName = facilityMatch[1].trim();
    
    // 시설명에서 숫자 추출 (예: "배출시설1" → "1")
    const numberMatch = fullFacilityName.match(/(\d+)$/);
    if (numberMatch) {
      facilityNumber = numberMatch[1];
      facilityIndex = parseInt(facilityNumber);
      facilityName = fullFacilityName.replace(/\d+$/, ''); // 숫자 제거한 순수 시설명
    }
    
    // 용량 정보 추출 (괄호 안의 내용)
    if (facilityMatch[2]) {
      capacity = facilityMatch[2].replace(/[()]/g, ''); // 괄호 제거
    }
  }
  
  // displayName에서 추가 정보 추출 시도
  const displayMatch = facilityInfo.match(/용량:\s*([^,]+)/);
  if (displayMatch && !capacity) {
    capacity = displayMatch[1].trim();
  }
  
  const result = {
    facilityName,
    capacity,
    outletNumber,
    facilityNumber,
    facilityIndex
  };
  
  console.log('✅ [PARSE-FACILITY] 파싱 결과:', result);
  return result;
}

// 기본사진 카테고리 파싱 함수
function parseCategoryFromFacilityInfo(facilityInfo: string): string {
  const lowerInfo = facilityInfo.toLowerCase();
  
  if (lowerInfo.includes('게이트웨이') || lowerInfo.includes('gateway')) return 'gateway';
  if (lowerInfo.includes('송풍기') || lowerInfo.includes('fan')) return 'fan';
  if (lowerInfo.includes('배전함') || lowerInfo.includes('electrical')) return 'electrical';
  
  return 'others';
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
    const displayName = formData.get('displayName') as string | null; // 배출시설1, 배출시설2 등
    const systemType = formData.get('type') as string || 'completion';

    console.log('🔍 [UPLOAD-DEBUG] 받은 데이터:', {
      businessName,
      fileType,
      facilityInfo,
      displayName,
      systemType,
      파일수: files.length
    });

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

    // 4. Supabase Storage에 업로드 (병렬) - 구조화된 파일명 사용
    const uploadPromises = validFiles.map(async ({ file, hash }, index) => {
      try {
        // 구조화된 파일명 생성
        let structuredFilename = file.name;
        
        if (fileType === 'discharge' || fileType === 'prevention') {
          // 시설별 사진용 구조화된 파일명 생성
          // facilityInfo에서 시설 정보 파싱
          const facilityData = parseFacilityInfo(facilityInfo || '', fileType);
          structuredFilename = generateFacilityFileName({
            facility: {
              name: facilityData.facilityName,
              capacity: facilityData.capacity,
              outlet: parseInt(facilityData.outletNumber) || 1,
              number: parseInt(facilityData.facilityNumber) || 1,
              quantity: 1,
              displayName: `${facilityData.facilityName}${facilityData.facilityNumber}`
            },
            facilityType: fileType,
            facilityIndex: facilityData.facilityIndex,
            photoIndex: index + 1, // 현재 업로드에서의 순서
            originalFileName: file.name
          });
        } else if (fileType === 'basic') {
          // 기본사진용 구조화된 파일명 생성
          const category = parseCategoryFromFacilityInfo(facilityInfo || '');
          structuredFilename = generateBasicFileName(category, index + 1, file.name);
        }

        console.log(`📝 [FILENAME] 구조화된 파일명 생성: ${file.name} → ${structuredFilename}`);
        
        const filePath = getFilePath(businessName, fileType, facilityInfo || '기본사진', structuredFilename, systemType, displayName || undefined);
        
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

        // 5. DB에 파일 정보 저장 - 구조화된 파일명으로 저장
        const { data: fileRecord, error: dbError } = await supabaseAdmin
          .from('uploaded_files')
          .insert({
            business_id: businessId,
            filename: structuredFilename, // 구조화된 파일명 사용
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

        // FileContext에서 기대하는 UploadedFile 형식으로 반환
        const folderName = filePath.includes('discharge') ? '배출시설' : 
                          filePath.includes('prevention') ? '방지시설' : '기본사진';
        
        return {
          id: fileRecord.id,
          name: structuredFilename, // 구조화된 파일명 사용
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          createdTime: fileRecord.created_at,
          modifiedTime: fileRecord.created_at,
          webViewLink: publicUrl.publicUrl,
          downloadUrl: publicUrl.publicUrl,
          thumbnailUrl: publicUrl.publicUrl,
          publicUrl: publicUrl.publicUrl,
          directUrl: publicUrl.publicUrl,
          folderName,
          uploadStatus: 'uploaded',
          syncedAt: fileRecord.created_at,
          googleFileId: null,
          facilityInfo: facilityInfo,
          filePath: uploadData.path, // 시설별 스토리지 경로 추가
          justUploaded: true,
          uploadedAt: Date.now()
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

    // 업로드 성공 시 캐시 무효화 (즉시 새 데이터 반영)
    if (successfulUploads.length > 0) {
      memoryCache.delete(`files_${businessName}_completion`);
      memoryCache.delete(`files_${businessName}_presurvey`);
      console.log(`💾 [CACHE-INVALIDATE] 업로드 후 캐시 무효화: ${businessName}`);
    }

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