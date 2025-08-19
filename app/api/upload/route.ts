// app/api/upload/route.ts - 안정화된 파일 업로드 API
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';

// Vercel 설정
export const runtime = 'nodejs';
export const maxDuration = 60;

// 환경변수 검증
function validateEnvironment() {
  const required = [
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    'PRESURVEY_FOLDER_ID',
    'COMPLETION_FOLDER_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

// 단순화된 파일명 생성
function generateSimpleFileName(businessName: string, fileType: string, fileNumber: number, originalName: string): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  
  // 확장자 추출
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  
  // 파일명 정리 (특수문자 제거)
  const cleanBusinessName = businessName.replace(/[^\w\s가-힣]/g, '').substring(0, 20);
  const cleanFileType = fileType === 'basic' ? '기본' : fileType === 'discharge' ? '배출' : '방지';
  
  return `${cleanBusinessName}_${cleanFileType}_${fileNumber}_${timestamp}.${extension}`;
}

// Google Drive 클라이언트 생성
async function createDriveClient() {
  try {
    console.log('🔧 [UPLOAD] Google 클라이언트 생성 시작');
    
    const { google } = await import('googleapis');
    
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('Private key not found');
    }
    
    // Private key 정규화
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = JSON.parse(privateKey);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    console.log('✅ [UPLOAD] Google 클라이언트 생성 완료');
    
    return drive;
  } catch (error) {
    console.error('❌ [UPLOAD] Google 클라이언트 생성 실패:', error);
    throw error;
  }
}

// 폴더 찾기 또는 생성
async function findOrCreateFolder(drive: any, folderName: string, parentId: string): Promise<string> {
  try {
    console.log(`📁 [UPLOAD] 폴더 검색: ${folderName}`);
    
    // 기존 폴더 검색
    const searchQuery = `name='${folderName.replace(/'/g, "\\\'")}' and parents in '${parentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    const searchResponse = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name)',
      pageSize: 1
    });
    
    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const folderId = searchResponse.data.files[0].id;
      console.log(`✅ [UPLOAD] 기존 폴더 사용: ${folderId}`);
      return folderId;
    }
    
    // 새 폴더 생성
    console.log(`📂 [UPLOAD] 새 폴더 생성: ${folderName}`);
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      },
      fields: 'id'
    });
    
    const folderId = createResponse.data.id;
    console.log(`✅ [UPLOAD] 폴더 생성 완료: ${folderId}`);
    return folderId;
    
  } catch (error) {
    console.error(`❌ [UPLOAD] 폴더 처리 실패: ${folderName}`, error);
    throw error;
  }
}

// 단일 파일 업로드
async function uploadFile(drive: any, file: File, folderId: string, fileName: string) {
  try {
    console.log(`📤 [UPLOAD] 파일 업로드 시작: ${fileName} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    
    // 파일을 스트림으로 변환
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = new Readable({
      read() {
        this.push(buffer);
        this.push(null);
      }
    });
    
    // Google Drive에 업로드
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        mimeType: file.type,
        body: stream
      },
      fields: 'id, name'
    });
    
    const fileId = response.data.id;
    console.log(`✅ [UPLOAD] 파일 업로드 완료: ${fileName} (ID: ${fileId})`);
    
    // 파일 공개 설정
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
      console.log(`🔓 [UPLOAD] 파일 공개 설정 완료: ${fileName}`);
    } catch (permError) {
      console.warn(`⚠️ [UPLOAD] 파일 공개 설정 실패: ${fileName}`, permError);
    }
    
    return {
      id: fileId,
      name: fileName,
      url: `https://drive.google.com/file/d/${fileId}/view`,
      size: file.size
    };
    
  } catch (error) {
    console.error(`❌ [UPLOAD] 파일 업로드 실패: ${fileName}`, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 [UPLOAD] === 파일 업로드 API 시작 ===');
  
  try {
    // 환경변수 검증
    validateEnvironment();
    console.log('✅ [UPLOAD] 환경변수 검증 완료');
    
    // FormData 파싱
    console.log('📋 [UPLOAD] FormData 파싱 시작');
    const formData = await request.formData();
    
    const businessName = formData.get('businessName') as string;
    const fileType = formData.get('fileType') as string;
    const systemType = (formData.get('type') as string) || 'presurvey';
    const files = formData.getAll('files') as File[];
    
    console.log('📋 [UPLOAD] 요청 데이터:', {
      businessName,
      fileType,
      systemType,
      fileCount: files.length,
      fileSizes: files.map(f => `${f.name}: ${(f.size / 1024 / 1024).toFixed(2)}MB`)
    });
    
    // 기본 검증
    if (!businessName?.trim()) {
      throw new Error('사업장명이 필요합니다');
    }
    
    if (!files || files.length === 0) {
      throw new Error('업로드할 파일이 없습니다');
    }
    
    // 파일 크기 검증
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const maxTotalSize = 50 * 1024 * 1024; // 50MB
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    if (totalSize > maxTotalSize) {
      throw new Error(`전체 파일 크기 초과: ${(totalSize / 1024 / 1024).toFixed(1)}MB / 50MB`);
    }
    
    for (const file of files) {
      if (file.size > maxFileSize) {
        throw new Error(`파일 크기 초과: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB / 10MB)`);
      }
      
      if (!file.type.startsWith('image/')) {
        throw new Error(`이미지 파일만 업로드 가능: ${file.name}`);
      }
    }
    
    console.log('✅ [UPLOAD] 파일 검증 완료');
    
    // Google Drive 클라이언트 생성
    const drive = await createDriveClient();
    
    // 루트 폴더 ID 결정
    const rootFolderId = systemType === 'completion' 
      ? process.env.COMPLETION_FOLDER_ID 
      : process.env.PRESURVEY_FOLDER_ID;
    
    console.log(`📁 [UPLOAD] 루트 폴더: ${rootFolderId} (${systemType})`);
    
    // 사업장 폴더 생성/확인
    const businessFolderId = await findOrCreateFolder(drive, businessName, rootFolderId!);
    
    // 파일 타입별 하위 폴더 생성/확인
    const subFolderName = fileType === 'basic' ? '기본사진' : 
                         fileType === 'discharge' ? '배출시설' : '방지시설';
    const targetFolderId = await findOrCreateFolder(drive, subFolderName, businessFolderId);
    
    // 파일 업로드 (순차 처리)
    const uploadResults = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = generateSimpleFileName(businessName, fileType, i + 1, file.name);
      
      try {
        const result = await uploadFile(drive, file, targetFolderId, fileName);
        uploadResults.push(result);
        
        // 파일 간 짧은 대기 (API 레이트 제한 방지)
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (fileError) {
        console.error(`❌ [UPLOAD] 개별 파일 업로드 실패: ${file.name}`, fileError);
        // 개별 파일 실패해도 계속 진행
      }
    }
    
    console.log(`🎉 [UPLOAD] === 업로드 완료: ${uploadResults.length}/${files.length} ===`);
    
    // 성공 응답
    return NextResponse.json({
      success: uploadResults.length > 0,
      message: `${uploadResults.length}장의 파일이 업로드되었습니다`,
      files: uploadResults,
      stats: {
        total: files.length,
        success: uploadResults.length,
        failed: files.length - uploadResults.length
      }
    });
    
  } catch (error) {
    console.error('💥 [UPLOAD] === 전체 업로드 실패 ===', error);
    
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '업로드 실패',
      error: {
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        details: error instanceof Error ? error.message : String(error)
      }
    }, { status: 500 });
  }
}