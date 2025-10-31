// types/router-inventory.ts
// 무선 라우터 재고 관리 타입 정의

/**
 * 라우터 상태
 */
export type RouterStatus = 'in_stock' | 'assigned'

/**
 * 라우터 재고 항목
 */
export interface RouterInventoryItem {
  id: string
  product_name: string
  serial_number: string
  mac_address: string | null
  imei: string | null

  // 입고 정보
  received_date: string | null
  received_batch: string | null
  supplier: string | null

  // 출고 정보
  shipped_date: string | null
  shipped_batch: string | null

  // 할당 정보
  assigned_business_id: string | null
  assigned_business_name?: string
  assigned_at: string | null
  assigned_by: string | null
  order_management_id: string | null

  // 상태
  status: RouterStatus

  // 메타
  notes: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
}

/**
 * 라우터 추가 요청 (복사-붙여넣기 데이터)
 */
export interface RouterBulkAddRequest {
  routers: {
    product_name: string
    serial_number: string
    mac_address?: string
    imei?: string
    shipped_date?: string
    supplier?: string
    assigned_business_name?: string  // 사업장 이름 (업로드 시 자동 할당)
  }[]
}

/**
 * 라우터 출고일 일괄 업데이트 요청
 */
export interface RouterShippingBulkUpdateRequest {
  router_ids: string[]
  shipped_date: string
  shipped_batch?: string
}

/**
 * 라우터 할당 요청
 */
export interface RouterAssignRequest {
  router_id: string
  business_id: string
  order_management_id: string
  assigned_by: string
}

/**
 * 라우터 목록 필터
 */
export interface RouterListFilter {
  status?: RouterStatus | 'all'
  search?: string  // S/N, MAC, IMEI 검색
  business_id?: string
  shipped_date_from?: string
  shipped_date_to?: string
  page?: number
  limit?: number
}

/**
 * 라우터 목록 응답
 */
export interface RouterListResponse {
  success: boolean
  data: {
    routers: RouterInventoryItem[]
    pagination: {
      total: number
      page: number
      limit: number
      total_pages: number
    }
    summary: {
      total: number
      in_stock: number
      assigned: number
      shipped_pending: number  // 출고했지만 미할당
    }
  }
  message?: string
}

/**
 * 라우터 상세 응답
 */
export interface RouterDetailResponse {
  success: boolean
  data: RouterInventoryItem
  message?: string
}

/**
 * 라우터 통계
 */
export interface RouterStatistics {
  total_inventory: number
  available_stock: number
  assigned_count: number
  recent_shipments: number  // 최근 7일 출고
  low_stock_alert: boolean  // 재고 10개 미만 경고
}
