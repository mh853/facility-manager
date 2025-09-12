// utils/upload-with-progress.ts
// XMLHttpRequest 기반 파일 업로드 (진행률 추적 지원)

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadResponse {
  success: boolean;
  message?: string;
  uploadedFiles?: any[];
  files?: any[]; // 추가: API 응답에서 files 속성도 지원
  error?: string;
  isDuplicate?: boolean;
  duplicateInfo?: {
    existingFile: string;
    uploadDate: string;
    hash: string;
  };
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal; // 업로드 취소 지원
}

/**
 * XMLHttpRequest 기반 파일 업로드 (진행률 추적)
 * @param file 업로드할 파일
 * @param formData 추가 폼 데이터
 * @param options 업로드 옵션 (진행률 콜백 등)
 * @returns Promise<UploadResponse>
 */
export function uploadWithProgress(
  file: File,
  additionalData: Record<string, string>,
  options: UploadOptions = {}
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    
    // 파일 및 추가 데이터 추가
    formData.append('file', file);
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // 업로드 진행률 추적
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && options.onProgress) {
        const progress: UploadProgress = {
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100)
        };
        options.onProgress(progress);
        
        console.log(`📊 [UPLOAD-PROGRESS] ${file.name}: ${progress.percent}% (${progress.loaded}/${progress.total} bytes)`);
      }
    });

    // 업로드 완료 처리
    xhr.addEventListener('load', () => {
      try {
        const response = JSON.parse(xhr.responseText) as UploadResponse;
        
        if (xhr.status === 200 && response.success) {
          console.log(`✅ [UPLOAD-SUCCESS] ${file.name} 업로드 완료`);
          options.onSuccess?.(response);
          resolve(response);
        } else {
          const error = new Error(response.message || `HTTP ${xhr.status}: 업로드 실패`);
          console.error(`❌ [UPLOAD-ERROR] ${file.name} 업로드 실패:`, error.message);
          options.onError?.(error);
          reject(error);
        }
      } catch (parseError) {
        const error = new Error(`응답 파싱 실패: ${xhr.responseText}`);
        console.error(`❌ [UPLOAD-PARSE-ERROR] ${file.name}:`, parseError);
        options.onError?.(error);
        reject(error);
      }
    });

    // 네트워크 오류 처리
    xhr.addEventListener('error', () => {
      const error = new Error(`네트워크 오류: ${file.name} 업로드 중 연결 문제 발생`);
      console.error(`❌ [UPLOAD-NETWORK-ERROR] ${file.name}:`, error.message);
      options.onError?.(error);
      reject(error);
    });

    // 업로드 취소 처리
    xhr.addEventListener('abort', () => {
      const error = new Error(`업로드 취소됨: ${file.name}`);
      console.log(`🚫 [UPLOAD-CANCELLED] ${file.name}`);
      options.onError?.(error);
      reject(error);
    });

    // 취소 신호 처리
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        xhr.abort();
      });
    }

    // 요청 시작
    console.log(`🚀 [UPLOAD-START] ${file.name} 업로드 시작 (${file.size} bytes)`);
    xhr.open('POST', '/api/upload-supabase');
    xhr.send(formData);
  });
}

/**
 * 여러 파일 병렬 업로드 (동시 업로드 수 제한)
 * @param files 업로드할 파일들
 * @param additionalDataFactory 각 파일별 추가 데이터 생성 함수
 * @param concurrency 동시 업로드 수 (기본: 3)
 * @param onFileProgress 개별 파일 진행률 콜백
 * @returns Promise<UploadResponse[]>
 */
export async function uploadMultipleWithProgress(
  files: File[],
  additionalDataFactory: (file: File, index: number) => Record<string, string>,
  concurrency: number = 3,
  onFileProgress?: (fileIndex: number, progress: UploadProgress) => void,
  onFileComplete?: (fileIndex: number, response: UploadResponse) => void,
  onFileError?: (fileIndex: number, error: Error) => void
): Promise<UploadResponse[]> {
  const results: UploadResponse[] = [];
  const errors: Error[] = [];
  
  console.log(`🔥 [BATCH-UPLOAD] ${files.length}개 파일 병렬 업로드 시작 (동시: ${concurrency}개)`);
  
  // 병렬 처리를 위한 청크 단위 처리
  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (file, chunkIndex) => {
      const globalIndex = i + chunkIndex;
      
      try {
        const response = await uploadWithProgress(
          file,
          additionalDataFactory(file, globalIndex),
          {
            onProgress: (progress) => onFileProgress?.(globalIndex, progress),
            onSuccess: (response) => onFileComplete?.(globalIndex, response),
            onError: (error) => onFileError?.(globalIndex, error)
          }
        );
        return { index: globalIndex, response, error: null };
      } catch (error) {
        const uploadError = error instanceof Error ? error : new Error(String(error));
        onFileError?.(globalIndex, uploadError);
        return { index: globalIndex, response: null, error: uploadError };
      }
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    
    // 결과 정리
    chunkResults.forEach(({ index, response, error }) => {
      if (response) {
        results[index] = response;
      } else if (error) {
        errors.push(error);
        console.error(`❌ [BATCH-UPLOAD-ERROR] 파일 ${index + 1}/${files.length}: ${error.message}`);
      }
    });
  }
  
  console.log(`📊 [BATCH-UPLOAD-COMPLETE] 완료: ${results.filter(r => r).length}개, 실패: ${errors.length}개`);
  
  return results;
}

/**
 * 이미지 파일 미리보기 생성
 * @param file 이미지 파일
 * @returns Promise<string> blob URL
 */
export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일이 아닙니다'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('미리보기 생성 실패'));
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
}

/**
 * 파일 크기 포맷팅
 * @param bytes 바이트 크기
 * @returns 포맷된 문자열 (예: "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}