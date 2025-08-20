// app/api/upload/route.ts - Vercel 배포 안정화된 파일 업로드 API
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';

// Vercel 최적화 설정
export const runtime = 'nodejs';
export const maxDuration = 60;

// 타입 정의
interface UploadResult {
  id: string;
  name: string;
  url: string;
  size: number;
}

interface UploadResponse {
  success: boolean;
  message: string;
  files?: UploadResult[];
  stats?: {
    total: number;
    success: number;
    failed: number;
  };
  error?: {
    type: string;
    details: string;
  };
}

// 환경변수 검증 함수
function validateEnvironment(): void {
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

// 단순화된 파일명 생성 함수
function generateFileName(
  businessName: string,
  fileType: string,
  fileNumber: number,
  originalName: string
): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  
  // 확장자 추출
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  
  // 파일명 정리 (특수문자 제거, 한글 허용)
  const cleanBusinessName = businessName.replace(/[^\w\s가-힣]/g, '').substring(0, 20);
  const typeMap: Record<string, string> = {
    'basic': '기본',
    'discharge': '배출',
    'prevention': '방지'
  };
  const cleanFileType = typeMap[fileType] || '기타';
  
  return `${cleanBusinessName}_${cleanFileType}_${fileNumber}_${timestamp}.${extension}`;
}

