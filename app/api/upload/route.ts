// app/api/upload/route.ts - 파일 업로드 API (깔끔하게 정리)
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { createOptimizedDriveClient } from '@/lib/google-client';

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
      facilityInfo,
      fileCount: files.length
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

    // 파일 크기 및 타입 검증
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

    // 파일 업로드 (순차 처리)
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

    // 업로드 성공 시 구글시트에 로그 추가
    if (uploadResults.length > 0) {
      try {
        const facilityDetails = facilityInfo || '정보 없음';
        const uploadLog = `파일 ${uploadResults.length}개 업로드 완료 [${getFileTypeDisplayName(fileType)}] - ${facilityDetails}`;
        
        const { sheets } = await import('@/lib/google-client');
        
        // systemType에 따라 적절한 스프레드시트와 시트 선택
        const spreadsheetId = systemType === 'completion' 
          ? process.env.COMPLETION_SPREADSHEET_ID 
          : process.env.DATA_COLLECTION_SPREADSHEET_ID;
        const sheetName = systemType === 'completion' ? '설치 후 사진' : '설치 전 실사';
        
        console.log('📊 [UPLOAD] 로그 기록 시작:', { systemType, sheetName });
        
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
          // 시간 정보 (20250819_16:30 형식)
          const now = new Date();
          const koreaTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const logEntry = `[${koreaTime}] ${uploadLog}`;
          
          // 기존 상태에 로그 추가
          let newStatus = currentRow[2] || '';
          newStatus = newStatus ? `${newStatus}\\n${logEntry}` : logEntry;
          
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
          
          console.log('📊 [UPLOAD] 구글시트 로그 추가 완료');
        } else {
          console.warn('📊 [UPLOAD] 해당 사업장을 시트에서 찾을 수 없음:', businessName);
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

// 사업장 폴더 생성/확인
async function findOrCreateBusinessFolder(drive: any, businessName: string, parentFolderId: string): Promise<string> {
  try {
    console.log(`📁 [UPLOAD] 사업장 폴더 확인: ${businessName}`);

    // 기존 폴더 검색
    const searchResponse = await drive.files.list({
      q: `name='${businessName.replace(/'/g, "\\\\'")}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
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

    // 새 폴더 생성
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

    // 하위 폴더 생성
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
    const fileName = generateFileName(businessName, fileType, facilityInfo, fileNumber, file.name);
    console.log(`📝 [UPLOAD] 생성된 파일명: "${fileName}"`);

    // 파일명 안전성 검사
    if (!fileName || fileName.length > 200) {
      throw new Error(`파일명 길이 오류: ${fileName?.length || 0}자`);
    }

    // 위험한 문자 검사
    if (/[<>:"/\\\\|?*\\x00-\\x1f]/.test(fileName)) {
      throw new Error(`파일명에 허용되지 않는 문자가 있습니다`);
    }

    // 대상 폴더 확인
    const targetFolderId = await getTargetFolder(drive, businessFolderId, fileType);

    // Google Drive에 업로드
    const response = await drive.files.create({
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

    console.log(`✅ [UPLOAD] 업로드 성공: ${fileName}`);

    const fileId = response.data.id;
    
    // 파일을 공개로 설정
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        },
        supportsAllDrives: true
      });
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
    const searchResponse = await drive.files.list({
      q: `name='${subFolderName}' and parents in '${businessFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    if (searchResponse.data.files?.length > 0) {
      return searchResponse.data.files[0].id!;
    }
  } catch (error) {
    console.error(`❌ [UPLOAD] 하위 폴더 검색 실패: ${subFolderName}`, error);
  }
  
  return businessFolderId;
}