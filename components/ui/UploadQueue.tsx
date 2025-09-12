// components/ui/UploadQueue.tsx
// 업로드 큐 상태를 표시하는 컴포넌트

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Upload, CheckCircle, AlertTriangle, Clock, X, RefreshCw, Archive } from 'lucide-react';
import { OptimisticPhoto, UploadQueueStats } from '@/hooks/useOptimisticUpload';
import ProgressUploadCard from './ProgressUploadCard';

interface UploadQueueProps {
  photos: OptimisticPhoto[];
  stats: UploadQueueStats;
  isProcessing: boolean;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
  onForceUpload?: (id: string) => void;
  onClearCompleted?: () => void;
  onCancelAll?: () => void;
  className?: string;
}

export default function UploadQueue({
  photos,
  stats,
  isProcessing,
  onCancel,
  onRetry,
  onRemove,
  onForceUpload,
  onClearCompleted,
  onCancelAll,
  className = ''
}: UploadQueueProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // 활성 상태 필터
  const activePhotos = photos.filter(photo => 
    photo.status === 'preparing' || 
    photo.status === 'uploading' || 
    photo.status === 'error'
  );

  const completedPhotos = photos.filter(photo => 
    photo.status === 'uploaded' || 
    photo.status === 'cancelled'
  );

  // 큐가 비어있으면 표시하지 않음
  if (photos.length === 0) return null;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* 헤더 - 요약 정보 */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          {isProcessing ? (
            <Upload className="w-5 h-5 text-blue-500 animate-pulse" />
          ) : (
            <Archive className="w-5 h-5 text-gray-500" />
          )}
          
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              업로드 진행 상황
              {isProcessing && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  진행 중
                </span>
              )}
            </h3>
            
            <div className="flex items-center space-x-4 text-xs text-gray-600 mt-1">
              {stats.completed > 0 && (
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span>완료: {stats.completed}</span>
                </div>
              )}
              
              {stats.uploading > 0 && (
                <div className="flex items-center space-x-1">
                  <Upload className="w-3 h-3 text-blue-500" />
                  <span>업로드 중: {stats.uploading}</span>
                </div>
              )}
              
              {stats.pending > 0 && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-orange-500" />
                  <span>대기: {stats.pending}</span>
                </div>
              )}
              
              {stats.failed > 0 && (
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  <span>실패: {stats.failed}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 헤더 액션 */}
        <div className="flex items-center space-x-2">
          {/* 전체 취소 버튼 */}
          {(stats.uploading > 0 || stats.pending > 0) && onCancelAll && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('모든 업로드를 취소하시겠습니까?')) {
                  onCancelAll();
                }
              }}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="모든 업로드 취소"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* 완료된 항목 정리 */}
          {stats.completed > 0 && onClearCompleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearCompleted();
              }}
              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
              title="완료된 항목 정리"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}

          {/* 펼치기/접기 버튼 */}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* 전체 진행률 바 */}
      {stats.total > 0 && (
        <div className="px-4 pb-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
              style={{ 
                width: `${Math.round((stats.completed / stats.total) * 100)}%` 
              }}
            />
          </div>
          <div className="text-xs text-gray-600 mt-1 text-right">
            {stats.completed} / {stats.total} 완료 ({Math.round((stats.completed / stats.total) * 100)}%)
          </div>
        </div>
      )}

      {/* 상세 내용 */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* 활성 업로드 */}
          {activePhotos.length > 0 && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                  활성 업로드
                </h4>
                <span className="text-xs text-gray-500">
                  {activePhotos.length}개 항목
                </span>
              </div>
              
              <div className="space-y-2">
                {activePhotos.map(photo => (
                  <ProgressUploadCard
                    key={photo.id}
                    photo={photo}
                    onCancel={onCancel}
                    onRetry={onRetry}
                    onRemove={onRemove}
                    onForceUpload={onForceUpload}
                    compact={true}
                    showPreview={false}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 완료된 업로드 (선택적 표시) */}
          {completedPhotos.length > 0 && (
            <div className="border-t border-gray-100">
              <div 
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                  완료된 업로드
                </h4>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    {completedPhotos.length}개 항목
                  </span>
                  {showCompleted ? (
                    <ChevronUp className="w-3 h-3 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  )}
                </div>
              </div>

              {showCompleted && (
                <div className="px-4 pb-4 space-y-2">
                  {completedPhotos.slice(0, 10).map(photo => (
                    <ProgressUploadCard
                      key={photo.id}
                      photo={photo}
                      onRemove={onRemove}
                      onForceUpload={onForceUpload}
                      compact={true}
                      showPreview={false}
                    />
                  ))}
                  
                  {completedPhotos.length > 10 && (
                    <div className="text-xs text-gray-500 text-center py-2">
                      ... 및 {completedPhotos.length - 10}개 더
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 빈 상태 */}
          {activePhotos.length === 0 && completedPhotos.length === 0 && (
            <div className="p-8 text-center">
              <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">업로드할 파일이 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}