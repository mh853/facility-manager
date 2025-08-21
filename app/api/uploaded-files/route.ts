// app/api/uploaded-files/route.ts - 업로드된 파일 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { createOptimizedDriveClient } from '@/lib/google-client';
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
  try {
    const body = await request.json();
    const { fileId, fileName } = body;

    console.log('🗑️ [FILES] 삭제 요청 데이터:', { fileId, fileName });

    if (!fileId) {
      return NextResponse.json({
        success: false,
        message: '파일 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log('🗑️ [FILES] 파일 삭제 시작:', { fileName, fileId });

    const drive = await createOptimizedDriveClient();

    // 파일 존재 확인 먼저 시도
    try {
      console.log('🔍 [FILES] 파일 존재 확인:', fileId);
      const fileInfo = await drive.files.get({
        fileId,
        fields: 'id, name, trashed, parents',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      console.log('🔍 [FILES] 파일 정보:', {
        id: fileInfo.data.id,
        name: fileInfo.data.name,
        trashed: fileInfo.data.trashed,
        parents: fileInfo.data.parents
      });
    } catch (getError: any) {
      console.error('🔍 [FILES] 파일 조회 실패:', {
        fileId,
        fileName,
        error: getError?.message || String(getError),
        code: getError?.code,
        status: getError?.status
      });
      
      // Google API 에러 코드별 처리
      if (getError?.code === 404 || getError?.message?.includes('File not found')) {
        return NextResponse.json({
          success: false,
          message: `파일을 찾을 수 없습니다. (ID: ${fileId})`
        }, { status: 404 });
      } else if (getError?.code === 403 || getError?.message?.includes('Forbidden')) {
        return NextResponse.json({
          success: false,
          message: '파일에 접근할 권한이 없습니다.'
        }, { status: 403 });
      } else {
        return NextResponse.json({
          success: false,
          message: `파일 조회 중 오류 발생: ${getError?.message || 'Unknown error'}`
        }, { status: 500 });
      }
    }

    // 파일 삭제 실행
    console.log('🗑️ [FILES] 삭제 실행 중...');
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    console.log('🗑️ [FILES] ✅ 파일 삭제 완료:', fileName);

    return NextResponse.json({
      success: true,
      message: `"${fileName}" 파일이 삭제되었습니다.`
    });

  } catch (error) {
    console.error('🗑️ [FILES] ❌ 파일 삭제 실패:', error);
    
    // 에러 메시지 상세화
    let errorMessage = '파일 삭제 실패';
    if (error instanceof Error) {
      if (error.message.includes('File not found') || error.message.includes('notFound')) {
        errorMessage = '파일을 찾을 수 없습니다';
      } else if (error.message.includes('Insufficient Permission') || error.message.includes('forbidden')) {
        errorMessage = '파일 삭제 권한이 없습니다';
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      } : undefined
    }, { status: 500 });
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
