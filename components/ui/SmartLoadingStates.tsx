'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Upload, Check, X, AlertCircle } from 'lucide-react';

// 로딩 상태 타입
export type LoadingState = 'idle' | 'pending' | 'success' | 'error';

// 스켈레톤 로딩 컴포넌트
export function SkeletonLoader({ 
  count = 3, 
  height = 'h-4',
  className = '' 
}: { 
  count?: number; 
  height?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className={`bg-gray-200 rounded ${height}`}></div>
        </div>
      ))}
    </div>
  );
}

// 이미지 스켈레톤 그리드
export function ImageSkeletonGrid({ 
  count = 6,
  className = '' 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse delay-150"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 적응적 로딩 스피너 (로딩 시간에 따라 변화)
export function AdaptiveLoader({ 
  isLoading, 
  children,
  skeletonFallback,
  minLoadingTime = 200,
  showSkeletonAfter = 1000 
}: {
  isLoading: boolean;
  children: React.ReactNode;
  skeletonFallback?: React.ReactNode;
  minLoadingTime?: number;
  showSkeletonAfter?: number;
}) {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (isLoading) {
      setStartTime(Date.now());
      const timer = setTimeout(() => {
        setShowSkeleton(true);
      }, showSkeletonAfter);

      return () => clearTimeout(timer);
    } else {
      const loadTime = startTime ? Date.now() - startTime : 0;
      if (loadTime < minLoadingTime) {
        const delay = minLoadingTime - loadTime;
        setTimeout(() => {
          setShowSkeleton(false);
          setStartTime(null);
        }, delay);
      } else {
        setShowSkeleton(false);
        setStartTime(null);
      }
    }
  }, [isLoading, showSkeletonAfter, minLoadingTime, startTime]);

  if (!isLoading) return <>{children}</>;

  if (showSkeleton && skeletonFallback) {
    return <>{skeletonFallback}</>;
  }

  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      <span className="ml-2 text-gray-600">로딩 중...</span>
    </div>
  );
}

// 상태 피드백 아이콘
export function StatusIcon({ 
  state, 
  size = 'w-5 h-5',
  showText = false 
}: { 
  state: LoadingState; 
  size?: string;
  showText?: boolean;
}) {
  const configs = {
    idle: { icon: null, color: 'text-gray-400', text: '대기' },
    pending: { icon: Loader2, color: 'text-blue-500', text: '처리 중', animate: 'animate-spin' },
    success: { icon: Check, color: 'text-green-500', text: '완료' },
    error: { icon: X, color: 'text-red-500', text: '실패' }
  };

  const config = configs[state];
  if (!config.icon) return null;

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon className={`${size} ${config.color} ${config.animate || ''}`} />
      {showText && (
        <span className={`text-sm ${config.color}`}>
          {config.text}
        </span>
      )}
    </div>
  );
}

// 업로드 상태 표시기
export function UploadStatusIndicator({ 
  progress, 
  state, 
  fileName,
  className = '' 
}: {
  progress?: number;
  state: LoadingState;
  fileName?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm ${className}`}>
      <div className="flex-shrink-0">
        {state === 'pending' ? (
          <Upload className="w-5 h-5 text-blue-500 animate-pulse" />
        ) : (
          <StatusIcon state={state} />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        {fileName && (
          <p className="text-sm font-medium text-gray-900 truncate">
            {fileName}
          </p>
        )}
        
        {state === 'pending' && progress !== undefined && (
          <div className="mt-1">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>업로드 중...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-blue-500 h-1 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        
        {state === 'success' && (
          <p className="text-xs text-green-600 mt-1">업로드 완료</p>
        )}
        
        {state === 'error' && (
          <p className="text-xs text-red-600 mt-1">업로드 실패</p>
        )}
      </div>
    </div>
  );
}

// 다중 작업 상태 표시기
export function BatchOperationStatus({ 
  operations,
  className = '' 
}: {
  operations: Array<{
    id: string;
    name: string;
    state: LoadingState;
    progress?: number;
  }>;
  className?: string;
}) {
  const totalOps = operations.length;
  const completedOps = operations.filter(op => op.state === 'success').length;
  const failedOps = operations.filter(op => op.state === 'error').length;
  const pendingOps = operations.filter(op => op.state === 'pending').length;

  const overallProgress = totalOps > 0 ? (completedOps / totalOps) * 100 : 0;

  return (
    <div className={`bg-white border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">
          일괄 처리 상태
        </h4>
        <span className="text-xs text-gray-500">
          {completedOps}/{totalOps} 완료
        </span>
      </div>

      {/* 전체 진행률 */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>전체 진행률</span>
          <span>{Math.round(overallProgress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* 상태 요약 */}
      <div className="flex items-center gap-4 text-xs">
        {pendingOps > 0 && (
          <div className="flex items-center gap-1 text-blue-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{pendingOps}개 처리 중</span>
          </div>
        )}
        {completedOps > 0 && (
          <div className="flex items-center gap-1 text-green-600">
            <Check className="w-3 h-3" />
            <span>{completedOps}개 완료</span>
          </div>
        )}
        {failedOps > 0 && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertCircle className="w-3 h-3" />
            <span>{failedOps}개 실패</span>
          </div>
        )}
      </div>

      {/* 개별 작업 목록 */}
      <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
        {operations.map((op) => (
          <div key={op.id} className="flex items-center gap-2 text-xs">
            <StatusIcon state={op.state} size="w-3 h-3" />
            <span className="flex-1 truncate text-gray-700">{op.name}</span>
            {op.state === 'pending' && op.progress && (
              <span className="text-gray-500">{Math.round(op.progress)}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 네트워크 상태 인디케이터
export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setTimeout(() => setWasOffline(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (isOnline && !wasOffline) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 p-3 rounded-lg shadow-lg transition-all duration-300 ${
      isOnline 
        ? 'bg-green-500 text-white' 
        : 'bg-red-500 text-white'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-green-200' : 'bg-red-200 animate-pulse'
        }`} />
        <span className="text-sm font-medium">
          {isOnline ? '연결됨' : '오프라인'}
        </span>
      </div>
    </div>
  );
}

export default {
  SkeletonLoader,
  ImageSkeletonGrid,
  AdaptiveLoader,
  StatusIcon,
  UploadStatusIndicator,
  BatchOperationStatus,
  NetworkStatus
};