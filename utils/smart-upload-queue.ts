// utils/smart-upload-queue.ts
// 시설별 독립 처리를 위한 스마트 업로드 큐 시스템

import { compressImages, CompressionResult, calculateFileHash } from './client-image-processor';
import { uploadWithProgress, UploadResponse } from './upload-with-progress';

export interface QueuedUpload {
  id: string;
  facilityId: string;
  facilityName: string;
  files: File[];
  metadata: Record<string, string>;
  status: 'queued' | 'compressing' | 'uploading' | 'completed' | 'failed';
  progress: number;
  startTime?: number;
  completedTime?: number;
  results?: UploadResponse[];
  error?: string;
}

export interface UploadQueueStats {
  totalUploads: number;
  queuedUploads: number;
  activeUploads: number;
  completedUploads: number;
  failedUploads: number;
  totalFiles: number;
  uploadedFiles: number;
  averageUploadTime: number;
}

export class SmartUploadQueue {
  private queue: Map<string, QueuedUpload> = new Map();
  private activeUploads: Set<string> = new Set();
  private maxConcurrentUploads: number = 2; // 시설별 동시 업로드 제한
  private compressionEnabled: boolean = true;
  private listeners: Map<string, (upload: QueuedUpload) => void> = new Map();
  private globalListeners: ((stats: UploadQueueStats) => void)[] = [];

  constructor(options: {
    maxConcurrentUploads?: number;
    compressionEnabled?: boolean;
  } = {}) {
    this.maxConcurrentUploads = options.maxConcurrentUploads || 2;
    this.compressionEnabled = options.compressionEnabled ?? true;
    
    console.log(`🎯 [SMART-QUEUE] 업로드 큐 초기화:`, {
      maxConcurrentUploads: this.maxConcurrentUploads,
      compressionEnabled: this.compressionEnabled
    });
  }