// Google Drive 클라이언트 생성 함수
async function createGoogleDriveClient() {
  try {
    console.log('🔧 [UPLOAD] Google Drive 클라이언트 생성 시작');
    
    // googleapis 동적 import
    const { google } = await import('googleapis');
    
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    
    console.log('🔍 [UPLOAD] 환경변수 상태:', {
      hasEmail: !!clientEmail,
      hasPrivateKey: !!rawPrivateKey,
      emailLength: clientEmail?.length || 0,
      privateKeyLength: rawPrivateKey?.length || 0
    });
    
    if (!clientEmail || !rawPrivateKey) {
      throw new Error(`환경변수 누락 - Email: ${!!clientEmail}, PrivateKey: ${!!rawPrivateKey}`);
    }
    
    // Private Key 처리
    let privateKey = rawPrivateKey;
    
    // JSON 감싸진 경우 처리
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      try {
        privateKey = JSON.parse(privateKey);
        console.log('✅ [UPLOAD] JSON wrapped key parsed');
      } catch (parseError) {
        console.warn('⚠️ [UPLOAD] JSON parsing failed, using raw key');
      }
    }
    
    // 개행문자 정규화
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    // Base64 디코딩 시도
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      try {
        const decoded = Buffer.from(privateKey, 'base64').toString('utf8');
        if (decoded.includes('-----BEGIN PRIVATE KEY-----')) {
          privateKey = decoded;
          console.log('✅ [UPLOAD] Base64 key decoded');
        }
      } catch (decodeError) {
        console.warn('⚠️ [UPLOAD] Base64 decoding failed');
      }
    }
    
    // 키 형식 검증
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
      throw new Error('Invalid private key format - must contain BEGIN/END markers');
    }
    
    // Google Auth 생성
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    console.log('✅ [UPLOAD] Google Drive client created successfully');
    
    return drive;
    
  } catch (error) {
    console.error('❌ [UPLOAD] Google Drive client creation failed:', error);
    throw new Error(`Google Drive client error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 폴더 찾기/생성 함수 (오류 진단 강화)
async function ensureFolderExists(
  drive: any,
  folderName: string,
  parentId: string
): Promise<string> {
  try {
    console.log(`📁 [UPLOAD] Ensuring folder exists: ${folderName} in parent: ${parentId}`);
    
    // 먼저 부모 폴더 존재 확인
    try {
      const parentCheck = await drive.files.get({
        fileId: parentId,
        fields: 'id, name, mimeType, trashed'
      });
      
      console.log(`✅ [UPLOAD] Parent folder verified:`, {
        id: parentCheck.data.id,
        name: parentCheck.data.name,
        mimeType: parentCheck.data.mimeType,
        trashed: parentCheck.data.trashed
      });
      
      if (parentCheck.data.trashed) {
        throw new Error(`Parent folder is trashed: ${parentId}`);
      }
      
    } catch (parentError) {
      console.error(`❌ [UPLOAD] Parent folder access failed:`, parentError);
      throw new Error(`Cannot access parent folder ${parentId}: ${parentError instanceof Error ? parentError.message : String(parentError)}`);
    }
    
    // 기존 폴더 검색 (더 안전한 쿼리)
    const searchQuery = `name='${folderName.replace(/'/g, "\\'")}' and parents in '${parentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    console.log(`🔍 [UPLOAD] Search query: ${searchQuery}`);
    
    const searchResponse = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, parents)',
      pageSize: 10
    });
    
    console.log(`🔍 [UPLOAD] Search results:`, {
      query: searchQuery,
      resultCount: searchResponse.data.files?.length || 0,
      results: searchResponse.data.files?.map((f: any) => ({ id: f.id, name: f.name })) || []
    });
    
    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const folderId = searchResponse.data.files[0].id;
      console.log(`✅ [UPLOAD] Using existing folder: ${folderId}`);
      return folderId;
    }
    
    // 새 폴더 생성
    console.log(`📂 [UPLOAD] Creating new folder: ${folderName} in parent: ${parentId}`);
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      },
      fields: 'id, name, parents'
    });
    
    const folderId = createResponse.data.id;
    if (!folderId) {
      throw new Error('Failed to create folder - no ID returned');
    }
    
    console.log(`✅ [UPLOAD] Created new folder:`, {
      id: folderId,
      name: createResponse.data.name,
      parents: createResponse.data.parents
    });
    return folderId;
    
  } catch (error) {
    console.error(`❌ [UPLOAD] Folder operation failed for "${folderName}" in parent "${parentId}":`, error);
    throw new Error(`Folder error for "${folderName}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 단일 파일 업로드 함수
async function uploadSingleFile(
  drive: any,
  file: File,
  folderId: string,
  fileName: string
): Promise<UploadResult> {
  try {
    console.log(`📤 [UPLOAD] Uploading file: ${fileName} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    
    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Buffer를 Readable Stream으로 변환
    const stream = new Readable({
      read() {
        this.push(buffer);
        this.push(null);
      }
    });
    
    // Google Drive에 업로드
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        mimeType: file.type || 'image/jpeg',
        body: stream
      },
      fields: 'id, name'
    });
    
    const fileId = uploadResponse.data.id;
    if (!fileId) {
      throw new Error('Upload failed - no file ID returned');
    }
    
    console.log(`✅ [UPLOAD] File uploaded successfully: ${fileId}`);
    
    // 파일 공개 권한 설정 (오류 무시)
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
      console.log(`🔓 [UPLOAD] File made public: ${fileId}`);
    } catch (permError) {
      console.warn(`⚠️ [UPLOAD] Failed to make file public: ${fileId}`, permError);
    }
    
    return {
      id: fileId,
      name: fileName,
      url: `https://drive.google.com/file/d/${fileId}/view`,
      size: file.size
    };
    
  } catch (error) {
    console.error(`❌ [UPLOAD] File upload failed: ${fileName}`, error);
    throw new Error(`Upload error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 메인 POST 핸들러
export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  console.log('🚀 [UPLOAD] === Upload API Started ===');
  
  try {
    // 환경변수 검증
    validateEnvironment();
    console.log('✅ [UPLOAD] Environment variables validated');
    
    // FormData 파싱
    console.log('📋 [UPLOAD] Parsing form data');
    const formData = await request.formData();
    
    const businessName = formData.get('businessName') as string;
    const fileType = formData.get('fileType') as string;
    const systemType = (formData.get('type') as string) || 'presurvey';
    const files = formData.getAll('files') as File[];
    
    console.log('📋 [UPLOAD] Request data:', {
      businessName,
      fileType,
      systemType,
      fileCount: files.length,
      fileSizes: files.map(f => `${f.name}: ${(f.size / 1024 / 1024).toFixed(2)}MB`)
    });
    
    // 입력 검증
    if (!businessName?.trim()) {
      throw new Error('Business name is required');
    }
    
    if (!files || files.length === 0) {
      throw new Error('No files to upload');
    }
    
    // 파일 크기 검증
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new Error(`Total file size exceeds limit: ${(totalSize / 1024 / 1024).toFixed(1)}MB / 50MB`);
    }
    
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB / 10MB)`);
      }
      
      if (!file.type.startsWith('image/')) {
        throw new Error(`Only image files allowed: ${file.name} (${file.type})`);
      }
    }
    
    console.log('✅ [UPLOAD] File validation passed');
    
    // Google Drive 클라이언트 생성
    const drive = await createGoogleDriveClient();
    
    // 루트 폴더 ID 결정
    const rootFolderId = systemType === 'completion' 
      ? process.env.COMPLETION_FOLDER_ID!
      : process.env.PRESURVEY_FOLDER_ID!;
    
    console.log(`📁 [UPLOAD] Root folder ID: ${rootFolderId} (${systemType})`);
    
    // 사업장 폴더 생성/확인
    const businessFolderId = await ensureFolderExists(drive, businessName, rootFolderId);
    
    // 파일 타입별 하위 폴더 생성/확인
    const subFolderMap: Record<string, string> = {
      'basic': '기본사진',
      'discharge': '배출시설',
      'prevention': '방지시설'
    };
    const subFolderName = subFolderMap[fileType] || '기타';
    const targetFolderId = await ensureFolderExists(drive, subFolderName, businessFolderId);
    
    // 파일 업로드 (순차 처리)
    console.log('📤 [UPLOAD] Starting file uploads');
    const uploadResults: UploadResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = generateFileName(businessName, fileType, i + 1, file.name);
      
      try {
        const result = await uploadSingleFile(drive, file, targetFolderId, fileName);
        uploadResults.push(result);
        
        // 파일 간 짧은 지연 (API 레이트 제한 방지)
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (fileError) {
        console.error(`❌ [UPLOAD] Individual file upload failed: ${file.name}`, fileError);
        // 개별 파일 실패시에도 계속 진행
      }
    }
    
    console.log(`🎉 [UPLOAD] === Upload Complete: ${uploadResults.length}/${files.length} successful ===`);
    
    // 성공 응답
    const response: UploadResponse = {
      success: uploadResults.length > 0,
      message: `${uploadResults.length}개의 파일이 성공적으로 업로드되었습니다`,
      files: uploadResults,
      stats: {
        total: files.length,
        success: uploadResults.length,
        failed: files.length - uploadResults.length
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('💥 [UPLOAD] === Upload Failed ===', error);
    
    const errorResponse: UploadResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Upload failed',
      error: {
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        details: error instanceof Error ? error.message : String(error)
      }
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}