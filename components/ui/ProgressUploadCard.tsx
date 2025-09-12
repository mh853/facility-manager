// components/ui/ProgressUploadCard.tsx
// 진행률을 표시하는 업로드 카드 컴포넌트

import React from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, Upload, Pause, Play } from 'lucide-react';
import { OptimisticPhoto } from '@/hooks/useOptimisticUpload';
import { formatFileSize } from '@/utils/upload-with-progress';

interface ProgressUploadCardProps {
  photo: OptimisticPhoto;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
  showPreview?: boolean;
  compact?: boolean;
}

export default function ProgressUploadCard({
  photo,
  onCancel,
  onRetry,
  onRemove,
  showPreview = true,
  compact = false
}: ProgressUploadCardProps) {
  const getStatusIcon = () => {
    switch (photo.status) {
      case 'preparing':
        return <Upload className="w-4 h-4 text-blue-500" />;
      case 'uploading':
        return <Upload className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'uploaded':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <Pause className="w-4 h-4 text-gray-500" />;
      default:
        return <Upload className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (photo.status) {
      case 'preparing': return 'border-blue-200 bg-blue-50';
      case 'uploading': return 'border-blue-300 bg-blue-50';
      case 'uploaded': return 'border-green-200 bg-green-50';
      case 'error': return 'border-red-200 bg-red-50';
      case 'cancelled': return 'border-gray-200 bg-gray-50';
      default: return 'border-gray-200 bg-white';
    }
  };

  const getProgressColor = () => {
    switch (photo.status) {
      case 'uploading': return 'bg-blue-500';
      case 'uploaded': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusText = () => {
    switch (photo.status) {
      case 'preparing': return '준비 중...';
      case 'uploading': return `업로드 중... ${photo.progress}%`;
      case 'uploaded': return '업로드 완료';
      case 'error': return photo.error || '업로드 실패';
      case 'cancelled': return '취소됨';
      default: return '대기 중';
    }
  };

  const duration = photo.endTime ? photo.endTime - photo.startTime : Date.now() - photo.startTime;
  const durationText = duration > 1000 ? `${Math.round(duration / 1000)}초` : `${duration}ms`;

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 p-2 rounded-lg border ${getStatusColor()}`}>
        {/* 아이콘 */}
        <div className="flex-shrink-0">
          {getStatusIcon()}
        </div>

        {/* 파일 정보 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {photo.file.name}
          </p>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span>{formatFileSize(photo.file.size)}</span>
            <span>•</span>
            <span>{getStatusText()}</span>
          </div>
        </div>

        {/* 진행률 바 */}
        {photo.status === 'uploading' && (
          <div className="flex-shrink-0 w-12">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                style={{ width: `${photo.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex-shrink-0 flex space-x-1">
          {photo.status === 'uploading' && onCancel && (
            <button
              onClick={() => onCancel(photo.id)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="업로드 취소"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          
          {photo.status === 'error' && onRetry && (
            <button
              onClick={() => onRetry(photo.id)}
              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
              title="다시 시도"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}

          {(photo.status === 'uploaded' || photo.status === 'error' || photo.status === 'cancelled') && onRemove && (
            <button
              onClick={() => onRemove(photo.id)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="제거"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()}`}>
      <div className="flex space-x-4">
        {/* 미리보기 이미지 */}
        {showPreview && photo.localPreview && (
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
              <img 
                src={photo.localPreview} 
                alt={photo.file.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* 파일 정보 및 진행률 */}
        <div className="flex-1 min-w-0">
          {/* 파일명 */}
          <div className="flex items-center space-x-2 mb-2">
            {getStatusIcon()}
            <h4 className="text-sm font-medium text-gray-800 truncate">
              {photo.file.name}
            </h4>
          </div>

          {/* 파일 크기 및 상태 */}
          <div className="flex items-center space-x-4 text-xs text-gray-600 mb-3">
            <span>{formatFileSize(photo.file.size)}</span>
            <span>•</span>
            <span>{durationText}</span>
            {photo.retryCount > 0 && (
              <>
                <span>•</span>
                <span className="text-orange-600">재시도 {photo.retryCount}회</span>
              </>
            )}
          </div>

          {/* 진행률 바 */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>{getStatusText()}</span>
              {photo.status === 'uploading' && (
                <span>{photo.progress}%</span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                style={{ 
                  width: photo.status === 'uploaded' ? '100%' : 
                         photo.status === 'error' ? '100%' :
                         `${photo.progress}%` 
                }}
              />
            </div>
          </div>

          {/* 에러 메시지 */}
          {photo.status === 'error' && photo.error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">
              {photo.error}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex space-x-2">
            {photo.status === 'uploading' && onCancel && (
              <button
                onClick={() => onCancel(photo.id)}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                <X className="w-3 h-3" />
                <span>취소</span>
              </button>
            )}

            {photo.status === 'error' && onRetry && (
              <button
                onClick={() => onRetry(photo.id)}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>재시도</span>
              </button>
            )}

            {(photo.status === 'uploaded' || photo.status === 'error' || photo.status === 'cancelled') && onRemove && (
              <button
                onClick={() => onRemove(photo.id)}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                <X className="w-3 h-3" />
                <span>제거</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}