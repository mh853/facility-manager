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
          // 대한민국 시간대로 시간 생성 (20250819_16:30 형식)
          const now = new Date();
          const koreaTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
    
    // 최대한 단순한 처리로 문제 예방
    console.log(`📷 [UPLOAD] 원본 파일명: "${file.name || 'undefined'}", 타입: ${file.type || 'undefined'}, 크기: ${file.size}`);
    
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

    // 극도로 단순한 파일명 생성
    const fileName = generateFileName(businessName, fileType, facilityInfo, fileNumber, file.name);
    
    console.log(`📝 [UPLOAD] 생성된 파일명: "${fileName}"`);
    
    // 한글 파일명 검증 (한글, 영어, 숫자, 기본 특수문자 허용)
    if (!fileName || fileName.length > 200) {
      console.error(`❌ [UPLOAD] 파일명 오류: "${fileName}" (길이: ${fileName?.length || 0})`);
      throw new Error(`파일명 길이 오류`);
    }
    
    // 파일명에 위험한 문자가 있는지 검사 (파일시스템 안전성)
    if (/[<>:"/\\|?*\x00-\x1f]/.test(fileName)) {
      console.error(`❌ [UPLOAD] 파일명에 위험한 문자: "${fileName}"`);
      throw new Error(`파일명에 허용되지 않는 문자가 있습니다`);
    }
    
    console.log(`✅ [UPLOAD] 한글 파일명 생성: ${fileName}`);
    
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
      
      console.log(`✅ [UPLOAD] 업로드 성공: ${fileName}`);
      
    } catch (driveError: any) {
      console.error(`❌ [UPLOAD] Google Drive 실패:`, driveError.message);
      
      // pattern 오류 감지 및 구체적 로깅
      if (driveError.message?.includes('pattern') || driveError.message?.includes('invalid')) {
        console.error(`🚫 [UPLOAD] 파일명 패턴 오류: "${fileName}"`);
        console.error(`🔍 [UPLOAD] 파일명 분석: 길이=${fileName.length}, 한글포함=true`);
        throw new Error(`파일명 형식 오류: ${fileName}`);
      }
      
      // 기타 오류 처리
      let errorMessage = '파일 업로드 실패';
      if (driveError.message?.includes('quota')) {
        errorMessage = 'Google Drive 용량 한도 초과';
      } else if (driveError.message?.includes('permission')) {
        errorMessage = 'Google Drive 접근 권한 부족';
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

// 한글 파일명 생성 (카메라 사진만 특별 처리)
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
  
  // 카메라로 직접 찍은 사진 감지 (기본 파일명들)
  const isCameraPhoto = !originalName || 
    ['image.jpg', 'image.jpeg', 'image.png', 'photo.jpg', 'photo.jpeg', 'photo.png'].includes(originalName?.toLowerCase());
  
  if (isCameraPhoto) {
    // 카메라 사진인 경우: 고유한 한글 파일명 생성
    const now = new Date();
    const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // 파일 타입별 한글 접두사
    const typeMap = {
      'basic': '기본사진',
      'discharge': '배출시설',
      'prevention': '방지시설'
    };
    
    const typePrefix = typeMap[fileType as keyof typeof typeMap] || '기타';
    
    // facilityInfo에서 시설명 추출
    let facilityName = '시설';
    if (facilityInfo && facilityInfo.trim()) {
      const cleanInfo = facilityInfo.split(/[-,/]/)[0]?.trim();
      if (cleanInfo) {
        facilityName = cleanInfo.substring(0, 20);
      }
    }
    
    const fileName = `${businessName}_${typePrefix}_${facilityName}_${fileNumber}번째_${timeStr}.${extension}`;
    return fileName;
    
  } else {
    // 사진첩에서 선택한 사진인 경우: 기존 방식 유지하되 한글로
    const now = new Date();
    const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // 파일 타입별 한글 접두사
    const typeMap = {
      'basic': '기본사진',
      'discharge': '배출시설', 
      'prevention': '방지시설'
    };
    
    const typePrefix = typeMap[fileType as keyof typeof typeMap] || '기타';
    
    // facilityInfo 정보 파싱
    let facilityParts = [];
    if (facilityInfo && facilityInfo.trim()) {
      facilityParts = facilityInfo.split(/[-,/]/).map(p => p.trim()).filter(Boolean);
    }
    
    // 파일명 구성
    const nameParts = [
      businessName,
      typePrefix,
      ...facilityParts.slice(0, 3), // 최대 3개 부분만 사용
      `${fileNumber}번째`,
      timeStr
    ].filter(Boolean);
    
    const fileName = nameParts.join('_') + `.${extension}`;
    
    // 길이 제한 (Windows/Google Drive 호환)
    if (fileName.length > 150) {
      const shortName = `${businessName}_${typePrefix}_${facilityParts[0] || '시설'}_${fileNumber}번째_${timeStr}.${extension}`;
      return shortName;
    }
    
    return fileName;
  }
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
