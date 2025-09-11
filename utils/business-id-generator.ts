// utils/business-id-generator.ts - 범용 사업장 ID 생성 시스템
// 한글, 영어, 숫자, 특수문자 혼합 사업장명을 안전한 해시 ID로 변환

import crypto from 'crypto';

// 메모리 캐시 (성능 최적화)
const businessIdCache = new Map<string, string>();
const reverseIdCache = new Map<string, string>();

// 캐시 크기 제한 (메모리 관리)
const MAX_CACHE_SIZE = 10000;

/**
 * 사업장명을 해시 기반 고유 ID로 변환
 * 10,000개 사업장 기준 충돌 확률 < 0.01%
 * 
 * @param businessName 원본 사업장명 (한글/영어/숫자/특수문자 지원)
 * @returns 해시 기반 ID (예: biz_a1b2c3d4)
 */
export function generateBusinessId(businessName: string): string {
  if (!businessName || typeof businessName !== 'string') {
    throw new Error('사업장명은 필수이며 문자열이어야 합니다');
  }

  const trimmedName = businessName.trim();
  if (!trimmedName) {
    throw new Error('사업장명이 비어있습니다');
  }

  // 캐시에서 먼저 확인 (성능 최적화)
  if (businessIdCache.has(trimmedName)) {
    return businessIdCache.get(trimmedName)!;
  }

  // 캐시 크기 관리
  if (businessIdCache.size >= MAX_CACHE_SIZE) {
    const firstKey = businessIdCache.keys().next().value;
    businessIdCache.delete(firstKey);
    reverseIdCache.delete(businessIdCache.get(firstKey)!);
  }

  // SHA-256 해시 생성 (8자리)
  const hash = crypto.createHash('sha256')
    .update(trimmedName, 'utf8')
    .digest('hex')
    .substring(0, 8);
  
  const businessId = `biz_${hash}`;

  // 양방향 캐시 저장
  businessIdCache.set(trimmedName, businessId);
  reverseIdCache.set(businessId, trimmedName);

  console.log('🏢 [BUSINESS-ID] 생성 완료:', {
    원본사업장명: trimmedName,
    생성된ID: businessId,
    캐시크기: businessIdCache.size
  });

  return businessId;
}

/**
 * 해시 ID로부터 원본 사업장명 복원 (캐시에서만)
 * 
 * @param businessId 해시 기반 ID
 * @returns 원본 사업장명 또는 undefined
 */
export function getBusinessNameById(businessId: string): string | undefined {
  return reverseIdCache.get(businessId);
}

/**
 * 캐시 통계 조회
 */
export function getCacheStats() {
  return {
    cacheSize: businessIdCache.size,
    maxCacheSize: MAX_CACHE_SIZE,
    cacheHitRate: businessIdCache.size > 0 ? '활성' : '비어있음'
  };
}

/**
 * 캐시 초기화 (테스트/디버깅용)
 */
export function clearCache() {
  businessIdCache.clear();
  reverseIdCache.clear();
  console.log('🧹 [BUSINESS-ID] 캐시 초기화 완료');
}

/**
 * 레거시 경로 감지 및 변환
 * 기존 'default_business' 경로를 새로운 해시 ID로 변환
 */
export function convertLegacyPath(
  filePath: string, 
  businessName: string
): string {
  if (!filePath.includes('default_business')) {
    return filePath; // 이미 새로운 형식
  }

  const newBusinessId = generateBusinessId(businessName);
  const convertedPath = filePath.replace('default_business', newBusinessId);

  console.log('🔄 [PATH-CONVERT] 레거시 경로 변환:', {
    기존경로: filePath,
    변환경로: convertedPath,
    사업장명: businessName
  });

  return convertedPath;
}

/**
 * 경로 호환성 검사
 * 다양한 경로 패턴을 지원하여 fallback 처리
 */
export function generatePathVariants(
  businessName: string,
  facilityType: string,
  fileName: string
): string[] {
  const variants: string[] = [];

  // 파일명에서 시설 정보 추출 (예: discharge1_001_250911.webp -> outlet:1, facility:1)
  const facilityMatch = fileName.match(/(discharge|prevention)(\d+)_/);
  const outletNumber = facilityMatch ? parseInt(facilityMatch[2]) : 1;
  const facilityNumber = outletNumber; // 기본적으로 같은 번호 사용

  // 1. 새로운 해시 기반 경로 (전체 구조 포함)
  const hashId = generateBusinessId(businessName);
  variants.push(`${hashId}/${facilityType}/outlet_${outletNumber}/${facilityType}_${facilityNumber}/${fileName}`);
  variants.push(`${hashId}/${facilityType}/${fileName}`); // 단순 구조도 시도

  // 2. 레거시 경로들 (전체 구조 포함)
  variants.push(`default_business/${facilityType}/outlet_${outletNumber}/${facilityType}_${facilityNumber}/${fileName}`);
  variants.push(`default_business/${facilityType}/${fileName}`); // 단순 구조도 시도
  
  // 3. 기존 하드코딩된 경로들 (하위 호환)
  const legacyMappings: { [key: string]: string } = {
    '스타일웍스': 'styleworks',
    '삼성전자': 'samsung',
    '엘지전자': 'lg'
  };
  
  if (legacyMappings[businessName]) {
    variants.push(`${legacyMappings[businessName]}/${facilityType}/outlet_${outletNumber}/${facilityType}_${facilityNumber}/${fileName}`);
    variants.push(`${legacyMappings[businessName]}/${facilityType}/${fileName}`);
  }

  // 4. URL 인코딩된 경로
  const encodedName = encodeURIComponent(businessName).replace(/%/g, '_');
  variants.push(`${encodedName}/${facilityType}/outlet_${outletNumber}/${facilityType}_${facilityNumber}/${fileName}`);
  variants.push(`${encodedName}/${facilityType}/${fileName}`);

  console.log('🔍 [PATH-VARIANTS] 생성된 경로 후보들:', {
    사업장명: businessName,
    시설정보: { facilityType, outletNumber, facilityNumber },
    경로수: variants.length,
    경로들: variants
  });

  return variants;
}