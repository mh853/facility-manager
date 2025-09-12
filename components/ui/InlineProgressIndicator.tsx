// components/ui/InlineProgressIndicator.tsx
// 각 시설 섹션에 표시되는 인라인 업로드 진행률 표시기

import React from 'react';
import { Upload, CheckCircle, AlertTriangle, X, Clock } from 'lucide-react';
import { OptimisticPhoto } from '@/hooks/useOptimisticUpload';

interface InlineProgressIndicatorProps {
  photos: OptimisticPhoto[];
  facilityType: 'discharge' | 'prevention' | 'basic';
  facilityId?: string; // 시설 고유 식별자 (basic의 경우 카테고리명)
  className?: string;
}

export default function InlineProgressIndicator({
  photos,
  facilityType,
  facilityId,
  className = ''
}: InlineProgressIndicatorProps) {
  
  // 해당 시설의 업로드 사진들 필터링
  const relevantPhotos = photos.filter(photo => {
    // 파일명이나 메타데이터를 통해 해당 시설의 사진인지 확인
    // 실제로는 additionalData에서 facilityId나 category 정보를 확인해야 함
    if (facilityType === 'basic') {
      // 기본사진의 경우 facilityId가 카테고리명
      return photo.file.name.includes(facilityId || '') || 
             photo.uploadedData?.category === facilityId;
    } else {
      // 시설사진의 경우
      return photo.file.name.includes(facilityId || '') ||
             photo.uploadedData?.facilityId === facilityId;
    }
  });

  // 진행 중인 업로드가 없으면 표시하지 않음
  const activePhotos = relevantPhotos.filter(photo => 
    photo.status === 'uploading' || photo.status === 'preparing'
  );
  
  const completedPhotos = relevantPhotos.filter(photo => photo.status === 'uploaded');
  const errorPhotos = relevantPhotos.filter(photo => photo.status === 'error');
  const duplicatePhotos = relevantPhotos.filter(photo => photo.status === 'duplicate');

  // 관련 업로드가 없으면 표시하지 않음
  if (relevantPhotos.length === 0) return null;

  const totalPhotos = relevantPhotos.length;
  const totalProgress = relevantPhotos.reduce((sum, photo) => sum + photo.progress, 0);
  const avgProgress = totalPhotos > 0 ? Math.round(totalProgress / totalPhotos) : 0;

  const getStatusColor = () => {
    if (errorPhotos.length > 0) return 'red';
    if (activePhotos.length > 0) return 'blue';
    if (completedPhotos.length === totalPhotos) return 'green';
    return 'orange';
  };

  const getStatusIcon = () => {
    if (errorPhotos.length > 0) return <AlertTriangle className="w-3 h-3" />;
    if (activePhotos.length > 0) return <Upload className="w-3 h-3 animate-pulse" />;
    if (completedPhotos.length === totalPhotos) return <CheckCircle className="w-3 h-3" />;
    return <Clock className="w-3 h-3" />;
  };

  const getStatusText = () => {
    if (errorPhotos.length > 0) return `${errorPhotos.length}장 실패`;
    if (activePhotos.length > 0) return `${activePhotos.length}장 업로드 중...`;
    if (completedPhotos.length === totalPhotos) return `${totalPhotos}장 완료`;
    return `${completedPhotos.length}/${totalPhotos}장 완료`;
  };

  const statusColor = getStatusColor();

  return (
    <div className={`bg-white border rounded-lg p-3 shadow-sm ${className}`}>
      {/* 상태 표시 */}
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center space-x-2 text-${statusColor}-600`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
        
        {/* 진행률 퍼센트 */}
        {activePhotos.length > 0 && (
          <div className={`text-xs font-semibold text-${statusColor}-700`}>
            {avgProgress}%
          </div>
        )}
      </div>

      {/* 진행률 바 */}
      {totalPhotos > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className={`bg-${statusColor}-500 h-2 rounded-full transition-all duration-500`}
            style={{ width: `${avgProgress}%` }}
          />
        </div>
      )}

      {/* 상세 정보 (모바일에서는 간단히) */}
      {totalPhotos > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex space-x-3">
            {completedPhotos.length > 0 && (
              <span className="flex items-center space-x-1 text-green-600">
                <CheckCircle className="w-3 h-3" />
                <span>{completedPhotos.length}</span>
              </span>
            )}
            {activePhotos.length > 0 && (
              <span className="flex items-center space-x-1 text-blue-600">
                <Upload className="w-3 h-3" />
                <span>{activePhotos.length}</span>
              </span>
            )}
            {errorPhotos.length > 0 && (
              <span className="flex items-center space-x-1 text-red-600">
                <AlertTriangle className="w-3 h-3" />
                <span>{errorPhotos.length}</span>
              </span>
            )}
            {duplicatePhotos.length > 0 && (
              <span className="flex items-center space-x-1 text-orange-600">
                <X className="w-3 h-3" />
                <span>{duplicatePhotos.length}</span>
              </span>
            )}
          </div>
          
          {/* 시설별 진행률 텍스트 */}
          <div className="text-right">
            <span className="font-medium">{facilityType === 'basic' ? '기본' : facilityType === 'discharge' ? '배출' : '방지'}</span>
          </div>
        </div>
      )}
    </div>
  );
}