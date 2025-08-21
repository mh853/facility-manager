// app/api/uploaded-files/route.ts - 업로드된 파일 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { createOptimizedDriveClient, sheets } from '@/lib/google-client';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// 업로드된 파일 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const businessName = url.searchParams.get('businessName');
    const systemType = url.searchParams.get('systemType') || 'presurvey';
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    if (!businessName) {
      return NextResponse.json({
        success: false,
        message: '사업장명이 필요합니다.'
      }, { status: 400 });
    }

    console.log('📂 [FILES] 업로드된 파일 조회 시작:', { businessName, systemType, forceRefresh });

    const drive = await createOptimizedDriveClient();
    
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

    console.log('📂 [FILES] 루트 폴더 ID:', folderId);

    // 사업장 폴더 찾기 (캐시 무효화 옵션 포함)
    const businessFolderId = await findBusinessFolder(drive, businessName, folderId, forceRefresh);
    
    if (!businessFolderId) {
      return NextResponse.json({
        success: true,
        data: {
          businessName,
          files: [],
          totalCount: 0
        },
        message: '업로드된 파일이 없습니다.'
      });
    }

    // 업로드된 파일들 조회
    const files = await getUploadedFiles(drive, businessFolderId, businessName);

    console.log('📂 [FILES] 파일 조회 완료:', files.length, '개');

    return NextResponse.json({
      success: true,
      data: {
        businessName,
        files,
        totalCount: files.length
      },
      message: `${files.length}개의 파일을 찾았습니다.`
    });

  } catch (error) {
    console.error('📂 [FILES] ❌ 파일 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '파일 조회 실패'
    }, { status: 500 });
  }
}

// 파일 삭제 (DELETE)
export async function DELETE(request: NextRequest) {
  let fileId: string | undefined;
  let fileName: string | undefined;
  
  try {
    const body = await request.json();
    fileId = body.fileId;
    fileName = body.fileName;

    console.log('🗑️ [FILES] 삭제 요청 데이터:', { fileId, fileName });

    if (!fileId) {
      return NextResponse.json({
        success: false,
        message: '파일 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log('🗑️ [FILES] 파일 삭제 시작:', { fileName, fileId });

    const drive = await createOptimizedDriveClient();

    // 파일 삭제 실행 (휴지통으로 이동)
    console.log('🗑️ [FILES] 삭제 실행 중...');
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true
    });

    console.log('🗑️ [FILES] ✅ 파일 삭제 완료:', fileName);

    // Google Sheets에 삭제 이력 기록
    if (fileName && fileId) {
      try {
        await recordDeletionHistory(fileName, fileId);
        console.log('📝 [FILES] 삭제 이력 기록 완료');
      } catch (historyError) {
        console.error('📝 [FILES] 삭제 이력 기록 실패:', historyError);
        // 이력 기록 실패해도 삭제는 성공으로 처리
      }
    }

    return NextResponse.json({
      success: true,
      message: `"${fileName}" 파일이 삭제되었습니다.`
    });

  } catch (error: any) {
    console.error('🗑️ [FILES] ❌ 파일 삭제 실패:', {
      fileId,
      fileName,
      error: error?.message || String(error),
      code: error?.code,
      status: error?.status,
      response: error?.response?.data
    });
    
    // 에러 메시지 및 상태 코드 결정
    let errorMessage = '파일 삭제 실패';
    let statusCode = 500;
    
    if (error?.code === 404 || error?.message?.includes('File not found') || error?.message?.includes('notFound')) {
      errorMessage = '파일을 찾을 수 없습니다';
      statusCode = 404;
    } else if (error?.code === 403 || error?.message?.includes('Insufficient Permission') || error?.message?.includes('forbidden')) {
      errorMessage = '파일 삭제 권한이 없습니다';
      statusCode = 403;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? {
        error: error instanceof Error ? error.message : String(error),
        code: error?.code,
        fileId,
        fileName
      } : undefined
    }, { status: statusCode });
  }
}

