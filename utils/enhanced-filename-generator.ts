// utils/enhanced-filename-generator.ts - 개선된 사용자 친화적 파일명 생성기

/**
 * 사용자 친화적 파일명 생성
 * 구조: {시설유형}{번호}_{파일크기}_{날짜}_{시간}_{원본파일명}
 * 
 * 예시:
 * - 배1_3.2MB_20241211_143022_측정사진.jpg
 * - 방2_1.8MB_20241211_143023_검사사진.jpg
 * - 게이트웨이_2.1MB_20241211_143024_전경사진.jpg
 */

interface EnhancedFileNameParams {
  facilityType: 'discharge' | 'prevention' | 'basic';
  facilityNumber?: number;
  outletNumber?: number;
  category?: string; // 기본사진용
  fileSize: number; // 바이트 단위
  originalFileName: string;
}

/**
 * 파일 크기를 MB 단위로 포맷팅
 */
function formatFileSize(sizeInBytes: number): string {
  const sizeInMB = sizeInBytes / (1024 * 1024);
  return `${sizeInMB.toFixed(1)}MB`;
}

/**
 * 날짜를 YYYYMMDD 형식으로 포맷팅
 */
function formatDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 시간을 HHMMSS 형식으로 포맷팅
 */
function formatTime(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${hours}${minutes}${seconds}`;
}

/**
 * 원본 파일명에서 확장자를 제외한 이름 추출
 */
function getBaseFileName(originalFileName: string): string {
  const lastDotIndex = originalFileName.lastIndexOf('.');
  return lastDotIndex > 0 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
}

/**
 * 파일 확장자 추출
 */
function getFileExtension(originalFileName: string): string {
  const lastDotIndex = originalFileName.lastIndexOf('.');
  return lastDotIndex > 0 ? originalFileName.substring(lastDotIndex + 1) : 'jpg';
}

/**
 * 시설 유형별 접두사 생성
 */
function getFacilityPrefix(
  facilityType: 'discharge' | 'prevention' | 'basic',
  facilityNumber?: number,
  outletNumber?: number,
  category?: string
): string {
  switch (facilityType) {
    case 'discharge':
      return `배${facilityNumber}`;
    case 'prevention':
      return `방${facilityNumber}`;
    case 'basic':
      switch (category) {
        case 'gateway':
          return '게이트웨이';
        case 'fan':
          return '송풍팬';
        case 'others':
        default:
          return '기타';
      }
    default:
      return '사진';
  }
}

/**
 * 안전한 파일명으로 변환 (특수문자 제거)
 */
function sanitizeFileName(fileName: string): string {
  // Windows에서 금지된 문자들을 제거하거나 대체
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_') // 금지된 문자를 언더스코어로 대체
    .replace(/\s+/g, '_') // 연속된 공백을 언더스코어로 대체
    .replace(/_+/g, '_') // 연속된 언더스코어를 하나로 줄임
    .trim();
}

/**
 * 개선된 파일명 생성 메인 함수
 */
export function generateEnhancedFileName(params: EnhancedFileNameParams): string {
  const {
    facilityType,
    facilityNumber,
    outletNumber,
    category,
    fileSize,
    originalFileName
  } = params;

  // 구성 요소들 생성
  const facilityPrefix = getFacilityPrefix(facilityType, facilityNumber, outletNumber, category);
  const fileSizeFormatted = formatFileSize(fileSize);
  const dateFormatted = formatDate();
  const timeFormatted = formatTime();
  const baseFileName = getBaseFileName(originalFileName);
  const fileExtension = getFileExtension(originalFileName);

  // 파일명 조합
  const newFileName = `${facilityPrefix}_${fileSizeFormatted}_${dateFormatted}_${timeFormatted}_${baseFileName}.${fileExtension}`;
  
  // 안전한 파일명으로 변환
  const safeFileName = sanitizeFileName(newFileName);

  console.log('📝 [ENHANCED-FILENAME] 파일명 생성:', {
    입력: params,
    구성요소: {
      시설접두사: facilityPrefix,
      파일크기: fileSizeFormatted,
      날짜: dateFormatted,
      시간: timeFormatted,
      원본파일명: baseFileName,
      확장자: fileExtension
    },
    생성된파일명: safeFileName
  });

  return safeFileName;
}

/**
 * 파일명 생성 예시 함수 (테스트용)
 */
export function generateFileNameExamples(): void {
  const examples = [
    {
      facilityType: 'discharge' as const,
      facilityNumber: 1,
      outletNumber: 1,
      fileSize: 3355443, // 3.2MB
      originalFileName: '측정사진.jpg'
    },
    {
      facilityType: 'prevention' as const,
      facilityNumber: 2,
      outletNumber: 1,
      fileSize: 1887437, // 1.8MB
      originalFileName: '검사사진.jpg'
    },
    {
      facilityType: 'basic' as const,
      category: 'gateway',
      fileSize: 2202010, // 2.1MB
      originalFileName: '전경사진.jpg'
    }
  ];

  console.log('📋 [FILENAME-EXAMPLES] 파일명 생성 예시:');
  examples.forEach((example, index) => {
    const fileName = generateEnhancedFileName(example);
    console.log(`${index + 1}. ${fileName}`);
  });
}