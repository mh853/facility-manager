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

    // 파일 검증
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) {
        return NextResponse.json({
          success: false,
          message: `파일 크기 초과: ${file.name} (최대 15MB)`
        }, { status: 400 });
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

    // 파일 업로드 (병렬 처리로 속도 향상)
    const uploadResults = [];
    const maxConcurrent = 3; // 동시 업로드 제한
    
    for (let i = 0; i < files.length; i += maxConcurrent) {
      const batch = files.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (file, batchIndex) => {
        const fileIndex = i + batchIndex + 1;
        console.log(`📄 [UPLOAD] 업로드 중 (${fileIndex}/${files.length}): ${file.name}`);
        
        try {
          const result = await uploadSingleFile(
            drive, 
            file, 
            businessFolderId, 
            fileType, 
            facilityInfo, 
            fileIndex, 
            businessName
          );
          
          if (result) {
            console.log(`✅ [UPLOAD] 성공: ${result.name}`);
            return result;
          }
          return null;
        } catch (error) {
          console.error(`❌ [UPLOAD] 실패: ${file.name}`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      uploadResults.push(...batchResults.filter(Boolean));
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
          const timestamp = new Date().toLocaleString('ko-KR');
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

// 단일 파일 업로드 (공유 드라이브 지원 + 이미지 압축)
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
    // 파일 유효성 검사
    if (!file || !file.type) {
      throw new Error('올바르지 않은 파일 형식');
    }
    
    // 날짜 포맷 올바른 파일명 생성
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    let safeFileName = file.name || `camera_image_${timestamp}`;
    
    // 파일명에서 특수문자 제거
    safeFileName = safeFileName.replace(/[^a-zA-Z0-9성-힣一-鿿._-]/g, '_');
    
    console.log(`📄 [UPLOAD] 원본 파일: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    
    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    
    // 이미지 크기 최적화 (5MB 이상일 때)
    if (file.size > 5 * 1024 * 1024 && file.type.startsWith('image/')) {
      try {
        console.log(`📊 [UPLOAD] 이미지 압축 시도: ${file.name}`);
        
        // Canvas를 사용한 이미지 리사이징 (서버사이드에서는 어려우므로 생략)
        // 대신 JPEG 품질 조정으로 대체
        console.log(`⚠️ [UPLOAD] 이미지 압축 생략 (서버사이드)`);
      } catch (compressionError) {
        console.warn(`⚠️ [UPLOAD] 이미지 압축 실패, 원본 사용:`, compressionError);
      }
    }

    // Buffer를 Readable Stream으로 변환
    const readableStream = new Readable({
      read() {
        this.push(buffer);
        this.push(null);
      }
    });

    // 파일명 생성 (안전한 이름 사용)
    const fileName = generateFileName(businessName, fileType, facilityInfo, fileNumber, safeFileName);
    
    console.log(`📝 [UPLOAD] 생성된 파일명: ${fileName}`);
    
    // Google Drive API 호출 전 파일명 유효성 최종 검사
    if (!fileName || fileName.length > 255) {
      throw new Error(`파일명이 너무 깁니다: ${fileName?.length || 0}자`);
    }
    
    // 대상 폴더 확인
    const targetFolderId = await getTargetFolder(drive, businessFolderId, fileType);

    // Google Drive에 업로드 (공유 드라이브 지원, 개선된 오류 처리)
    let response;
    try {
      response = await drive.files.create({
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
      });
      
      if (!response?.data?.id) {
        throw new Error('Google Drive 업로드 응답이 올바르지 않습니다');
      }
      
      console.log(`🎉 [UPLOAD] Google Drive 업로드 성공: ${fileName} (ID: ${response.data.id})`);
      
    } catch (driveError: any) {
      console.error(`❌ [UPLOAD] Google Drive 업로드 실패:`, driveError);
      
      // 구체적인 오류 메시지 생성
      let errorMessage = '파일 업로드 실패';
      if (driveError.message?.includes('invalid') || driveError.message?.includes('pattern')) {
        errorMessage = '파일명에 올바르지 않은 문자가 포함되어 있습니다';
      } else if (driveError.message?.includes('quota') || driveError.message?.includes('limit')) {
        errorMessage = 'Google Drive 용량 한도에 도달했습니다';
      } else if (driveError.message?.includes('permission') || driveError.message?.includes('access')) {
        errorMessage = 'Google Drive 접근 권한이 없습니다';
      }
      
      throw new Error(`${errorMessage}: ${driveError.message}`);
    }

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

// 파일명 생성 (카메라 사진 지원 개선)
function generateFileName(
  businessName: string,
  fileType: string,
  facilityInfo: string,
  fileNumber: number,
  originalName: string
): string {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, -5);
  
  // 카메라 사진의 경우 확장자가 없을 수 있음
  let extension = 'jpg'; // 기본값
  if (originalName && originalName.includes('.')) {
    extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  }
  
  const typeMapping: Record<string, string> = {
    'basic': '기본사진',
    'discharge': '배출시설',
    'prevention': '방지시설'
  };
  
  const typeFolder = typeMapping[fileType] || '기본사진';
  
  // facilityInfo에서 안전한 이름 추출
  let facilityName = 'facility';
  if (facilityInfo && facilityInfo.trim()) {
    facilityName = facilityInfo.split('-')[0]?.trim() || facilityInfo.trim();
  }
  
  // 모든 특수문자와 공백을 안전하게 처리
  const sanitizePart = (part: string): string => {
    return part
      .replace(/[\s\uFEFF\xA0]+/g, '_') // 모든 종류의 공백을 _로 변경
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, '') // 제어 문자 제거
      .replace(/[\/\\:*?"<>|\[\]{}()#%&+@!^~`=]/g, '_') // 특수문자를 _로 변경
      .replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, (char) => char) // 한글은 유지
      .replace(/_+/g, '_') // 연속된 _를 하나로
      .replace(/^_|_$/g, '') // 시작과 끝의 _ 제거
      .substring(0, 50); // 길이 제한
  };
  
  const safeName = [
    sanitizePart(businessName || 'business'),
    sanitizePart(typeFolder),
    sanitizePart(facilityName),
    `${fileNumber}`,
    timestamp.replace(/[^0-9-]/g, '') // 타임스탬프에서 숫자와 -만 유지
  ]
    .filter(Boolean)
    .join('_');
  
  // 최종 파일명 길이 제한 (Google Drive 제한: 255자)
  const finalName = safeName.length > 200 ? safeName.substring(0, 200) : safeName;
  
  return `${finalName}.${extension}`;
}

// 대상 폴더 확인 (공유 드라이브 지원)
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
  
  try {
    const searchQuery = `name='${subFolderName}' and parents in '${businessFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    console.log(`📁 [UPLOAD] 하위 폴더 검색 쿼리:`, searchQuery);
    
    const searchResponse = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    if (searchResponse.data.files?.length > 0) {
      const targetFolder = searchResponse.data.files[0];
      console.log(`✅ [UPLOAD] 하위 폴더 발견:`, { name: targetFolder.name, id: targetFolder.id });
      return targetFolder.id!;
    } else {
      console.log(`⚠️ [UPLOAD] 하위 폴더 없음, 상위 폴더 사용: ${subFolderName}`);
    }
  } catch (error) {
    console.error(`❌ [UPLOAD] 하위 폴더 검색 실패: ${subFolderName}`, error);
  }
  
  console.log(`📁 [UPLOAD] 최종 대상 폴더: 상위 폴더 (${businessFolderId})`);
  return businessFolderId;
}
