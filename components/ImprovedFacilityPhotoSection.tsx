'use client';

// VERSION: 2025-09-11-08-27-CACHE-BUST-v4 🔥🔥🔥
// 🚨 EMERGENCY CACHE INVALIDATION - FORCE BROWSER RELOAD
// LAST MODIFIED: 2025-09-11T09:15:00Z - FORCE BROWSER RELOAD

import React, { useState, useCallback, useEffect, useRef, forwardRef } from 'react';
import { Camera, Upload, Factory, Shield, Building2, AlertCircle, Eye, Download, Trash2, RefreshCw, X, Zap, Router, Cpu, Plus, Grid, List, ChevronLeft, ChevronRight, Archive } from 'lucide-react';
import { FacilitiesData, Facility, UploadedFile } from '@/types';
import { createFacilityPhotoTracker, FacilityPhotoInfo, FacilityPhoto } from '@/utils/facility-photo-tracker';
import LazyImage from '@/components/ui/LazyImage';
import { useToast } from '@/contexts/ToastContext';
import { useFileContext } from '@/contexts/FileContext';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { deletedPhotoIdsAtom, deletePhotoAtom, undeletePhotoAtom, clearDeletedPhotosAtom } from '../stores/photo-atoms';

interface ImprovedFacilityPhotoSectionProps {
  businessName: string;
  facilities: FacilitiesData | null;
}

type ViewMode = 'grid' | 'list';

