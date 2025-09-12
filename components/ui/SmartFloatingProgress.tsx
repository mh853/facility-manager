// components/ui/SmartFloatingProgress.tsx
// 스마트 호버 진행상황 표시 - 하단 중앙 고정, 업로드 중에만 표시

'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, FileImage, AlertTriangle, Clock, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface SmartFloatingProgressProps {
  // 표시 여부
  isVisible: boolean;
  // 파일 정보
  totalFiles: number;
  completedFiles: number;
  currentFileName?: string;
  // 진행률
  overallProgress: number;
  // 자동 숨김 설정
  autoHideDelay?: number; // 완료 후 자동 숨김 딜레이 (ms)
  // 에러 정보 추가
  failedFiles?: number;
  errorMessage?: string;
  isStuck?: boolean; // 진행이 멈춤
  stuckReason?: string; // 멈춤 이유
  detailedErrors?: Array<{
    fileName: string;
    error: string;
    timestamp: number;
  }>;
}

export function SmartFloatingProgress({
  isVisible,
  totalFiles,
  completedFiles,
  currentFileName,
  overallProgress,
  autoHideDelay = 2000,
  failedFiles = 0,
  errorMessage,
  isStuck = false,
  stuckReason,
  detailedErrors = []
}: SmartFloatingProgressProps) {
  const [mounted, setMounted] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // 클라이언트 사이드에서만 Portal 렌더링
  useEffect(() => {
    setMounted(true);
  }, []);

  // 표시 상태 관리
  useEffect(() => {
    if (isVisible && totalFiles > 0) {
      setShouldShow(true);
      setIsCompleted(false);
    } else if (!isVisible && shouldShow) {
      // 업로드 완료 시 자동 숨김 처리
      setIsCompleted(true);
      const timeout = setTimeout(() => {
        setShouldShow(false);
        setIsCompleted(false);
      }, autoHideDelay);

      return () => clearTimeout(timeout);
    }
  }, [isVisible, totalFiles, shouldShow, autoHideDelay]);

  // 현재 파일명 단축 (너무 길면 줄임)
  const truncatedFileName = currentFileName && currentFileName.length > 25 
    ? `${currentFileName.substring(0, 22)}...` 
    : currentFileName;

  // 상태 판단 로직
  const hasErrors = failedFiles > 0 || errorMessage || detailedErrors.length > 0;
  const hasWarnings = isStuck && stuckReason;
  const isInProgress = !isCompleted && (totalFiles > completedFiles);
  
  // 상태별 스타일링
  const getStatusConfig = () => {
    if (isCompleted && !hasErrors) {
      return {
        bgColor: 'bg-green-50 border-green-200',
        iconColor: 'text-green-500',
        barColor: 'bg-green-500',
        status: '업로드 완료!'
      };
    }
    
    if (hasErrors) {
      return {
        bgColor: 'bg-red-50 border-red-200',
        iconColor: 'text-red-500',
        barColor: 'bg-red-500',
        status: '업로드 실패'
      };
    }
    
    if (hasWarnings || isStuck) {
      return {
        bgColor: 'bg-yellow-50 border-yellow-200',
        iconColor: 'text-yellow-500',
        barColor: 'bg-yellow-500',
        status: '업로드 지연'
      };
    }
    
    return {
      bgColor: 'bg-white border-gray-200',
      iconColor: 'text-blue-500',
      barColor: 'bg-gradient-to-r from-blue-500 to-blue-600',
      status: '업로드 중...'
    };
  };

  const statusConfig = getStatusConfig();

  // Portal로 body에 직접 렌더링
  if (!mounted || !shouldShow) return null;

  return createPortal(
    <div className={`
      fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50
      transition-all duration-300 ease-in-out
      ${shouldShow ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
    `}>
      <div className={`
        ${statusConfig.bgColor} rounded-lg shadow-lg
        px-4 py-3 mx-4
        min-w-[320px] max-w-[450px] w-full
        backdrop-blur-sm transition-all duration-300
        ${hasErrors || hasWarnings ? 'cursor-pointer' : ''}
      `}
      onClick={hasErrors || hasWarnings ? () => setShowDetails(!showDetails) : undefined}
      >
        {/* 헤더: 업로드 상태 + 파일 개수 + 에러 표시 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {hasErrors ? (
              <XCircle className={`w-4 h-4 ${statusConfig.iconColor}`} />
            ) : hasWarnings ? (
              <AlertTriangle className={`w-4 h-4 ${statusConfig.iconColor}`} />
            ) : isStuck ? (
              <Clock className={`w-4 h-4 ${statusConfig.iconColor}`} />
            ) : (
              <Upload className={`
                w-4 h-4 ${statusConfig.iconColor}
                ${isInProgress ? 'animate-pulse' : ''}
              `} />
            )}
            <span className="text-sm font-medium text-gray-700">
              {statusConfig.status}
            </span>
            {(hasErrors || hasWarnings) && (
              <button className="ml-1">
                {showDetails ? (
                  <ChevronUp className="w-3 h-3 text-gray-400" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                )}
              </button>
            )}
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <span>{completedFiles}/{totalFiles} files</span>
            {failedFiles > 0 && (
              <span className="text-red-500">({failedFiles} 실패)</span>
            )}
          </div>
        </div>

        {/* 현재 파일명 표시 */}
        {truncatedFileName && !isCompleted && (
          <div className="flex items-center gap-2 mb-3">
            <FileImage className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-600 truncate">
              현재: {truncatedFileName}
            </span>
          </div>
        )}

        {/* 에러 메시지 또는 멈춤 이유 */}
        {(errorMessage || stuckReason) && !showDetails && (
          <div className="mb-3 text-xs text-gray-600 bg-gray-100 rounded px-2 py-1">
            {errorMessage || stuckReason}
          </div>
        )}

        {/* 진행률 바 */}
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`
                h-2 rounded-full transition-all duration-300 ease-out
                ${statusConfig.barColor}
              `}
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
          
          {/* 진행률 텍스트 */}
          <div className="text-center">
            <span className="text-sm font-medium text-gray-700">
              {Math.round(overallProgress)}% 완료
            </span>
          </div>
        </div>

        {/* 상세 에러 정보 (확장 가능) */}
        {showDetails && (hasErrors || hasWarnings) && (
          <div className="mt-3 space-y-2 border-t pt-3">
            {/* 일반 에러 메시지 */}
            {errorMessage && (
              <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                <strong>에러:</strong> {errorMessage}
              </div>
            )}
            
            {/* 멈춤 이유 */}
            {stuckReason && (
              <div className="text-xs text-yellow-600 bg-yellow-50 rounded px-2 py-1">
                <strong>지연 사유:</strong> {stuckReason}
              </div>
            )}
            
            {/* 개별 파일 에러 목록 */}
            {detailedErrors.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-700">
                  파일별 에러 ({detailedErrors.length}개):
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {detailedErrors.slice(0, 3).map((error, index) => (
                    <div key={index} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                      <div className="font-medium truncate">{error.fileName}</div>
                      <div className="text-red-500">{error.error}</div>
                    </div>
                  ))}
                  {detailedErrors.length > 3 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{detailedErrors.length - 3}개 더...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 완료 후 추가 정보 */}
        {isCompleted && (
          <div className="text-center mt-2">
            <span className="text-xs text-green-600">
              {totalFiles}개 파일이 성공적으로 업로드되었습니다
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default SmartFloatingProgress;