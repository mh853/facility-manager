// utils/image-optimizer.ts - 이미지 최적화 유틸리티
interface ImageOptimizationConfig {
  quality: number;
  format: 'webp' | 'avif' | 'jpeg' | 'png';
  sizes: number[];
  priority?: boolean;
}

export class ImageOptimizer {
  private static defaultConfig: ImageOptimizationConfig = {
    quality: 85,
    format: 'webp',
    sizes: [640, 750, 828, 1080, 1200, 1920],
    priority: false
  };

  static getOptimizedImageProps(
    src: string, 
    alt: string, 
    config: Partial<ImageOptimizationConfig> = {}
  ) {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    return {
      src,
      alt,
      quality: finalConfig.quality,
      format: finalConfig.format,
      sizes: `(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw`,
      priority: finalConfig.priority,
      placeholder: 'blur' as const,
      blurDataURL: this.generateBlurDataURL(),
      style: {
        maxWidth: '100%',
        height: 'auto',
      }
    };
  }

  static generateBlurDataURL(): string {
    // 간단한 blur placeholder 생성
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#e5e7eb;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f3f4f6;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
      </svg>
    `)}`;
  }

  // 파일 업로드 시 클라이언트 사이드 압축 - 성능 개선
  static async compressImage(file: File, maxSize: number = 1024 * 1024): Promise<File> {
    if (file.size <= maxSize) return file;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // 썸네일 크기로 압축 (200x200px 최대)
        const thumbnailSize = 400;
        const ratio = Math.min(thumbnailSize / img.width, thumbnailSize / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        // 이미지 품질 최적화
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Progressive JPEG 대신 WebP로 변환 (더 나은 압축)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.(jpg|jpeg|png)$/i, '.webp'), {
                type: 'image/webp',
                lastModified: Date.now()
              });
              console.log(`⚡ [COMPRESS] ${file.name}: ${(file.size/1024).toFixed(1)}KB → ${(compressedFile.size/1024).toFixed(1)}KB`);
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/webp',
          0.75 // 품질 75% (빠른 로딩과 품질의 균형)
        );
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  // 레이지 로딩 옵저버
  static createLazyLoadObserver(callback: (entries: IntersectionObserverEntry[]) => void) {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return null;
    }

    return new IntersectionObserver(callback, {
      rootMargin: '50px 0px', // 50px 미리 로드
      threshold: 0.01
    });
  }
}

// 아이콘 SVG 생성 유틸리티
export const IconGenerator = {
  // PWA 아이콘 생성
  generatePWAIcons(): { size: number; content: string }[] {
    const sizes = [192, 512];
    
    return sizes.map(size => ({
      size,
      content: `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#3b82f6"/>
              <stop offset="100%" style="stop-color:#1e40af"/>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" rx="${size * 0.15}" fill="url(#grad)"/>
          <path d="M${size * 0.2} ${size * 0.3} L${size * 0.8} ${size * 0.3} L${size * 0.8} ${size * 0.45} L${size * 0.2} ${size * 0.45} Z" fill="white"/>
          <path d="M${size * 0.3} ${size * 0.5} L${size * 0.7} ${size * 0.5} L${size * 0.7} ${size * 0.65} L${size * 0.3} ${size * 0.65} Z" fill="white"/>
          <circle cx="${size * 0.5}" cy="${size * 0.75}" r="${size * 0.05}" fill="white"/>
        </svg>
      `
    }));
  },

  // 파비콘 생성
  generateFavicon(): string {
    return `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#3b82f6"/>
        <rect x="4" y="8" width="24" height="4" rx="1" fill="white"/>
        <rect x="6" y="14" width="20" height="4" rx="1" fill="white"/>
        <circle cx="16" cy="22" r="2" fill="white"/>
      </svg>
    `;
  }
};

export default ImageOptimizer;
