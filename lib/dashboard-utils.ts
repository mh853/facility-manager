// 대시보드 API용 유틸리티 함수들

/**
 * 집계 단위 타입 정의
 */
export type AggregationLevel = 'daily' | 'weekly' | 'monthly';

/**
 * 날짜 범위를 기반으로 적절한 집계 단위 결정
 * - 7일 이하: 일별 집계
 * - 8~60일: 주별 집계
 * - 61일 이상: 월별 집계
 *
 * @param startDate YYYY-MM 또는 YYYY-MM-DD 형식
 * @param endDate YYYY-MM 또는 YYYY-MM-DD 형식
 * @returns 적절한 집계 단위
 */
export function determineAggregationLevel(startDate: string, endDate: string): AggregationLevel {
  try {
    // YYYY-MM 형식인 경우 -01 추가
    const normalizedStart = startDate.length === 7 ? startDate + '-01' : startDate;
    const normalizedEnd = endDate.length === 7 ? endDate + '-01' : endDate;

    const start = new Date(normalizedStart);
    const end = new Date(normalizedEnd);

    // 유효하지 않은 날짜인 경우 월별로 폴백
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn('[Dashboard Utils] Invalid dates, falling back to monthly:', { startDate, endDate });
      return 'monthly';
    }

    const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 7) return 'daily';
    if (daysDiff <= 60) return 'weekly';
    return 'monthly';
  } catch (error) {
    console.error('[Dashboard Utils] Error determining aggregation level:', error);
    return 'monthly'; // 에러 시 월별로 폴백
  }
}

/**
 * 날짜를 집계 키로 변환
 *
 * @param date Date 객체
 * @param level 집계 단위
 * @returns 집계 키 (YYYY-MM-DD, YYYY-Www, YYYY-MM)
 */
export function getAggregationKey(date: Date, level: AggregationLevel): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (level) {
    case 'daily':
      return `${year}-${month}-${day}`;

    case 'weekly':
      // ISO 주차 계산 (일요일 시작)
      const startOfYear = new Date(year, 0, 1);
      const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
      return `${year}-W${String(weekNumber).padStart(2, '0')}`;

    case 'monthly':
      return `${year}-${month}`;

    default:
      return `${year}-${month}`;
  }
}

/**
 * 집계 키를 표시용 레이블로 변환
 *
 * @param key 집계 키
 * @param level 집계 단위
 * @returns 표시용 레이블
 */
export function formatAggregationLabel(key: string, level: AggregationLevel): string {
  switch (level) {
    case 'daily':
      // 2025-10-29 -> 10/29
      const [, month, day] = key.split('-');
      return `${month}/${day}`;

    case 'weekly':
      // 2025-W43 -> 43주차
      const weekNum = key.split('-W')[1];
      return `${weekNum}주차`;

    case 'monthly':
      // 2025-10 -> 2025-10 (기존 형식 유지)
      return key;

    default:
      return key;
  }
}

/**
 * 날짜 범위에서 모든 집계 키 생성
 *
 * @param startDate 시작일 (YYYY-MM 또는 YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM 또는 YYYY-MM-DD)
 * @param level 집계 단위
 * @returns 집계 키 배열
 */
export function generateAggregationKeys(
  startDate: string,
  endDate: string,
  level: AggregationLevel
): string[] {
  const keys: string[] = [];

  try {
    // 날짜 정규화
    const normalizedStart = startDate.length === 7 ? startDate + '-01' : startDate;
    const normalizedEnd = endDate.length === 7 ? endDate + '-01' : endDate;

    const start = new Date(normalizedStart);
    const end = new Date(normalizedEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn('[Dashboard Utils] Invalid dates for key generation:', { startDate, endDate });
      return keys;
    }

    const current = new Date(start);

    switch (level) {
      case 'daily':
        // 일별: 시작일부터 종료일까지 매일
        while (current <= end) {
          keys.push(getAggregationKey(current, level));
          current.setDate(current.getDate() + 1);
        }
        break;

      case 'weekly':
        // 주별: 시작일부터 종료일까지 매주
        const seenWeeks = new Set<string>();
        while (current <= end) {
          const weekKey = getAggregationKey(current, level);
          if (!seenWeeks.has(weekKey)) {
            keys.push(weekKey);
            seenWeeks.add(weekKey);
          }
          current.setDate(current.getDate() + 1);
        }
        break;

      case 'monthly':
        // 월별: 시작월부터 종료월까지 매월
        while (current <= end) {
          keys.push(getAggregationKey(current, level));
          current.setMonth(current.getMonth() + 1);
        }
        break;
    }

    return keys;
  } catch (error) {
    console.error('[Dashboard Utils] Error generating aggregation keys:', error);
    return keys;
  }
}

/**
 * 주차의 시작일과 종료일 계산 (일요일 시작)
 *
 * @param year 연도
 * @param week 주차
 * @returns { start: Date, end: Date }
 */
export function getWeekDateRange(year: number, week: number): { start: Date; end: Date } {
  const startOfYear = new Date(year, 0, 1);
  const dayOfWeek = startOfYear.getDay(); // 0 (일요일) ~ 6 (토요일)

  // 첫 번째 일요일까지의 일수
  const daysToFirstSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

  // 해당 주의 일요일
  const weekStart = new Date(year, 0, 1 + daysToFirstSunday + (week - 1) * 7);

  // 해당 주의 토요일
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return { start: weekStart, end: weekEnd };
}

/**
 * 현재 시점의 집계 키 반환
 *
 * @param level 집계 단위
 * @returns 현재 시점의 집계 키 (YYYY-MM-DD, YYYY-Www, YYYY-MM)
 */
export function getCurrentTimeKey(level: AggregationLevel): string {
  const now = new Date();
  return getAggregationKey(now, level);
}