  /**
   * 업로드 작업을 큐에 추가
   */
  addUpload(
    facilityId: string,
    facilityName: string,
    files: File[],
    metadata: Record<string, string>
  ): string {
    const uploadId = `${facilityId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    const queuedUpload: QueuedUpload = {
      id: uploadId,
      facilityId,
      facilityName,
      files: [...files],
      metadata: { ...metadata },
      status: 'queued',
      progress: 0
    };

    this.queue.set(uploadId, queuedUpload);
    
    console.log(`📥 [SMART-QUEUE] 업로드 큐에 추가:`, {
      uploadId,
      facilityName,
      fileCount: files.length,
      queueSize: this.queue.size
    });

    // 리스너들에게 상태 변경 알림
    this.notifyListeners(uploadId);
    this.notifyGlobalListeners();

    // 즉시 처리 시도
    this.processQueue();

    return uploadId;
  }

  /**
   * 큐 처리 (비동기)
   */
  private async processQueue(): Promise<void> {
    // 활성 업로드 수가 최대치에 도달했으면 대기
    if (this.activeUploads.size >= this.maxConcurrentUploads) {
      return;
    }

    // 대기 중인 업로드 찾기
    const queuedUploads = Array.from(this.queue.values())
      .filter(upload => upload.status === 'queued')
      .sort((a, b) => {
        // 시설별 우선순위: 파일 수가 적은 것 먼저
        return a.files.length - b.files.length;
      });

    if (queuedUploads.length === 0) {
      return;
    }

    const nextUpload = queuedUploads[0];
    await this.processUpload(nextUpload.id);
  }

  /**
   * 개별 업로드 처리
   */
  private async processUpload(uploadId: string): Promise<void> {
    const upload = this.queue.get(uploadId);
    if (!upload) return;

    this.activeUploads.add(uploadId);
    upload.startTime = Date.now();

    try {
      console.log(`🚀 [SMART-QUEUE] 업로드 처리 시작: ${upload.facilityName} (${upload.files.length}개 파일)`);

      // 1단계: 이미지 압축 (활성화된 경우)
      let finalFiles = upload.files;
      if (this.compressionEnabled) {
        upload.status = 'compressing';
        upload.progress = 10;
        this.notifyListeners(uploadId);

        const compressionResults = await compressImages(
          upload.files,
          {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.8,
            format: 'jpeg'
          },
          (completed, total) => {
            upload.progress = 10 + (completed / total) * 20; // 10-30%
            this.notifyListeners(uploadId);
          }
        );

        finalFiles = compressionResults.map(result => result.file);
        
        // 압축 통계 로깅
        const totalOriginal = compressionResults.reduce((sum, r) => sum + r.originalSize, 0);
        const totalCompressed = compressionResults.reduce((sum, r) => sum + r.compressedSize, 0);
        const savedSize = totalOriginal - totalCompressed;
        
        console.log(`🗜️ [SMART-QUEUE] 압축 완료: ${upload.facilityName}`, {
          originalSize: `${(totalOriginal/1024/1024).toFixed(2)}MB`,
          compressedSize: `${(totalCompressed/1024/1024).toFixed(2)}MB`,
          savedSize: `${(savedSize/1024/1024).toFixed(2)}MB`
        });
      }

      // 2단계: 실제 업로드
      upload.status = 'uploading';
      upload.progress = 30;
      this.notifyListeners(uploadId);

      const results: UploadResponse[] = [];
      
      // 파일별 개별 업로드 (진행률 추적)
      for (let i = 0; i < finalFiles.length; i++) {
        const file = finalFiles[i];
        const fileMetadata = {
          ...upload.metadata,
          fileName: file.name,
          fileIndex: (i + 1).toString()
        };

        try {
          const result = await uploadWithProgress(file, fileMetadata, {
            onProgress: (progress) => {
              // 개별 파일 진행률을 전체 진행률에 반영
              const fileBaseProgress = 30 + (i / finalFiles.length) * 60; // 30-90%
              const fileProgress = (progress.percent / 100) * (60 / finalFiles.length);
              upload.progress = Math.round(fileBaseProgress + fileProgress);
              this.notifyListeners(uploadId);
            }
          });

          results.push(result);
          
          console.log(`✅ [SMART-QUEUE] 파일 업로드 완료: ${file.name} (${i+1}/${finalFiles.length})`);
          
        } catch (fileError) {
          console.error(`❌ [SMART-QUEUE] 파일 업로드 실패: ${file.name}`, fileError);
          
          // 실패한 파일도 결과에 포함 (에러 정보와 함께)
          results.push({
            success: false,
            error: fileError instanceof Error ? fileError.message : String(fileError),
            message: `파일 업로드 실패: ${file.name}`
          });
        }
      }

      // 3단계: 완료 처리
      upload.status = 'completed';
      upload.progress = 100;
      upload.completedTime = Date.now();
      upload.results = results;

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      console.log(`🎯 [SMART-QUEUE] 업로드 완료: ${upload.facilityName}`, {
        총파일: finalFiles.length,
        성공: successCount,
        실패: failCount,
        처리시간: `${((upload.completedTime - upload.startTime!) / 1000).toFixed(1)}초`
      });

    } catch (error) {
      // 전체 업로드 실패
      upload.status = 'failed';
      upload.error = error instanceof Error ? error.message : String(error);
      upload.completedTime = Date.now();

      console.error(`🚨 [SMART-QUEUE] 업로드 실패: ${upload.facilityName}`, error);
    } finally {
      this.activeUploads.delete(uploadId);
      this.notifyListeners(uploadId);
      this.notifyGlobalListeners();

      // 다음 대기 중인 업로드 처리
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * 업로드 상태 리스너 등록
   */
  onUploadChange(uploadId: string, callback: (upload: QueuedUpload) => void): () => void {
    this.listeners.set(uploadId, callback);
    
    // 현재 상태 즉시 전달
    const upload = this.queue.get(uploadId);
    if (upload) {
      callback(upload);
    }

    // 리스너 해제 함수 반환
    return () => {
      this.listeners.delete(uploadId);
    };
  }

  /**
   * 전역 통계 리스너 등록
   */
  onStatsChange(callback: (stats: UploadQueueStats) => void): () => void {
    this.globalListeners.push(callback);
    
    // 현재 통계 즉시 전달
    callback(this.getStats());

    // 리스너 해제 함수 반환
    return () => {
      const index = this.globalListeners.indexOf(callback);
      if (index > -1) {
        this.globalListeners.splice(index, 1);
      }
    };
  }

  /**
   * 현재 큐 통계 조회
   */
  getStats(): UploadQueueStats {
    const uploads = Array.from(this.queue.values());
    const totalFiles = uploads.reduce((sum, upload) => sum + upload.files.length, 0);
    
    const completedUploads = uploads.filter(u => u.status === 'completed');
    const uploadedFiles = completedUploads.reduce((sum, upload) => {
      const successCount = upload.results?.filter(r => r.success).length || 0;
      return sum + successCount;
    }, 0);

    const completionTimes = completedUploads
      .filter(u => u.startTime && u.completedTime)
      .map(u => u.completedTime! - u.startTime!);
    
    const averageUploadTime = completionTimes.length > 0 
      ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length 
      : 0;

    return {
      totalUploads: uploads.length,
      queuedUploads: uploads.filter(u => u.status === 'queued').length,
      activeUploads: uploads.filter(u => ['compressing', 'uploading'].includes(u.status)).length,
      completedUploads: uploads.filter(u => u.status === 'completed').length,
      failedUploads: uploads.filter(u => u.status === 'failed').length,
      totalFiles,
      uploadedFiles,
      averageUploadTime
    };
  }

  /**
   * 특정 업로드 취소
   */
  cancelUpload(uploadId: string): boolean {
    const upload = this.queue.get(uploadId);
    if (!upload || upload.status === 'completed') {
      return false;
    }

    upload.status = 'failed';
    upload.error = '사용자에 의해 취소됨';
    upload.completedTime = Date.now();

    this.activeUploads.delete(uploadId);
    this.notifyListeners(uploadId);
    this.notifyGlobalListeners();

    console.log(`🚫 [SMART-QUEUE] 업로드 취소: ${upload.facilityName}`);
    return true;
  }

  /**
   * 큐 전체 초기화
   */
  clearQueue(): void {
    this.queue.clear();
    this.activeUploads.clear();
    this.notifyGlobalListeners();
    
    console.log(`🧹 [SMART-QUEUE] 큐 초기화 완료`);
  }

  private notifyListeners(uploadId: string): void {
    const upload = this.queue.get(uploadId);
    const listener = this.listeners.get(uploadId);
    
    if (upload && listener) {
      listener(upload);
    }
  }

  private notifyGlobalListeners(): void {
    const stats = this.getStats();
    this.globalListeners.forEach(listener => listener(stats));
  }
}

// 전역 싱글톤 인스턴스
export const smartUploadQueue = new SmartUploadQueue({
  maxConcurrentUploads: 2, // 시설별 동시 업로드 최대 2개
  compressionEnabled: true
});