// components/ui/OptimizedUploadDemo.tsx
// 최적화된 업로드 시스템 사용 예시 및 데모

'use client';

import React, { useState, useRef } from 'react';
import { Upload, Settings, BarChart3, Zap } from 'lucide-react';
import { useAdvancedUpload, useUploadStats } from '@/hooks/useAdvancedUpload';
import AdvancedUploadProgress from './AdvancedUploadProgress';

interface OptimizedUploadDemoProps {
  businessName: string;
  onUploadComplete?: (results: any) => void;
}

export function OptimizedUploadDemo({
  businessName,
  onUploadComplete
}: OptimizedUploadDemoProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFacility, setSelectedFacility] = useState('배출시설1');
  const [showSettings, setShowSettings] = useState(false);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [maxConcurrency, setMaxConcurrency] = useState(6);

  const { 
    startUpload, 
    queueStats, 
    setCompressionEnabled: updateCompression,
    setMaxConcurrency: updateConcurrency 
  } = useAdvancedUpload();
  
  const performanceStats = useUploadStats();

  // 파일 선택 처리
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    console.log(`📁 [DEMO] 파일 선택됨:`, {
      count: files.length,
      facility: selectedFacility,
      totalSize: `${(files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)}MB`
    });

    // 업로드 시작
    const uploadId = startUpload(
      `facility_${selectedFacility}_${Date.now()}`,
      selectedFacility,
      files,
      {
        businessName,
        systemType: 'presurvey',
        category: '기본사진'
      }
    );

    console.log(`🚀 [DEMO] 업로드 ID: ${uploadId}`);

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 설정 변경 처리
  const handleCompressionChange = (enabled: boolean) => {
    setCompressionEnabled(enabled);
    updateCompression(enabled);
  };

  const handleConcurrencyChange = (value: number) => {
    setMaxConcurrency(value);
    updateConcurrency(value);
  };

  return (
    <div className="space-y-6">
      {/* 업로드 인터페이스 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            최적화된 업로드 시스템
          </h3>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            설정
          </button>
        </div>

        {/* 설정 패널 */}
        {showSettings && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-4">
            <h4 className="font-medium text-gray-700">업로드 최적화 설정</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 압축 설정 */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={compressionEnabled}
                    onChange={(e) => handleCompressionChange(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">이미지 압축 활성화</span>
                </label>
                <p className="text-xs text-gray-500">
                  업로드 전 이미지를 자동 압축하여 속도 향상
                </p>
              </div>

              {/* 동시성 설정 */}
              <div className="space-y-2">
                <label className="block text-sm text-gray-700">
                  최대 동시 업로드: {maxConcurrency}개
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={maxConcurrency}
                  onChange={(e) => handleConcurrencyChange(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  네트워크 상태에 따라 동시 업로드 수 조절
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 시설 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            업로드할 시설 선택
          </label>
          <select
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="배출시설1">배출시설 1</option>
            <option value="배출시설2">배출시설 2</option>
            <option value="방지시설1">방지시설 1</option>
            <option value="방지시설2">방지시설 2</option>
            <option value="기본사진">기본사진</option>
          </select>
        </div>

        {/* 파일 업로드 버튼 */}
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={queueStats.activeUploads >= maxConcurrency}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 
                     bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed
                     text-white rounded-lg transition-colors"
          >
            <Upload className="w-5 h-5" />
            {queueStats.activeUploads > 0 ? '다른 시설 파일 추가' : '파일 선택 및 업로드'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            JPG, PNG 파일을 선택하세요. 여러 파일 동시 선택 가능
          </p>
        </div>
      </div>

      {/* 성능 통계 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-green-500" />
          업로드 성능 통계
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {queueStats.totalFiles}
            </div>
            <div className="text-sm text-gray-500">총 파일 수</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {performanceStats.successRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500">성공률</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {queueStats.averageUploadTime > 0 
                ? (queueStats.averageUploadTime / 1000).toFixed(1) 
                : '0'}초
            </div>
            <div className="text-sm text-gray-500">평균 업로드 시간</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {queueStats.activeUploads + queueStats.queuedUploads}
            </div>
            <div className="text-sm text-gray-500">진행중/대기</div>
          </div>
        </div>

        {/* 큐 상태 표시 */}
        {queueStats.totalUploads > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-700 mb-2">큐 상태:</div>
            <div className="flex gap-4 text-xs">
              <span className="text-blue-600">진행중: {queueStats.activeUploads}</span>
              <span className="text-yellow-600">대기: {queueStats.queuedUploads}</span>
              <span className="text-green-600">완료: {queueStats.completedUploads}</span>
              <span className="text-red-600">실패: {queueStats.failedUploads}</span>
            </div>
          </div>
        )}
      </div>

      {/* 최적화 정보 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          🚀 업로드 최적화 기능
        </h3>
        
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>네트워크 상태 기반 동적 병렬 처리 (3-8개 동시 업로드)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>클라이언트 사이드 이미지 압축 및 WebP 변환</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span>시설별 독립 업로드 큐 관리</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <span>실시간 진행률 추적 및 스마트 에러 처리</span>
          </div>
        </div>
      </div>

      {/* 고도화된 진행률 표시 */}
      <AdvancedUploadProgress
        isVisible={queueStats.activeUploads > 0 || queueStats.queuedUploads > 0}
        autoHideDelay={3000}
        onClose={() => {
          // 필요시 추가 정리 작업
        }}
      />
    </div>
  );
}

export default OptimizedUploadDemo;