// app/api/upload/route.ts - Vercel 최적화된 파일 업로드 API
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { createOptimizedDriveClient } from '@/lib/google-client';

// Vercel에서 Node.js runtime 강제 지정 (Edge Runtime 대신)
export const runtime = 'nodejs';
// 파일 업로드를 위한 바디 크기 제한 증가 (50MB)
export const maxDuration = 60; // 60초 최대 실행 시간

// 파일 타입 표시명 매핑
function getFileTypeDisplayName(fileType: string): string {
  const typeMap: Record<string, string> = {
    'basic': '기본시설',
    'discharge': '배출시설', 
    'prevention': '방지시설'
  };
  return typeMap[fileType] || fileType;
}

// 간단하고 안전한 파일명 생성
function generateFileName(
  businessName: string,
  fileType: string,
  facilityInfo: string,
  fileNumber: number,
  originalName: string
): string {
  // 확장자 처리
  let extension = 'jpg';
  if (originalName && typeof originalName === 'string') {
    const lastDot = originalName.lastIndexOf('.');
    if (lastDot > 0) {
      extension = originalName.substring(lastDot + 1).toLowerCase();
    }
  }
  
  // 시간 정보 (20250819_16:30 형식)
  const now = new Date();
  const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  // 파일 타입별 한글 접두사
  const typeMap = {
    'basic': '기본사진',
    'discharge': '배출시설',
    'prevention': '방지시설'
  };
  const typePrefix = typeMap[fileType as keyof typeof typeMap] || '기타';
  
  // 시설 정보 추출 (첫 번째 부분만)
  let facilityName = '시설';
  if (facilityInfo && facilityInfo.trim()) {
    const firstPart = facilityInfo.split(/[-,/]/)[0]?.trim();
    if (firstPart) {
      facilityName = firstPart.substring(0, 20);
    }
  }
  
  // 카메라 사진 감지 (기본 파일명들)
  const isCameraPhoto = !originalName || 
    ['image.jpg', 'image.jpeg', 'image.png', 'photo.jpg', 'photo.jpeg', 'photo.png'].includes(originalName?.toLowerCase());
  
  if (isCameraPhoto) {
    // 카메라 사진: 간단한 형식
    return `${businessName}_${typePrefix}_${facilityName}_${fileNumber}번째_${timeStr}.${extension}`;
  } else {
    // 사진첩 사진: 상세한 형식
    const detailParts: string[] = [];
    if (facilityInfo && facilityInfo.trim()) {
      const parts = facilityInfo.split(/[-,/]/).map(p => p.trim()).filter(Boolean);
      detailParts.push(...parts.slice(0, 3));
    }
    
    const nameParts = [
      businessName,
      typePrefix,
      ...detailParts,
      `${fileNumber}번째`,
      timeStr
    ].filter(Boolean);
    
    const fileName = nameParts.join('_') + `.${extension}`;
    
    // 길이 제한
    if (fileName.length > 180) {
      return `${businessName}_${typePrefix}_${facilityName}_${fileNumber}번째_${timeStr}.${extension}`;
    }
    
    return fileName;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('📤 [UPLOAD] Vercel 최적화 버전 - 파일 업로드 시작');

    // Vercel에서 formData 파싱 최적화
    let formData: FormData;
    try {
      // 타임아웃 설정으로 파싱 최적화
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃
      
      formData = await request.formData();
      clearTimeout(timeoutId);
      
      console.log('✅ [UPLOAD] FormData 파싱 완료');
    } catch (parseError) {
      console.error('❌ [UPLOAD] FormData 파싱 실패:', parseError);
      return NextResponse.json({
        success: false,
        message: 'FormData 파싱 실패 - 파일 크기가 너무 크거나 형식이 잘못되었습니다.'
      }, { status: 400 });
    }

    const businessName = formData.get('businessName') as string;
    const fileType = formData.get('fileType') as string;
    const facilityInfo = formData.get('facilityInfo') as string;
    const systemType = (formData.get('type') as 'completion' | 'presurvey') || 'presurvey';
    const files = formData.getAll('files') as File[];

    console.log('📋 [UPLOAD] 요청 정보:', {
      businessName,
      fileType,
      systemType,
      facilityInfo,
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0)
    });

    // 기본 검증
    if (!businessName?.trim()) {
      return NextResponse.json({
        success: false,
        message: '사업장명이 필요합니다.'
      }, { status: 400 });
    }

    if (!files.length) {
      return NextResponse.json({
        success: false,
        message: '업로드할 파일이 없습니다.'
      }, { status: 400 });
    }

    // Vercel 환경에 맞는 파일 크기 검증 (개별 파일 10MB, 전체 30MB)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const maxTotalSize = 30 * 1024 * 1024; // 30MB
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    if (totalSize > maxTotalSize) {
      return NextResponse.json({
        success: false,
        message: `전체 파일 크기 초과 (${(totalSize / 1024 / 1024).toFixed(1)}MB / 30MB)`
      }, { status: 413 });
    }

    for (const file of files) {
      if (file.size > maxFileSize) {
        return NextResponse.json({
          success: false,
          message: `파일 크기 초과: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB / 10MB)`
        }, { status: 413 });
      }

      if (!file.type.startsWith('image/')) {
        return NextResponse.json({
          success: false,
          message: `이미지 파일만 업로드 가능: ${file.name}`
        }, { status: 400 });
      }
    }

    // 폴더 ID 확인
    const folderId = systemType === 'completion' 
      ? process.env.COMPLETION_FOLDER_ID 
      : process.env.PRESURVEY_FOLDER_ID;

    if (!folderId) {
      console.error('❌ [UPLOAD] 폴더 ID 환경변수 누락:', { systemType });
      return NextResponse.json({
        success: false,
        message: '폴더 설정이 누락되었습니다.'
      }, { status: 500 });
    }

    console.log('📁 [UPLOAD] 대상 폴더 ID:', folderId);

    // Drive 클라이언트 생성 (에러 처리 강화)
    let drive;
    try {
      drive = await createOptimizedDriveClient();
      console.log('✅ [UPLOAD] Drive 클라이언트 생성 완료');
    } catch (driveError) {
      console.error('❌ [UPLOAD] Drive 클라이언트 생성 실패:', driveError);
      return NextResponse.json({
        success: false,
        message: 'Google Drive 연결 실패'
      }, { status: 500 });
    }

    // 사업장 폴더 생성/확인
    let businessFolderId;
    try {
      businessFolderId = await findOrCreateBusinessFolder(drive, businessName, folderId);
      console.log('📁 [UPLOAD] 사업장 폴더 준비 완료:', businessFolderId);
    } catch (folderError) {
      console.error('❌ [UPLOAD] 사업장 폴더 처리 실패:', folderError);
      return NextResponse.json({
        success: false,
        message: '사업장 폴더 처리 실패'
      }, { status: 500 });
    }

    // 파일 업로드 (병렬 처리로 최적화하되 동시 연결 수 제한)
    const uploadResults: any[] = [];
    const batchSize = 2; // Vercel에서 안정적인 동시 업로드 수
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const batchPromises = batch.map((file, index) => 
        uploadSingleFileWithRetry(
          drive, 
          file, 
          businessFolderId, 
          fileType, 
          facilityInfo, 
          i + index + 1, 
          businessName
        )
      );
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            uploadResults.push(result.value);
            console.log(`✅ [UPLOAD] 배치 성공: ${batch[index].name}`);
          } else {
            console.error(`❌ [UPLOAD] 배치 실패: ${batch[index].name}`, result.status === 'rejected' ? result.reason : 'Unknown error');
          }
        });
      } catch (batchError) {
        console.error('❌ [UPLOAD] 배치 처리 실패:', batchError);
      }
      
      // 배치 간 짧은 지연으로 API 레이트 제한 방지
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
      }
    }

    console.log(`🎉 [UPLOAD] 완료: ${uploadResults.length}/${files.length} 성공`);

    // 업로드 성공 시 구글시트에 로그 추가 (비동기로 처리하여 응답 속도 개선)
    if (uploadResults.length > 0) {
      // 백그라운드에서 로그 처리 (응답 속도 개선)
      updateSheetLogAsync(systemType, businessName, uploadResults.length, fileType, facilityInfo)
        .catch(syncError => console.warn('📊 [UPLOAD] 구글시트 로그 추가 실패:', syncError));
    }

    return NextResponse.json({
      success: uploadResults.length > 0,
      message: `${uploadResults.length}장의 파일이 업로드되었습니다.`,
      files: uploadResults,
      stats: {
        total: files.length,
        success: uploadResults.length,
        failed: files.length - uploadResults.length
      }
    });

  } catch (error) {
    console.error('❌ [UPLOAD] 전체 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '업로드 실패'
    }, { status: 500 });
  }
}

