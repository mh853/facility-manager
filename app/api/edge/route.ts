// app/api/edge/route.ts - Vercel Edge Function for image optimization
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = ['icn1', 'hnd1']; // 한국/일본 리전 우선

// 지원되는 이미지 포맷 및 품질 설정
const IMAGE_CONFIGS = {
  'image/webp': { quality: 85, maxWidth: 1920 },
  'image/avif': { quality: 75, maxWidth: 1920 },
  'image/jpeg': { quality: 90, maxWidth: 1920 },
  'image/png': { quality: 95, maxWidth: 1920 }
} as const;

const DEFAULT_WIDTHS = [320, 640, 750, 828, 1080, 1200, 1600, 1920];
const MAX_AGE = 31536000; // 1년
const STALE_WHILE_REVALIDATE = 86400; // 1일

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // 필수 매개변수 검증
    const url = searchParams.get('url');
    if (!url) {
      return new NextResponse('Missing url parameter', { status: 400 });
    }

    // 이미지 최적화 옵션
    const width = parseInt(searchParams.get('w') || '0');
    const quality = parseInt(searchParams.get('q') || '85');
    const format = searchParams.get('f') || 'auto';

    // 캐시 헤더 설정
    const cacheHeaders = {
      'Cache-Control': `public, max-age=${MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
      'CDN-Cache-Control': `public, max-age=${MAX_AGE}`,
      'Vercel-CDN-Cache-Control': `public, max-age=${MAX_AGE}`,
    };

    // URL 검증 및 보안 체크
    if (!isValidImageUrl(url)) {
      return new NextResponse('Invalid image URL', { status: 400 });
    }

    // 원본 이미지 가져오기
    const imageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Vercel Edge Function Image Optimizer'
      }
    });

    if (!imageResponse.ok) {
      return new NextResponse('Failed to fetch image', { status: 404 });
    }

    const contentType = imageResponse.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return new NextResponse('Invalid content type', { status: 400 });
    }

    // 브라우저 지원 포맷 감지
    const acceptHeader = req.headers.get('accept') || '';
    const supportsAVIF = acceptHeader.includes('image/avif');
    const supportsWebP = acceptHeader.includes('image/webp');

    // 최적 포맷 결정
    let targetFormat = contentType;
    if (format === 'auto') {
      if (supportsAVIF) {
        targetFormat = 'image/avif';
      } else if (supportsWebP) {
        targetFormat = 'image/webp';
      }
    } else if (format && IMAGE_CONFIGS[format as keyof typeof IMAGE_CONFIGS]) {
      targetFormat = format;
    }

    // 이미지 변환이 필요한지 확인
    const config = IMAGE_CONFIGS[targetFormat as keyof typeof IMAGE_CONFIGS];
    const needsOptimization = width > 0 || 
      quality !== 85 || 
      targetFormat !== contentType ||
      config.maxWidth < 1920;

    // 최적화가 필요하지 않으면 원본 반환
    if (!needsOptimization) {
      const body = await imageResponse.arrayBuffer();
      return new NextResponse(body, {
        headers: {
          ...cacheHeaders,
          'Content-Type': contentType,
          'Content-Length': body.byteLength.toString(),
        }
      });
    }

    // 이미지 최적화 수행
    const optimizedImage = await optimizeImage(
      await imageResponse.arrayBuffer(),
      {
        width: width || undefined,
        quality: quality || config?.quality || 85,
        format: targetFormat as keyof typeof IMAGE_CONFIGS,
        maxWidth: config?.maxWidth || 1920
      }
    );

    // 최적화된 이미지 반환
    return new NextResponse(optimizedImage.buffer, {
      headers: {
        ...cacheHeaders,
        'Content-Type': targetFormat,
        'Content-Length': optimizedImage.buffer.byteLength.toString(),
        'X-Optimized': 'true',
        'X-Original-Format': contentType,
        'X-Target-Format': targetFormat,
        'X-Optimization-Savings': `${Math.round((1 - optimizedImage.buffer.byteLength / Number(imageResponse.headers.get('content-length') || optimizedImage.buffer.byteLength)) * 100)}%`,
      }
    });

  } catch (error) {
    console.error('Image optimization error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// URL 유효성 검증
function isValidImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // 허용된 도메인 체크 (Supabase, 자체 도메인 등)
    const allowedDomains = [
      'qdfqoykhmuiambtrrlnf.supabase.co',
      'localhost',
      'vercel.app',
      // 추가 허용 도메인들...
    ];

    const hostname = parsedUrl.hostname;
    const isAllowedDomain = allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    // HTTPS 또는 로컬 개발환경만 허용
    const isSecure = parsedUrl.protocol === 'https:' || 
      (parsedUrl.protocol === 'http:' && hostname === 'localhost');

    return isAllowedDomain && isSecure;
  } catch {
    return false;
  }
}

// 이미지 최적화 함수 (실제 구현시 Sharp 또는 다른 라이브러리 사용)
async function optimizeImage(
  buffer: ArrayBuffer,
  options: {
    width?: number;
    quality: number;
    format: keyof typeof IMAGE_CONFIGS;
    maxWidth: number;
  }
): Promise<{ buffer: ArrayBuffer }> {
  // Edge Function에서는 WebAssembly 기반 이미지 처리 라이브러리 사용 필요
  // 예: @vercel/og, squoosh 등
  
  // 실제 구현에서는 여기에 이미지 처리 로직 구현
  // 현재는 원본 반환 (placeholder)
  
  console.log('Image optimization requested:', {
    size: buffer.byteLength,
    ...options
  });

  // Mock optimization (실제로는 WebAssembly 기반 이미지 처리)
  return { buffer };
}

// 이미지 크기 조정 헬퍼
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  targetWidth?: number,
  maxWidth: number = 1920
): { width: number; height: number } {
  if (!targetWidth) {
    // 최대 너비 제한만 적용
    if (originalWidth <= maxWidth) {
      return { width: originalWidth, height: originalHeight };
    }
    const ratio = maxWidth / originalWidth;
    return {
      width: maxWidth,
      height: Math.round(originalHeight * ratio)
    };
  }

  // 특정 너비로 조정
  const ratio = targetWidth / originalWidth;
  return {
    width: targetWidth,
    height: Math.round(originalHeight * ratio)
  };
}

// 응답형 srcset 생성 (내부 함수로 변경)
function generateSrcSet(baseUrl: string, widths: number[] = DEFAULT_WIDTHS): string {
  return widths
    .map(width => `${baseUrl}?w=${width} ${width}w`)
    .join(', ');
}

// Picture 엘리먼트용 소스 생성 (내부 함수로 변경)
function generatePictureSources(baseUrl: string): Array<{
  srcSet: string;
  type: string;
  media?: string;
}> {
  const sources = [];

  // AVIF 소스 (최신 브라우저)
  sources.push({
    srcSet: generateSrcSet(`${baseUrl}&f=avif`),
    type: 'image/avif'
  });

  // WebP 소스 (대부분 브라우저)
  sources.push({
    srcSet: generateSrcSet(`${baseUrl}&f=webp`),
    type: 'image/webp'
  });

  // JPEG 폴백 (모든 브라우저)
  sources.push({
    srcSet: generateSrcSet(`${baseUrl}&f=jpeg`),
    type: 'image/jpeg'
  });

  return sources;
}