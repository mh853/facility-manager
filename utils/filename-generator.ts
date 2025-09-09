// utils/filename-generator.ts - 시설별 파일명 생성 유틸리티

import { Facility } from '@/types';

/**
 * 시설별 파일명 생성 규칙
 * 구조: {시설타입}{순번}_{시설명}{용량}_{사진순서}번째_{yymmdd}.webp
 * 
 * 예시:
 * - 방1_흡착에의한시설250㎥/분_1번째_250109.webp
 * - 배2_혼합시설3.5㎥_2번째_250109.webp
 */

interface FileNameParams {
  facility: Facility;
  facilityType: 'discharge' | 'prevention';
  facilityIndex: number; // 해당 시설 타입 내에서의 순번 (1, 2, 3...)
  photoIndex: number; // 사진 순서 (1, 2, 3...)
  originalFileName?: string;
}

/**
 * 간략한 타임스탬프 생성 (yymmdd 형식)
 */
function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // 24, 25
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 01-12
  const day = now.getDate().toString().padStart(2, '0'); // 01-31
  return `${year}${month}${day}`;
}

/**
 * 파일 확장자 추출
 */
function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png' ? 'webp' : (ext || 'webp');
}

/**
 * 시설명과 용량을 정리하여 파일명에 적합한 형태로 변환
 */
function sanitizeFacilityInfo(name: string, capacity: string): string {
  // 시설명에서 불필요한 문자 제거 및 정리
  let cleanName = name
    .replace(/\s+/g, '') // 공백 제거
    .replace(/[()]/g, '') // 괄호 제거
    .trim();

  // 용량 정보 정리 (특수문자 유지)
  let cleanCapacity = capacity
    .replace(/\s+/g, '') // 공백만 제거
    .trim();

  return `${cleanName}${cleanCapacity}`;
}

/**
 * 시설별 구조화된 파일명 생성
 * 
 * @param params 파일명 생성에 필요한 파라미터
 * @returns 구조화된 파일명
 */
export function generateFacilityFileName(params: FileNameParams): string {
  const {
    facility,
    facilityType,
    facilityIndex,
    photoIndex,
    originalFileName = 'photo.jpg'
  } = params;

  // 1. 시설 타입과 순번
  const facilityPrefix = facilityType === 'prevention' ? '방' : '배';
  const facilityNumber = facilityIndex;

  // 2. 시설명과 용량 조합
  const facilityInfo = sanitizeFacilityInfo(facility.name, facility.capacity);

  // 3. 사진 순서
  const photoOrder = `${photoIndex}번째`;

  // 4. 타임스탬프
  const timestamp = generateTimestamp();

  // 5. 확장자 (webp로 통일)
  const extension = getFileExtension(originalFileName);

  // 6. 최종 파일명 조합
  const fileName = `${facilityPrefix}${facilityNumber}_${facilityInfo}_${photoOrder}_${timestamp}.${extension}`;

  console.log('📝 [FILENAME-GENERATOR] 파일명 생성:', {
    입력: params,
    생성된파일명: fileName,
    구조분석: {
      시설타입: `${facilityPrefix} (${facilityType})`,
      시설순번: facilityNumber,
      시설정보: facilityInfo,
      사진순서: photoOrder,
      타임스탬프: timestamp,
      확장자: extension
    }
  });

  return fileName;
}

/**
 * 기본사진용 파일명 생성
 * 구조: 기본_{카테고리}_{순서}번째_{yymmdd}.webp
 */
export function generateBasicFileName(
  category: string, 
  photoIndex: number, 
  originalFileName: string = 'photo.jpg'
): string {
  const timestamp = generateTimestamp();
  const extension = getFileExtension(originalFileName);
  const photoOrder = `${photoIndex}번째`;

  // 카테고리명 매핑
  const categoryMap: { [key: string]: string } = {
    'gateway': '게이트웨이',
    'fan': '송풍기',
    'electrical': '배전함',
    'others': '기타시설'
  };

  const categoryName = categoryMap[category] || category;
  const fileName = `기본_${categoryName}_${photoOrder}_${timestamp}.${extension}`;

  console.log('📝 [BASIC-FILENAME-GENERATOR] 기본사진 파일명 생성:', {
    카테고리: category,
    사진순서: photoIndex,
    생성된파일명: fileName
  });

  return fileName;
}

/**
 * 시설 목록에서 특정 시설 타입의 순번 계산
 */
export function calculateFacilityIndex(
  facilities: Facility[], 
  targetFacility: Facility, 
  facilityType: 'discharge' | 'prevention'
): number {
  // 같은 타입의 시설들만 필터링
  const sameTyepFacilities = facilities.filter(f => f.outlet === targetFacility.outlet);
  
  // 배출구 내에서 해당 시설의 순번 찾기
  const facilityIndex = sameTyepFacilities.findIndex(f => 
    f.number === targetFacility.number && 
    f.name === targetFacility.name && 
    f.capacity === targetFacility.capacity
  );

  return facilityIndex + 1; // 1부터 시작
}

/**
 * 업로드된 파일들 중에서 같은 시설의 사진 개수 계산 (사진 순서 결정용)
 */
export function calculatePhotoIndex(
  existingFiles: any[], 
  facility: Facility, 
  facilityType: 'discharge' | 'prevention'
): number {
  const facilityPrefix = facilityType === 'prevention' ? '방' : '배';
  const facilityInfo = sanitizeFacilityInfo(facility.name, facility.capacity);

  // 같은 시설의 기존 파일 개수 계산
  const existingCount = existingFiles.filter(file => 
    file.name && file.name.includes(`${facilityPrefix}`) && file.name.includes(facilityInfo)
  ).length;

  return existingCount + 1; // 다음 순서
}

/**
 * 기본사진의 사진 순서 계산
 */
export function calculateBasicPhotoIndex(
  existingFiles: any[], 
  category: string
): number {
  const categoryMap: { [key: string]: string } = {
    'gateway': '게이트웨이',
    'fan': '송풍기', 
    'electrical': '배전함',
    'others': '기타시설'
  };

  const categoryName = categoryMap[category] || category;

  // 같은 카테고리의 기존 파일 개수 계산
  const existingCount = existingFiles.filter(file =>
    file.name && file.name.includes(`기본_${categoryName}`)
  ).length;

  return existingCount + 1; // 다음 순서
}