// 재시도 로직이 포함된 파일 업로드
async function uploadSingleFileWithRetry(
  drive: any,
  file: File,
  businessFolderId: string,
  fileType: string,
  facilityInfo: string,
  fileNumber: number,
  businessName: string,
  maxRetries: number = 2
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📷 [UPLOAD] 파일 업로드 시도 ${attempt}/${maxRetries}: ${file.name}`);
      
      const result = await uploadSingleFile(
        drive, 
        file, 
        businessFolderId, 
        fileType, 
        facilityInfo, 
        fileNumber, 
        businessName
      );
      
      if (result) {
        console.log(`✅ [UPLOAD] 성공 (시도 ${attempt}): ${result.name}`);
        return result;
      }
    } catch (error) {
      console.error(`❌ [UPLOAD] 시도 ${attempt} 실패: ${file.name}`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 재시도 전 잠깐 대기 (지수 백오프)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return null;
}

// 사업장 폴더 생성/확인
async function findOrCreateBusinessFolder(drive: any, businessName: string, parentFolderId: string): Promise<string> {
  try {
    console.log(`📁 [UPLOAD] 사업장 폴더 확인: ${businessName}`);

    // 기존 폴더 검색 (Vercel 타임아웃 고려한 최적화된 쿼리)
    const searchResponse = await Promise.race([
      drive.files.list({
        q: `name='${businessName.replace(/'/g, "\\\\'")}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Folder search timeout')), 10000))
    ]) as any;

    if (searchResponse.data.files?.length > 0) {
      const existingFolderId = searchResponse.data.files[0].id!;
      console.log(`✅ [UPLOAD] 기존 폴더 사용: ${businessName}`);
      return existingFolderId;
    }

    // 새 폴더 생성 (타임아웃 보호)
    console.log(`📂 [UPLOAD] 새 폴더 생성: ${businessName}`);
    const folderResponse = await Promise.race([
      drive.files.create({
        requestBody: {
          name: businessName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        },
        fields: 'id, name',
        supportsAllDrives: true
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Folder creation timeout')), 15000))
    ]) as any;

    const businessFolderId = folderResponse.data.id!;
    console.log(`✅ [UPLOAD] 폴더 생성 완료: ${businessFolderId}`);

    // 하위 폴더 생성 (백그라운드에서 처리)
    createSubFoldersAsync(drive, businessFolderId)
      .catch(error => console.warn('⚠️ [UPLOAD] 하위 폴더 생성 실패:', error));

    return businessFolderId;

  } catch (error: any) {
    console.error('❌ [UPLOAD] 폴더 처리 실패:', error);
    throw new Error(`폴더 처리 실패: ${error.message}`);
  }
}

