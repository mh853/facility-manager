/**
 * 전화번호 자동 포맷팅 유틸리티
 * 숫자만 입력하면 자동으로 하이픈(-)을 추가합니다
 */

/**
 * 전화번호를 자동으로 포맷팅
 * @param value - 입력된 전화번호 (숫자와 하이픈 포함 가능)
 * @returns 포맷팅된 전화번호
 *
 * 지원 형식:
 * - 휴대전화: 010-1234-5678, 011-123-4567
 * - 서울 지역번호: 02-1234-5678, 02-123-4567
 * - 기타 지역번호: 031-123-4567, 051-1234-5678
 * - 1588/1577: 1588-1234
 * - 단축번호: 그대로 반환
 */
export function formatPhoneNumber(value: string): string {
  if (!value) return '';

  // 숫자만 추출
  const numbers = value.replace(/[^\d]/g, '');

  // 빈 문자열이면 그대로 반환
  if (!numbers) return '';

  // 길이에 따라 포맷팅
  const length = numbers.length;

  // 1-3자리: 그대로 반환
  if (length <= 3) {
    return numbers;
  }

  // 4자리: 1588, 1577 등 (1588-1234 형태)
  if (length === 4) {
    return numbers;
  }

  // 5-7자리: 부분 포맷팅
  if (length <= 7) {
    if (numbers.startsWith('02')) {
      // 서울 지역번호 (02-123-4567 또는 02-1234-5678)
      return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    } else if (numbers.startsWith('1')) {
      // 1588, 1577 등
      return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
    } else {
      // 기타 지역번호 (3자리)
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    }
  }

  // 8자리 이상: 완전 포맷팅
  if (numbers.startsWith('02')) {
    // 서울 지역번호
    if (length === 9) {
      // 02-123-4567
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
    } else {
      // 02-1234-5678
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
    }
  } else if (numbers.startsWith('01')) {
    // 휴대전화 (010, 011, 016, 017, 018, 019)
    if (length === 10) {
      // 구형: 011-123-4567
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
    } else {
      // 신형: 010-1234-5678
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  } else if (numbers.startsWith('15') || numbers.startsWith('16') || numbers.startsWith('18')) {
    // 1588, 1577, 1600, 1800 등 대표번호
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 8)}`;
  } else {
    // 기타 지역번호 (3자리)
    if (length === 10) {
      // 031-123-4567
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
    } else {
      // 031-1234-5678
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  }
}

/**
 * 전화번호 입력 핸들러 (React onChange용)
 * @param value - 입력된 값
 * @param maxLength - 최대 길이 (기본: 13, 하이픈 포함)
 * @returns 포맷팅된 전화번호
 */
export function handlePhoneInput(value: string, maxLength: number = 13): string {
  // 포맷팅
  const formatted = formatPhoneNumber(value);

  // 최대 길이 제한
  return formatted.slice(0, maxLength);
}

/**
 * 전화번호 유효성 검증
 * @param value - 검증할 전화번호
 * @returns 유효 여부
 */
export function isValidPhoneNumber(value: string): boolean {
  if (!value) return true; // 빈 값은 허용 (선택 필드)

  const numbers = value.replace(/[^\d]/g, '');

  // 최소 길이 확인 (지역번호 포함 최소 9자리)
  if (numbers.length < 9) return false;

  // 최대 길이 확인 (최대 11자리)
  if (numbers.length > 11) return false;

  // 유효한 시작 번호 확인
  const validPrefixes = [
    '02',   // 서울
    '031', '032', '033', '041', '042', '043', '044', // 경기/강원/충청/세종
    '051', '052', '053', '054', '055', // 부산/울산/대구/경북/경남
    '061', '062', '063', '064', // 전남/광주/전북/제주
    '010', '011', '016', '017', '018', '019', // 휴대전화
    '15', '16', '18', '070' // 대표번호, 인터넷전화
  ];

  return validPrefixes.some(prefix => numbers.startsWith(prefix));
}

/**
 * 전화번호에서 숫자만 추출
 * @param value - 전화번호
 * @returns 숫자만 포함된 문자열
 */
export function extractNumbers(value: string): string {
  return value.replace(/[^\d]/g, '');
}
