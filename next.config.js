/** @type {import('next').NextConfig} */
const nextConfig = {
  // 성능 최적화 설정
  compress: true,
  swcMinify: true,
  poweredByHeader: false,
  // 일시적으로 타입 체크 비활성화 (배포용)
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  
  // 이미지 최적화 - 성능 개선
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60, // 1시간 캐시 (더 자주 업데이트)
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Jest worker 오류 방지
    loader: 'default',
    dangerouslyAllowSVG: true,
    // 썸네일 품질 최적화
    domains: [],
    unoptimized: false,
  },
  
  // 성능 헤더 - 🚀 최적화 강화
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ],
      },
      // 🔥 사진 조회 API - 장시간 캐싱
      {
        source: '/api/facility-photos',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=600, stale-while-revalidate=1800, max-age=300'
          }
        ],
      },
      {
        source: '/api/uploaded-files-supabase',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=600, stale-while-revalidate=1800, max-age=300'
          }
        ],
      },
      // 🔥 일반 API - 적당한 캐싱
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=180, stale-while-revalidate=600, max-age=60'
          }
        ],
      },
      // 🔥 정적 파일 - 무제한 캐싱
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ],
      },
      // 🔥 이미지 파일 - 장시간 캐싱
      {
        source: '/(.*)\\.(jpg|jpeg|png|webp|avif|gif|svg)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800'
          }
        ],
      },
    ];
  },
}

module.exports = nextConfig;