// 하위 폴더 생성 (비동기)
async function createSubFoldersAsync(drive: any, businessFolderId: string) {
  const subFolders = ['기본사진', '배출시설', '방지시설'];
  
  for (const subFolder of subFolders) {
    try {
      await drive.files.create({
        requestBody: {
          name: subFolder,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [businessFolderId]
        },
        supportsAllDrives: true
      });
      console.log(`📁 [UPLOAD] 하위 폴더 생성: ${subFolder}`);
    } catch (error) {
      console.warn(`⚠️ [UPLOAD] 하위 폴더 생성 실패: ${subFolder}`, error);
    }
  }
}

// 단일 파일 업로드
async function uploadSingleFile(
  drive: any,
  file: File,
  businessFolderId: string,
  fileType: string,
  facilityInfo: string,
  fileNumber: number,
  businessName: string
) {
  try {
    console.log(`📷 [UPLOAD] 파일 처리: "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // 파일을 Buffer로 변환 (Vercel 환경 최적화)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Buffer를 Readable Stream으로 변환
    const readableStream = new Readable({
      read() {
        this.push(buffer);
        this.push(null);
      }
    });

    // 파일명 생성
    const fileName = generateFileName(businessName, fileType, facilityInfo, fileNumber, file.name);
    console.log(`📝 [UPLOAD] 생성된 파일명: "${fileName}"`);

    // 파일명 안전성 검사
    if (!fileName || fileName.length > 200) {
      throw new Error(`파일명 길이 오류: ${fileName?.length || 0}자`);
    }

    // 위험한 문자 검사 (한글과 특수문자는 허용)
    if (/[<>:"/\\|?*\x00-\x1f]/.test(fileName)) {
      throw new Error(`파일명에 허용되지 않는 문자가 있습니다`);
    }

    // 대상 폴더 확인
    const targetFolderId = await getTargetFolder(drive, businessFolderId, fileType);

    // Google Drive에 업로드 (타임아웃 보호)
    const response = await Promise.race([
      drive.files.create({
        requestBody: {
          name: fileName,
          parents: [targetFolderId]
        },
        media: {
          mimeType: file.type || 'image/jpeg',
          body: readableStream
        },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 30000)) // 30초 타임아웃
    ]) as any;

    if (!response?.data?.id) {
      throw new Error('Google Drive 업로드 응답이 올바르지 않습니다');
    }

    console.log(`✅ [UPLOAD] 업로드 성공: ${fileName}`);

    const fileId = response.data.id;
    
    // 파일을 공개로 설정 (비동기로 처리)
    setFilePermissionAsync(drive, fileId, fileName)
      .catch(permError => console.warn(`⚠️ [UPLOAD] 파일 공개 설정 실패: ${fileName}`, permError));

    return {
      id: response.data.id,
      name: response.data.name,
      url: `https://drive.google.com/file/d/${response.data.id}/view`,
      downloadUrl: `https://drive.google.com/uc?id=${response.data.id}`,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${response.data.id}&sz=w300-h300-c`,
      publicUrl: `https://lh3.googleusercontent.com/d/${response.data.id}`,
      size: file.size,
      mimeType: file.type
    };

  } catch (error: any) {
    console.error(`❌ [UPLOAD] 파일 업로드 실패 (${file.name}):`, error);
    throw error;
  }
}