// Performance-optimized animated counter component
function AnimatedCounter({ value, duration = 1000, className = "" }: { 
  value: number; 
  duration?: number; 
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const startValueRef = useRef<number>(0);

  useEffect(() => {
    if (value === displayValue) return;

    setIsAnimating(true);
    startValueRef.current = displayValue;
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current!;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth easing function for natural animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = Math.round(
        startValueRef.current + (value - startValueRef.current) * easeOutCubic
      );

      setDisplayValue(currentValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration, displayValue]);

  return (
    <span className={`${className} ${isAnimating ? 'text-opacity-90' : ''} transition-opacity duration-200`}>
      {displayValue}
    </span>
  );
}

// Helper functions for user-friendly messages
const getUserFriendlyErrorMessage = (serverMessage: string): string => {
  if (serverMessage.includes('파일명: undefined') || serverMessage.includes('files')) {
    return '파일을 읽을 수 없습니다. 파일을 다시 선택해주세요.';
  }
  if (serverMessage.includes('network') || serverMessage.includes('connection')) {
    return '네트워크 연결이 불안정합니다. 인터넷 연결을 확인해주세요.';
  }
  if (serverMessage.includes('size') || serverMessage.includes('용량')) {
    return '파일 크기가 너무 큽니다. 더 작은 파일로 시도해주세요.';
  }
  if (serverMessage.includes('format') || serverMessage.includes('형식')) {
    return '지원하지 않는 파일 형식입니다. JPG, PNG 파일만 업로드 가능합니다.';
  }
  if (serverMessage.includes('permission') || serverMessage.includes('권한')) {
    return '업로드 권한이 없습니다. 관리자에게 문의해주세요.';
  }
  if (serverMessage.includes('storage') || serverMessage.includes('공간')) {
    return '저장 공간이 부족합니다. 관리자에게 문의해주세요.';
  }
  
  // 기본 사용자 친화적 메시지
  return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
};

const getCategoryDisplayName = (category: string): string => {
  switch (category) {
    case 'gateway': return '게이트웨이';
    case 'fan': return '송풍팬';
    case 'others': return '기타';
    default: return category;
  }
};

export default function ImprovedFacilityPhotoSection({ 
  businessName, 
  facilities 
}: ImprovedFacilityPhotoSectionProps) {
  const toast = useToast();
  const { addFiles } = useFileContext();
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  
  // Individual file upload tracking and cancellation
  const [fileUploadStates, setFileUploadStates] = useState<{ 
    [fileId: string]: {
      status: 'waiting' | 'uploading' | 'success' | 'error';
      progress: number;
      fileName: string;
      error?: string;
      abortController?: AbortController;
      previewUrl?: string;
    }
  }>({});
  
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
  const [isDeletingPhoto, setIsDeletingPhoto] = useState<boolean>(false);
  
  // 🔧 Jotai를 사용한 삭제된 사진 ID 추적 (즉시 UI 숨김용)
  const deletedPhotoIds = useAtomValue(deletedPhotoIdsAtom);
  const markPhotoAsDeleted = useSetAtom(deletePhotoAtom);
  const markPhotoAsUndeleted = useSetAtom(undeletePhotoAtom); // 롤백용
  const clearDeletedPhotos = useSetAtom(clearDeletedPhotosAtom);
  
  console.log('🔧 [DEBUG-SCOPE] markPhotoAsDeleted 함수가 정의되었습니다:', !!markPhotoAsDeleted);

  // 🚨🚨🚨 EMERGENCY CACHE INVALIDATION TEST
  console.log(`🔥🔥🔥 [EMERGENCY-CACHE-TEST] 긴급 캐시 무효화 테스트 - 브라우저가 이 메시지를 보고 있다면 성공!`, {
    timestamp: new Date().toISOString(),
    version: 'EMERGENCY-v4-2025-09-11-08-27',
    deletedPhotoIds: deletedPhotoIds.size,
    location: window.location.href,
    userAgent: navigator.userAgent.substring(0, 50)
  });
  
  // 🚨 추가 브라우저 캐시 확인
  if (typeof window !== 'undefined') {
    console.log(`🌐 [BROWSER-INFO] 브라우저 환경 확인됨:`, {
      url: window.location.href,
      protocol: window.location.protocol,
      port: window.location.port
    });
  }
  
  // 📷 Jotai로 필터링된 사진 목록을 생성하는 함수
  const getFilteredPhotos = useCallback((originalPhotos: FacilityPhoto[]) => {
    console.log(`🔍 [FILTER-DEBUG] 원본: ${originalPhotos.length}장, 삭제됨: ${deletedPhotoIds.size}장, 삭제ID들:`, Array.from(deletedPhotoIds));
    const filtered = originalPhotos.filter(photo => !deletedPhotoIds.has(photo.id));
    console.log(`✅ [FILTER-RESULT] ${originalPhotos.length}장 → ${filtered.length}장 필터링 완료`);
    return filtered;
  }, [deletedPhotoIds]);

  // 🔧 실시간 Jotai 상태 변화 추적
  useEffect(() => {
    console.log(`🔧 [JOTAI-STATE-CHANGE] deletedPhotoIds 업데이트됨:`, {
      count: deletedPhotoIds.size,
      ids: Array.from(deletedPhotoIds),
      timestamp: Date.now()
    });
  }, [deletedPhotoIds]);
  
  // Sophisticated drag-and-drop state management
  const [dragStates, setDragStates] = useState<{
    [zoneId: string]: {
      isDragOver: boolean;
      dragDepth: number;
      isValidDrag: boolean;
      draggedFileCount: number;
    }
  }>({});
  
  const [globalDragActive, setGlobalDragActive] = useState(false);
  
  // Auto-refresh with highlighting for new photos
  const [recentPhotoIds, setRecentPhotoIds] = useState<Set<string>>(new Set());
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [photoTracker] = useState(() => createFacilityPhotoTracker(businessName));
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<FacilityPhoto | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedFacilities, setExpandedFacilities] = useState<Set<string>>(new Set());
  const [statistics, setStatistics] = useState({
    totalFacilities: 0,
    totalPhotos: 0,
    dischargeFacilities: 0,
    preventionFacilities: 0,
    basicCategories: 0
  });
  const modalRef = useRef<HTMLDivElement>(null);

  // 업로드된 파일 로드 및 추적기 업데이트 (새 사진 하이라이트 포함)
  const loadUploadedFiles = useCallback(async (forceRefresh = false, highlightNew = false) => {
    if (!businessName) return;
    
    setLoadingFiles(true);
    try {
      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const response = await fetch(`/api/facility-photos?businessName=${encodeURIComponent(businessName)}${refreshParam}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const newFiles = result.data.files || [];
          
          // 새로 추가된 사진 감지 (하이라이트용)
          if (highlightNew) {
            const currentFacilities = photoTracker.getAllFacilities();
            const currentPhotos = currentFacilities.flatMap(facility => facility.photos);
            const currentPhotoIds = new Set(currentPhotos.map(p => p.id));
            const newPhotoIds = new Set<string>();
            
            newFiles.forEach((file: any) => {
              if (!currentPhotoIds.has(file.id)) {
                newPhotoIds.add(file.id);
              }
            });
            
            if (newPhotoIds.size > 0) {
              setRecentPhotoIds(newPhotoIds);
              console.log(`✨ [NEW-PHOTOS] ${newPhotoIds.size}장의 새 사진이 발견되어 하이라이트됩니다.`);
              
              // 5초 후 하이라이트 제거
              setTimeout(() => {
                setRecentPhotoIds(new Set());
              }, 5000);
            }
          }
          
          // 추적기 업데이트
          console.log('🔍 [DEBUG] API 응답 파일들:', newFiles);
          photoTracker.buildFromUploadedFiles(newFiles);
          
          // 모든 시설의 사진을 가져와서 합치기
          const allFacilities = photoTracker.getAllFacilities();
          const allPhotos = allFacilities.flatMap(facility => facility.photos);
          console.log('🔍 [DEBUG] photoTracker 업데이트 후 전체 사진:', allPhotos);
          
          // 통계 업데이트 (성능 최적화된 애니메이션으로 업데이트)
          setStatistics(photoTracker.getStatistics());
          setLastRefreshTime(new Date());
          
          console.log('📊 [PHOTO-TRACKER] 업데이트 완료:', photoTracker.getStatistics());
        }
      }
    } catch (error) {
      console.error('파일 목록 로드 실패:', error);
    } finally {
      setLoadingFiles(false);
    }
  }, [businessName, photoTracker]);

  useEffect(() => {
    loadUploadedFiles();
  }, [loadUploadedFiles]);

  // 백그라운드 새로고침 (새 사진 하이라이트 포함)
  useEffect(() => {
    const interval = setInterval(() => {
      loadUploadedFiles(true, true); // 백그라운드 새로고침 시 새 사진 하이라이트
    }, 30000); // 30초로 단축하여 더 빈번한 업데이트

    return () => clearInterval(interval);
  }, [loadUploadedFiles]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(fileUploadStates).forEach(state => {
        if (state.previewUrl) {
          URL.revokeObjectURL(state.previewUrl);
        }
      });
    };
  }, []);

  // Individual file upload management
  const cancelFileUpload = useCallback((fileId: string) => {
    const fileState = fileUploadStates[fileId];
    if (fileState?.abortController) {
      fileState.abortController.abort();
    }
    
    // 미리보기 URL 정리
    if (fileState?.previewUrl) {
      URL.revokeObjectURL(fileState.previewUrl);
    }
    
    setFileUploadStates(prev => ({
      ...prev,
      [fileId]: {
        ...prev[fileId],
        status: 'error',
        error: '업로드가 취소되었습니다.',
        previewUrl: undefined
      }
    }));
    
    setActiveUploads(prev => {
      const newSet = new Set(prev);
      newSet.delete(fileId);
      return newSet;
    });
    
    toast.info('업로드 취소됨', `${fileState?.fileName || '파일'}의 업로드가 취소되었습니다.`);
  }, [fileUploadStates, toast]);
  
  const retryFileUpload = useCallback(async (fileId: string, uploadFunction: () => Promise<void>) => {
    setFileUploadStates(prev => ({
      ...prev,
      [fileId]: {
        ...prev[fileId],
        status: 'waiting',
        error: undefined
      }
    }));
    
    try {
      await uploadFunction();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, []);
  
  const clearCompletedUploads = useCallback(() => {
    setFileUploadStates(prev => {
      const newStates: typeof prev = {};
      Object.keys(prev).forEach(fileId => {
        if (prev[fileId].status === 'uploading' || prev[fileId].status === 'waiting') {
          newStates[fileId] = prev[fileId];
        } else {
          // 완료된 업로드의 미리보기 URL 정리
          if (prev[fileId].previewUrl) {
            URL.revokeObjectURL(prev[fileId].previewUrl);
          }
        }
      });
      return newStates;
    });
  }, []);

  // Sophisticated drag-and-drop handlers
  const createDragHandlers = (zoneId: string, onDrop: (files: FileList) => void) => {
    const updateDragState = (updates: Partial<typeof dragStates[string]>) => {
      setDragStates(prev => ({
        ...prev,
        [zoneId]: { ...prev[zoneId], ...updates }
      }));
    };

    const validateDraggedFiles = (dataTransfer: DataTransfer): { isValid: boolean; fileCount: number } => {
      const items = Array.from(dataTransfer.items || []);
      const files = items.filter(item => item.kind === 'file' && item.type.startsWith('image/'));
      return { isValid: files.length > 0, fileCount: files.length };
    };

    return {
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const { isValid, fileCount } = validateDraggedFiles(e.dataTransfer);
        
        setGlobalDragActive(true);
        updateDragState({
          isDragOver: true,
          dragDepth: (dragStates[zoneId]?.dragDepth || 0) + 1,
          isValidDrag: isValid,
          draggedFileCount: fileCount
        });
      },

      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const newDepth = (dragStates[zoneId]?.dragDepth || 1) - 1;
        
        if (newDepth <= 0) {
          updateDragState({
            isDragOver: false,
            dragDepth: 0,
            isValidDrag: false,
            draggedFileCount: 0
          });
          
          // Check if any other zones are active
          const hasOtherActiveZones = Object.entries(dragStates).some(([id, state]) => 
            id !== zoneId && state.isDragOver
          );
          if (!hasOtherActiveZones) {
            setGlobalDragActive(false);
          }
        } else {
          updateDragState({ dragDepth: newDepth });
        }
      },

      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const { isValid, fileCount } = validateDraggedFiles(e.dataTransfer);
        updateDragState({ isValidDrag: isValid, draggedFileCount: fileCount });
      },

      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        setGlobalDragActive(false);
        updateDragState({
          isDragOver: false,
          dragDepth: 0,
          isValidDrag: false,
          draggedFileCount: 0
        });

        const files = e.dataTransfer.files;
        if (files.length > 0) {
          const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
          if (imageFiles.length > 0) {
            const dataTransfer = new DataTransfer();
            imageFiles.forEach(file => dataTransfer.items.add(file));
            onDrop(dataTransfer.files);
          }
        }
      }
    };
  };

  const getDragZoneStyles = (zoneId: string, baseStyles: string = '') => {
    const dragState = dragStates[zoneId];
    if (!dragState?.isDragOver) return baseStyles;

    const validDragStyles = dragState.isValidDrag 
      ? 'border-green-400 bg-green-50 ring-2 ring-green-200 shadow-lg transform scale-[1.02]'
      : 'border-red-400 bg-red-50 ring-2 ring-red-200 shadow-lg';

    return `${baseStyles} ${validDragStyles} transition-all duration-200 ease-out`;
  };

  // Global drag overlay for sophisticated visual feedback
  const DragOverlay = () => {
    if (!globalDragActive) return null;

    return (
      <div className="fixed inset-0 bg-blue-500/10 backdrop-blur-sm z-40 pointer-events-none">
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-md rounded-lg shadow-lg px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
            <Upload className="w-4 h-4 animate-bounce" />
            이미지를 업로드할 영역으로 드래그하세요
          </div>
        </div>
      </div>
    );
  };

  // 시설별 파일 업로드
  const handleFacilityUpload = useCallback(async (
    files: FileList, 
    facilityType: 'discharge' | 'prevention',
    facility: Facility,
    instanceIndex: number = 1
  ) => {
    if (!files.length) return;

    const uploadKey = `${facilityType}-${facility.outlet}-${facility.number}-${instanceIndex}`;
    
    setUploading(prev => ({ ...prev, [uploadKey]: true }));
    setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

    // Initialize individual file states with improved uniqueness
    const fileIds: string[] = [];
    const newFileStates: { [key: string]: any } = {};
    
    // 🔧 모든 파일 정보를 먼저 준비 (배치 처리를 위해)
    Array.from(files).forEach((file, index) => {
      // 🔧 더 강력한 고유성 보장 - 시간, 인덱스, 파일정보 조합
      const timestamp = Date.now().toString(36);
      const performanceTime = performance.now().toString(36);
      const randomSuffix = Math.random().toString(36).substring(2, 15);
      const fileHash = `${file.name}-${file.size}-${file.lastModified}`.replace(/[^a-zA-Z0-9]/g, '_');
      const fileId = `${uploadKey}-${index}-${timestamp}-${performanceTime}-${fileHash}-${randomSuffix}`;
      fileIds.push(fileId);
      
      // 🖼️ 각 파일별 고유 미리보기 URL 생성 - File 객체를 직접 사용하여 고유성 보장
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      
      // 🐛 디버깅: 미리보기 URL 추적 (각 파일별 고유성 확인)
      console.log(`🖼️ [PREVIEW-DEBUG-${index}] 파일정보:`, {
        fileName: file.name,
        fileSize: file.size,
        lastModified: file.lastModified,
        fileId,
        previewUrl: previewUrl?.substring(0, 50) + '...',
        type: file.type,
        timestamp,
        performanceTime
      });
      
      // 새로운 상태를 미리 준비
      newFileStates[fileId] = {
        status: 'waiting' as const,
        progress: 0,
        fileName: file.name,
        abortController: new AbortController(),
        previewUrl
      };
    });
    
    // 🔧 모든 파일 상태를 한 번에 업데이트 (배치 처리로 상태 경쟁 조건 방지)
    setFileUploadStates(prev => {
      const updatedState = {
        ...prev,
        ...newFileStates
      };
      console.log(`🎯 [BATCH-STATE-UPDATE] ${fileIds.length}개 파일 상태 배치 업데이트 완료`, {
        fileIds,
        stateKeys: Object.keys(newFileStates)
      });
      return updatedState;
    });

    // Process files individually with cancellation support
    // 🔧 배치 업로드로 변경 - 모든 파일을 하나의 요청으로 처리
    console.log(`📦 [BATCH-UPLOAD-START] ${files.length}장의 파일을 배치 업로드 시작`);
    
    // 모든 파일 상태를 업로드 중으로 설정
    setFileUploadStates(prev => {
      const newStates = { ...prev };
      fileIds.forEach(fileId => {
        if (newStates[fileId]) {
          newStates[fileId].status = 'uploading';
        }
      });
      return newStates;
    });

    try {
      const formData = new FormData();
      
      // 모든 파일을 하나의 FormData에 추가
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      
      formData.append('businessName', businessName);
      formData.append('facilityType', facilityType);
      formData.append('facilityNumber', facility.number?.toString() || '1');
      formData.append('outletNumber', facility.outlet.toString());

      console.log(`📤 [BATCH-UPLOAD-REQUEST] 배치 업로드 요청 전송:`, {
        filesCount: files.length,
        facilityType,
        facilityNumber: facility.number,
        outletNumber: facility.outlet
      });

      const response = await fetch('/api/facility-photos', {
        method: 'POST',
        body: formData
      });

      let result: any;
      
      if (response.ok) {
        result = await response.json();
        
        console.log(`📥 [BATCH-UPLOAD-RESPONSE] 서버 응답:`, result);
        
        if (result.success) {
          console.log(`🎯 [INSTANT-UI-UPDATE] 업로드 성공, 즉시 UI 반영 시작`, result);
          
          // 모든 파일을 성공 상태로 업데이트
          setFileUploadStates(prev => {
            const newStates = { ...prev };
            fileIds.forEach(fileId => {
              if (newStates[fileId]) {
                // 성공 시 미리보기 URL 정리
                if (newStates[fileId].previewUrl) {
                  URL.revokeObjectURL(newStates[fileId].previewUrl);
                }
                newStates[fileId] = {
                  ...newStates[fileId],
                  status: 'success',
                  progress: 100,
                  previewUrl: undefined
                };
              }
            });
            return newStates;
          });
          
          // 🚀 핵심 개선: 업로드 성공 시 FileContext에 즉시 파일 추가
          if (result.uploadedFiles && result.uploadedFiles.length > 0) {
            console.log(`➕ [INSTANT-ADD] ${result.uploadedFiles.length}개 파일을 즉시 UI에 추가`);
            addFiles(result.uploadedFiles);
            
            // 실시간 성공 알림 (향상된 모바일 지원)
            if (typeof window !== 'undefined') {
              const instantToast = document.createElement('div');
              instantToast.className = 'instant-upload-toast fixed top-16 right-4 bg-gradient-to-r from-green-400 to-blue-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-500 scale-100';
              instantToast.innerHTML = `
                <div class="flex items-center space-x-3">
                  <div class="animate-bounce">🎉</div>
                  <div>
                    <div class="font-bold text-sm">실시간 업로드!</div>
                    <div class="text-xs opacity-90">${result.uploadedFiles.length}장 즉시 반영됨</div>
                  </div>
                </div>
              `;
              document.body.appendChild(instantToast);
              
              setTimeout(() => {
                instantToast.style.transform = 'scale(0) translateY(-20px)';
                setTimeout(() => instantToast.remove(), 200);
              }, 2500);
              
              // 모바일 햅틱 피드백
              if (navigator.vibrate) {
                navigator.vibrate([100, 100, 200]);
              }
            }
          } else {
            console.warn(`⚠️ [NO-FILES-RETURNED] 서버에서 uploadedFiles 반환되지 않음, 폴백 새로고침 사용`);
          }
          
        } else {
          throw new Error(result.message || '업로드 실패');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 모든 파일이 성공적으로 업로드됨
      const successCount = files.length;
      console.log(`✅ [UPLOAD-COMPLETE] ${successCount}/${files.length}장 업로드 완료`);
      
      // 폴백 새로고침: result.uploadedFiles가 없는 경우에만 실행
      if (!result.uploadedFiles || result.uploadedFiles.length === 0) {
        console.log(`🔄 [FALLBACK-REFRESH] uploadedFiles 없음, 폴백 새로고침 실행`);
        await new Promise(resolve => setTimeout(resolve, 200)); // 서버 업데이트 대기
        await loadUploadedFiles(true, true);
        console.log(`✅ [FALLBACK-COMPLETE] 폴백 새로고침 완료`);
      } else {
        console.log(`⚡ [SKIP-REFRESH] 즉시 UI 반영 완료, 새로고침 생략`);
      }
      
      // 업로드 진행률 업데이트
      setUploadProgress(prev => ({ ...prev, [uploadKey]: 100 }));
      
      // 성공/실패 알림
      if (successCount === files.length) {
        toast.success(`업로드 완료`, `${successCount}장의 사진이 모두 업로드되었습니다.`);
      } else if (successCount > 0) {
        toast.warning(`부분 업로드`, `${successCount}/${files.length}장의 사진이 업로드되었습니다.`);
      } else {
        toast.error(`업로드 실패`, `모든 파일의 업로드가 실패했습니다.`);
      }

    } catch (error: any) {
      console.error('🚨 [BATCH-UPLOAD-ERROR] 배치 업로드 오류:', error);
      
      // 모든 파일을 오류 상태로 업데이트
      setFileUploadStates(prev => {
        const newStates = { ...prev };
        fileIds.forEach(fileId => {
          if (newStates[fileId]) {
            // 오류 시 미리보기 URL 정리
            if (newStates[fileId].previewUrl) {
              URL.revokeObjectURL(newStates[fileId].previewUrl);
            }
            newStates[fileId] = {
              ...newStates[fileId],
              status: 'error',
              error: error.message || '업로드 실패',
              previewUrl: undefined
            };
          }
        });
        return newStates;
      });
      
      // 네트워크 오류에 대한 사용자 친화적 메시지와 재시도
      toast.error(
        '업로드 실패', 
        `${files.length}장의 사진 업로드가 실패했습니다. 다시 시도해주세요.`, 
        {
          duration: 0,
          onRetry: () => handleFacilityUpload(files, facilityType, facility, instanceIndex)
        }
      );
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: false }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
      }, 2000);
    }
  }, [businessName, loadUploadedFiles]);

  // 기본사진 업로드
  const handleBasicUpload = useCallback(async (files: FileList, category: string) => {
    if (!files.length) return;

    const uploadKey = `basic-${category}`;
    
    setUploading(prev => ({ ...prev, [uploadKey]: true }));
    setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

    try {
      const formData = new FormData();
      
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      
      formData.append('businessName', businessName);
      formData.append('facilityType', 'basic');
      formData.append('category', category);

      const response = await fetch('/api/facility-photos', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ [BASIC-UPLOAD-SUCCESS] ${category} ${result.data?.uploadedPhotos?.length || 0}장 업로드 완료`);
        
        // 🚀 즉시 UI 반영: 업로드된 파일들을 즉시 추가
        if (result.data?.uploadedPhotos && result.data.uploadedPhotos.length > 0) {
          console.log(`➕ [BASIC-INSTANT-ADD] ${result.data.uploadedPhotos.length}개 기본사진을 즉시 UI에 추가`);
          addFiles(result.data.uploadedPhotos);
          
          // 실시간 성공 알림 (기본사진용)
          if (typeof window !== 'undefined') {
            const basicToast = document.createElement('div');
            basicToast.className = 'basic-upload-toast fixed top-16 left-4 bg-gradient-to-r from-purple-400 to-pink-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-500 scale-100';
            basicToast.innerHTML = `
              <div class="flex items-center space-x-3">
                <div class="animate-pulse">📷</div>
                <div>
                  <div class="font-bold text-sm">${getCategoryDisplayName(category)} 업로드!</div>
                  <div class="text-xs opacity-90">${result.data.uploadedPhotos.length}장 즉시 반영</div>
                </div>
              </div>
            `;
            document.body.appendChild(basicToast);
            
            setTimeout(() => {
              basicToast.style.transform = 'scale(0) translateX(-20px)';
              setTimeout(() => basicToast.remove(), 200);
            }, 2500);
          }
        }
        
        // ⚡ 성능 최적화: 즉시 UI 업데이트 완료
        setUploadProgress(prev => ({ ...prev, [uploadKey]: 100 }));
        
        // 조건부 폴백 새로고침
        if (!result.data?.uploadedPhotos || result.data.uploadedPhotos.length === 0) {
          console.log(`🔄 [BASIC-FALLBACK] uploadedPhotos 없음, 폴백 새로고침`);
          setTimeout(() => {
            loadUploadedFiles(true, true).catch(error => {
              console.warn('기본사진 폴백 새로고침 실패:', error);
            });
          }, 100);
        } else {
          console.log(`⚡ [BASIC-SKIP-REFRESH] 즉시 반영 완료, 새로고침 생략`);
        }
      } else {
        console.error('❌ [BASIC-UPLOAD-ERROR]', result.message);
        
        // 사용자 친화적 에러 메시지와 재시도 버튼
        toast.error(
          '업로드 실패', 
          getUserFriendlyErrorMessage(result.message), 
          {
            duration: 0,
            onRetry: () => handleBasicUpload(files, category)
          }
        );
      }

    } catch (error) {
      console.error('기본사진 업로드 오류:', error);
      
      // 네트워크 오류에 대한 사용자 친화적 메시지
      toast.error(
        '연결 오류', 
        '네트워크 연결을 확인하고 다시 시도해주세요.', 
        {
          duration: 0,
          onRetry: () => handleBasicUpload(files, category)
        }
      );
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: false }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
      }, 2000);
    }
  }, [businessName, loadUploadedFiles]);

  // 🔧 개선된 사진 삭제 - 즉시 UI 업데이트 + 백그라운드 동기화 + 롤백 처리
  const deletePhoto = useCallback(async (photo: FacilityPhoto) => {
    console.log('🚨 [DEBUG] deletePhoto 함수가 호출되었습니다!', photo);
    if (!confirm(`"${photo.originalFileName}" 파일을 삭제하시겠습니까?`)) {
      console.log('🚫 [DEBUG] 사용자가 삭제를 취소했습니다');
      return;
    }

    try {
      console.log(`🔥🔥🔥 [DELETE-FUNCTION-CALLED] ${photo.fileName} (ID: ${photo.id}) 새로운 삭제 함수 호출됨! 🔥🔥🔥`);
      console.log(`🚀 [DELETE-START] ${photo.fileName} (ID: ${photo.id}) 삭제 시작`);
      
      // 🚨 삭제 작업 시작 - 외부 클릭 차단
      setIsDeletingPhoto(true);
      console.log(`🔒 [DELETE-LOCK] 삭제 작업 중 모달 잠금 활성화 - HOT RELOAD TEST`);
      
      // 1️⃣ 즉시 UI에서 사진 숨기기 (Jotai 사용)
      markPhotoAsDeleted(photo.id);
      console.log(`⚡ [INSTANT-DELETE] ${photo.fileName} - markPhotoAsDeleted 호출완료`);
      
      // 2️⃣ 상태 변경 확인을 위한 약간의 지연
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log(`🔄 [UI-SYNC] Jotai 상태 업데이트 후 UI 리렌더링 대기`);
      
      // ✅ 상세보기 창 유지 - 모달 닫지 않음 (사용자 경험 개선)
      console.log(`👁️ [MODAL-KEEP] 상세보기 창 유지 - 삭제 후에도 계속 사용 가능`);
      // setSelectedPhoto(null);   // 주석 처리 - 모달 닫지 않음
      // setModalPosition(null);   // 주석 처리 - 모달 닫지 않음
      
      // 3️⃣ 성공 메시지는 즉시 표시
      toast.success('삭제 완료', '사진이 성공적으로 삭제되었습니다.');
      
      // 🚨 삭제 작업 완료 - 외부 클릭 차단 해제
      setIsDeletingPhoto(false);
      console.log(`🔓 [DELETE-UNLOCK] 삭제 작업 완료 - 모달 잠금 해제`);
      
      // 4️⃣ 백그라운드에서 실제 API 삭제 수행 (사용자는 기다리지 않음)
      const response = await fetch('/api/facility-photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          photoId: photo.id, 
          businessName: businessName
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        // 🔄 API 삭제 실패 시 롤백
        console.error('❌ [DELETE-API-FAILED]', result.message);
        
        // Jotai에서 삭제 상태 롤백
        markPhotoAsUndeleted(photo.id);
        
        // photoTracker에서도 롤백 (전체 새로고침으로 처리)
        loadUploadedFiles(true, false).catch(error => {
          console.warn('롤백 새로고침 실패:', error);
        });
        
        toast.error('삭제 실패', getUserFriendlyErrorMessage(result.message));
      } else {
        console.log(`✅ [DELETE-API-SUCCESS] ${photo.fileName} 서버에서도 삭제 완료`);
      }
      
    } catch (error) {
      console.error('사진 삭제 API 오류:', error);
      
      // 🚨 삭제 실패 시에도 외부 클릭 차단 해제
      setIsDeletingPhoto(false);
      console.log(`🔓 [DELETE-UNLOCK-ERROR] 삭제 실패 - 모달 잠금 해제`);
      
      // 🔄 API 오류 시에도 롤백 처리
      markPhotoAsUndeleted(photo.id);
      
      loadUploadedFiles(true, false).catch(refreshError => {
        console.warn('오류 복구 새로고침 실패:', refreshError);
      });
      
      toast.error('삭제 오류', '사진 삭제 중 문제가 발생했습니다. 다시 시도해주세요.');
    }
  }, [businessName, markPhotoAsDeleted, markPhotoAsUndeleted, photoTracker, toast, loadUploadedFiles]);

  // 사진 선택 모달
  const handlePhotoSelect = useCallback((photo: FacilityPhoto, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    const centerX = rect.left + rect.width / 2 + 50;
    const centerY = rect.top + rect.height / 2;
    
    const modalWidth = 600;
    const modalHeight = 500;
    
    const adjustedX = Math.min(Math.max(centerX - modalWidth/2, 20), window.innerWidth - modalWidth - 20);
    const adjustedY = Math.min(Math.max(centerY - modalHeight/2, 20), window.innerHeight - modalHeight - 20);
    
    setModalPosition({ x: adjustedX, y: adjustedY });
    setSelectedPhoto(photo);
  }, []);

  // 시설 확장/축소
  const toggleFacilityExpansion = useCallback((facilityKey: string) => {
    setExpandedFacilities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(facilityKey)) {
        newSet.delete(facilityKey);
      } else {
        newSet.add(facilityKey);
      }
      return newSet;
    });
  }, []);

  // 키보드 및 모달 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedPhoto) {
        console.log(`🔑 [ESC-KEY] ESC 키로 모달 닫기 - 사용자가 직접 종료`);
        setSelectedPhoto(null);
        setModalPosition(null);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      // 🚨 삭제 작업 중일 때는 외부 클릭으로 모달 닫지 않음
      if (isDeletingPhoto) {
        console.log(`🚫 [CLICK-OUTSIDE-BLOCKED] 삭제 작업 중 - 외부 클릭 무시`);
        return;
      }
      
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        console.log(`🖱️ [CLICK-OUTSIDE] 외부 클릭으로 모달 닫기`);
        setSelectedPhoto(null);
        setModalPosition(null);
      }
    };

    if (selectedPhoto) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedPhoto, isDeletingPhoto]);

  if (!facilities) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-xl border-2 border-gray-200/80">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Camera className="w-6 h-6 text-gray-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">시설별 사진 관리</h2>
        </div>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">시설 정보를 먼저 불러와주세요.</p>
        </div>
      </div>
    );
  }

  // 시설별 정보 가져오기
  const dischargeFacilities = photoTracker.getDischargeFacilities();
  const preventionFacilities = photoTracker.getPreventionFacilities();
  const basicFacilities = photoTracker.getBasicFacilities();

  // 배출구별 시설 그룹화
  const facilitiesByOutlet = () => {
    const grouped: { [outlet: number]: { discharge: Facility[], prevention: Facility[] } } = {};
    
    if (!facilities || !facilities.discharge || !facilities.prevention) {
      return grouped;
    }
    
    facilities.discharge.forEach(facility => {
      if (!grouped[facility.outlet]) {
        grouped[facility.outlet] = { discharge: [], prevention: [] };
      }
      grouped[facility.outlet].discharge.push(facility);
    });
    
    facilities.prevention.forEach(facility => {
      if (!grouped[facility.outlet]) {
        grouped[facility.outlet] = { discharge: [], prevention: [] };
      }
      grouped[facility.outlet].prevention.push(facility);
    });
    
    return grouped;
  };

  const outletFacilities = facilitiesByOutlet();
  const outlets = Object.keys(outletFacilities).map(Number).sort((a, b) => a - b);

  // Individual file upload status component
  const FileUploadStatus = ({ fileStates }: { fileStates: typeof fileUploadStates }) => {
    const activeFiles = Object.entries(fileStates).filter(([_, state]) => 
      state.status === 'uploading' || state.status === 'waiting' || state.status === 'error'
    );

    if (activeFiles.length === 0) return null;

    return (
      <div className="mb-4 bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-800">파일 업로드 상태</h4>
          <button
            onClick={clearCompletedUploads}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            완료된 항목 정리
          </button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {activeFiles.map(([fileId, state]) => (
            <div key={fileId} className="flex items-center gap-3 p-2 bg-white rounded border">
              {/* Preview image - 🔧 각 파일별 고유 미리보기 표시 */}
              {state.previewUrl ? (
                <img 
                  src={state.previewUrl} 
                  alt={state.fileName}
                  className="w-12 h-12 object-cover rounded border flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded border flex-shrink-0 flex items-center justify-center">
                  <span className="text-xs text-gray-500">📄</span>
                </div>
              )}
              
              {/* Status indicator */}
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                state.status === 'uploading' ? 'bg-blue-500 animate-pulse' :
                state.status === 'waiting' ? 'bg-yellow-500' :
                state.status === 'success' ? 'bg-green-500' :
                'bg-red-500'
              }`} />
              
              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {state.fileName}
                </div>
                <div className="text-xs text-gray-500">
                  {state.status === 'uploading' ? `업로드 중... ${state.progress}%` :
                   state.status === 'waiting' ? '대기 중' :
                   state.status === 'success' ? '완료' :
                   state.error || '실패'}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-1">
                {state.status === 'uploading' && (
                  <button
                    onClick={() => cancelFileUpload(fileId)}
                    className="p-1 text-red-500 hover:text-red-700 rounded"
                    title="취소"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {state.status === 'error' && (
                  <button
                    onClick={() => retryFileUpload(fileId, () => Promise.resolve())}
                    className="p-1 text-blue-500 hover:text-blue-700 rounded"
                    title="재시도"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Global drag overlay */}
      <DragOverlay />
      
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-xl border-2 border-gray-200/80">
        {/* File upload status tracker */}
        <FileUploadStatus fileStates={fileUploadStates} />
      
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Camera className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">시설별 사진 관리</h2>
            <p className="text-sm text-gray-600">
              총 {statistics.totalFacilities}개 시설, {statistics.totalPhotos}장의 사진
            </p>
          </div>
        </div>

        {/* 컨트롤 버튼 */}
        <div className="flex items-center gap-2">
          {/* 뷰 모드 토글 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => loadUploadedFiles(true)}
            disabled={loadingFiles}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* 통계 대시보드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <div className="bg-orange-50 p-2 md:p-4 rounded-lg border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-all duration-200 transform hover:scale-105">
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-orange-600" />
            <span className="font-medium text-orange-800">배출시설</span>
          </div>
          <div className="text-2xl font-bold text-orange-900">
            <AnimatedCounter 
              value={statistics.dischargeFacilities} 
              duration={800} 
              className="inline-block" 
            />
          </div>
        </div>

        <div className="bg-green-50 p-2 md:p-4 rounded-lg border border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 transform hover:scale-105">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-800">방지시설</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            <AnimatedCounter 
              value={statistics.preventionFacilities} 
              duration={800} 
              className="inline-block" 
            />
          </div>
        </div>

        <div className="bg-blue-50 p-2 md:p-4 rounded-lg border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 transform hover:scale-105">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-800">기본사진</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">
            <AnimatedCounter 
              value={statistics.basicCategories} 
              duration={800} 
              className="inline-block" 
            />
          </div>
        </div>

        <div className="bg-purple-50 p-2 md:p-4 rounded-lg border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 transform hover:scale-105">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-purple-800">총 사진</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">
            <AnimatedCounter 
              value={statistics.totalPhotos} 
              duration={1000} 
              className="inline-block" 
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 md:space-y-6">
        {/* 배출구별 시설 */}
        {outlets.map(outlet => {
          const outletData = outletFacilities[outlet];
          const outletPrevention = outletData.prevention || [];
          const outletDischarge = outletData.discharge || [];
          
          return (
            <div key={outlet} className="bg-white rounded-lg p-3 md:p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-2 md:mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  배출구 {outlet}
                </span>
              </h3>
              
              {/* 방지시설 */}
              {outletPrevention.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-green-600 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    방지시설 ({outletPrevention.reduce((total, f) => total + f.quantity, 0)}개)
                  </h4>
                  
                  {outletPrevention.map((facility) => 
                    Array.from({ length: facility.quantity }, (_, quantityIndex) => {
                      const instanceIndex = quantityIndex + 1;
                      const uploadKey = `prevention-${facility.outlet}-${facility.number}-${instanceIndex}`;
                      const isUploading = uploading[uploadKey];
                      const progress = uploadProgress[uploadKey] || 0;
                      
                      // 해당 시설의 사진들 가져오기 (Jotai로 삭제된 사진 필터링)
                      const facilityPhotos = getFilteredPhotos(photoTracker.getFacilityPhotos('prevention', facility.number, facility.outlet));
                      console.log(`🔍 [DEBUG] Prevention 시설 ${facility.number} 사진:`, facilityPhotos);

                      return (
                        <FacilityCard
                          key={`prevention-${facility.outlet}-${facility.number}-${instanceIndex}`}
                          facility={facility}
                          facilityType="prevention"
                          instanceIndex={instanceIndex}
                          isUploading={isUploading}
                          progress={progress}
                          photos={facilityPhotos}
                          onUpload={(files) => handleFacilityUpload(files, 'prevention', facility, instanceIndex)}
                          onPhotoSelect={handlePhotoSelect}
                          viewMode={viewMode}
                          dragHandlers={createDragHandlers(
                            `prevention-${facility.outlet}-${facility.number}-${instanceIndex}`,
                            (files) => handleFacilityUpload(files, 'prevention', facility, instanceIndex)
                          )}
                          dragZoneStyles={getDragZoneStyles}
                          recentPhotoIds={recentPhotoIds}
                          businessName={businessName}
                          loadUploadedFiles={loadUploadedFiles}
                        />
                      );
                    })
                  ).flat()}
                </div>
              )}
              
              {/* 배출시설 */}
              {outletDischarge.length > 0 && (
                <div>
                  <h4 className="text-md font-medium text-orange-600 mb-3 flex items-center gap-2">
                    <Factory className="w-4 h-4" />
                    배출시설 ({outletDischarge.reduce((total, f) => total + f.quantity, 0)}개)
                  </h4>
                  
                  {outletDischarge.map((facility) => 
                    Array.from({ length: facility.quantity }, (_, quantityIndex) => {
                      const instanceIndex = quantityIndex + 1;
                      const uploadKey = `discharge-${facility.outlet}-${facility.number}-${instanceIndex}`;
                      const isUploading = uploading[uploadKey];
                      const progress = uploadProgress[uploadKey] || 0;
                      
                      // 해당 시설의 사진들 가져오기 (Jotai로 삭제된 사진 필터링)
                      const facilityPhotos = getFilteredPhotos(photoTracker.getFacilityPhotos('discharge', facility.number, facility.outlet));

                      return (
                        <FacilityCard
                          key={`discharge-${facility.outlet}-${facility.number}-${instanceIndex}`}
                          facility={facility}
                          facilityType="discharge"
                          instanceIndex={instanceIndex}
                          isUploading={isUploading}
                          progress={progress}
                          photos={facilityPhotos}
                          onUpload={(files) => handleFacilityUpload(files, 'discharge', facility, instanceIndex)}
                          onPhotoSelect={handlePhotoSelect}
                          viewMode={viewMode}
                          dragHandlers={createDragHandlers(
                            `discharge-${facility.outlet}-${facility.number}-${instanceIndex}`,
                            (files) => handleFacilityUpload(files, 'discharge', facility, instanceIndex)
                          )}
                          dragZoneStyles={getDragZoneStyles}
                          recentPhotoIds={recentPhotoIds}
                          businessName={businessName}
                          loadUploadedFiles={loadUploadedFiles}
                        />
                      );
                    })
                  ).flat()}
                </div>
              )}
            </div>
          );
        })}

        {/* 기본사진 섹션 */}
        <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 md:mb-6 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            기본사진
          </h3>
          
          <div className="space-y-3 md:space-y-6">
            {/* 게이트웨이 */}
            <BasicPhotoCategory
              category="gateway"
              title="게이트웨이"
              icon={<Router className="w-4 h-4" />}
              color="purple"
              isUploading={uploading['basic-gateway']}
              progress={uploadProgress['basic-gateway'] || 0}
              photos={getFilteredPhotos(photoTracker.getFacilityPhotos('basic', undefined, undefined, 'gateway'))}
              onUpload={(files) => handleBasicUpload(files, 'gateway')}
              onPhotoSelect={handlePhotoSelect}
              viewMode={viewMode}
              dragHandlers={createDragHandlers(
                'basic-gateway',
                (files) => handleBasicUpload(files, 'gateway')
              )}
              dragZoneStyles={getDragZoneStyles}
              recentPhotoIds={recentPhotoIds}
              businessName={businessName}
              loadUploadedFiles={loadUploadedFiles}
            />

            {/* 송풍팬 */}
            <BasicPhotoCategory
              category="fan"
              title="송풍팬"
              icon={<Zap className="w-4 h-4" />}
              color="cyan"
              isUploading={uploading['basic-fan']}
              progress={uploadProgress['basic-fan'] || 0}
              photos={getFilteredPhotos(photoTracker.getFacilityPhotos('basic', undefined, undefined, 'fan'))}
              onUpload={(files) => handleBasicUpload(files, 'fan')}
              onPhotoSelect={handlePhotoSelect}
              viewMode={viewMode}
              dragHandlers={createDragHandlers(
                'basic-fan',
                (files) => handleBasicUpload(files, 'fan')
              )}
              dragZoneStyles={getDragZoneStyles}
              recentPhotoIds={recentPhotoIds}
              businessName={businessName}
              loadUploadedFiles={loadUploadedFiles}
            />

            {/* 기타 */}
            <BasicPhotoCategory
              category="others"
              title="기타"
              icon={<Building2 className="w-4 h-4" />}
              color="gray"
              isUploading={uploading['basic-others']}
              progress={uploadProgress['basic-others'] || 0}
              photos={getFilteredPhotos(photoTracker.getFacilityPhotos('basic', undefined, undefined, 'others'))}
              onUpload={(files) => handleBasicUpload(files, 'others')}
              onPhotoSelect={handlePhotoSelect}
              viewMode={viewMode}
              dragHandlers={createDragHandlers(
                'basic-others',
                (files) => handleBasicUpload(files, 'others')
              )}
              dragZoneStyles={getDragZoneStyles}
              recentPhotoIds={recentPhotoIds}
              businessName={businessName}
              loadUploadedFiles={loadUploadedFiles}
            />
          </div>
        </div>
      </div>

      {/* 사진 상세 모달 */}
      {selectedPhoto && modalPosition && (
        <PhotoDetailModal
          ref={modalRef}
          photo={selectedPhoto}
          position={modalPosition}
          onClose={() => { setSelectedPhoto(null); setModalPosition(null); }}
          onDelete={() => deletePhoto(selectedPhoto)}
        />
      )}
    </div>
    </>
  );
}

// 시설 카드 컴포넌트
interface FacilityCardProps {
  facility: Facility;
  facilityType: 'discharge' | 'prevention';
  instanceIndex: number;
  isUploading: boolean;
  progress: number;
  photos: FacilityPhoto[];
  onUpload: (files: FileList) => void;
  onPhotoSelect: (photo: FacilityPhoto, event: React.MouseEvent) => void;
  viewMode: ViewMode;
  dragHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  dragZoneStyles: (zoneId: string, baseStyles?: string) => string;
  recentPhotoIds?: Set<string>;
  businessName: string;
  loadUploadedFiles: (forceRefresh?: boolean, highlightNew?: boolean) => Promise<void>;
}

function FacilityCard({ 
  facility, 
  facilityType, 
  instanceIndex, 
  isUploading, 
  progress, 
  photos,
  onUpload,
  onPhotoSelect,
  viewMode,
  dragHandlers,
  dragZoneStyles,
  recentPhotoIds,
  businessName,
  loadUploadedFiles
}: FacilityCardProps) {
  const displayNumber = `${facilityType === 'discharge' ? '배' : '방'}${facility.number}${facility.quantity > 1 ? `-${instanceIndex}` : ''}`;
  const colorScheme = facilityType === 'discharge' ? 'orange' : 'green';

  return (
    <div className={`bg-${colorScheme}-50 border border-${colorScheme}-200 rounded-lg p-4 mb-3`}>
      {/* 시설 정보 */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`bg-${colorScheme}-600 text-white px-2 py-1 rounded text-sm font-medium`}>
          {displayNumber}
        </span>
        <span className="text-gray-600 text-sm">배출구 {facility.outlet}</span>
        {facility.quantity > 1 && (
          <span className={`text-xs bg-${colorScheme}-100 text-${colorScheme}-700 px-2 py-1 rounded`}>
            {instanceIndex}/{facility.quantity}
          </span>
        )}
        <span className={`text-xs bg-${colorScheme}-100 text-${colorScheme}-700 px-2 py-1 rounded ml-auto`}>
          {photos.length}장
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <span className="text-sm text-gray-600 font-medium">시설명:</span>
          <div className="text-gray-900 font-semibold">{facility.name}</div>
        </div>
        <div>
          <span className="text-sm text-gray-600 font-medium">용량:</span>
          <div className="text-gray-900 font-semibold">{facility.capacity}</div>
        </div>
        <div>
          <span className="text-sm text-gray-600 font-medium">수량:</span>
          <div className="text-gray-900 font-semibold">{facility.quantity}개</div>
        </div>
      </div>

      {/* 업로드 진행률 */}
      {isUploading && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>업로드 중...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`bg-${colorScheme}-600 h-2 rounded-full transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 파일 업로드 영역 */}
      <div className="relative mb-3">
        <input
          type="file"
          id={`upload-${facilityType}-${facility.outlet}-${facility.number}-${instanceIndex}`}
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
          disabled={isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        />
        <div 
          className={dragZoneStyles(
            `${facilityType}-${facility.outlet}-${facility.number}-${instanceIndex}`,
            `border-2 border-dashed border-${colorScheme}-300 rounded-lg p-4 text-center transition-all duration-200
            ${isUploading ? `bg-${colorScheme}-100 border-${colorScheme}-400` : `hover:border-${colorScheme}-400 hover:bg-${colorScheme}-50`}
            ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`
          )}
          {...dragHandlers}
        >
          <Upload className={`w-8 h-8 text-${colorScheme}-600 mx-auto mb-2 transition-transform duration-200`} />
          <p className={`text-${colorScheme}-700 font-medium`}>
            {isUploading ? '업로드 중...' : '사진 업로드 (여러 장 선택 가능)'}
          </p>
          <p className={`text-${colorScheme}-600 text-sm mt-1`}>
            클릭하거나 파일을 드래그하여 업로드
          </p>
        </div>
      </div>

      {/* 업로드된 사진들 */}
      {photos.length > 0 && (
        <InlinePhotoViewer 
          photos={photos} 
          onPhotoSelect={onPhotoSelect} 
          viewMode={viewMode}
          colorScheme={colorScheme}
          recentPhotoIds={recentPhotoIds}
          businessName={businessName}
          facilityType={facilityType}
          facilityNumber={facility.number}
          outletNumber={facility.outlet}
          category={undefined}
          loadUploadedFiles={loadUploadedFiles}
        />
      )}
    </div>
  );
}

// 기본사진 카테고리 컴포넌트
interface BasicPhotoCategoryProps {
  category: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  isUploading: boolean;
  progress: number;
  photos: FacilityPhoto[];
  onUpload: (files: FileList) => void;
  onPhotoSelect: (photo: FacilityPhoto, event: React.MouseEvent) => void;
  viewMode: ViewMode;
  dragHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  dragZoneStyles: (zoneId: string, baseStyles?: string) => string;
  recentPhotoIds?: Set<string>;
  businessName: string;
  loadUploadedFiles: (forceRefresh?: boolean, highlightNew?: boolean) => Promise<void>;
}

function BasicPhotoCategory({
  category,
  title,
  icon,
  color,
  isUploading,
  progress,
  photos,
  onUpload,
  onPhotoSelect,
  viewMode,
  dragHandlers,
  dragZoneStyles,
  recentPhotoIds,
  businessName,
  loadUploadedFiles
}: BasicPhotoCategoryProps) {
  return (
    <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4`}>
      <h4 className={`text-md font-medium text-${color}-700 mb-3 flex items-center gap-2`}>
        {icon}
        {title}
        <span className={`text-xs bg-${color}-100 text-${color}-700 px-2 py-1 rounded ml-auto`}>
          {photos.length}장
        </span>
      </h4>
      
      {/* 업로드 진행률 */}
      {isUploading && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>업로드 중...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`bg-${color}-600 h-2 rounded-full transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 업로드 영역 */}
      <div className="relative mb-3">
        <input
          type="file"
          id={`upload-${category}`}
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
          disabled={isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        />
        <div 
          className={dragZoneStyles(
            `basic-${category}`,
            `border-2 border-dashed border-${color}-300 rounded-lg p-4 text-center transition-all duration-200
            ${isUploading ? `bg-${color}-100 border-${color}-400` : `hover:border-${color}-400 hover:bg-${color}-50`}
            ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`
          )}
          {...dragHandlers}
        >
          <Upload className={`w-8 h-8 text-${color}-600 mx-auto mb-2 transition-transform duration-200`} />
          <p className={`text-${color}-700 font-medium`}>
            {isUploading ? '업로드 중...' : `${title} 사진 업로드`}
          </p>
          <p className={`text-${color}-600 text-sm mt-1`}>
            클릭하거나 파일을 드래그하여 업로드
          </p>
        </div>
      </div>

      {/* 업로드된 사진들 */}
      {photos.length > 0 && (
        <InlinePhotoViewer 
          photos={photos} 
          onPhotoSelect={onPhotoSelect} 
          viewMode={viewMode}
          colorScheme={color}
          recentPhotoIds={recentPhotoIds}
          businessName={businessName}
          facilityType="basic"
          facilityNumber={undefined}
          outletNumber={undefined}
          category={category}
          loadUploadedFiles={loadUploadedFiles}
        />
      )}
    </div>
  );
}

// 인라인 확장 사진 뷰어 컴포넌트
interface InlinePhotoViewerProps {
  photos: FacilityPhoto[];
  onPhotoSelect: (photo: FacilityPhoto, event: React.MouseEvent) => void;
  viewMode: ViewMode;
  colorScheme: string;
  recentPhotoIds?: Set<string>;
  // 시설 정보 추가
  businessName: string;
  facilityType?: 'discharge' | 'prevention' | 'basic';
  facilityNumber?: number;
  outletNumber?: number;
  category?: string;
  loadUploadedFiles: (forceRefresh?: boolean, highlightNew?: boolean) => Promise<void>;
}

function InlinePhotoViewer({ photos, onPhotoSelect, viewMode, colorScheme, recentPhotoIds, businessName, facilityType, facilityNumber, outletNumber, category, loadUploadedFiles }: InlinePhotoViewerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const expandedRef = useRef<HTMLDivElement>(null);
  const expandedContentRef = useRef<HTMLDivElement>(null);
  
  // 📷 메인 컴포넌트에서 이미 getFilteredPhotos()로 필터링된 배열을 받음
  // 따라서 추가 필터링 불필요, photos를 직접 사용
  console.log('🔍 [INLINE-VIEWER-DEBUG]', {
    receivedPhotos: photos.length,
    facilityType,
    facilityNumber,
    outletNumber,
    category
  });

  // 사진 클릭 핸들러 - 인라인 확장
  const handlePhotoClick = useCallback((photo: FacilityPhoto, index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (expandedIndex === index) {
      // 이미 확장된 사진을 다시 클릭하면 닫기
      setExpandedIndex(null);
    } else {
      setIsAnimating(true);
      setExpandedIndex(index);
      
      // 확장 애니메이션 후 스크롤
      setTimeout(() => {
        expandedRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'nearest'
        });
        setIsAnimating(false);
      }, 100);
    }
  }, [expandedIndex]);

  // 키보드 네비게이션 및 외부 클릭 처리
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (expandedIndex === null) return;

      switch (event.key) {
        case 'Escape':
          setExpandedIndex(null);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          setExpandedIndex(prev => prev === null ? null : Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setExpandedIndex(prev => prev === null ? null : Math.min(photos.length - 1, prev + 1));
          break;
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (expandedIndex === null) return;
      
      // 확장된 뷰어 내부를 클릭한 경우는 닫지 않음
      if (expandedContentRef.current?.contains(event.target as Node)) {
        return;
      }
      
      // 확장 영역 외부 클릭 시 닫기
      if (expandedRef.current && !expandedRef.current.contains(event.target as Node)) {
        setExpandedIndex(null);
      }
    };

    if (expandedIndex !== null) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expandedIndex, photos.length]);

  // 썸네일 그리드 렌더링
  const renderThumbnailGrid = () => {
    if (viewMode === 'list') {
      return (
        <div className="space-y-2">
          {photos.map((photo, index) => {
            const isRecentPhoto = recentPhotoIds?.has(photo.id);
            const isExpanded = expandedIndex === index;
            
            return (
              <div key={photo.id}>
                <div 
                  className={`flex items-center gap-3 p-2 bg-white rounded border cursor-pointer transition-all duration-300 ${
                    isExpanded ? 
                      `border-${colorScheme}-600 bg-${colorScheme}-100 shadow-md` :
                      isRecentPhoto ? 
                        `ring-2 ring-${colorScheme}-400 border-${colorScheme}-400 bg-${colorScheme}-50 animate-pulse shadow-lg` : 
                        `hover:border-${colorScheme}-400 border-gray-200`
                  }`}
                  onClick={(e) => handlePhotoClick(photo, index, e)}
                >
                  <div className={`w-12 h-12 bg-${colorScheme}-100 rounded flex items-center justify-center text-${colorScheme}-600 font-bold text-sm`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{photo.originalFileName}</div>
                    <div className="text-xs text-gray-500">
                      {(photo.fileSize / 1024 / 1024).toFixed(1)}MB • {new Date(photo.uploadedAt).toLocaleString()}
                    </div>
                  </div>
                  <Eye className="w-4 h-4 text-gray-400" />
                </div>
                
                {/* 인라인 확장 영역 - 리스트 모드 */}
                {isExpanded && (
                  <div 
                    ref={expandedRef}
                    className={`mt-3 mb-3 bg-white border-2 border-${colorScheme}-200 rounded-lg overflow-hidden transition-all duration-300 ${
                      isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
                    }`}
                  >
                    <div ref={expandedContentRef}>
                      <ExpandedPhotoSection 
                        photo={photo} 
                        photos={photos}
                        currentIndex={index}
                        colorScheme={colorScheme}
                        onNavigate={setExpandedIndex}
                        onClose={() => setExpandedIndex(null)}
                        onRefresh={() => loadUploadedFiles(true, true)}
                        businessName={businessName}
                        facilityType={facilityType}
                        facilityNumber={facilityNumber}
                        outletNumber={outletNumber}
                        category={category}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // 그리드 모드
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1 md:gap-3">
          {photos.map((photo, index) => {
            const isRecentPhoto = recentPhotoIds?.has(photo.id);
            const isExpanded = expandedIndex === index;
            
            return (
              <div 
                key={photo.id}
                className={`relative group cursor-pointer bg-white rounded-lg border-2 overflow-hidden aspect-[4/3] transition-all duration-300 ${
                  isExpanded ? 
                    `border-${colorScheme}-600 shadow-xl ring-2 ring-${colorScheme}-300` :
                    isRecentPhoto ? 
                      `border-${colorScheme}-400 shadow-xl ring-4 ring-${colorScheme}-200 animate-pulse transform scale-[1.02]` : 
                      `border-gray-200 hover:border-${colorScheme}-400 hover:shadow-md`
                }`}
                onClick={(e) => handlePhotoClick(photo, index, e)}
              >
                <div className={`absolute top-2 left-2 bg-${colorScheme}-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10`}>
                  {index + 1}
                </div>
                
                <LazyImage
                  src={photo.thumbnailUrl}
                  alt={photo.originalFileName}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  filePath={photo.filePath}
                />
                
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-white text-xs font-medium truncate">
                    {index + 1}번째 - {photo.originalFileName}
                  </p>
                </div>
                
                {photo.isRecent && (
                  <div className={`absolute inset-0 bg-${colorScheme}-400 bg-opacity-20 animate-pulse`} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* 인라인 확장 영역 - 그리드 모드 */}
        {expandedIndex !== null && (
          <div 
            ref={expandedRef}
            className={`bg-white border-2 border-${colorScheme}-200 rounded-lg overflow-hidden transition-all duration-300 ${
              isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
            }`}
          >
            <div ref={expandedContentRef}>
              <ExpandedPhotoSection 
                photo={photos[expandedIndex]} 
                photos={photos}
                currentIndex={expandedIndex}
                colorScheme={colorScheme}
                onNavigate={setExpandedIndex}
                onClose={() => setExpandedIndex(null)}
                onRefresh={() => loadUploadedFiles(true, true)}
                businessName={businessName}
                facilityType={facilityType}
                facilityNumber={facilityNumber}
                outletNumber={outletNumber}
                category={category}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return renderThumbnailGrid();
}

// 확장된 사진 섹션 컴포넌트
interface ExpandedPhotoSectionProps {
  photo: FacilityPhoto;
  photos: FacilityPhoto[];
  currentIndex: number;
  colorScheme: string;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onRefresh?: () => Promise<void>; // 삭제 후 새로고침 콜백 추가
  // 시설 정보 추가
  businessName: string;
  facilityType?: 'discharge' | 'prevention' | 'basic';
  facilityNumber?: number;
  // Jotai 삭제 함수들은 컴포넌트 내부에서 직접 사용
  outletNumber?: number;
  category?: string;
}

function ExpandedPhotoSection({ 
  photo, 
  photos, 
  currentIndex, 
  colorScheme, 
  onNavigate, 
  onClose,
  onRefresh,
  businessName,
  facilityType,
  facilityNumber,
  outletNumber,
  category
}: ExpandedPhotoSectionProps) {
  const toast = useToast();
  
  // 🔧 ExpandedPhotoSection에서 직접 Jotai 사용
  const markPhotoAsDeleted = useSetAtom(deletePhotoAtom);
  const markPhotoAsUndeleted = useSetAtom(undeletePhotoAtom);
  
  console.log('🔧 [EXPANDED-SCOPE] ExpandedPhotoSection에서 Jotai 함수 직접 정의:', !!markPhotoAsDeleted);
  
  // 🛡️ 방어 코드: photo가 undefined이거나 삭제된 경우 처리
  if (!photo) {
    console.warn('⚠️ [EXPANDED-PHOTO] photo 객체가 undefined입니다. 모달을 자동으로 닫습니다.');
    onClose();
    return null;
  }
  
  // 개별 다운로드
  const handleDownload = async () => {
    try {
      console.log('📥 [INDIVIDUAL-DOWNLOAD] 개별 다운로드 시작:', {
        photoId: photo.id,
        fileName: photo.originalFileName,
        currentIndex,
        totalPhotos: photos.length
      });
      
      // API를 통한 다운로드
      const response = await fetch(`/api/facility-photos/${photo.id}?download=true`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // 파일이 삭제되었을 가능성
          toast.warning('파일 없음', '이 파일은 삭제되었거나 이동되었습니다. 페이지를 새로고침합니다.');
          if (onRefresh) {
            await onRefresh();
          }
          return;
        }
        
        const errorData = await response.json();
        throw new Error(errorData.error || '다운로드 요청 실패');
      }
      
      // Blob으로 파일 데이터 받기
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // 다운로드 링크 생성 및 클릭
      const link = document.createElement('a');
      link.href = url;
      link.download = photo.originalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 메모리 정리
      window.URL.revokeObjectURL(url);
      
      console.log('✅ [INDIVIDUAL-DOWNLOAD] 다운로드 완료:', photo.originalFileName);
      toast.success('다운로드 완료', `${photo.originalFileName} 파일이 다운로드되었습니다.`);
      
    } catch (error) {
      console.error('❌ [INDIVIDUAL-DOWNLOAD] 다운로드 실패:', error);
      toast.error('다운로드 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  // 전체 ZIP 다운로드
  const handleDownloadAll = async () => {
    try {
      const requestBody = {
        businessName,
        facilityType,
        facilityNumber,
        outletNumber,
        category
      };

      console.log('📦 [ZIP-DOWNLOAD] 요청 시작:', requestBody);

      const response = await fetch('/api/facility-photos/download-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'ZIP 다운로드 요청 실패');
      }

      // ZIP 파일 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Content-Disposition 헤더에서 파일명 추출
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = '사진모음.zip';
      
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename\*?=['"]?([^'"]+)['"]?/);
        if (fileNameMatch) {
          fileName = decodeURIComponent(fileNameMatch[1]);
        }
      }

      // 다운로드 링크 생성 및 클릭
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // 정리
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ [ZIP-DOWNLOAD] 다운로드 완료:', fileName);
      
    } catch (error) {
      console.error('❌ [ZIP-DOWNLOAD] 오류:', error);
      alert(`ZIP 다운로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  return (
    <div className="p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`bg-${colorScheme}-600 text-white px-3 py-1 rounded-full text-sm font-medium`}>
            {currentIndex + 1} / {photos.length}
          </span>
          <h3 className="font-semibold text-gray-900 truncate">
            {photo?.originalFileName || photo?.fileName || '파일명 없음'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="닫기 (ESC)"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* 메인 레이아웃: 좌측 메인사진 + 우측 썸네일 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* 좌측: 메인 사진 */}
        <div className="lg:col-span-2">
          <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-[4/3]">
            <LazyImage
              src={photo.downloadUrl}
              alt={photo.originalFileName}
              className="w-full h-full object-contain"
              filePath={photo.filePath}
            />
            
            {/* 네비게이션 화살표 */}
            {currentIndex > 0 && (
              <button
                onClick={() => onNavigate(currentIndex - 1)}
                className={`absolute left-2 top-1/2 transform -translate-y-1/2 bg-${colorScheme}-600 text-white p-2 rounded-full hover:bg-${colorScheme}-700 transition-colors`}
                title="이전 사진 (←)"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            
            {currentIndex < photos.length - 1 && (
              <button
                onClick={() => onNavigate(currentIndex + 1)}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 bg-${colorScheme}-600 text-white p-2 rounded-full hover:bg-${colorScheme}-700 transition-colors`}
                title="다음 사진 (→)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* 사진 정보 */}
          <div className="mt-2 text-sm text-gray-600">
            <div>{(photo.fileSize / 1024 / 1024).toFixed(1)}MB • {new Date(photo.uploadedAt).toLocaleString()}</div>
          </div>
        </div>

        {/* 우측: 썸네일 리스트 */}
        <div className="lg:col-span-1">
          <h4 className="font-medium text-gray-900 mb-2">전체 사진</h4>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {photos.map((thumbPhoto, index) => (
              <div 
                key={thumbPhoto.id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all duration-200 ${
                  index === currentIndex 
                    ? `bg-${colorScheme}-100 border-2 border-${colorScheme}-400` 
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
                onClick={() => onNavigate(index)}
              >
                <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                  <LazyImage
                    src={thumbPhoto.thumbnailUrl}
                    alt={thumbPhoto.originalFileName}
                    className="w-full h-full object-cover"
                    filePath={thumbPhoto.filePath}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">
                    {index + 1}. {thumbPhoto.originalFileName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(thumbPhoto.fileSize / 1024 / 1024).toFixed(1)}MB
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단: 액션 버튼들 */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 justify-center pt-4 border-t">
        <button
          onClick={handleDownload}
          className={`bg-${colorScheme}-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-${colorScheme}-700 transition-colors flex items-center gap-1 md:gap-2 text-sm md:text-base font-medium`}
        >
          <Download className="w-3 md:w-4 h-3 md:h-4" />
          개별 다운로드
        </button>
        
        <button
          onClick={handleDownloadAll}
          className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 md:gap-2 text-sm md:text-base font-medium"
        >
          <Archive className="w-3 md:w-4 h-3 md:h-4" />
          전체 ZIP
        </button>
        
        <button
          onClick={async () => {
            console.log('🔥🔥 [EXPANDED-VIEWER-DELETE] 확장 뷰어의 삭제 버튼 클릭됨!');
            if (confirm(`"${photo.originalFileName}" 파일을 삭제하시겠습니까?`)) {
              console.log('🚀 [EXPANDED-DELETE-START] 확장 뷰어에서 삭제 진행');
              
              // 🎯 Jotai를 사용한 즉시 UI 업데이트
              markPhotoAsDeleted(photo.id);
              console.log('⚡ [EXPANDED-INSTANT-DELETE] markPhotoAsDeleted 호출완료');
              
              // ✅ 모달 닫지 않음 - 사용자가 계속 다른 사진들을 볼 수 있도록
              // onClose(); // 주석 처리 - 모달 닫지 않음
              console.log('👁️ [EXPANDED-MODAL-KEEP] 확장 뷰어 유지 - 모달 닫지 않음');
              
              // 성공 메시지 즉시 표시
              toast.success('삭제 완료', '사진이 성공적으로 삭제되었습니다.');
              
              try {
                // 백그라운드에서 실제 API 삭제
                const response = await fetch('/api/facility-photos', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    photoId: photo.id, 
                    businessName: businessName
                  })
                });

                const result = await response.json();
                
                if (!result.success) {
                  // API 실패 시 롤백
                  console.error('❌ [EXPANDED-DELETE-API-FAILED]', result.message);
                  markPhotoAsUndeleted(photo.id);
                  toast.error('삭제 실패', result.message || '삭제 중 오류가 발생했습니다.');
                } else {
                  console.log('✅ [EXPANDED-DELETE-API-SUCCESS] 서버에서도 삭제 완료');
                }
              } catch (error) {
                console.error('❌ [EXPANDED-DELETE-API-ERROR]', error);
                markPhotoAsUndeleted(photo.id);
                toast.error('삭제 오류', '사진 삭제 중 문제가 발생했습니다. 다시 시도해주세요.');
              }
            }
          }}
          className="bg-red-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1 md:gap-2 text-sm md:text-base font-medium"
        >
          <Trash2 className="w-3 md:w-4 h-3 md:h-4" />
          삭제
        </button>
      </div>
    </div>
  );
}

// 사진 상세 모달 컴포넌트
interface PhotoDetailModalProps {
  photo: FacilityPhoto;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: () => void;
}

const PhotoDetailModal = forwardRef<HTMLDivElement, PhotoDetailModalProps>(
  ({ photo, position, onClose, onDelete }, ref) => {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 animate-fade-in"
        style={{ backdropFilter: 'blur(4px)' }}
      >
        <div 
          ref={ref}
          tabIndex={-1}
          className="fixed bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden focus:outline-none"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            maxWidth: '600px',
            maxHeight: '80vh',
            minWidth: '400px',
            transform: 'scale(0.95)',
            animation: 'modalSlideIn 0.2s ease-out forwards'
          }}
        >
          {/* 모달 헤더 */}
          <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
            <div>
              <h3 className="font-semibold text-gray-900 truncate">
                {photo.originalFileName}
              </h3>
              <p className="text-sm text-gray-600">
                {(photo.fileSize / 1024 / 1024).toFixed(1)}MB • {new Date(photo.uploadedAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* 모달 이미지 */}
          <div className="p-4">
            <div className="relative bg-gray-100 rounded-lg overflow-hidden">
              <LazyImage
                src={photo.downloadUrl}
                alt={photo.originalFileName}
                className="w-full max-h-[70vh] object-contain"
                filePath={photo.filePath}
              />
            </div>
            
            {/* 액션 버튼 */}
            <div className="flex flex-col md:flex-row gap-2 md:gap-3 justify-center mt-4">
              <a
                href={photo.downloadUrl}
                download={photo.originalFileName}
                className="bg-blue-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 md:gap-2 text-sm md:text-base font-medium"
              >
                <Download className="w-3 md:w-4 h-3 md:h-4" />
                다운로드
              </a>
              
              <button
                onClick={() => {
                  console.log('🔥 [DEBUG] 삭제 버튼이 클릭되었습니다!');
                  onDelete();
                }}
                className="bg-red-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1 md:gap-2 text-sm md:text-base font-medium"
              >
                <Trash2 className="w-3 md:w-4 h-3 md:h-4" />
                삭제
              </button>
            </div>
          </div>

          {/* ESC 힌트 */}
          <div className="absolute top-4 right-16 text-xs text-gray-500 bg-white bg-opacity-90 px-2 py-1 rounded">
            ESC 또는 외부 클릭으로 닫기
          </div>
        </div>
      </div>
    );
  }
);

PhotoDetailModal.displayName = 'PhotoDetailModal';