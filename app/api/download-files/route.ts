// app/api/download-files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import JSZip from 'jszip';

// Google API 설정
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessName = searchParams.get('businessName');
    const type = searchParams.get('type') || 'completion';

    if (!businessName) {
      return NextResponse.json(
        { success: false, message: '사업장명이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`📦 파일 일괄 다운로드 시작: ${businessName}`);

    // 사업장 폴더 찾기
    const folderId = type === 'completion' 
      ? process.env.COMPLETION_FOLDER_ID 
      : process.env.PRESURVEY_FOLDER_ID;

    const businessFolder = await findBusinessFolder(businessName, folderId || '');
    
    if (!businessFolder) {
      return NextResponse.json(
        { success: false, message: '사업장 폴더를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 모든 파일 수집
    const allFiles = await collectAllFiles(businessFolder);
    
    if (allFiles.length === 0) {
      return NextResponse.json(
        { success: false, message: '다운로드할 파일이 없습니다.' },
        { status: 404 }
      );
    }

    console.log(`📁 파일 수집 완료: ${allFiles.length}개`);

    // ZIP 파일 생성
    const zip = new JSZip();
    
    for (const file of allFiles) {
      try {
        const fileData = await downloadFileFromDrive(file.id);
        if (fileData) {
          zip.file(file.path, fileData);
          console.log(`✅ ZIP 추가: ${file.path}`);
        }
      } catch (error) {
        console.error(`❌ 파일 다운로드 실패: ${file.name}`, error);
      }
    }

    // ZIP 생성
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const fileName = `${businessName}_${type}_files_${new Date().toISOString().split('T')[0]}.zip`;

    console.log(`🎉 ZIP 파일 생성 완료: ${fileName}`);

    // ZIP 파일 반환
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': zipBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('❌ 파일 다운로드 실패:', error);
    return NextResponse.json(
      { success: false, message: '파일 다운로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function findBusinessFolder(businessName: string, parentFolderId: string) {
  try {
    const response = await drive.files.list({
      q: `name='${businessName}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)'
    });

    return response.data.files?.[0]?.id || null;
  } catch (error) {
    console.error('폴더 찾기 실패:', error);
    return null;
  }
}

async function collectAllFiles(folderId: string, basePath: string = ''): Promise<Array<{id: string, name: string, path: string}>> {
  const files: Array<{id: string, name: string, path: string}> = [];
  
  try {
    const response = await drive.files.list({
      q: `parents in '${folderId}' and trashed=false`,
      fields: 'files(id, name, mimeType)',
    });

    const items = response.data.files || [];

    for (const item of items) {
      const itemPath = basePath ? `${basePath}/${item.name}` : item.name || '';

      if (item.mimeType === 'application/vnd.google-apps.folder') {
        // 하위 폴더의 파일들 재귀적으로 수집
        const subFiles = await collectAllFiles(item.id || '', itemPath);
        files.push(...subFiles);
      } else if (item.mimeType?.startsWith('image/')) {
        // 이미지 파일만 추가
        files.push({
          id: item.id || '',
          name: item.name || '',
          path: itemPath
        });
      }
    }
  } catch (error) {
    console.error('파일 수집 실패:', error);
  }

  return files;
}

async function downloadFileFromDrive(fileId: string): Promise<ArrayBuffer | null> {
  try {
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' });

    return response.data as ArrayBuffer;
  } catch (error) {
    console.error(`파일 다운로드 실패: ${fileId}`, error);
    return null;
  }
}