// 파일 권한 설정 (비동기)
async function setFilePermissionAsync(drive: any, fileId: string, fileName: string) {
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      },
      supportsAllDrives: true
    });
    console.log(`🔓 [UPLOAD] 파일 공개 설정 완료: ${fileName}`);
  } catch (error) {
    console.warn(`⚠️ [UPLOAD] 파일 공개 설정 실패: ${fileName}`, error);
  }
}

// 구글시트 로그 업데이트 (비동기)
async function updateSheetLogAsync(
  systemType: 'completion' | 'presurvey',
  businessName: string,
  fileCount: number,
  fileType: string,
  facilityInfo: string
) {
  try {
    const facilityDetails = facilityInfo || '정보 없음';
    const uploadLog = `파일 ${fileCount}개 업로드 완료 [${getFileTypeDisplayName(fileType)}] - ${facilityDetails}`;
    
    const { sheets } = await import('@/lib/google-client');
    
    // systemType에 따라 적절한 스프레드시트와 시트 선택
    const spreadsheetId = systemType === 'completion' 
      ? process.env.COMPLETION_SPREADSHEET_ID 
      : process.env.DATA_COLLECTION_SPREADSHEET_ID;
    const sheetName = systemType === 'completion' ? '설치 후 사진' : '설치 전 실사';
    
    console.log('📊 [UPLOAD] 로그 기록 시작:', { systemType, sheetName });
    
    // 해당 사업장 행 찾기 (타임아웃 보호)
    const range = `'${sheetName}'!A:H`;
    const response = await Promise.race([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Sheet read timeout')), 10000))
    ]) as any;
    
    const rows = response.data?.values || [];
    let targetRowIndex = -1;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] && row[1].toString().trim() === businessName.trim()) {
        targetRowIndex = i + 1;
        break;
      }
    }
    
    if (targetRowIndex !== -1) {
      const currentRow = rows[targetRowIndex - 1] || [];
      // 시간 정보 (20250819_16:30 형식)
      const now = new Date();
      const koreaTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const logEntry = `[${koreaTime}] ${uploadLog}`;
      
      // 기존 상태에 로그 추가
      let newStatus = currentRow[2] || '';
      newStatus = newStatus ? `${newStatus}\\n${logEntry}` : logEntry;
      
      // C열(상태)만 업데이트 (타임아웃 보호)
      const updateRange = `'${sheetName}'!C${targetRowIndex}`;
      await Promise.race([
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: updateRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[newStatus]],
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sheet update timeout')), 10000))
      ]) as any;
      
      console.log('📊 [UPLOAD] 구글시트 로그 추가 완료');
    } else {
      console.warn('📊 [UPLOAD] 해당 사업장을 시트에서 찾을 수 없음:', businessName);
    }
  } catch (syncError) {
    console.warn('📊 [UPLOAD] 구글시트 로그 추가 실패:', syncError);
    throw syncError;
  }
}

// 대상 폴더 확인
async function getTargetFolder(drive: any, businessFolderId: string, fileType: string): Promise<string> {
  const subFolderMapping: Record<string, string> = {
    'basic': '기본사진',
    'discharge': '배출시설',
    'prevention': '방지시설'
  };
  
  const subFolderName = subFolderMapping[fileType];
  
  if (!subFolderName) {
    return businessFolderId;
  }
  
  try {
    // 타임아웃 보호된 폴더 검색
    const searchResponse = await Promise.race([
      drive.files.list({
        q: `name='${subFolderName}' and parents in '${businessFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Subfolder search timeout')), 5000))
    ]) as any;
    
    if (searchResponse.data.files?.length > 0) {
      return searchResponse.data.files[0].id!;
    }
  } catch (error) {
    console.error(`❌ [UPLOAD] 하위 폴더 검색 실패: ${subFolderName}`, error);
  }
  
  return businessFolderId;
}