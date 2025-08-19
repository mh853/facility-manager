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

    // 파일 업로드 (단순 순차 처리로 속도 최적화)
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
          // 대한민국 시간대로 시간 생성
          const koreaTime = new Date().toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          const logEntry = `[${koreaTime}] ${uploadLog}`;
          
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
    if (!file) {
      throw new Error('올바르지 않은 파일');
    }
    
    // MIME 타입 기본값 설정 (카메라 사진 대비)
    const mimeType = file.type || 'image/jpeg';
    
    // 카메라 사진의 동일한 파일명 문제 해결
    let safeFileName = 'camera_image';
    if (file.name && typeof file.name === 'string' && file.name.trim()) {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '').substring(0, 50);
      // image.jpg 같은 기본 파일명 감지 및 고유 이름 생성
      if (cleanName && cleanName !== 'image.jpg' && cleanName !== 'image.jpeg' && cleanName !== 'image.png') {
        safeFileName = cleanName;
      } else {
        // 기본 파일명인 경우 고유 이름 생성
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        safeFileName = `camera_${timestamp}_${random}`;
      }
    } else {
      // 파일명이 없는 경우도 고유 이름 생성
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      safeFileName = `camera_${timestamp}_${random}`;
    }
    
    // 속도 최적화: 최소한의 처리
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Buffer를 Readable Stream으로 변환
    const readableStream = new Readable({
      read() {
        this.push(buffer);
        this.push(null);
      }
    });

    // 고유 파일명 생성
    const fileName = generateFileName(businessName, fileType, facilityInfo, fileNumber, safeFileName);
    
    console.log(`📝 [UPLOAD] 원본명: "${file.name}" → 생성명: "${fileName}"`);
    
    // 파일명 안전성 검사
    if (!fileName || typeof fileName !== 'string' || fileName.length > 200) {
      console.error(`❌ [UPLOAD] 파일명 길이 오류: ${fileName?.length || 0}자`);
      throw new Error(`파일명 길이 오류: ${fileName}`);
    }
    
    // ASCII 문자만 허용하는지 최종 검사
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
      console.error(`❌ [UPLOAD] 파일명 문자 오류: "${fileName}"`);
      throw new Error(`파일명에 허용되지 않는 문자: ${fileName}`);
    }
    
    console.log(`✅ [UPLOAD] 파일명 검증 통과: ${fileName}`);
    
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
          mimeType: mimeType,
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

// 파일명 충돌 방지를 위한 고유 파일명 생성
function generateFileName(
  businessName: string,
  fileType: string,
  facilityInfo: string,
  fileNumber: number,
  originalName: string
): string {
  // 고유성을 보장하는 타임스탬프 + 랜덤값
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  // 확장자 처리
  let extension = 'jpg';
  if (originalName && typeof originalName === 'string' && originalName.includes('.')) {
    const parts = originalName.split('.');
    if (parts.length > 1) {
      extension = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    }
  }
  
  // 유효한 확장자만 허용
  const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  if (!validExtensions.includes(extension)) {
    extension = 'jpg';
  }
  
  // 절대 중복될 수 없는 고유 파일명 생성
  const uniqueName = `img_${timestamp}_${milliseconds}_${random}_${fileNumber}`;
  
  return `${uniqueName}.${extension}`;
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
