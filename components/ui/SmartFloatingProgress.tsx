// components/ui/SmartFloatingProgress.tsx
// 스마트 호버 진행상황 표시 - 하단 중앙 고정, 업로드 중에만 표시

'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, FileImage, AlertTriangle, Clock, XCircle, ChevronDown, ChevronUp, X } from 'lucide-react';

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
  // 수동 닫기 기능
  onClose?: () => void; // 닫기 콜백
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
  detailedErrors = [],
  onClose
}: SmartFloatingProgressProps) {
  const [mounted, setMounted] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // 클라이언트 사이드에서만 Portal 렌더링
  useEffect(() => {
    setMounted(true);
  }, []);

  // 수동 닫기 처리
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    setShouldShow(false);
    setIsCompleted(false);
  };

  // 표시 상태 관리 (스마트 자동 숨김)
  useEffect(() => {
    if (isVisible && totalFiles > 0) {
      setShouldShow(true);
      setIsCompleted(false);
    } else if (!isVisible && shouldShow) {
      setIsCompleted(true);
      
      // 에러나 경고가 있으면 자동 숨김 하지 않음 (수동 닫기만 가능)
      const hasErrors = failedFiles > 0 || errorMessage || detailedErrors.length > 0;
      const hasWarnings = isStuck && stuckReason;
      
      if (!hasErrors && !hasWarnings) {
        // 성공적으로 완료된 경우에만 자동 숨김
        const timeout = setTimeout(() => {
          setShouldShow(false);
          setIsCompleted(false);
        }, autoHideDelay);

        return () => clearTimeout(timeout);
      }
      // 에러/경고가 있으면 사용자가 수동으로 닫을 때까지 유지
    }
  }, [isVisible, totalFiles, shouldShow, autoHideDelay, failedFiles, errorMessage, detailedErrors.length, isStuck, stuckReason]);

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
      fixed bottom-4 md:bottom-6 left-1/2 transform -translate-x-1/2 z-50
      transition-all duration-300 ease-in-out
      ${shouldShow ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
      touch-manipulation
    `}>
      <div className={`
        ${statusConfig.bgColor} rounded-lg shadow-lg
        px-4 py-3 mx-3 md:mx-4
        min-w-[300px] md:min-w-[320px] max-w-[400px] md:max-w-[450px] w-full
        backdrop-blur-sm transition-all duration-300
        ${hasErrors || hasWarnings ? 'cursor-pointer' : ''}
      `}
      onClick={hasErrors || hasWarnings ? () => setShowDetails(!showDetails) : undefined}
      >
        {/* 헤더: 업로드 상태 + 파일 개수 + 에러 표시 + 닫기 버튼 */}
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
          
          <div className="flex items-center gap-2">
            {/* 파일 개수 및 실패 표시 */}
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <span>{completedFiles}/{totalFiles} files</span>
              {failedFiles > 0 && (
                <span className="text-red-500">({failedFiles} 실패)</span>
              )}
            </div>
            
            {/* 닫기 버튼 - 조건에 상관없이 항상 표시 (모바일 터치 최적화) */}
            <button
              onClick={handleClose}
              className="p-2 md:p-1 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-full transition-all duration-200 touch-manipulation min-w-[40px] min-h-[40px] md:min-w-[32px] md:min-h-[32px] flex items-center justify-center"
              title="닫기"
            >
              <X className="w-5 h-5 md:w-4 md:h-4 text-gray-400 hover:text-gray-600" />
            </button>
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

        {/* 실패한 파일명 표시 (핵심 정보) */}
        {detailedErrors.length > 0 && !showDetails && (
          <div className="mb-3 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
            <strong>실패:</strong> {detailedErrors.slice(0, 2).map(e => e.fileName).join(', ')}
            {detailedErrors.length > 2 && ` +${detailedErrors.length - 2}개`}
          </div>
        )}

        {/* 에러 메시지 또는 멈춤 이유 (실패 파일명이 없는 경우만) */}
        {(errorMessage || stuckReason) && !showDetails && detailedErrors.length === 0 && (
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