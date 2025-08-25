'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';

interface OptimizedImageProps {
  cdnUrl?: string;
  fallbackUrl: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export default function OptimizedImage({
  cdnUrl,
  fallbackUrl,
  alt,
  className = '',
  width = 300,
  height = 200,
  priority = false
}: OptimizedImageProps) {
  const [currentSrc, setCurrentSrc] = useState(cdnUrl || fallbackUrl);
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    if (currentSrc === cdnUrl && fallbackUrl) {
      console.log(`⚠️ CDN 이미지 로드 실패, 폴백 사용: ${alt}`);
      setCurrentSrc(fallbackUrl);
      setHasError(false);
    } else {
      console.error(`❌ 이미지 로드 완전 실패: ${alt}`);
      setHasError(true);
    }
  }, [currentSrc, cdnUrl, fallbackUrl, alt]);

  const handleLoad = useCallback(() => {
    if (currentSrc === cdnUrl) {
      console.log(`✅ CDN 이미지 로드 성공: ${alt}`);
    } else {
      console.log(`✅ 폴백 이미지 로드 성공: ${alt}`);
    }
  }, [currentSrc, cdnUrl, alt]);

  if (hasError) {
    return (
      <div 
        className={`bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-center text-gray-500 text-sm ${className}`}
        style={{ width, height }}
      >
        이미지 로드 실패
      </div>
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      className={`object-cover rounded-lg ${className}`}
      priority={priority}
      onError={handleError}
      onLoad={handleLoad}
      unoptimized={currentSrc.includes('r2.dev') || currentSrc.includes('googleusercontent.com')}
    />
  );
}