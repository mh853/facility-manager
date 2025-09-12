// hooks/useOptimisticUpload.ts
// Optimistic UI를 위한 업로드 상태 관리 훅

import { useState, useCallback, useRef } from 'react';
import { uploadWithProgress, uploadMultipleWithProgress, createImagePreview, UploadProgress } from '@/utils/upload-with-progress';

export interface OptimisticPhoto {
  id: string; // temp-${timestamp}-${random}
  status: 'preparing' | 'uploading' | 'uploaded' | 'error' | 'cancelled' | 'duplicate';
  progress: number; // 0-100
  file: File;
  localPreview?: string; // data URL or blob URL
  uploadedData?: any; // 서버에서 반환된 업로드 결과
  error?: string;
  retryCount: number;
  startTime: number;
  endTime?: number;
  abortController?: AbortController;
  duplicateInfo?: {
    existingFile: string;
    uploadDate: string;
    hash: string;
  };
}

export interface UploadQueueStats {
  total: number;
  completed: number;
  uploading: number;
  pending: number;
  failed: number;
  cancelled: number;
  duplicates: number;
}

interface UseOptimisticUploadOptions {
  maxConcurrency?: number; // 동시 업로드 수 (기본: 3)
  maxRetries?: number; // 최대 재시도 횟수 (기본: 2)
  autoRetry?: boolean; // 자동 재시도 여부 (기본: false)
}

