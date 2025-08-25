// app/api/upload/route.ts - 최적화된 파일 업로드 API
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { createOptimizedDriveClient } from '@/lib/google-client';
import { withApiHandler, createSuccessResponse, createErrorResponse, sanitizeFileName, withTimeout } from '@/lib/api-utils';

// 파일 타입 표시명 매핑
function getFileTypeDisplayName(fileType: string): string {
  const typeMap: Record<string, string> = {
    'basic': '기본시설',
    'discharge': '배출시설', 
    'prevention': '방지시설'
  };
  return typeMap[fileType] || fileType;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📤 [UPLOAD] 파일 업로드 시작');

    // 폼 데이터 파싱
    const formData = await request.formData();
    const businessName = formData.get('businessName') as string;
    const fileType = formData.get('fileType') as string;
    const facilityInfo = formData.get('facilityInfo') as string;
    const systemType = (formData.get('type') as 'completion' | 'presurvey') || 'presurvey';
    const files = formData.getAll('files') as File[];

    console.log('📋 [UPLOAD] 요청 정보:', {
      businessName,
      fileType,
      systemType,
      fileCount: files.length
    });

    // 입력 검증
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

    // 파일 검증 (향상된 로깅과 HEIC 지원)
    for (const file of files) {
      console.log('📱 [UPLOAD-API] 파일 검증:', {
        name: file.name,
        size: file.size,
        type: file.type,
        sizeInMB: (file.size / (1024 * 1024)).toFixed(2)
      });

      if (file.size > 100 * 1024 * 1024) { // 100MB로 증가
        return NextResponse.json({
          success: false,
          message: `파일 크기 초과: ${file.name} (최대 100MB, 현재 ${(file.size / (1024 * 1024)).toFixed(1)}MB)`
        }, { status: 400 });
      }

      // HEIC/HEIF 포맷도 허용하도록 수정
      const isValidImageType = file.type.startsWith('image/') || 
                              file.type.includes('heic') || 
                              file.type.includes('heif') ||
                              file.name.toLowerCase().endsWith('.heic') ||
                              file.name.toLowerCase().endsWith('.heif');

      if (!isValidImageType) {
        return NextResponse.json({
          success: false,
          message: `지원하지 않는 파일 형식: ${file.name} (${file.type || '알 수 없음'})`
        }, { status: 400 });
      }
    }

    // 폴더 ID 확인
    const folderId = systemType === 'completion' 
      ? process.env.COMPLETION_FOLDER_ID 
      : process.env.PRESURVEY_FOLDER_ID;

    if (!folderId) {
      return NextResponse.json({
        success: false,
        message: '폴더 설정이 누락되었습니다.'
      }, { status: 500 });
    }

    console.log('📁 [UPLOAD] 대상 폴더 ID:', folderId);

    // Drive 클라이언트 생성
    const drive = await createOptimizedDriveClient();

    // 사업장 폴더 생성/확인
    const businessFolderId = await findOrCreateBusinessFolder(drive, businessName, folderId);

    // 파일 업로드
    const uploadResults = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📄 [UPLOAD] 업로드 중 (${i + 1}/${files.length}): ${file.name}`);
      
      try {
        const result = await uploadSingleFile(
          drive, 
          file, 
          businessFolderId, 
          fileType, 
          facilityInfo, 
          i + 1, 
          businessName
        );
        
        if (result) {
          uploadResults.push(result);
          console.log(`✅ [UPLOAD] 성공: ${result.name}`);
        }
      } catch (error) {
        console.error(`❌ [UPLOAD] 실패: ${file.name}`, error);
      }
    }

    console.log(`🎉 [UPLOAD] 완료: ${uploadResults.length}/${files.length} 성공`);

    // 업로드 성공 시 구글시트 상태 컬럼에 로그 추가
    if (uploadResults.length > 0) {
      try {
        // 시설 정보를 포함한 더 상세한 로그 생성
        const facilityDetails = facilityInfo.includes('-') ? 
          facilityInfo.split('-').map(part => part.trim()).join(' - ') : 
          facilityInfo;
        
        const uploadLog = `파일 ${uploadResults.length}개 업로드 완료 [${getFileTypeDisplayName(fileType)}] - ${facilityDetails}`;
        
        // 기존 Google Client 사용
        const { sheets } = await import('@/lib/google-client');
        
        // systemType에 따라 적절한 스프레드시트와 시트 선택
        const spreadsheetId = systemType === 'completion' 
          ? process.env.COMPLETION_SPREADSHEET_ID 
          : process.env.DATA_COLLECTION_SPREADSHEET_ID;
        const sheetName = systemType === 'completion' ? '설치 후 사진' : '설치 전 실사';
        
        console.log('📊 [UPLOAD] 업로드 로그 대상:', { systemType, spreadsheetId: spreadsheetId?.slice(0, 10) + '...', sheetName });
        
        // 해당 사업장 행 찾기
        const range = `'${sheetName}'!A:H`;
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        
        const rows = response.data.values || [];
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
          const timestamp = new Date().toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          const logEntry = `[${timestamp}] ${uploadLog}`;
          
          // 기존 상태에 로그 추가
          let newStatus = currentRow[2] || '';
          newStatus = newStatus ? `${newStatus}\n${logEntry}` : logEntry;
          
          // C열(상태)만 업데이트
          const updateRange = `'${sheetName}'!C${targetRowIndex}`;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: updateRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[newStatus]],
            },
          });
          
          console.log('📊 [UPLOAD] 구글시트 업로드 로그 추가 완료');
        }
      } catch (syncError) {
        console.warn('📊 [UPLOAD] 구글시트 로그 추가 실패:', syncError);
      }
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

// 사업장 폴더 생성/확인 (공유 드라이브 지원)
async function findOrCreateBusinessFolder(drive: any, businessName: string, parentFolderId: string): Promise<string> {
  try {
    console.log(`📁 [UPLOAD] 사업장 폴더 확인: ${businessName}`);

    // 기존 폴더 검색 (공유 드라이브 지원)
    const searchResponse = await drive.files.list({
      q: `name='${businessName.replace(/'/g, "\\'")}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    if (searchResponse.data.files?.length > 0) {
      const existingFolderId = searchResponse.data.files[0].id!;
      console.log(`✅ [UPLOAD] 기존 폴더 사용: ${businessName}`);
      return existingFolderId;
    }

    // 새 폴더 생성 (공유 드라이브 지원)
    console.log(`📂 [UPLOAD] 새 폴더 생성: ${businessName}`);
    const folderResponse = await drive.files.create({
      requestBody: {
        name: businessName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      },
      fields: 'id, name',
      supportsAllDrives: true
    });

    const businessFolderId = folderResponse.data.id!;
    console.log(`✅ [UPLOAD] 폴더 생성 완료: ${businessFolderId}`);

    // 하위 폴더 생성 (공유 드라이브 지원)
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
        console.warn(`⚠️ [UPLOAD] 하위 폴더 생성 실패: ${subFolder}`);
      }
    }

    return businessFolderId;

  } catch (error: any) {
    console.error('❌ [UPLOAD] 폴더 처리 실패:', error);
    throw new Error(`폴더 처리 실패: ${error.message}`);
  }
}