// 파일 삭제 이력을 Google Sheets에 기록
async function recordDeletionHistory(fileName: string, fileId: string) {
  try {
    // 파일명에서 사업장명과 시스템 타입 추출
    const businessName = fileName.split('_')[0];
    
    // 파일명에서 시스템 타입 판단 (설치전/설치후)
    const isCompletion = fileName.includes('설치후') || fileName.includes('completion');
    const spreadsheetId = isCompletion 
      ? process.env.COMPLETION_SPREADSHEET_ID 
      : process.env.DATA_COLLECTION_SPREADSHEET_ID;
    const sheetName = isCompletion ? '설치 후 사진' : '설치 전 실사';
    
    if (!spreadsheetId) {
      throw new Error(`${isCompletion ? 'COMPLETION_SPREADSHEET_ID' : 'DATA_COLLECTION_SPREADSHEET_ID'}가 설정되지 않았습니다`);
    }

    console.log('📝 [DELETION] 삭제 이력 기록 시작:', { businessName, fileName, fileId, isCompletion, sheetName });
    
    // B열에서 사업장명이 있는 행 찾기 (업로드 로그와 동일한 방식)
    const range = `'${sheetName}'!A:H`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    
    const rows = response.data.values || [];
    let targetRowIndex = -1;
    
    // B열(index 1)에서 사업장명 찾기
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] && row[1].toString().trim() === businessName.trim()) {
        targetRowIndex = i + 1; // 1-based index
        break;
      }
    }
    
    if (targetRowIndex !== -1) {
      // 사업장명이 있는 행의 C열에 삭제 로그 추가
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
      const logEntry = `[${timestamp}] 파일삭제: ${fileName}`;
      
      // 기존 상태에 삭제 로그 추가 (업로드 로그와 동일한 방식)
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
      
      console.log('📝 [DELETION] 구글시트 삭제 로그 추가 완료:', { targetRowIndex, logEntry });
    } else {
      console.warn('📝 [DELETION] 사업장명을 찾을 수 없음:', businessName);
    }
    
  } catch (error) {
    console.error('📝 [DELETION] 삭제 이력 기록 실패:', error);
    throw error;
  }
}

// 사업장 폴더 찾기 (개선된 버전)
async function findBusinessFolder(drive: any, businessName: string, parentFolderId: string, forceRefresh: boolean = false): Promise<string | null> {
  try {
    console.log('📂 [FILES] 사업장 폴더 검색:', { businessName, parentFolderId, forceRefresh });

    // 정확한 이름 매칭과 부분 매칭 모두 시도
    const queries = [
      // 정확한 이름 매칭
      `name='${businessName.replace(/'/g, "\\'")}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      // 부분 매칭 (공백 문제 등을 위해)
      `name contains '${businessName.replace(/'/g, "\\'")}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    ];

    for (const query of queries) {
      console.log('📂 [FILES] 검색 쿼리:', query);
      
      const searchResponse = await drive.files.list({
        q: query,
        fields: 'files(id, name, parents)',
        pageSize: 10,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        orderBy: 'name'
      });

      console.log('📂 [FILES] 검색 결과:', searchResponse.data.files?.length, '개 폴더 발견');

      if (searchResponse.data.files?.length > 0) {
        // 정확히 일치하는 폴더 우선 선택
        const exactMatch = searchResponse.data.files.find((file: any) => file.name === businessName);
        const selectedFolder = exactMatch || searchResponse.data.files[0];
        
        console.log('📂 [FILES] 선택된 폴더:', selectedFolder.name, '(ID:', selectedFolder.id, ')');
        return selectedFolder.id!;
      }
    }

    console.log('📂 [FILES] 사업장 폴더를 찾을 수 없음:', businessName);
    return null;
  } catch (error) {
    console.error('📂 [FILES] 사업장 폴더 찾기 실패:', error);
    return null;
  }
}

// 업로드된 파일들 조회 (재귀적으로 하위 폴더까지)
async function getUploadedFiles(drive: any, folderId: string, folderName: string = 'root'): Promise<any[]> {
  try {
    const allFiles: any[] = [];

    // 현재 폴더의 모든 항목 조회
    const response = await drive.files.list({
      q: `parents in '${folderId}' and trashed=false`,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents)',
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const items = response.data.files || [];
    console.log(`📂 [FILES] ${folderName} 폴더에서 ${items.length}개 항목 발견`);

    for (const item of items) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        // 하위 폴더인 경우 재귀적으로 조회
        console.log(`📁 [FILES] 하위 폴더 탐색: ${item.name}`);
        const subFiles = await getUploadedFiles(drive, item.id!, item.name!);
        allFiles.push(...subFiles);
      } else if (item.mimeType?.startsWith('image/')) {
        // 이미지 파일인 경우 목록에 추가
        const fileInfo = {
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          size: parseInt(item.size || '0'),
          createdTime: item.createdTime,
          modifiedTime: item.modifiedTime,
          webViewLink: item.webViewLink,
          downloadUrl: `https://drive.google.com/uc?id=${item.id}&export=download`,
          thumbnailUrl: `https://drive.google.com/thumbnail?id=${item.id}&sz=w300-h300-c`,
          publicUrl: `https://lh3.googleusercontent.com/d/${item.id}`,
          directUrl: `https://drive.google.com/uc?id=${item.id}`,
          folderName: folderName === 'root' ? '기본사진' : folderName // root는 기본사진으로 매핑
        };
        
        console.log(`🖼️ [FILES] 이미지 파일 발견:`, {
          name: item.name,
          id: item.id,
          folderName: fileInfo.folderName,
          mimeType: item.mimeType,
          size: item.size
        });
        allFiles.push(fileInfo);
      }
    }

    return allFiles;
  } catch (error) {
    console.error(`📂 [FILES] 폴더 ${folderName} 조회 실패:`, error);
    return [];
  }
}
