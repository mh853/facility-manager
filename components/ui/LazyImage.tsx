'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { ImageOptimizer } from '@/utils/image-optimizer';

interface LazyImageProps {
  src: string | string[];
  alt: string;
  className?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

const LazyImage = memo(function LazyImage({
  src,
  alt,
  className = '',
  priority = false,
  quality = 85,
  placeholder = true,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const [currentSrcIndex, setCurrentSrcIndex] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Convert src to array for consistent handling
  const srcArray = Array.isArray(src) ? src : [src];
  const currentSrc = srcArray[currentSrcIndex];

  useEffect(() => {
    if (priority) return; // Skip lazy loading for priority images

    const observer = ImageOptimizer.createLazyLoadObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer?.unobserve(entry.target);
        }
      });
    });

    observerRef.current = observer;

    if (observer && imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    console.log(`[LAZY-IMAGE] 이미지 로드 실패: ${currentSrc} (${currentSrcIndex + 1}/${srcArray.length})`);
    
    // Try next URL in array
    if (currentSrcIndex < srcArray.length - 1) {
      console.log(`[LAZY-IMAGE] 다음 URL 시도: ${srcArray[currentSrcIndex + 1]}`);
      setCurrentSrcIndex(prev => prev + 1);
      setIsLoaded(false); // Reset loaded state for new image
    } else {
      console.log('[LAZY-IMAGE] 모든 URL 실패, 에러 상태 설정');
      setHasError(true);
      onError?.();
    }
  };

  // Generate optimized image props using current src
  const imageProps = ImageOptimizer.getOptimizedImageProps(currentSrc, alt, {
    quality,
    priority,
  });

  const shouldShowImage = priority || isInView;

  return (
    <div className={`relative overflow-hidden ${className}`} ref={imgRef}>
      {/* Placeholder */}
      {placeholder && !isLoaded && !hasError && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse"
          style={{
            backgroundImage: `url("${ImageOptimizer.generateBlurDataURL()}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Actual Image */}
      {shouldShowImage && !hasError && currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={handleLoad}
          onError={handleError}
          style={imageProps.style}
        />
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center text-gray-500">
            <div className="text-2xl mb-2">📷</div>
            <div className="text-sm">이미지를 불러올 수 없습니다</div>
          </div>
        </div>
      )}
    </div>
  );
});

export default LazyImage;