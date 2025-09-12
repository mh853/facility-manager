// components/ui/AdvancedUploadProgress.tsx
// 고도화된 업로드 진행률 표시 - SmartQueue 연동

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, 
  FileImage, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Zap,
  Loader2,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { smartUploadQueue, QueuedUpload, UploadQueueStats } from '@/utils/smart-upload-queue';

interface AdvancedUploadProgressProps {
  isVisible: boolean;
  autoHideDelay?: number;
  onClose?: () => void;
}

interface UploadStatusInfo {
  currentUpload?: QueuedUpload;
  queueStats: UploadQueueStats;
  showDetails: boolean;
}

export function AdvancedUploadProgress({
  isVisible,
  autoHideDelay = 3000,
  onClose
}: AdvancedUploadProgressProps) {
  const [mounted, setMounted] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [statusInfo, setStatusInfo] = useState<UploadStatusInfo>({
    queueStats: {
      totalUploads: 0,
      queuedUploads: 0,
      activeUploads: 0,
      completedUploads: 0,
      failedUploads: 0,
      totalFiles: 0,
      uploadedFiles: 0,
      averageUploadTime: 0
    },
    showDetails: false
  });
  const [activeUploads, setActiveUploads] = useState<Map<string, QueuedUpload>>(new Map());

  // 클라이언트 사이드에서만 Portal 렌더링
  useEffect(() => {
    setMounted(true);
  }, []);

  // 업로드 큐 통계 구독
  useEffect(() => {
    const unsubscribe = smartUploadQueue.onStatsChange((stats) => {
      setStatusInfo(prev => ({
        ...prev,
        queueStats: stats
      }));

      // 자동 표시/숨김 로직
      if (stats.activeUploads > 0 || stats.queuedUploads > 0) {
        setShouldShow(true);
      } else if (stats.totalUploads > 0 && stats.activeUploads === 0 && stats.queuedUploads === 0) {
        // 모든 업로드 완료 시 자동 숨김 (실패가 없는 경우에만)
        if (stats.failedUploads === 0) {
          setTimeout(() => {
            setShouldShow(false);
          }, autoHideDelay);
        }
      }
    });

    return unsubscribe;
  }, [autoHideDelay]);

  // 수동 닫기 처리
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    setShouldShow(false);
  };

  // 세부 정보 토글
  const toggleDetails = () => {
    setStatusInfo(prev => ({
      ...prev,
      showDetails: !prev.showDetails
    }));
  };

  // 현재 상태 분석
  const getCurrentStatus = () => {
    const { queueStats } = statusInfo;
    
    if (queueStats.activeUploads > 0) {
      const compressingCount = Array.from(activeUploads.values())
        .filter(upload => upload.status === 'compressing').length;
      
      if (compressingCount > 0) {
        return {
          phase: 'compressing',
          message: '이미지 압축 중...',
          icon: <Zap className="w-4 h-4 animate-pulse" />,
          color: 'blue'
        };
      } else {
        return {
          phase: 'uploading',
          message: '업로드 중...',
          icon: <Upload className="w-4 h-4 animate-pulse" />,
          color: 'blue'
        };
      }
    } else if (queueStats.queuedUploads > 0) {
      return {
        phase: 'queued',
        message: '대기 중...',
        icon: <Clock className="w-4 h-4" />,
        color: 'yellow'
      };
    } else if (queueStats.failedUploads > 0) {
      return {
        phase: 'failed',
        message: '업로드 실패',
        icon: <XCircle className="w-4 h-4" />,
        color: 'red'
      };
    } else if (queueStats.completedUploads > 0) {
      return {
        phase: 'completed',
        message: '업로드 완료!',
        icon: <CheckCircle2 className="w-4 h-4" />,
        color: 'green'
      };
    }

    return {
      phase: 'idle',
      message: '준비',
      icon: <Upload className="w-4 h-4" />,
      color: 'gray'
    };
  };

  const status = getCurrentStatus();
  const { queueStats } = statusInfo;

  // 전체 진행률 계산
  const overallProgress = queueStats.totalFiles > 0 
    ? Math.round((queueStats.uploadedFiles / queueStats.totalFiles) * 100)
    : 0;

  // 상태별 스타일링
  const getStatusStyles = () => {
    const colorMap = {
      blue: {
        bg: 'bg-blue-50 border-blue-200',
        icon: 'text-blue-500',
        bar: 'bg-gradient-to-r from-blue-500 to-blue-600',
        text: 'text-blue-700'
      },
      green: {
        bg: 'bg-green-50 border-green-200',
        icon: 'text-green-500',
        bar: 'bg-green-500',
        text: 'text-green-700'
      },
      red: {
        bg: 'bg-red-50 border-red-200',
        icon: 'text-red-500',
        bar: 'bg-red-500',
        text: 'text-red-700'
      },
      yellow: {
        bg: 'bg-yellow-50 border-yellow-200',
        icon: 'text-yellow-500',
        bar: 'bg-yellow-500',
        text: 'text-yellow-700'
      },
      gray: {
        bg: 'bg-gray-50 border-gray-200',
        icon: 'text-gray-500',
        bar: 'bg-gray-500',
        text: 'text-gray-700'
      }
    };

    return colorMap[status.color as keyof typeof colorMap] || colorMap.gray;
  };

  const styles = getStatusStyles();

  // Portal로 body에 직접 렌더링
  if (!mounted || !shouldShow) return null;

  return createPortal(
    <div className={`
      fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50
      transition-all duration-300 ease-in-out
      ${shouldShow ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
    `}>
      <div className={`
        ${styles.bg} rounded-lg shadow-lg
        px-4 py-3 mx-4
        min-w-[350px] max-w-[500px] w-full
        backdrop-blur-sm transition-all duration-300
      `}>
        {/* 헤더: 상태 + 통계 + 닫기 버튼 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={styles.icon}>
              {status.icon}
            </div>
            <span className={`text-sm font-medium ${styles.text}`}>
              {status.message}
            </span>
            
            {/* 큐 정보 */}
            {queueStats.totalUploads > 0 && (
              <div className="flex items-center gap-1 ml-2">
                <Layers className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {queueStats.activeUploads + queueStats.queuedUploads > 0 ? (
                    `${queueStats.activeUploads}개 진행중, ${queueStats.queuedUploads}개 대기`
                  ) : (
                    `${queueStats.completedUploads}개 완료`
                  )}
                </span>
              </div>
            )}

            {/* 세부사항 토글 */}
            {queueStats.totalUploads > 1 && (
              <button 
                onClick={toggleDetails}
                className="ml-2 p-1 hover:bg-black/10 rounded-full transition-colors"
              >
                {statusInfo.showDetails ? (
                  <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                )}
              </button>
            )}
          </div>
          
          {/* 파일 통계 + 닫기 버튼 */}
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              {queueStats.uploadedFiles}/{queueStats.totalFiles} 파일
              {queueStats.failedUploads > 0 && (
                <span className="text-red-500 ml-1">
                  ({queueStats.failedUploads}개 실패)
                </span>
              )}
            </div>
            
            {/* 닫기 버튼 */}
            {(queueStats.activeUploads === 0 && queueStats.queuedUploads === 0) && (
              <button
                onClick={handleClose}
                className="p-1 hover:bg-black/10 rounded-full transition-colors"
                title="닫기"
              >
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* 전체 진행률 바 */}
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`
                h-2.5 rounded-full transition-all duration-300 ease-out
                ${styles.bar}
              `}
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
          
          {/* 진행률 텍스트 */}
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${styles.text}`}>
              {overallProgress}% 완료
            </span>
            
            {/* 평균 업로드 시간 */}
            {queueStats.averageUploadTime > 0 && (
              <span className="text-xs text-gray-500">
                평균: {(queueStats.averageUploadTime / 1000).toFixed(1)}초
              </span>
            )}
          </div>
        </div>

        {/* 세부 정보 (확장 가능) */}
        {statusInfo.showDetails && queueStats.totalUploads > 0 && (
          <div className="mt-4 pt-3 border-t space-y-2">
            <div className="text-xs font-medium text-gray-700 mb-2">
              업로드 현황:
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">완료된 시설:</span>
                <span className="font-medium text-green-600">{queueStats.completedUploads}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">진행 중:</span>
                <span className="font-medium text-blue-600">{queueStats.activeUploads}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">대기 중:</span>
                <span className="font-medium text-yellow-600">{queueStats.queuedUploads}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">실패:</span>
                <span className="font-medium text-red-600">{queueStats.failedUploads}</span>
              </div>
            </div>

            {/* 압축 정보 */}
            {status.phase === 'compressing' && (
              <div className="mt-2 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
                💡 이미지를 압축하여 업로드 속도를 개선하고 있습니다.
              </div>
            )}
          </div>
        )}

        {/* 완료 메시지 */}
        {status.phase === 'completed' && queueStats.failedUploads === 0 && (
          <div className="text-center mt-3">
            <span className="text-xs text-green-600">
              🎉 모든 파일이 성공적으로 업로드되었습니다!
            </span>
          </div>
        )}

        {/* 부분 완료 메시지 */}
        {status.phase === 'completed' && queueStats.failedUploads > 0 && (
          <div className="text-center mt-3">
            <span className="text-xs text-yellow-600">
              ⚠️ 일부 파일 업로드가 실패했습니다. 세부사항을 확인해주세요.
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default AdvancedUploadProgress;