// utils/image-optimizer.ts - 이미지 최적화 유틸리티
interface ImageOptimizationConfig {
  quality: number;
  format: 'webp' | 'avif' | 'jpeg' | 'png';
  sizes: number[];
  priority?: boolean;
  fallbackFormat?: 'webp' | 'jpeg';
}

export class ImageOptimizer {
  private static defaultConfig: ImageOptimizationConfig = {
    quality: 88, // 향상된 품질 (85 → 88)
    format: 'webp',
    sizes: [320, 640, 750, 828, 1080, 1200, 1600, 1920], // 더 세밀한 반응형 크기
    priority: false,
    fallbackFormat: 'webp'
  };

  // AVIF 지원 감지
  private static avifSupport: boolean | null = null;
  
  static async detectAVIFSupport(): Promise<boolean> {
    if (this.avifSupport !== null) return this.avifSupport;
    
    return new Promise((resolve) => {
      const avifTest = new Image();
      avifTest.onload = avifTest.onerror = () => {
        this.avifSupport = avifTest.height === 2;
        resolve(this.avifSupport);
      };
      avifTest.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    });
  }

  static async getOptimizedImageProps(
    src: string, 
    alt: string, 
    config: Partial<ImageOptimizationConfig> = {}
  ) {
    const finalConfig = { ...this.defaultConfig, ...config };
    const avifSupported = await this.detectAVIFSupport();
    
    // 최적 포맷 결정 (AVIF > WebP > JPEG)
    let optimalFormat = finalConfig.format;
    if (avifSupported && finalConfig.format !== 'png') {
      optimalFormat = 'avif';
    } else if (finalConfig.format === 'avif' && !avifSupported) {
      optimalFormat = finalConfig.fallbackFormat || 'webp';
    }
    
    return {
      src,
      alt,
      quality: this.getOptimalQuality(optimalFormat, finalConfig.quality),
      format: optimalFormat,
      sizes: this.generateResponsiveSizes(finalConfig.sizes),
      priority: finalConfig.priority,
      placeholder: 'blur' as const,
      blurDataURL: this.generateBlurDataURL(),
      style: {
        maxWidth: '100%',
        height: 'auto',
      }
    };
  }

  // 포맷별 최적 품질 설정
  private static getOptimalQuality(format: string, baseQuality: number): number {
    switch (format) {
      case 'avif':
        return Math.max(baseQuality - 5, 70); // AVIF는 더 효율적이므로 품질 약간 낮춤
      case 'webp':
        return baseQuality;
      case 'jpeg':
        return Math.min(baseQuality + 5, 95); // JPEG는 품질 약간 높임
      default:
        return baseQuality;
    }
  }

  // 반응형 sizes 속성 생성
  private static generateResponsiveSizes(sizes: number[]): string {
    const sortedSizes = [...sizes].sort((a, b) => a - b);
    const sizeQueries = [];
    
    for (let i = 0; i < sortedSizes.length; i++) {
      const size = sortedSizes[i];
      if (i === sortedSizes.length - 1) {
        sizeQueries.push(`${size}px`);
      } else {
        sizeQueries.push(`(max-width: ${size}px) ${size}px`);
      }
    }
    
    return sizeQueries.join(', ');
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

  // 파일 업로드 시 클라이언트 사이드 압축 - 성능 개선 (WebP/AVIF 지원)
  static async compressImage(file: File, maxSize: number = 1024 * 1024): Promise<File> {
    if (file.size <= maxSize) return file;

    const avifSupported = await this.detectAVIFSupport();
    
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = async () => {
        // 더 큰 썸네일 크기 (800px 최대)
        const maxDimension = 800;
        const ratio = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        // 고품질 이미지 처리
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 포맷과 품질 선택
        let format = 'image/webp';
        let quality = 0.82; // WebP 품질 82% (향상된 품질)
        let extension = '.webp';

        if (avifSupported) {
          format = 'image/avif';
          quality = 0.75; // AVIF는 더 효율적이므로 75%도 충분
          extension = '.avif';
        }

        // 압축 시도
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const originalExt = file.name.match(/\.(jpg|jpeg|png|webp|avif)$/i)?.[0] || '';
              const newName = file.name.replace(/\.(jpg|jpeg|png|webp|avif)$/i, extension);
              
              const compressedFile = new File([blob], newName, {
                type: format,
                lastModified: Date.now()
              });
              
              const originalSize = (file.size / 1024).toFixed(1);
              const compressedSize = (compressedFile.size / 1024).toFixed(1);
              const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
              
              console.log(`🎨 [COMPRESS] ${file.name}: ${originalSize}KB → ${compressedSize}KB (${compressionRatio}% 감소, ${format.split('/')[1].toUpperCase()})`);
              resolve(compressedFile);
            } else {
              // Blob 생성 실패시 WebP로 폴백
              this.fallbackToWebP(canvas, file, resolve);
            }
          },
          format,
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  // WebP 폴백 압축
  private static fallbackToWebP(canvas: HTMLCanvasElement, originalFile: File, resolve: (file: File) => void) {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const compressedFile = new File([blob], originalFile.name.replace(/\.(jpg|jpeg|png|avif)$/i, '.webp'), {
            type: 'image/webp',
            lastModified: Date.now()
          });
          console.log(`🔄 [FALLBACK] WebP 압축: ${(originalFile.size/1024).toFixed(1)}KB → ${(compressedFile.size/1024).toFixed(1)}KB`);
          resolve(compressedFile);
        } else {
          resolve(originalFile);
        }
      },
      'image/webp',
      0.82
    );
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
