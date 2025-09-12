// utils/client-image-processor.ts
// 클라이언트 사이드 이미지 압축 및 최적화

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 - 1.0
  format?: 'jpeg' | 'webp' | 'png';
  maxFileSize?: number; // bytes
  progressive?: boolean;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  processingTime: number;
}

/**
 * 브라우저 지원 기능 확인
 */
function getBrowserCapabilities() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  return {
    supportsWebP: canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0,
    supportsCanvas: !!ctx,
    supportsBlobConstructor: typeof Blob !== 'undefined',
    supportsFileReader: typeof FileReader !== 'undefined'
  };
}

/**
 * 클라이언트 사이드 이미지 압축
 */
export async function compressImage(
  file: File, 
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  const startTime = performance.now();
  const originalSize = file.size;
  
  // 기본 옵션 설정
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    format = 'jpeg',
    maxFileSize = 2 * 1024 * 1024, // 2MB
    progressive = true
  } = options;

  // 브라우저 지원 확인
  const capabilities = getBrowserCapabilities();
  if (!capabilities.supportsCanvas || !capabilities.supportsFileReader) {
    console.warn('⚠️ [CLIENT-COMPRESS] 브라우저가 이미지 압축을 지원하지 않습니다.');
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      processingTime: 0
    };
  }

  console.log(`🖼️ [CLIENT-COMPRESS] 이미지 압축 시작: ${file.name} (${(originalSize/1024/1024).toFixed(2)}MB)`);

  try {
    // 파일이 이미 충분히 작다면 압축하지 않음
    if (originalSize <= maxFileSize * 0.5) {
      console.log(`⚡ [CLIENT-COMPRESS] 파일이 이미 작음, 압축 스킵: ${file.name}`);
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        processingTime: performance.now() - startTime
      };
    }

    // 이미지를 캔버스로 로드
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    // 이미지 로딩을 Promise로 래핑
    const loadImage = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    };

    await loadImage();

    // 최적 크기 계산 (비율 유지)
    let { width, height } = img;
    const aspectRatio = width / height;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    // 캔버스 크기 설정
    canvas.width = width;
    canvas.height = height;

    // 이미지 그리기 (고품질 설정)
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // 최적 포맷 결정
    let outputFormat = `image/${format}`;
    if (format === 'webp' && !capabilities.supportsWebP) {
      outputFormat = 'image/jpeg';
      console.log('⚡ [CLIENT-COMPRESS] WebP 미지원, JPEG로 변환');
    }

    // Blob 생성을 Promise로 래핑
    const createBlob = (): Promise<Blob> => {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, outputFormat, quality);
      });
    };

    const blob = await createBlob();
    
    // File 객체 생성 (원본 파일명 유지)
    const compressedFile = new File([blob], file.name, {
      type: blob.type,
      lastModified: Date.now()
    });

    // 압축률 계산
    const compressedSize = compressedFile.size;
    const compressionRatio = compressedSize / originalSize;
    const processingTime = performance.now() - startTime;

    // URL 정리
    URL.revokeObjectURL(img.src);

    console.log(`✅ [CLIENT-COMPRESS] 압축 완료: ${file.name}`, {
      originalSize: `${(originalSize/1024/1024).toFixed(2)}MB`,
      compressedSize: `${(compressedSize/1024/1024).toFixed(2)}MB`,
      compressionRatio: `${((1-compressionRatio) * 100).toFixed(1)}% 감소`,
      processingTime: `${processingTime.toFixed(1)}ms`,
      dimensions: `${width}x${height}`,
      format: outputFormat
    });

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      compressionRatio,
      processingTime
    };

  } catch (error) {
    console.error('❌ [CLIENT-COMPRESS] 이미지 압축 실패:', error);
    
    // 압축 실패 시 원본 파일 반환
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      processingTime: performance.now() - startTime
    };
  }
}

/**
 * 여러 이미지 배치 압축
 */
export async function compressImages(
  files: File[],
  options: ImageCompressionOptions = {},
  onProgress?: (completed: number, total: number) => void
): Promise<CompressionResult[]> {
  console.log(`📦 [BATCH-COMPRESS] ${files.length}개 이미지 배치 압축 시작`);
  
  const results: CompressionResult[] = [];
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  const nonImageFiles = files.filter(file => !file.type.startsWith('image/'));
  
  // 이미지가 아닌 파일들은 그대로 반환
  nonImageFiles.forEach(file => {
    results.push({
      file,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 1,
      processingTime: 0
    });
  });

  // 이미지 파일들 병렬 압축
  const compressionPromises = imageFiles.map(async (file, index) => {
    const result = await compressImage(file, options);
    
    if (onProgress) {
      onProgress(index + 1, imageFiles.length);
    }
    
    return result;
  });

  const compressionResults = await Promise.all(compressionPromises);
  results.push(...compressionResults);

  // 통계 계산
  const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressedSize = results.reduce((sum, r) => sum + r.compressedSize, 0);
  const totalCompressionRatio = totalCompressedSize / totalOriginalSize;
  
  console.log(`✅ [BATCH-COMPRESS] 배치 압축 완료:`, {
    totalFiles: files.length,
    imageFiles: imageFiles.length,
    totalOriginalSize: `${(totalOriginalSize/1024/1024).toFixed(2)}MB`,
    totalCompressedSize: `${(totalCompressedSize/1024/1024).toFixed(2)}MB`,
    totalSavings: `${((1-totalCompressionRatio) * 100).toFixed(1)}% 감소`
  });

  return results;
}

/**
 * 파일 해시 계산 (클라이언트 사이드)
 */
export async function calculateFileHash(file: File): Promise<string> {
  if (!window.crypto?.subtle) {
    // crypto.subtle이 없으면 파일명과 크기 기반 간단한 해시
    const simpleHash = `${file.name}-${file.size}-${file.lastModified}`;
    return btoa(simpleHash).replace(/[+/]/g, '_').slice(0, 16);
  }

  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.slice(0, 16); // 처음 16자리만 사용
  } catch (error) {
    console.warn('⚠️ [CLIENT-HASH] 해시 계산 실패, 간단한 해시 사용:', error);
    const simpleHash = `${file.name}-${file.size}-${file.lastModified}`;
    return btoa(simpleHash).replace(/[+/]/g, '_').slice(0, 16);
  }
}