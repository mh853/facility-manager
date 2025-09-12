// components/ui/MobileStickyProgress.tsx
// 모바일에서 화면 하단에 고정되는 업로드 진행률 표시기

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Upload, CheckCircle, AlertTriangle, X, Minimize2 } from 'lucide-react';
import { OptimisticPhoto, UploadQueueStats } from '@/hooks/useOptimisticUpload';

interface MobileStickyProgressProps {
  photos: OptimisticPhoto[];
  stats: UploadQueueStats;
  isProcessing: boolean;
  className?: string;
}

export default function MobileStickyProgress({
  photos,
  stats,
  isProcessing,
  className = ''
}: MobileStickyProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // 활성 업로드가 없으면 표시하지 않음
  const activePhotos = photos.filter(photo => 
    photo.status === 'uploading' || 
    photo.status === 'preparing' || 
    photo.status === 'error'
  );

  if (activePhotos.length === 0 && !isProcessing) return null;

  // 전체 진행률 계산
  const totalProgress = photos.length > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  // 현재 업로드 중인 사진들의 평균 진행률
  const currentUploads = photos.filter(p => p.status === 'uploading');
  const currentProgress = currentUploads.length > 0
    ? Math.round(currentUploads.reduce((sum, p) => sum + p.progress, 0) / currentUploads.length)
    : 0;

  // 최소화된 상태
  if (isMinimized) {
    return (
      <div className={`fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg z-50 md:hidden ${className}`}>
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center space-x-2"
        >
          <Upload className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-medium">{totalProgress}%</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 md:hidden ${className}`}>
      {/* 메인 헤더 */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          {isProcessing ? (
            <Upload className="w-5 h-5 text-blue-500 animate-pulse" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              업로드 진행 중
            </h3>
            <div className="text-xs text-gray-600">
              {stats.completed}/{stats.total} 완료 ({totalProgress}%)
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* 최소화 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          {/* 펼치기/접기 버튼 */}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="px-4 pb-2">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      {/* 상세 정보 (확장된 상태) */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 space-y-3 max-h-60 overflow-y-auto">
          {/* 상태별 요약 */}
          <div className="grid grid-cols-4 gap-2 text-xs text-center">
            <div className="flex flex-col items-center space-y-1">
              <Upload className="w-4 h-4 text-blue-500" />
              <span className="text-blue-600 font-medium">{stats.uploading}</span>
              <span className="text-gray-500">업로드</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-600 font-medium">{stats.completed}</span>
              <span className="text-gray-500">완료</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-red-600 font-medium">{stats.failed}</span>
              <span className="text-gray-500">실패</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <X className="w-4 h-4 text-orange-500" />
              <span className="text-orange-600 font-medium">{stats.duplicates}</span>
              <span className="text-gray-500">중복</span>
            </div>
          </div>

          {/* 현재 업로드 중인 파일들 (최대 3개) */}
          {currentUploads.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                현재 업로드 중
              </h4>
              {currentUploads.slice(0, 3).map(photo => (
                <div key={photo.id} className="flex items-center space-x-3 p-2 bg-blue-50 rounded">
                  <Upload className="w-4 h-4 text-blue-500 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {photo.file.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(photo.file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-blue-600">
                    {photo.progress}%
                  </div>
                </div>
              ))}
              
              {currentUploads.length > 3 && (
                <div className="text-xs text-gray-500 text-center">
                  ... 및 {currentUploads.length - 3}개 더
                </div>
              )}
            </div>
          )}

          {/* 실패한 파일들 (최대 2개) */}
          {stats.failed > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-red-700 uppercase tracking-wide">
                업로드 실패
              </h4>
              {photos.filter(p => p.status === 'error').slice(0, 2).map(photo => (
                <div key={photo.id} className="flex items-center space-x-3 p-2 bg-red-50 rounded">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {photo.file.name}
                    </div>
                    <div className="text-xs text-red-600">
                      {photo.error || '업로드 실패'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}