// 단일 파일 업로드 (공유 드라이브 지원)
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
    // 파일을 Buffer로 변환
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
    const fileName = generateFileName(businessName, fileType, facilityInfo, fileNumber, file.name, file);
    
    // 대상 폴더 확인
    const targetFolderId = await getTargetFolder(drive, businessFolderId, fileType);

    // 중복 파일 체크 (같은 이름의 파일이 이미 있는지 확인)
    const existingFileCheck = await drive.files.list({
      q: `name='${fileName.replace(/'/g, "\\'")}' and parents in '${targetFolderId}' and trashed=false`,
      fields: 'files(id, name, size)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    if (existingFileCheck.data.files?.length > 0) {
      const existingFile = existingFileCheck.data.files[0];
      console.log(`⚠️ [UPLOAD] 중복 파일 발견, 덮어쓰기:`, {
        fileName,
        existingId: existingFile.id,
        existingSize: existingFile.size,
        newSize: file.size
      });
      
      // 기존 파일 업데이트 (덮어쓰기)
      const response = await drive.files.update({
        fileId: existingFile.id!,
        media: {
          mimeType: file.type,
          body: readableStream
        },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true
      });

      console.log(`✅ [UPLOAD] 파일 덮어쓰기 완료: ${fileName}`);
      
      const fileId = response.data.id;
      
      return {
        id: response.data.id,
        name: response.data.name,
        url: `https://drive.google.com/file/d/${response.data.id}/view`,
        downloadUrl: `https://drive.google.com/uc?id=${response.data.id}`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${response.data.id}&sz=w300-h300-c`,
        publicUrl: `https://lh3.googleusercontent.com/d/${response.data.id}`,
        size: file.size,
        mimeType: file.type,
        updated: true // 덮어쓰기 표시
      };
    }

    // 새 파일 업로드
    console.log(`📤 [UPLOAD] 새 파일 업로드: ${fileName}`);
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId]
      },
      media: {
        mimeType: file.type,
        body: readableStream
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });

    const fileId = response.data.id;
    
    // 파일을 공개로 설정 (미리보기를 위해)
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
    } catch (permError) {
      console.warn(`⚠️ [UPLOAD] 파일 공개 설정 실패: ${fileName}`, permError);
    }

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