export function useOptimisticUpload(options: UseOptimisticUploadOptions = {}) {
  const {
    maxConcurrency = 3,
    maxRetries = 2,
    autoRetry = false
  } = options;

  const [photos, setPhotos] = useState<OptimisticPhoto[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const queueRef = useRef<OptimisticPhoto[]>([]);
  const processingRef = useRef<Set<string>>(new Set());

  // 고유 ID 생성
  const generateId = useCallback(() => {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // 큐 통계 계산
  const getQueueStats = useCallback((): UploadQueueStats => {
    const total = photos.length;
    const completed = photos.filter(p => p.status === 'uploaded').length;
    const uploading = photos.filter(p => p.status === 'uploading').length;
    const pending = photos.filter(p => p.status === 'preparing').length;
    const failed = photos.filter(p => p.status === 'error').length;
    const cancelled = photos.filter(p => p.status === 'cancelled').length;
    const duplicates = photos.filter(p => p.status === 'duplicate').length;

    return { total, completed, uploading, pending, failed, cancelled, duplicates };
  }, [photos]);

  // 사진 미리보기 생성
  const createPreview = useCallback(async (file: File): Promise<string | undefined> => {
    try {
      return await createImagePreview(file);
    } catch (error) {
      console.warn(`⚠️ [PREVIEW] 미리보기 생성 실패: ${file.name}`, error);
      return undefined;
    }
  }, []);

  // 파일 추가 (즉시 UI에 표시)
  const addFiles = useCallback(async (
    files: File[],
    additionalDataFactory: (file: File, index: number) => Record<string, string>
  ) => {
    console.log(`➕ [OPTIMISTIC] ${files.length}개 파일 즉시 UI 추가`);
    
    const newPhotos: OptimisticPhoto[] = [];
    
    // 각 파일을 즉시 UI에 추가
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = generateId();
      const localPreview = await createPreview(file);
      
      const optimisticPhoto: OptimisticPhoto = {
        id,
        status: 'preparing',
        progress: 0,
        file,
        localPreview,
        retryCount: 0,
        startTime: Date.now(),
        abortController: new AbortController()
      };
      
      newPhotos.push(optimisticPhoto);
    }

    // UI 즉시 업데이트
    setPhotos(prev => [...prev, ...newPhotos]);
    queueRef.current.push(...newPhotos);
    
    // 업로드 프로세스 시작
    processQueue(additionalDataFactory);
    
    return newPhotos.map(p => p.id);
  }, [generateId, createPreview]);

  // 큐 처리 (병렬 업로드)
  const processQueue = useCallback(async (
    additionalDataFactory: (file: File, index: number) => Record<string, string>
  ) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    console.log(`🔄 [QUEUE] 큐 처리 시작, 대기중: ${queueRef.current.length}개`);
    
    // 준비 상태인 파일들만 처리
    const readyPhotos = queueRef.current.filter(p => 
      p.status === 'preparing' && !processingRef.current.has(p.id)
    );
    
    if (readyPhotos.length === 0) {
      setIsProcessing(false);
      return;
    }
    
    // 동시 업로드 제한
    const batchSize = Math.min(readyPhotos.length, maxConcurrency);
    const batch = readyPhotos.slice(0, batchSize);
    
    console.log(`🚀 [BATCH] ${batch.length}개 파일 병렬 업로드 시작`);
    
    // 배치 상태를 업로드 중으로 변경
    batch.forEach(photo => {
      processingRef.current.add(photo.id);
      updatePhoto(photo.id, { status: 'uploading', progress: 0 });
    });
    
    // 병렬 업로드 실행
    const uploadPromises = batch.map(async (photo, index) => {
      try {
        const response = await uploadWithProgress(
          photo.file,
          additionalDataFactory(photo.file, index),
          {
            onProgress: (progress) => {
              updatePhoto(photo.id, { 
                progress: progress.percent 
              });
            },
            signal: photo.abortController?.signal
          }
        );
        
        // 🚀 FIX: FileContext 업데이트 성공 후에만 완료 상태 설정
        let syncSuccess = false;
        
        // FileContext 즉시 업데이트 시도
        if (response.files && response.files.length > 0) {
          try {
            const fileContextEvent = new CustomEvent('progressiveUploadComplete', {
              detail: {
                uploadedFiles: response.files,
                photoId: photo.id
              }
            });
            window.dispatchEvent(fileContextEvent);
            console.log(`🔄 [INSTANT-SYNC] FileContext 즉시 업데이트 이벤트 발송: ${photo.file.name}`);
            syncSuccess = true;
          } catch (error) {
            console.warn('⚠️ [INSTANT-SYNC] 즉시 동기화 실패:', error);
          }
        }
        
        // 성공 시 상태 업데이트 - FileContext 동기화 성공 여부에 따라
        updatePhoto(photo.id, {
          status: syncSuccess ? 'uploaded' : 'error',
          progress: syncSuccess ? 100 : 95, // 동기화 실패 시 95%로 표시
          uploadedData: response,
          endTime: Date.now(),
          error: syncSuccess ? undefined : '이미지 동기화 대기 중...'
        });
        
        console.log(`${syncSuccess ? '✅' : '⚠️'} [UPLOAD-${syncSuccess ? 'SUCCESS' : 'SYNC-PENDING'}] ${photo.file.name} ${syncSuccess ? '완료' : '동기화 대기'}`);
        
        // 동기화 실패 시 재시도 메커니즘 (3초 후)
        if (!syncSuccess && response.files && response.files.length > 0) {
          setTimeout(() => {
            try {
              const retryEvent = new CustomEvent('progressiveUploadComplete', {
                detail: {
                  uploadedFiles: response.files,
                  photoId: photo.id
                }
              });
              window.dispatchEvent(retryEvent);
              
              // 재시도 성공으로 간주하고 완료 상태로 변경
              updatePhoto(photo.id, {
                status: 'uploaded',
                progress: 100,
                error: undefined
              });
              console.log(`✅ [SYNC-RETRY-SUCCESS] ${photo.file.name} 재시도 동기화 완료`);
            } catch (retryError) {
              console.warn('⚠️ [SYNC-RETRY-FAILED] 재시도 동기화 실패:', retryError);
            }
          }, 3000);
        }
        
        return { photo, response, error: null };
        
      } catch (error) {
        const uploadError = error instanceof Error ? error : new Error(String(error));
        
        // 응답 파싱하여 중복 파일 확인
        let isDuplicate = false;
        let duplicateInfo = null;
        
        try {
          if (uploadError.message.includes('동일한 파일이')) {
            const response = await fetch('/api/upload-supabase', {
              method: 'POST', 
              body: new FormData() // 임시로 빈 폼데이터
            });
            const result = await response.json();
            if (result.isDuplicate) {
              isDuplicate = true;
              duplicateInfo = result.duplicateInfo;
            }
          }
        } catch (parseError) {
          // 파싱 실패 시 일반 에러로 처리
        }
        
        if (isDuplicate) {
          // 중복 파일 상태 업데이트
          updatePhoto(photo.id, {
            status: 'duplicate',
            error: undefined,
            duplicateInfo,
            endTime: Date.now()
          });
          
          console.log(`🔄 [DUPLICATE] ${photo.file.name} 중복 파일 감지`);
        } else {
          // 일반 에러 상태 업데이트
          updatePhoto(photo.id, {
            status: 'error',
            error: uploadError.message,
            endTime: Date.now()
          });
          
          console.error(`❌ [UPLOAD-ERROR] ${photo.file.name}:`, uploadError.message);
        }
        
        // 자동 재시도 로직
        if (autoRetry && photo.retryCount < maxRetries) {
          setTimeout(() => {
            retryUpload(photo.id, additionalDataFactory);
          }, Math.pow(2, photo.retryCount) * 1000); // 지수 백오프
        }
        
        return { photo, response: null, error: uploadError };
      } finally {
        processingRef.current.delete(photo.id);
        // 큐에서 제거
        queueRef.current = queueRef.current.filter(p => p.id !== photo.id);
      }
    });
    
    await Promise.all(uploadPromises);
    
    // 다음 배치 처리
    if (queueRef.current.length > 0) {
      setTimeout(() => processQueue(additionalDataFactory), 100);
    } else {
      setIsProcessing(false);
      console.log(`🏁 [QUEUE] 모든 업로드 완료`);
    }
  }, [isProcessing, maxConcurrency, maxRetries, autoRetry]);

  // 개별 사진 상태 업데이트
  const updatePhoto = useCallback((id: string, updates: Partial<OptimisticPhoto>) => {
    setPhotos(prev => prev.map(photo => 
      photo.id === id ? { ...photo, ...updates } : photo
    ));
  }, []);

  // 업로드 재시도
  const retryUpload = useCallback((id: string, additionalDataFactory: (file: File, index: number) => Record<string, string>) => {
    const photo = photos.find(p => p.id === id);
    if (!photo || photo.retryCount >= maxRetries) return;
    
    console.log(`🔄 [RETRY] ${photo.file.name} 재시도 (${photo.retryCount + 1}/${maxRetries})`);
    
    updatePhoto(id, {
      status: 'preparing',
      progress: 0,
      error: undefined,
      retryCount: photo.retryCount + 1,
      abortController: new AbortController()
    });
    
    queueRef.current.push(photo);
    
    // 🚀 FIX: 재시도 시 큐 프로세싱 시작
    processQueue(additionalDataFactory);
  }, [photos, maxRetries, updatePhoto, processQueue]);

  // 업로드 취소
  const cancelUpload = useCallback((id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;
    
    console.log(`🚫 [CANCEL] ${photo.file.name} 업로드 취소`);
    
    photo.abortController?.abort();
    updatePhoto(id, { status: 'cancelled' });
    
    // 큐에서 제거
    queueRef.current = queueRef.current.filter(p => p.id !== id);
    processingRef.current.delete(id);
  }, [photos, updatePhoto]);

  // 완료된 업로드 정리
  const clearCompleted = useCallback(() => {
    setPhotos(prev => prev.filter(photo => 
      photo.status !== 'uploaded' && photo.status !== 'cancelled'
    ));
  }, []);

  // 모든 업로드 취소
  const cancelAll = useCallback(() => {
    photos.forEach(photo => {
      if (photo.status === 'uploading' || photo.status === 'preparing') {
        photo.abortController?.abort();
      }
    });
    
    setPhotos([]);
    queueRef.current = [];
    processingRef.current.clear();
    setIsProcessing(false);
  }, [photos]);

  // 강제 업로드 (중복 파일을 무시하고 업로드)
  const forceUpload = useCallback(async (id: string, additionalDataFactory: (file: File, index: number) => Record<string, string>) => {
    const photo = photos.find(p => p.id === id);
    if (!photo || photo.status !== 'duplicate') return;
    
    console.log(`🚀 [FORCE-UPLOAD] ${photo.file.name} 강제 업로드 시작`);
    
    updatePhoto(id, {
      status: 'uploading',
      progress: 0,
      error: undefined,
      duplicateInfo: undefined,
      abortController: new AbortController()
    });
    
    try {
      const response = await uploadWithProgress(
        photo.file,
        { ...additionalDataFactory(photo.file, 0), forceUpload: 'true' },
        {
          onProgress: (progress) => {
            updatePhoto(id, { progress: progress.percent });
          },
          signal: photo.abortController?.signal
        }
      );
      
      // 성공 시 상태 업데이트
      updatePhoto(id, {
        status: 'uploaded',
        progress: 100,
        uploadedData: response,
        endTime: Date.now()
      });
      
      console.log(`✅ [FORCE-UPLOAD-SUCCESS] ${photo.file.name} 강제 업로드 완료`);
    } catch (error) {
      const uploadError = error instanceof Error ? error : new Error(String(error));
      
      updatePhoto(id, {
        status: 'error',
        error: uploadError.message,
        endTime: Date.now()
      });
      
      console.error(`❌ [FORCE-UPLOAD-ERROR] ${photo.file.name}:`, uploadError.message);
    }
  }, [photos, updatePhoto]);

  // 즉시 삭제 (UI에서 제거)
  const removePhoto = useCallback((id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;
    
    console.log(`🗑️ [REMOVE] ${photo.file.name} UI에서 즉시 제거`);
    
    // 업로드 중이면 취소
    if (photo.status === 'uploading') {
      photo.abortController?.abort();
    }
    
    // 미리보기 URL 정리
    if (photo.localPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(photo.localPreview);
    }
    
    setPhotos(prev => prev.filter(p => p.id !== id));
    queueRef.current = queueRef.current.filter(p => p.id !== id);
    processingRef.current.delete(id);
  }, [photos]);

  // SmartFloatingProgress를 위한 데이터 제공
  const getSmartProgressData = useCallback(() => {
    const stats = getQueueStats();
    const uploadingPhoto = photos.find(p => p.status === 'uploading');
    const overallProgress = stats.total > 0 
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;

    return {
      isVisible: isProcessing || stats.total > 0,
      totalFiles: stats.total,
      completedFiles: stats.completed,
      currentFileName: uploadingPhoto?.file.name,
      overallProgress: overallProgress
    };
  }, [photos, isProcessing, getQueueStats]);

  return {
    photos,
    queueStats: getQueueStats(),
    isProcessing,
    addFiles,
    retryUpload,
    cancelUpload,
    removePhoto,
    clearCompleted,
    cancelAll,
    forceUpload,
    // SmartFloatingProgress를 위한 데이터
    getSmartProgressData
  };
}