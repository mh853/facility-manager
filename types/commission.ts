// types/commission.ts
// 수수료율 관리 시스템 타입 정의

export type Manufacturer = 'ecosense' | 'gaia_cns' | 'cleanearth' | 'evs'

export const MANUFACTURER_LABELS: Record<Manufacturer, string> = {
  ecosense: '에코센스',
  gaia_cns: '가이아씨앤에스',
  cleanearth: '크린어스',
  evs: '이브이에스'
}

export const MANUFACTURERS: Manufacturer[] = [
  'ecosense',
  'gaia_cns',
  'cleanearth',
  'evs'
]

// 수수료율 기본 정보
export interface CommissionRate {
  id: string
  sales_office: string
  manufacturer: Manufacturer
  commission_rate: number
  effective_from: string
  effective_to: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// 수수료율 이력 (생성자 정보 포함)
export interface CommissionRateHistory extends CommissionRate {
  created_by_name: string | null
  created_by_email: string | null
  is_current: boolean
}

// 영업점별 수수료율 설정
export interface SalesOfficeCommissionConfig {
  sales_office: string
  rates: {
    manufacturer: Manufacturer
    commission_rate: number
    effective_from: string
    notes?: string
  }[]
}

// 수수료율 업데이트 요청
export interface CommissionRateUpdateRequest {
  sales_office: string
  effective_from: string  // 적용 시작일
  rates: {
    manufacturer: Manufacturer
    commission_rate: number
    notes?: string
  }[]
}

// 단일 수수료율 업데이트
export interface SingleCommissionRateUpdate {
  manufacturer: Manufacturer
  commission_rate: number
  notes?: string
}

// 대량 업데이트 요청 (모든 영업점의 특정 제조사 수수료율)
export interface BulkCommissionRateUpdate {
  manufacturer: Manufacturer
  commission_rate: number
  effective_from: string
  notes?: string
  sales_offices?: string[]  // 지정하지 않으면 모든 영업점
}

// API 응답 타입
export interface CommissionRatesResponse {
  success: boolean
  data: {
    sales_office: string
    rates: CommissionRate[]
  }
}

export interface CommissionRateHistoryResponse {
  success: boolean
  data: {
    sales_office?: string
    manufacturer?: Manufacturer
    history: CommissionRateHistory[]
    total: number
  }
}

export interface BulkUpdateResponse {
  success: boolean
  data: {
    affected_count: number
    updated_offices: string[]
    details: {
      sales_office: string
      previous_rate: number | null
      new_rate: number
    }[]
  }
}

// 수수료 계산 결과
export interface CommissionCalculationResult {
  revenue: number
  commission_rate: number
  commission_amount: number
  sales_office: string
  manufacturer: Manufacturer
  calculation_date: string
}

// 수수료율 통계
export interface CommissionRateStatistics {
  by_manufacturer: {
    manufacturer: Manufacturer
    label: string
    avg_rate: number
    min_rate: number
    max_rate: number
    office_count: number
  }[]
  by_sales_office: {
    sales_office: string
    avg_rate: number
    rate_count: number
  }[]
  overall_avg: number
}
