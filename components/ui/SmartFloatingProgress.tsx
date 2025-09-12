// components/ui/SmartFloatingProgress.tsx
// 스마트 호버 진행상황 표시 - 하단 중앙 고정, 업로드 중에만 표시

'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, FileImage } from 'lucide-react';

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
}

export function SmartFloatingProgress({
  isVisible,
  totalFiles,
  completedFiles,
  currentFileName,
  overallProgress,
  autoHideDelay = 2000
}: SmartFloatingProgressProps) {
  const [mounted, setMounted] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

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

  // Portal로 body에 직접 렌더링
  if (!mounted || !shouldShow) return null;

  return createPortal(
    <div className={`
      fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50
      transition-all duration-300 ease-in-out
      ${shouldShow ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
    `}>
      <div className="
        bg-white border border-gray-200 rounded-lg shadow-lg
        px-4 py-3 mx-4
        min-w-[320px] max-w-[400px] w-full
        backdrop-blur-sm bg-white/95
      ">
        {/* 헤더: 업로드 상태 + 파일 개수 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Upload className={`
              w-4 h-4 
              ${isCompleted ? 'text-green-500' : 'text-blue-500'}
              ${!isCompleted ? 'animate-pulse' : ''}
            `} />
            <span className="text-sm font-medium text-gray-700">
              {isCompleted 
                ? '업로드 완료!' 
                : '업로드 중...'
              }
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {completedFiles}/{totalFiles} files
          </span>
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

        {/* 진행률 바 */}
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`
                h-2 rounded-full transition-all duration-300 ease-out
                ${isCompleted 
                  ? 'bg-green-500' 
                  : 'bg-gradient-to-r from-blue-500 to-blue-600'
                }
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