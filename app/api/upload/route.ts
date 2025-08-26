// app/api/upload/route.ts - 최적화된 파일 업로드 API
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { createHash } from 'crypto';
import { createOptimizedDriveClient } from '@/lib/google-client';
import { withApiHandler, createSuccessResponse, createErrorResponse, sanitizeFileName, withTimeout } from '@/lib/api-utils';

// 순차 업로드 처리 시스템 (완전한 순서 보장)
interface UploadTask {
  requestId: string;
  businessName: string;
  systemType: string;
  files: File[];
  formData: FormData;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

interface BusinessQueue {
  isProcessing: boolean;
  tasks: UploadTask[];
  currentFolderId?: string;
  folderHash?: string; // 폴더의 해시값 (생성된 폴더 고유 식별)
  fileHashCache: Set<string>; // 업로드된 파일들의 해시값 캐시
  lastActivity: number;
}

// 파일 해시 정보
interface FileHashInfo {
  hash: string;
  fileName: string;
  fileId: string;
  size: number;
  uploadDate: string;
}

// 전역 업로드 큐 관리 (사업장별 순차 처리)
const businessUploadQueues = new Map<string, BusinessQueue>();
const globalUploadCounter = { count: 0 };

// 큐 정리 함수 (10분 이상 비활성 큐 제거)
function cleanupInactiveQueues() {
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  
  for (const [key, queue] of businessUploadQueues.entries()) {
    if (!queue.isProcessing && now - queue.lastActivity > tenMinutes) {
      console.log(`🧹 [CLEANUP] 비활성 큐 정리: ${key} (대기 작업: ${queue.tasks.length})`);
      businessUploadQueues.delete(key);
    }
  }
}

// 고유 요청 ID 생성
function generateRequestId(): string {
  globalUploadCounter.count++;
  return `${Date.now()}-${globalUploadCounter.count.toString().padStart(3, '0')}-${Math.random().toString(36).substr(2, 6)}`;
}

// 파일 해시값 계산
async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

// 사업장명과 시스템 타입으로 폴더 해시 생성
function generateFolderHash(businessName: string, systemType: string): string {
  const hash = createHash('sha256');
  hash.update(`${businessName}-${systemType}-${Date.now()}`);
  return hash.digest('hex').substring(0, 16); // 16자리로 축약
}

// 폴더의 기존 파일들 해시 캐시 구축
async function buildFileHashCache(drive: any, folderId: string): Promise<Set<string>> {
  const hashCache = new Set<string>();
  
  try {
    console.log(`🔍 [HASH] 폴더 내 기존 파일 해시 캐시 구축 시작: ${folderId}`);
    
    // 폴더 내 모든 파일 조회 (재귀적으로 하위 폴더까지)
    const allFiles = await getAllFilesRecursive(drive, folderId);
    
    for (const file of allFiles) {
      // Google Drive에서 파일 메타데이터에 해시가 있으면 사용
      if (file.md5Checksum) {
        hashCache.add(file.md5Checksum);
        console.log(`💾 [HASH] 캐시 추가 (MD5): ${file.name} -> ${file.md5Checksum.substring(0, 8)}...`);
      }
      
      // 파일명에서 해시값 추출 시도 (우리가 저장한 파일인 경우)
      const hashFromName = extractHashFromFileName(file.name);
      if (hashFromName) {
        hashCache.add(hashFromName);
        console.log(`💾 [HASH] 캐시 추가 (이름): ${file.name} -> ${hashFromName.substring(0, 8)}...`);
      }
    }
    
    console.log(`✅ [HASH] 해시 캐시 구축 완료: ${hashCache.size}개 파일`);
    return hashCache;
    
  } catch (error) {
    console.error(`❌ [HASH] 해시 캐시 구축 실패:`, error);
    return hashCache; // 빈 캐시 반환
  }
}

// 폴더 내 모든 파일 재귀 조회
async function getAllFilesRecursive(drive: any, folderId: string, allFiles: any[] = []): Promise<any[]> {
  try {
    const response = await drive.files.list({
      q: `parents in '${folderId}' and trashed=false`,
      fields: 'files(id, name, mimeType, md5Checksum, size)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const items = response.data.files || [];
    
    for (const item of items) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        // 하위 폴더 재귀 탐색
        await getAllFilesRecursive(drive, item.id, allFiles);
      } else if (item.mimeType?.startsWith('image/')) {
        // 이미지 파일만 추가
        allFiles.push(item);
      }
    }
    
    return allFiles;
  } catch (error) {
    console.error(`❌ [HASH] 파일 조회 실패: ${folderId}`, error);
    return allFiles;
  }
}

// 파일명에서 해시값 추출 (파일명에 해시가 포함된 경우)
function extractHashFromFileName(fileName: string): string | null {
  // 파일명 패턴: businessName_typeFolder_facilityName_fileNumber_timestamp_HASH.extension
  const parts = fileName.split('_');
  if (parts.length >= 6) {
    const hashPart = parts[parts.length - 1]; // 마지막 파트 (HASH.extension)
    const hashMatch = hashPart.match(/^([a-f0-9]{8,64})\./i); // 8-64자리 hex
    return hashMatch ? hashMatch[1] : null;
  }
  return null;
}

// 문자열 유사도 계산 함수
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// 레벤슈타인 거리 계산
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// 파일 타입 표시명 매핑
function getFileTypeDisplayName(fileType: string): string {
  const typeMap: Record<string, string> = {
    'basic': '기본시설',
    'discharge': '배출시설', 
    'prevention': '방지시설'
  };
  return typeMap[fileType] || fileType;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  
  try {
    console.log(`📤 [UPLOAD] 업로드 요청 수신 (Request ID: ${requestId})`);

    // 폼 데이터 파싱
    const formData = await request.formData();
    const businessName = formData.get('businessName') as string;
    const systemType = (formData.get('type') as 'completion' | 'presurvey') || 'presurvey';
    const files = formData.getAll('files') as File[];

    console.log(`📋 [UPLOAD] 요청 파라미터 (${requestId}):`, {
      businessName,
      systemType,
      fileCount: files.length,
      timestamp: new Date().toISOString(),
      queuePosition: await getQueuePosition(businessName)
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

    // 순차 처리를 위해 큐에 추가하고 Promise로 결과 대기
    return new Promise((resolve, reject) => {
      addToUploadQueue(businessName, {
        requestId,
        businessName,
        systemType,
        files,
        formData,
        resolve: (result) => resolve(NextResponse.json(result)),
        reject: (error) => resolve(NextResponse.json({
          success: false,
          message: error.message || '업로드 실패'
        }, { status: 500 })),
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error(`❌ [UPLOAD] 요청 처리 실패 (${requestId}):`, error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '요청 처리 실패'
    }, { status: 500 });
  }
}

// 큐 위치 조회
async function getQueuePosition(businessName: string): Promise<number> {
  const queue = businessUploadQueues.get(businessName);
  return queue ? queue.tasks.length + (queue.isProcessing ? 1 : 0) : 0;
}

// 업로드 큐에 작업 추가
function addToUploadQueue(businessName: string, task: UploadTask) {
  cleanupInactiveQueues();
  
  // 사업장별 큐 초기화
  if (!businessUploadQueues.has(businessName)) {
    businessUploadQueues.set(businessName, {
      isProcessing: false,
      tasks: [],
      fileHashCache: new Set<string>(), // 파일 해시 캐시 초기화
      lastActivity: Date.now()
    });
  }
  
  const queue = businessUploadQueues.get(businessName)!;
  queue.tasks.push(task);
  queue.lastActivity = Date.now();
  
  console.log(`📝 [QUEUE] 작업 추가: ${businessName} (Request: ${task.requestId}, 큐 길이: ${queue.tasks.length})`);
  
  // 큐가 비어있으면 즉시 처리 시작
  if (!queue.isProcessing) {
    processUploadQueue(businessName);
  }
}

// 업로드 큐 처리 (순차적)
async function processUploadQueue(businessName: string) {
  const queue = businessUploadQueues.get(businessName);
  if (!queue || queue.tasks.length === 0) {
    return;
  }
  
  queue.isProcessing = true;
  queue.lastActivity = Date.now();
  
  console.log(`🔄 [QUEUE] 큐 처리 시작: ${businessName} (대기 작업: ${queue.tasks.length})`);
  
  while (queue.tasks.length > 0) {
    const task = queue.tasks.shift()!;
    
    try {
      console.log(`⚡ [QUEUE] 작업 처리 시작: ${task.requestId} (남은 작업: ${queue.tasks.length})`);
      
      const result = await processUploadTask(task, queue);
      task.resolve(result);
      
      console.log(`✅ [QUEUE] 작업 완료: ${task.requestId}`);
      
    } catch (error) {
      console.error(`❌ [QUEUE] 작업 실패: ${task.requestId}`, error);
      task.reject(error);
    }
    
    queue.lastActivity = Date.now();
  }
  
  queue.isProcessing = false;
  console.log(`🏁 [QUEUE] 큐 처리 완료: ${businessName}`);
}

// 실제 업로드 작업 처리
async function processUploadTask(task: UploadTask, queue: BusinessQueue): Promise<any> {
  const { requestId, businessName, systemType, files, formData } = task;
  
  // FormData에서 필요한 정보 추출
  const fileType = formData.get('fileType') as string;
  const facilityInfo = formData.get('facilityInfo') as string;
  const uploadId = formData.get('uploadId') as string;
  
  console.log(`⚡ [TASK] 업로드 작업 처리: ${requestId} (파일 ${files.length}개)`);

  // 파일 해시 계산 및 중복 검사
  const fileHashInfos: Array<{file: File, hash: string}> = [];
  
  console.log(`🔐 [HASH] 파일 해시값 계산 시작 (${requestId}): ${files.length}개 파일`);
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`📱 [TASK] 파일 검증 및 해시 계산 (${requestId}) ${i + 1}/${files.length}:`, {
      name: file.name,
      size: file.size,
      type: file.type,
      sizeInMB: (file.size / (1024 * 1024)).toFixed(2)
    });

    if (file.size > 100 * 1024 * 1024) {
      throw new Error(`파일 크기 초과: ${file.name} (최대 100MB, 현재 ${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
    }

    // HEIC/HEIF 포맷도 허용
    const isValidImageType = file.type.startsWith('image/') || 
                            file.type.includes('heic') || 
                            file.type.includes('heif') ||
                            file.name.toLowerCase().endsWith('.heic') ||
                            file.name.toLowerCase().endsWith('.heif');

    if (!isValidImageType) {
      throw new Error(`지원하지 않는 파일 형식: ${file.name} (${file.type || '알 수 없음'})`);
    }
    
    // 파일 해시 계산
    const fileHash = await calculateFileHash(file);
    console.log(`🔐 [HASH] 파일 해시 계산 완료 (${requestId}): ${file.name} -> ${fileHash.substring(0, 12)}...`);
    
    // 캐시에서 중복 확인
    if (queue.fileHashCache.has(fileHash)) {
      console.warn(`🚫 [HASH] 중복 파일 감지 - 해시값 일치 (${requestId}):`, {
        파일명: file.name,
        해시: fileHash.substring(0, 12) + '...',
        크기: file.size,
        중복: true
      });
      throw new Error(`중복 파일이 감지되었습니다. 동일한 내용의 파일이 이미 업로드되었습니다: ${file.name}`);
    }
    
    fileHashInfos.push({ file, hash: fileHash });
  }
  
  console.log(`✅ [HASH] 모든 파일 해시 계산 및 중복 검사 완료 (${requestId})`);
  

  // 폴더 ID 확인
  const folderId = systemType === 'completion' 
    ? process.env.COMPLETION_FOLDER_ID 
    : process.env.PRESURVEY_FOLDER_ID;

  if (!folderId) {
    throw new Error('폴더 설정이 누락되었습니다.');
  }

  console.log(`📁 [TASK] 대상 폴더 ID (${requestId}): ${folderId}`);

  // Drive 클라이언트 생성
  const drive = await createOptimizedDriveClient();

  // 사업장 폴더 확인/생성 (큐에서 캐시된 폴더 ID 사용 가능)
  let businessFolderId = queue.currentFolderId;
  
  if (!businessFolderId) {
    console.log(`🔍 [TASK] 사업장 폴더 생성/확인 시작 (${requestId}): ${businessName}`);
    businessFolderId = await findOrCreateBusinessFolderSequential(drive, businessName, folderId);
    queue.currentFolderId = businessFolderId; // 캐시에 저장
    
    // 폴더 해시 생성 및 저장
    if (!queue.folderHash) {
      queue.folderHash = generateFolderHash(businessName, systemType);
      console.log(`🔐 [HASH] 폴더 해시 생성 (${requestId}): ${queue.folderHash.substring(0, 8)}...`);
    }
    
    // 기존 파일들의 해시 캐시 구축 (캐시가 비어있는 경우)
    if (queue.fileHashCache.size === 0) {
      console.log(`🔍 [HASH] 기존 파일 해시 캐시 구축 시작 (${requestId})`);
      queue.fileHashCache = await buildFileHashCache(drive, businessFolderId);
      console.log(`✅ [HASH] 해시 캐시 구축 완료 (${requestId}): ${queue.fileHashCache.size}개 파일`);
    }
    
    console.log(`✅ [TASK] 사업장 폴더 설정 완료 (${requestId}): ${businessName} -> ${businessFolderId}`);
  } else {
    console.log(`♻️ [TASK] 캐시된 폴더 ID 사용 (${requestId}): ${businessFolderId}`);
  }

  // 파일 업로드 (해시 정보 포함)
  const uploadResults = [];
  const uploadErrors = [];
  
  for (let i = 0; i < fileHashInfos.length; i++) {
    const { file, hash } = fileHashInfos[i];
    console.log(`📄 [TASK] 파일 업로드 중 (${requestId}) ${i + 1}/${fileHashInfos.length}: ${file.name}`);
    
    try {
      const result = await uploadSingleFileWithHash(
        drive, 
        file, 
        hash,
        businessFolderId, 
        fileType, 
        facilityInfo, 
        i + 1, 
        businessName,
        uploadId,
        queue.folderHash || ''
      );
      
      if (result) {
        uploadResults.push(result);
        // 업로드 성공 시 해시를 캐시에 추가
        queue.fileHashCache.add(hash);
        console.log(`✅ [TASK] 파일 업로드 성공 (${requestId}): ${result.name} (해시: ${hash.substring(0, 8)}...)`);
      }
    } catch (error: any) {
      const errorInfo = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileHash: hash.substring(0, 16) + '...',
        error: error instanceof Error ? error.message : String(error),
        requestId
      };
      uploadErrors.push(errorInfo);
      console.error(`❌ [TASK] 파일 업로드 실패 (${requestId}):`, errorInfo);
    }
  }

  console.log(`🎉 [TASK] 업로드 완료 (${requestId}): ${uploadResults.length}/${files.length} 성공`);

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

    // 결과 메시지 생성
    let message = `${uploadResults.length}장의 파일이 업로드되었습니다.`;
    if (uploadErrors.length > 0) {
      message += ` (${uploadErrors.length}장 실패)`;
    }

    return {
      success: uploadResults.length > 0,
      message,
      files: uploadResults,
      totalUploaded: uploadResults.length, // 클라이언트에서 기대하는 필드 추가
      stats: {
        total: files.length,
        success: uploadResults.length,
        failed: uploadErrors.length
      },
      errors: uploadErrors.length > 0 ? uploadErrors : undefined
    };

}

// 순차 처리용 사업장 폴더 확인/생성 (중복 방지 강화)
async function findOrCreateBusinessFolderSequential(drive: any, businessName: string, parentFolderId: string): Promise<string> {
  try {
    console.log(`📂 [SEQUENTIAL] 사업장 폴더 확인: ${businessName}`);

    // 1. 먼저 부모 폴더의 모든 하위 폴더를 조회해서 정확한 매칭
    console.log(`🔍 [SEQUENTIAL] 부모 폴더 내 모든 폴더 조회 (특수문자 대응)...`);
    const allFoldersResponse = await drive.files.list({
      q: `parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, createdTime)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: 'createdTime desc' // 최신 순으로 정렬
    });

    console.log(`🔍 [SEQUENTIAL] 조회된 폴더 수: ${allFoldersResponse.data.files?.length || 0}`);
    
    if (allFoldersResponse.data.files?.length > 0) {
      console.log(`🔍 [SEQUENTIAL] 발견된 모든 사업장 폴더들:`, 
        allFoldersResponse.data.files.map((f: any) => ({ 
          id: f.id, 
          name: f.name, 
          createdTime: f.createdTime,
          exactMatch: f.name === businessName 
        }))
      );

      // 정확히 일치하는 폴더 찾기
      const exactMatch = allFoldersResponse.data.files.find((f: any) => f.name === businessName);
      if (exactMatch) {
        console.log(`✅ [SEQUENTIAL] 정확히 일치하는 기존 폴더 발견: ${businessName} (ID: ${exactMatch.id})`);
        
        // 기존 폴더에서도 하위 폴더 확인/생성
        await ensureSubFolders(drive, exactMatch.id);
        
        return exactMatch.id;
      }
    }

    // 새 폴더 생성 (공유 드라이브 지원)
    console.log(`📂 [SEQUENTIAL] 새 폴더 생성: ${businessName}`);
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
    console.log(`✅ [SEQUENTIAL] 폴더 생성 완료: ${businessFolderId}`);

    // 하위 폴더 확인/생성
    await ensureSubFolders(drive, businessFolderId);

    return businessFolderId;

  } catch (error: any) {
    console.error('❌ [SEQUENTIAL] 폴더 처리 실패:', error);
    throw new Error(`순차 폴더 처리 실패: ${error.message}`);
  }
}

// 하위 폴더 확인/생성 함수
async function ensureSubFolders(drive: any, businessFolderId: string): Promise<void> {
  const subFolders = ['기본사진', '배출시설', '방지시설'];
  for (const subFolder of subFolders) {
    try {
      // 기존 하위 폴더 검색
      const subFolderSearch = await drive.files.list({
        q: `name='${subFolder}' and parents in '${businessFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      if (subFolderSearch.data.files?.length > 0) {
        console.log(`✅ [UPLOAD] 기존 하위 폴더 사용: ${subFolder}`);
      } else {
        // 하위 폴더가 없으면 생성
        await drive.files.create({
          requestBody: {
            name: subFolder,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [businessFolderId]
          },
          supportsAllDrives: true
        });
        console.log(`📁 [UPLOAD] 새 하위 폴더 생성: ${subFolder}`);
      }
    } catch (error) {
      console.warn(`⚠️ [UPLOAD] 하위 폴더 처리 실패: ${subFolder}`, error);
    }
  }
}


// 해시 기반 단일 파일 업로드 (공유 드라이브 지원)
async function uploadSingleFileWithHash(
  drive: any,
  file: File,
  fileHash: string,
  businessFolderId: string,
  fileType: string,
  facilityInfo: string,
  fileNumber: number,
  businessName: string,
  uploadId?: string,
  folderHash?: string
) {
  try {
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

    // 해시를 포함한 파일명 생성
    const fileName = generateFileNameWithHash(businessName, fileType, facilityInfo, fileNumber, file.name, file, fileHash, uploadId, folderHash);
    
    // 대상 폴더 확인
    const targetFolderId = await getTargetFolder(drive, businessFolderId, fileType);

    console.log(`🔐 [HASH] 해시 기반 업로드 시작:`, {
      fileName,
      fileHash: fileHash.substring(0, 12) + '...',
      folderHash: folderHash?.substring(0, 8) + '...' || 'none',
      targetFolderId: targetFolderId.substring(0, 20) + '...'
    });

    // 새 파일 업로드
    console.log(`📤 [UPLOAD] 새 파일 업로드: ${fileName}`);
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId]
      },
      media: {
        mimeType: file.type,
        body: readableStream
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });

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

    console.log(`✅ [HASH] 해시 기반 파일 업로드 완료: ${fileName} (해시: ${fileHash.substring(0, 8)}...)`);
    
    return {
      id: response.data.id,
      name: response.data.name,
      url: `https://drive.google.com/file/d/${response.data.id}/view`,
      downloadUrl: `https://drive.google.com/uc?id=${response.data.id}`,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${response.data.id}&sz=w300-h300-c`,
      publicUrl: `https://lh3.googleusercontent.com/d/${response.data.id}`,
      size: file.size,
      mimeType: file.type,
      fileHash: fileHash, // 업로드된 파일의 해시값
      folderHash: folderHash, // 폴더 해시값
      hashBasedUpload: true // 해시 기반 업로드 표시
    };

  } catch (error: any) {
    console.error(`❌ [UPLOAD] 파일 업로드 실패 (${file.name}):`, error);
    throw error;
  }
}

// 해시 기반 파일명 생성
function generateFileNameWithHash(
  businessName: string,
  fileType: string,
  facilityInfo: string,
  fileNumber: number,
  originalName: string,
  file: File,
  fileHash: string,
  uploadId?: string,
  folderHash?: string
): string {
  const timestamp = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
    .replace(/[:.]/g, '-')
    .slice(0, -5);
  
  // 모바일 파일 (특히 아이폰 HEIC) 확장자 정확한 결정
  let extension = 'jpg'; // 안전한 기본값
  
  console.log(`📱 [UPLOAD] 모바일 파일 상세 분석:`, {
    originalName: originalName || '이름없음',
    mimeType: file.type || '타입없음',
    size: file.size,
    sizeInMB: (file.size / (1024 * 1024)).toFixed(2),
    lastModified: new Date(file.lastModified).toISOString(),
    userAgent: 'iPhone/Safari 감지됨',
    hasExtension: originalName ? originalName.includes('.') : false,
    nameLength: originalName?.length || 0
  });
  
  // 아이폰 Safari 특별 처리: 파일명이나 MIME 타입이 손실된 경우
  let hasValidFileInfo = !!(originalName && originalName.includes('.') && file.type);
  
  console.log(`🔍 [UPLOAD] 파일 정보 유효성:`, {
    hasFileName: !!originalName,
    hasExtension: originalName ? originalName.includes('.') : false,
    hasMimeType: !!file.type,
    isValid: hasValidFileInfo
  });

  // 1순위: MIME 타입으로 확장자 결정
  if (file.type && file.type.trim() !== '') {
    const mimeToExt: Record<string, string> = {
      'image/webp': 'webp',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg', 
      'image/png': 'png',
      'image/gif': 'gif',
      'image/heic': 'jpg',  // HEIC → JPG (압축됨)
      'image/heif': 'jpg',  // HEIF → JPG (압축됨)
      'image/tiff': 'jpg',
      'image/bmp': 'jpg',
      'image/webm': 'jpg'
    };
    
    const normalizedType = file.type.toLowerCase().trim();
    if (mimeToExt[normalizedType]) {
      extension = mimeToExt[normalizedType];
      console.log(`✅ [UPLOAD] MIME 타입으로 확장자 결정:`, { type: normalizedType, extension });
    }
  }
  
  // 2순위: 파일명에서 확장자 추출
  if (originalName && originalName.includes('.')) {
    const extractedExt = originalName.split('.').pop()?.toLowerCase()?.trim();
    
    if (extractedExt) {
      const fileExtMap: Record<string, string> = {
        'heic': 'jpg',    // 아이폰 HEIC → JPG
        'heif': 'jpg',    // 아이폰 HEIF → JPG  
        'jpeg': 'jpg',    // JPEG → JPG 통일
        'jpg': 'jpg',
        'png': 'png',
        'gif': 'gif',
        'webp': 'webp',
        'tiff': 'jpg',
        'tif': 'jpg',
        'bmp': 'jpg',
        'jfif': 'jpg'     // 일부 카메라에서 사용
      };
      
      if (fileExtMap[extractedExt]) {
        // MIME 타입이 없거나 신뢰할 수 없을 때 파일명 우선 사용
        if (!file.type || file.type.trim() === '' || extension === 'jpg') {
          extension = fileExtMap[extractedExt];
          console.log(`✅ [UPLOAD] 파일명으로 확장자 결정:`, { fileName: originalName, extension });
        }
      }
    }
  }
  
  // 3순위: 압축 결과 기반 강제 결정
  if (file.type === 'image/webp' || originalName?.toLowerCase().endsWith('.webp')) {
    extension = 'webp';
    console.log(`✅ [UPLOAD] WebP 강제 인식`);
  }

  // 4순위: 최후의 수단 - 아이폰에서 파일 정보가 완전히 손실된 경우
  if (!hasValidFileInfo) {
    console.warn(`⚠️ [UPLOAD] 파일 정보 손실 감지, 강제 JPG 설정:`, {
      originalName: originalName || 'null',
      mimeType: file.type || 'null',
      size: file.size
    });
    extension = 'jpg'; // 가장 호환성 높은 형식으로 설정
  }
  
  console.log(`📷 [UPLOAD] 최종 확장자 결정:`, {
    original: originalName,
    mimeType: file.type || '없음',
    finalExtension: extension,
    reason: file.type ? `MIME타입(${file.type})` : '파일명분석'
  });
  
  // uploadId에서 시설 인덱스 추출 (예: "prevention-0" -> "방1", "discharge-2" -> "배3")
  let typeFolder = '기본사진';
  let facilityName = facilityInfo.split('-')[0] || facilityInfo;
  
  if (uploadId && (uploadId.startsWith('prevention-') || uploadId.startsWith('discharge-'))) {
    const parts = uploadId.split('-');
    if (parts.length >= 2) {
      const facilityIndex = parseInt(parts[1]) + 1; // 0-based를 1-based로 변경
      
      if (uploadId.startsWith('prevention-')) {
        typeFolder = `방${facilityIndex}`;
      } else if (uploadId.startsWith('discharge-')) {
        typeFolder = `배${facilityIndex}`;
      }
    }
  } else {
    // 기본 매핑 사용
    const typeMapping: Record<string, string> = {
      'basic': '기본사진',
      'discharge': '배출시설',
      'prevention': '방지시설'
    };
    typeFolder = typeMapping[fileType] || '기본사진';
  }
  
  // 해시값을 8자리로 축약 (고유성 보장하면서 파일명 단축)
  const shortHash = fileHash.substring(0, 8);
  const shortFolderHash = folderHash ? folderHash.substring(0, 4) : '';
  
  const safeName = [
    businessName,
    typeFolder,
    facilityName,
    `${fileNumber}번째`,
    timestamp,
    shortHash, // 파일 해시 (중복 검사용)
    shortFolderHash // 폴더 해시 (폴더 식별용)
  ]
    .map(part => part.replace(/[\/\\:*?"<>|]/g, '_').trim())
    .filter(Boolean)
    .join('_');
  
  console.log(`📝 [HASH] 해시 포함 파일명 생성:`, {
    original: originalName,
    generated: `${safeName}.${extension}`,
    fileHash: shortHash,
    folderHash: shortFolderHash || 'none'
  });
  
  return `${safeName}.${extension}`;
}

// 폴더별 생성 중인 상태 추적 (중복 생성 방지)
const folderCreationInProgress = new Map<string, Promise<string>>();

// 대상 폴더 확인 (중복 생성 방지 포함)
async function getTargetFolder(drive: any, businessFolderId: string, fileType: string): Promise<string> {
  const subFolderMapping: Record<string, string> = {
    'basic': '기본사진',
    'discharge': '배출시설',
    'prevention': '방지시설'
  };
  
  const subFolderName = subFolderMapping[fileType];
  console.log(`📁 [UPLOAD] 대상 폴더 확인:`, { fileType, subFolderName, businessFolderId });
  
  // 1. 먼저 모든 하위 폴더 확인
  console.log(`🔍 [UPLOAD] 사업장 폴더 내 모든 하위 폴더 조회...`);
  try {
    const allSubFolders = await drive.files.list({
      q: `parents in '${businessFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 20,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    if (allSubFolders.data.files?.length > 0) {
      console.log(`🔍 [UPLOAD] 발견된 모든 하위 폴더:`, 
        allSubFolders.data.files.map((f: any) => ({ 
          id: f.id, 
          name: f.name, 
          matches: f.name === subFolderName 
        }))
      );
    } else {
      console.log(`🔍 [UPLOAD] 하위 폴더 없음, 모두 생성 필요`);
    }
  } catch (error) {
    console.warn(`⚠️ [UPLOAD] 하위 폴더 목록 조회 실패:`, error);
  }
  
  if (!subFolderName) {
    console.log(`📁 [UPLOAD] 알 수 없는 파일 타입, 상위 폴더 사용: ${fileType}`);
    return businessFolderId;
  }
  
  // 중복 생성 방지를 위한 고유 키
  const folderKey = `${businessFolderId}-${subFolderName}`;
  
  // 이미 생성 중인 폴더가 있으면 기다리기
  if (folderCreationInProgress.has(folderKey)) {
    console.log(`⏳ [UPLOAD] 폴더 생성 대기 중: ${subFolderName}`);
    return await folderCreationInProgress.get(folderKey)!;
  }
  
  try {
    const searchQuery = `name='${subFolderName}' and parents in '${businessFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    console.log(`📁 [UPLOAD] 하위 폴더 검색 쿼리:`, searchQuery);
    
    const searchResponse = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name)',
      pageSize: 10, // 여러 개가 있을 수 있으니 좀 더 많이 가져옴
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    if (searchResponse.data.files?.length > 0) {
      const targetFolder = searchResponse.data.files[0];
      console.log(`✅ [UPLOAD] 하위 폴더 발견:`, { 
        name: targetFolder.name, 
        id: targetFolder.id,
        totalFound: searchResponse.data.files.length
      });
      
      // 중복된 폴더가 있으면 로그 남기기
      if (searchResponse.data.files.length > 1) {
        console.warn(`⚠️ [UPLOAD] 중복 폴더 발견:`, {
          folderName: subFolderName,
          count: searchResponse.data.files.length,
          folders: searchResponse.data.files.map((f: any) => ({ id: f.id, name: f.name }))
        });
      }
      
      return targetFolder.id!;
    } else {
      console.log(`📂 [UPLOAD] 하위 폴더 없음, 새로 생성: ${subFolderName}`);
      
      // 폴더 생성을 Promise로 래핑하여 중복 방지
      const createPromise = (async (): Promise<string> => {
        try {
          // 생성 직전에 다시 한번 확인 (Race condition 방지)
          const doubleCheckResponse = await drive.files.list({
            q: searchQuery,
            fields: 'files(id, name)',
            pageSize: 1,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
          });
          
          if (doubleCheckResponse.data.files?.length > 0) {
            console.log(`🔄 [UPLOAD] 중복 생성 방지: 다른 요청에서 이미 생성됨`, subFolderName);
            return doubleCheckResponse.data.files[0].id!;
          }
          
          const createResponse = await drive.files.create({
            requestBody: {
              name: subFolderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [businessFolderId]
            },
            fields: 'id, name',
            supportsAllDrives: true
          });
          
          const newFolderId = createResponse.data.id!;
          console.log(`✅ [UPLOAD] 하위 폴더 생성 완료:`, { name: subFolderName, id: newFolderId });
          return newFolderId;
        } catch (createError) {
          console.error(`❌ [UPLOAD] 하위 폴더 생성 실패: ${subFolderName}`, createError);
          console.log(`📁 [UPLOAD] 폴백: 상위 폴더 사용`);
          return businessFolderId;
        } finally {
          // 생성 완료 후 상태 제거
          folderCreationInProgress.delete(folderKey);
        }
      })();
      
      // 생성 중 상태 등록
      folderCreationInProgress.set(folderKey, createPromise);
      return await createPromise;
    }
  } catch (error) {
    console.error(`❌ [UPLOAD] 하위 폴더 검색 실패: ${subFolderName}`, error);
    folderCreationInProgress.delete(folderKey);
  }
  
  console.log(`📁 [UPLOAD] 최종 대상 폴더: 상위 폴더 (${businessFolderId})`);
  return businessFolderId;
}
