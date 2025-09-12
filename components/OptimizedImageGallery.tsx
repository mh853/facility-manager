'use client';

import { useState, useMemo } from 'react';
import OptimizedImage from './OptimizedImage';
import { UploadedFile } from '@/types';

interface OptimizedImageGalleryProps {
  files: UploadedFile[];
  onImageClick?: (file: UploadedFile, index: number) => void;
  className?: string;
  imageClassName?: string;
  maxImagesPerRow?: number;
}

export default function OptimizedImageGallery({
  files,
  onImageClick,
  className = '',
  imageClassName = '',
  maxImagesPerRow = 3
}: OptimizedImageGalleryProps) {
  const [loadedImages, setLoadedImages] = useState(new Set<number>());

  // Calculate next images to preload for each image
  const preloadMap = useMemo(() => {
    const map: Record<number, string[]> = {};
    
    files.forEach((_, index) => {
      const nextImages: string[] = [];
      
      // Preload next 2-3 images in the gallery
      for (let i = 1; i <= 3; i++) {
        const nextIndex = index + i;
        if (nextIndex < files.length) {
          nextImages.push(files[nextIndex].thumbnailUrl || files[nextIndex].downloadUrl);
        }
      }
      
      // Also preload previous image (for navigation)
      if (index > 0) {
        const prevFile = files[index - 1];
        nextImages.push(prevFile.thumbnailUrl || prevFile.downloadUrl);
      }
      
      map[index] = nextImages.filter(Boolean);
    });
    
    return map;
  }, [files]);

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set(prev).add(index));
  };

  if (files.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        업로드된 이미지가 없습니다
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${className}`} 
         style={{ 
           gridTemplateColumns: `repeat(${Math.min(maxImagesPerRow, files.length)}, 1fr)` 
         }}>
      {files.map((file, index) => {
        const isImage = file.mimeType?.startsWith('image/');
        const imageUrl = file.thumbnailUrl || file.downloadUrl;
        const isLoaded = loadedImages.has(index);
        
        if (!isImage || !imageUrl) {
          return (
            <div 
              key={file.id}
              className={`aspect-square bg-gray-100 border-2 border-dashed border-gray-300 
                         flex items-center justify-center cursor-pointer 
                         hover:border-gray-400 transition-colors ${imageClassName}`}
              onClick={() => onImageClick?.(file, index)}
            >
              <div className="text-center p-2">
                <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-xs text-gray-500 truncate max-w-full">
                  {file.originalName}
                </p>
              </div>
            </div>
          );
        }

        return (
          <div 
            key={file.id}
            className={`relative aspect-square overflow-hidden rounded-lg cursor-pointer 
                       transform transition-all duration-200 hover:scale-105 hover:shadow-lg
                       ${isLoaded ? 'ring-2 ring-blue-200' : ''} ${imageClassName}`}
            onClick={() => onImageClick?.(file, index)}
          >
            <OptimizedImage
              src={imageUrl}
              alt={file.originalName || `이미지 ${index + 1}`}
              width={300}
              height={300}
              className="object-cover w-full h-full"
              quality={75}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={index < 6} // Prioritize first 6 images
              preloadNext={preloadMap[index] || []}
              onLoad={() => handleImageLoad(index)}
            />
            
            {/* File info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-2 
                           transform translate-y-full transition-transform duration-200 
                           group-hover:translate-y-0">
              <p className="text-xs truncate">
                {file.originalName}
              </p>
              <p className="text-xs text-gray-300">
                {(file.size / (1024 * 1024)).toFixed(1)}MB
              </p>
            </div>
            
            {/* Loading indicator */}
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {/* Recently uploaded indicator */}
            {file.justUploaded && (
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                새로 추가됨
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}