// components/SimpleProgressDemo.tsx
// 간단한 진행률 데모 컴포넌트

'use client';

import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useOptimisticUpload } from '@/hooks/useOptimisticUpload';
import ProgressUploadCard from './ui/ProgressUploadCard';
import UploadQueue from './ui/UploadQueue';

interface SimpleProgressDemoProps {
  businessName: string;
}

export default function SimpleProgressDemo({ businessName }: SimpleProgressDemoProps) {
  const optimisticUpload = useOptimisticUpload({
    maxConcurrency: 2,
    maxRetries: 1,
    autoRetry: false
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // 파일을 즉시 UI에 추가하고 업로드 시작
    optimisticUpload.addFiles(
      Array.from(files),
      (file, index) => ({
        businessName,
        facilityType: 'basic',
        category: 'demo',
        systemType: 'presurvey'
      })
    );

    // 입력 필드 초기화
    event.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          🚀 Progressive Upload 데모
        </h1>
        <p className="text-gray-600">
          파일을 선택하면 즉시 진행률과 함께 업로드가 시작됩니다
        </p>
      </div>

      {/* 파일 선택 */}
      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-blue-400 transition-colors">
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <label htmlFor="file-input" className="cursor-pointer">
          <span className="text-lg font-medium text-gray-700">파일 선택</span>
          <p className="text-sm text-gray-500 mt-2">
            이미지 파일을 선택하면 즉시 업로드가 시작됩니다
          </p>
        </label>
        <input
          id="file-input"
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* 업로드 큐 */}
      <UploadQueue
        photos={optimisticUpload.photos}
        stats={optimisticUpload.queueStats}
        isProcessing={optimisticUpload.isProcessing}
        onCancel={optimisticUpload.cancelUpload}
        onRetry={optimisticUpload.retryUpload}
        onRemove={optimisticUpload.removePhoto}
        onClearCompleted={optimisticUpload.clearCompleted}
        onCancelAll={optimisticUpload.cancelAll}
      />

      {/* 개별 카드 (상세 보기) */}
      {optimisticUpload.photos.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">상세 업로드 진행률</h2>
          <div className="space-y-3">
            {optimisticUpload.photos
              .filter(photo => photo.status !== 'uploaded' || optimisticUpload.photos.indexOf(photo) < 3)
              .map(photo => (
                <ProgressUploadCard
                  key={photo.id}
                  photo={photo}
                  onCancel={optimisticUpload.cancelUpload}
                  onRetry={optimisticUpload.retryUpload}
                  onRemove={optimisticUpload.removePhoto}
                  showPreview={true}
                  compact={false}
                />
              ))
            }
          </div>
        </div>
      )}

      {/* 통계 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">업로드 통계</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div className="bg-white rounded p-3">
            <div className="text-2xl font-bold text-gray-900">{optimisticUpload.queueStats.total}</div>
            <div className="text-xs text-gray-500">총 파일</div>
          </div>
          <div className="bg-white rounded p-3">
            <div className="text-2xl font-bold text-green-600">{optimisticUpload.queueStats.completed}</div>
            <div className="text-xs text-gray-500">완료</div>
          </div>
          <div className="bg-white rounded p-3">
            <div className="text-2xl font-bold text-blue-600">{optimisticUpload.queueStats.uploading}</div>
            <div className="text-xs text-gray-500">업로드 중</div>
          </div>
          <div className="bg-white rounded p-3">
            <div className="text-2xl font-bold text-orange-600">{optimisticUpload.queueStats.pending}</div>
            <div className="text-xs text-gray-500">대기</div>
          </div>
          <div className="bg-white rounded p-3">
            <div className="text-2xl font-bold text-red-600">{optimisticUpload.queueStats.failed}</div>
            <div className="text-xs text-gray-500">실패</div>
          </div>
        </div>
      </div>
    </div>
  );
}