// hooks/useAdvancedUpload.ts
// 고도화된 업로드 시스템을 위한 React 훅

import { useCallback, useEffect, useState } from 'react';
import { smartUploadQueue, QueuedUpload, UploadQueueStats } from '@/utils/smart-upload-queue';

export interface UseAdvancedUploadReturn {
  // 업로드 실행
  startUpload: (
    facilityId: string,
    facilityName: string,
    files: File[],
    metadata: Record<string, string>
  ) => string;
  
  // 상태 조회
  queueStats: UploadQueueStats;
  getUploadStatus: (uploadId: string) => QueuedUpload | undefined;
  
  // 제어 함수들
  cancelUpload: (uploadId: string) => boolean;
  clearQueue: () => void;
  
  // 설정
  setCompressionEnabled: (enabled: boolean) => void;
  setMaxConcurrency: (max: number) => void;
}

/**
 * 고도화된 업로드 시스템을 위한 React 훅
 */
export function useAdvancedUpload(): UseAdvancedUploadReturn {
  const [queueStats, setQueueStats] = useState<UploadQueueStats>({
    totalUploads: 0,
    queuedUploads: 0,
    activeUploads: 0,
    completedUploads: 0,
    failedUploads: 0,
    totalFiles: 0,
    uploadedFiles: 0,
    averageUploadTime: 0
  });

  const [uploadStatuses] = useState<Map<string, QueuedUpload>>(new Map());

  // 큐 통계 구독
  useEffect(() => {
    const unsubscribe = smartUploadQueue.onStatsChange((stats) => {
      setQueueStats(stats);
    });

    // 초기 상태 로드
    setQueueStats(smartUploadQueue.getStats());

    return unsubscribe;
  }, []);

  // 업로드 시작
  const startUpload = useCallback((
    facilityId: string,
    facilityName: string,
    files: File[],
    metadata: Record<string, string>
  ): string => {
    console.log(`🚀 [USE-ADVANCED-UPLOAD] 업로드 시작:`, {
      facilityId,
      facilityName,
      fileCount: files.length
    });

    // 큐에 업로드 추가
    const uploadId = smartUploadQueue.addUpload(facilityId, facilityName, files, metadata);

    // 개별 업로드 상태 구독
    const unsubscribe = smartUploadQueue.onUploadChange(uploadId, (upload) => {
      uploadStatuses.set(uploadId, upload);
      
      // 업로드 완료 시 상태 로깅
      if (upload.status === 'completed') {
        const successCount = upload.results?.filter(r => r.success).length || 0;
        const totalFiles = upload.files.length;
        
        console.log(`✅ [USE-ADVANCED-UPLOAD] 업로드 완료:`, {
          facilityName: upload.facilityName,
          성공: successCount,
          전체: totalFiles,
          처리시간: upload.startTime && upload.completedTime 
            ? `${((upload.completedTime - upload.startTime) / 1000).toFixed(1)}초`
            : 'N/A'
        });

        // 완료 후 일정 시간 후 구독 해제 (메모리 정리)
        setTimeout(() => {
          unsubscribe();
          uploadStatuses.delete(uploadId);
        }, 30000); // 30초 후
      }

      if (upload.status === 'failed') {
        console.error(`❌ [USE-ADVANCED-UPLOAD] 업로드 실패:`, {
          facilityName: upload.facilityName,
          error: upload.error
        });
      }
    });

    return uploadId;
  }, [uploadStatuses]);

  // 개별 업로드 상태 조회
  const getUploadStatus = useCallback((uploadId: string): QueuedUpload | undefined => {
    return uploadStatuses.get(uploadId);
  }, [uploadStatuses]);

  // 업로드 취소
  const cancelUpload = useCallback((uploadId: string): boolean => {
    const success = smartUploadQueue.cancelUpload(uploadId);
    
    if (success) {
      console.log(`🚫 [USE-ADVANCED-UPLOAD] 업로드 취소: ${uploadId}`);
    }
    
    return success;
  }, []);

  // 큐 전체 초기화
  const clearQueue = useCallback(() => {
    smartUploadQueue.clearQueue();
    uploadStatuses.clear();
    
    console.log(`🧹 [USE-ADVANCED-UPLOAD] 큐 초기화`);
  }, [uploadStatuses]);

  // 압축 기능 설정 (동적 변경)
  const setCompressionEnabled = useCallback((enabled: boolean) => {
    (smartUploadQueue as any).compressionEnabled = enabled;
    
    console.log(`⚙️ [USE-ADVANCED-UPLOAD] 압축 설정 변경: ${enabled ? '활성화' : '비활성화'}`);
  }, []);

  // 최대 동시성 설정 (동적 변경)
  const setMaxConcurrency = useCallback((max: number) => {
    if (max < 1 || max > 8) {
      console.warn(`⚠️ [USE-ADVANCED-UPLOAD] 잘못된 동시성 값: ${max}. 1-8 범위여야 합니다.`);
      return;
    }

    (smartUploadQueue as any).maxConcurrentUploads = max;
    
    console.log(`⚙️ [USE-ADVANCED-UPLOAD] 최대 동시성 변경: ${max}`);
  }, []);

  return {
    startUpload,
    queueStats,
    getUploadStatus,
    cancelUpload,
    clearQueue,
    setCompressionEnabled,
    setMaxConcurrency
  };
}

/**
 * 업로드 성능 통계를 위한 훅
 */
export function useUploadStats() {
  const [performanceStats, setPerformanceStats] = useState({
    totalUploads: 0,
    successRate: 0,
    averageSpeed: 0, // MB/s
    compressionSavings: 0, // bytes
    networkEfficiency: 0 // %
  });

  useEffect(() => {
    const unsubscribe = smartUploadQueue.onStatsChange((stats) => {
      const successRate = stats.totalUploads > 0 
        ? (stats.completedUploads / stats.totalUploads) * 100 
        : 0;

      setPerformanceStats(prev => ({
        ...prev,
        totalUploads: stats.totalUploads,
        successRate,
        averageSpeed: stats.averageUploadTime > 0 
          ? (1024 * 1024) / (stats.averageUploadTime / 1000) // 대략적인 MB/s
          : 0
      }));
    });

    return unsubscribe;
  }, []);

  return performanceStats;
}

/**
 * 편의성을 위한 단순화된 업로드 훅
 */
export function useSimpleUpload() {
  const { startUpload, queueStats } = useAdvancedUpload();

  const uploadFiles = useCallback((
    facilityName: string,
    files: File[],
    additionalMetadata?: Record<string, string>
  ) => {
    const facilityId = `facility_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const metadata = {
      facilityName,
      timestamp: new Date().toISOString(),
      ...additionalMetadata
    };

    return startUpload(facilityId, facilityName, files, metadata);
  }, [startUpload]);

  return {
    uploadFiles,
    isUploading: queueStats.activeUploads > 0 || queueStats.queuedUploads > 0,
    progress: queueStats.totalFiles > 0 
      ? Math.round((queueStats.uploadedFiles / queueStats.totalFiles) * 100)
      : 0
  };
}