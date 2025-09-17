// app/api/uploaded-files/route.ts - 업로드된 파일 관리 API (간소화)
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const businessName = url.searchParams.get('businessName');
    const systemType = url.searchParams.get('systemType') || 'presurvey';
    
    console.log('📂 [FILES] 파일 목록 조회 요청:', { businessName, systemType });

    if (!businessName) {
      return NextResponse.json({
        success: false,
        message: '사업장명이 필요합니다.'
      }, { status: 400 });
    }

    // 환경변수 확인
    const folderId = systemType === 'completion' 
      ? process.env.COMPLETION_FOLDER_ID 
      : process.env.PRESURVEY_FOLDER_ID;

    if (!folderId) {
      return NextResponse.json({
        success: false,
        message: '폴더 설정이 누락되었습니다.'
      }, { status: 500 });
    }

    try {
      // Google Drive API 연결
      const { google } = await import('googleapis');
      
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
      
      if (!clientEmail || !rawPrivateKey) {
        throw new Error('Google API 인증 정보가 없습니다.');
      }

      // Private Key 처리
      let privateKey = rawPrivateKey;
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = JSON.parse(privateKey);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      const drive = google.drive({ version: 'v3', auth });

      // 사업장 폴더 검색
      const businessFolderQuery = `name='${businessName.replace(/'/g, "\\'")}' and parents in '${folderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      
      const businessFolderResponse = await drive.files.list({
        q: businessFolderQuery,
        fields: 'files(id, name)',
        pageSize: 1
      });

      if (!businessFolderResponse.data.files || businessFolderResponse.data.files.length === 0) {
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

      const businessFolderId = businessFolderResponse.data.files[0].id;

      // 하위 폴더의 모든 파일 검색
      const filesQuery = `parents in '${businessFolderId}' and mimeType contains 'image/' and trashed=false`;
      
      const filesResponse = await drive.files.list({
        q: filesQuery,
        fields: 'files(id, name, mimeType, size, createdTime, parents)',
        orderBy: 'createdTime desc',
        pageSize: 100
      });

      const files = filesResponse.data.files || [];
      
      // 파일 정보 포맷팅
      const formattedFiles = files.map(file => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? parseInt(file.size) : 0,
        createdTime: file.createdTime,
        url: `https://drive.google.com/file/d/${file.id}/view`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w200-h200-c`
      }));

      console.log('📂 [FILES] 파일 검색 완료:', { 
        businessName, 
        totalFiles: formattedFiles.length 
      });

      return NextResponse.json({
        success: true,
        data: {
          businessName,
          files: formattedFiles,
          totalCount: formattedFiles.length,
          systemType
        }
      });

    } catch (driveError) {
      console.error('❌ [FILES] Google Drive 오류:', driveError);
      return NextResponse.json({
        success: false,
        message: 'Google Drive 연결 실패'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [FILES] 전체 오류:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '파일 목록 조회 실패'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({
        success: false,
        message: '파일 ID가 필요합니다.'
      }, { status: 400 });
    }

    console.log('🗑️ [FILES] 파일 삭제 요청:', fileId);

    try {
      // Google Drive API 연결
      const { google } = await import('googleapis');
      
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
      
      if (!clientEmail || !rawPrivateKey) {
        throw new Error('Google API 인증 정보가 없습니다.');
      }

      // Private Key 처리
      let privateKey = rawPrivateKey;
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = JSON.parse(privateKey);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
      });

      const drive = google.drive({ version: 'v3', auth });

      // 파일 삭제 (휴지통으로 이동)
      await drive.files.update({
        fileId: fileId,
        requestBody: {
          trashed: true
        }
      });

      console.log('✅ [FILES] 파일 삭제 완료:', fileId);

      return NextResponse.json({
        success: true,
        message: '파일이 삭제되었습니다.'
      });

    } catch (driveError) {
      console.error('❌ [FILES] 파일 삭제 오류:', driveError);
      return NextResponse.json({
        success: false,
        message: '파일 삭제 실패'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [FILES] 삭제 요청 처리 오류:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '파일 삭제 실패'
    }, { status: 500 });
  }
}