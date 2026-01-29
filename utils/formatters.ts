// utils/formatters.ts - 날짜 및 통화 포맷 유틸리티

/**
 * 날짜를 yyyy-mm-dd 형식으로 포맷
 * @param dateString - ISO 날짜 문자열 또는 Date 객체
 * @returns yyyy-mm-dd 형식의 날짜 문자열
 */
export function formatDate(dateString: string | Date): string {
  if (!dateString) return ''

  try {
    // 문자열인 경우 ISO 8601 형식에서 날짜 부분만 추출
    if (typeof dateString === 'string') {
      // YYYY-MM-DD 형식이면 그대로 반환
      const dateOnlyMatch = dateString.match(/^\d{4}-\d{2}-\d{2}$/)
      if (dateOnlyMatch) {
        return dateString
      }

      // ISO 8601 datetime 형식(YYYY-MM-DDTHH:mm:ss.sssZ)에서 날짜 부분만 추출
      if (dateString.includes('T')) {
        return dateString.split('T')[0]
      }
    }

    // Date 객체인 경우 UTC 기준으로 포맷
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString

    // 유효하지 않은 날짜인 경우
    if (isNaN(date.getTime())) {
      return typeof dateString === 'string' ? dateString : ''
    }

    // UTC 기준으로 날짜 추출 (타임존 변환 방지)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  } catch (error) {
    console.error('날짜 포맷 오류:', error)
    return typeof dateString === 'string' ? dateString : ''
  }
}

/**
 * 숫자를 통화 형식으로 포맷 (천 단위 콤마, 소수점 제거)
 * @param amount - 금액 (숫자)
 * @returns 포맷된 금액 문자열 (예: "1,234,567")
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0'

  try {
    // 소수점 제거 (floor)
    const integerAmount = Math.floor(amount)

    // 천 단위 콤마 추가
    return integerAmount.toLocaleString('ko-KR')
  } catch (error) {
    console.error('통화 포맷 오류:', error)
    return '0'
  }
}

/**
 * 원화 기호와 함께 금액을 포맷
 * @param amount - 금액 (숫자)
 * @returns 포맷된 금액 문자열 (예: "₩1,234,567")
 */
export function formatKRW(amount: number | null | undefined): string {
  return `₩${formatCurrency(amount)}`
}