// 파일명 생성
function generateFileName(
  businessName: string,
  fileType: string,
  facilityInfo: string,
  fileNumber: number,
  originalName: string,
  file: File
): string {
  const timestamp = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
    .replace(/[:.]/g, '-')
    .slice(0, -5);
  
  // 모바일 파일 (특히 아이폰 HEIC) 확장자 정확한 결정
  let extension = 'jpg'; // 안전한 기본값
  
  console.log(`📱 [UPLOAD] 모바일 파일 상세 분석:`, {
    originalName: originalName || '이름없음',
    mimeType: file.type || '타입없음',
    size: file.size,
    sizeInMB: (file.size / (1024 * 1024)).toFixed(2),
    lastModified: new Date(file.lastModified).toISOString(),
    userAgent: 'iPhone/Safari 감지됨',
    hasExtension: originalName ? originalName.includes('.') : false,
    nameLength: originalName?.length || 0
  });
  
  // 아이폰 Safari 특별 처리: 파일명이나 MIME 타입이 손실된 경우
  let hasValidFileInfo = !!(originalName && originalName.includes('.') && file.type);
  
  console.log(`🔍 [UPLOAD] 파일 정보 유효성:`, {
    hasFileName: !!originalName,
    hasExtension: originalName ? originalName.includes('.') : false,
    hasMimeType: !!file.type,
    isValid: hasValidFileInfo
  });

  // 1순위: MIME 타입으로 확장자 결정
  if (file.type && file.type.trim() !== '') {
    const mimeToExt: Record<string, string> = {
      'image/webp': 'webp',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg', 
      'image/png': 'png',
      'image/gif': 'gif',
      'image/heic': 'jpg',  // HEIC → JPG (압축됨)
      'image/heif': 'jpg',  // HEIF → JPG (압축됨)
      'image/tiff': 'jpg',
      'image/bmp': 'jpg',
      'image/webm': 'jpg'
    };
    
    const normalizedType = file.type.toLowerCase().trim();
    if (mimeToExt[normalizedType]) {
      extension = mimeToExt[normalizedType];
      console.log(`✅ [UPLOAD] MIME 타입으로 확장자 결정:`, { type: normalizedType, extension });
    }
  }
  
  // 2순위: 파일명에서 확장자 추출
  if (originalName && originalName.includes('.')) {
    const extractedExt = originalName.split('.').pop()?.toLowerCase()?.trim();
    
    if (extractedExt) {
      const fileExtMap: Record<string, string> = {
        'heic': 'jpg',    // 아이폰 HEIC → JPG
        'heif': 'jpg',    // 아이폰 HEIF → JPG  
        'jpeg': 'jpg',    // JPEG → JPG 통일
        'jpg': 'jpg',
        'png': 'png',
        'gif': 'gif',
        'webp': 'webp',
        'tiff': 'jpg',
        'tif': 'jpg',
        'bmp': 'jpg',
        'jfif': 'jpg'     // 일부 카메라에서 사용
      };
      
      if (fileExtMap[extractedExt]) {
        // MIME 타입이 없거나 신뢰할 수 없을 때 파일명 우선 사용
        if (!file.type || file.type.trim() === '' || extension === 'jpg') {
          extension = fileExtMap[extractedExt];
          console.log(`✅ [UPLOAD] 파일명으로 확장자 결정:`, { fileName: originalName, extension });
        }
      }
    }
  }
  
  // 3순위: 압축 결과 기반 강제 결정
  if (file.type === 'image/webp' || originalName?.toLowerCase().endsWith('.webp')) {
    extension = 'webp';
    console.log(`✅ [UPLOAD] WebP 강제 인식`);
  }

  // 4순위: 최후의 수단 - 아이폰에서 파일 정보가 완전히 손실된 경우
  if (!hasValidFileInfo) {
    console.warn(`⚠️ [UPLOAD] 파일 정보 손실 감지, 강제 JPG 설정:`, {
      originalName: originalName || 'null',
      mimeType: file.type || 'null',
      size: file.size
    });
    extension = 'jpg'; // 가장 호환성 높은 형식으로 설정
  }
  
  console.log(`📷 [UPLOAD] 최종 확장자 결정:`, {
    original: originalName,
    mimeType: file.type || '없음',
    finalExtension: extension,
    reason: file.type ? `MIME타입(${file.type})` : '파일명분석'
  });
  
  const typeMapping: Record<string, string> = {
    'basic': '기본사진',
    'discharge': '배출시설',
    'prevention': '방지시설'
  };
  
  const typeFolder = typeMapping[fileType] || '기본사진';
  const facilityName = facilityInfo.split('-')[0] || facilityInfo;
  
  const safeName = [
    businessName,
    typeFolder,
    facilityName,
    `${fileNumber}번째`,
    timestamp
  ]
    .map(part => part.replace(/[\/\\:*?"<>|]/g, '_').trim())
    .filter(Boolean)
    .join('_');
  
  return `${safeName}.${extension}`;
}

// 폴더별 생성 중인 상태 추적 (중복 생성 방지)
const folderCreationInProgress = new Map<string, Promise<string>>();

// 대상 폴더 확인 (중복 생성 방지 포함)
async function getTargetFolder(drive: any, businessFolderId: string, fileType: string): Promise<string> {
  const subFolderMapping: Record<string, string> = {
    'basic': '기본사진',
    'discharge': '배출시설',
    'prevention': '방지시설'
  };
  
  const subFolderName = subFolderMapping[fileType];
  console.log(`📁 [UPLOAD] 대상 폴더 확인:`, { fileType, subFolderName, businessFolderId });
  
  if (!subFolderName) {
    console.log(`📁 [UPLOAD] 알 수 없는 파일 타입, 상위 폴더 사용: ${fileType}`);
    return businessFolderId;
  }
  
  // 중복 생성 방지를 위한 고유 키
  const folderKey = `${businessFolderId}-${subFolderName}`;
  
  // 이미 생성 중인 폴더가 있으면 기다리기
  if (folderCreationInProgress.has(folderKey)) {
    console.log(`⏳ [UPLOAD] 폴더 생성 대기 중: ${subFolderName}`);
    return await folderCreationInProgress.get(folderKey)!;
  }
  
  try {
    const searchQuery = `name='${subFolderName}' and parents in '${businessFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    console.log(`📁 [UPLOAD] 하위 폴더 검색 쿼리:`, searchQuery);
    
    const searchResponse = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name)',
      pageSize: 10, // 여러 개가 있을 수 있으니 좀 더 많이 가져옴
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    if (searchResponse.data.files?.length > 0) {
      const targetFolder = searchResponse.data.files[0];
      console.log(`✅ [UPLOAD] 하위 폴더 발견:`, { 
        name: targetFolder.name, 
        id: targetFolder.id,
        totalFound: searchResponse.data.files.length
      });
      
      // 중복된 폴더가 있으면 로그 남기기
      if (searchResponse.data.files.length > 1) {
        console.warn(`⚠️ [UPLOAD] 중복 폴더 발견:`, {
          folderName: subFolderName,
          count: searchResponse.data.files.length,
          folders: searchResponse.data.files.map((f: any) => ({ id: f.id, name: f.name }))
        });
      }
      
      return targetFolder.id!;
    } else {
      console.log(`📂 [UPLOAD] 하위 폴더 없음, 새로 생성: ${subFolderName}`);
      
      // 폴더 생성을 Promise로 래핑하여 중복 방지
      const createPromise = (async (): Promise<string> => {
        try {
          // 생성 직전에 다시 한번 확인 (Race condition 방지)
          const doubleCheckResponse = await drive.files.list({
            q: searchQuery,
            fields: 'files(id, name)',
            pageSize: 1,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
          });
          
          if (doubleCheckResponse.data.files?.length > 0) {
            console.log(`🔄 [UPLOAD] 중복 생성 방지: 다른 요청에서 이미 생성됨`, subFolderName);
            return doubleCheckResponse.data.files[0].id!;
          }
          
          const createResponse = await drive.files.create({
            requestBody: {
              name: subFolderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [businessFolderId]
            },
            fields: 'id, name',
            supportsAllDrives: true
          });
          
          const newFolderId = createResponse.data.id!;
          console.log(`✅ [UPLOAD] 하위 폴더 생성 완료:`, { name: subFolderName, id: newFolderId });
          return newFolderId;
        } catch (createError) {
          console.error(`❌ [UPLOAD] 하위 폴더 생성 실패: ${subFolderName}`, createError);
          console.log(`📁 [UPLOAD] 폴백: 상위 폴더 사용`);
          return businessFolderId;
        } finally {
          // 생성 완료 후 상태 제거
          folderCreationInProgress.delete(folderKey);
        }
      })();
      
      // 생성 중 상태 등록
      folderCreationInProgress.set(folderKey, createPromise);
      return await createPromise;
    }
  } catch (error) {
    console.error(`❌ [UPLOAD] 하위 폴더 검색 실패: ${subFolderName}`, error);
    folderCreationInProgress.delete(folderKey);
  }
  
  console.log(`📁 [UPLOAD] 최종 대상 폴더: 상위 폴더 (${businessFolderId})`);
  return businessFolderId;
}
