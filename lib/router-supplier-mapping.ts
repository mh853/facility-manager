// lib/router-supplier-mapping.ts
// 라우터 상품명 기반 공급업체 자동 매핑

/**
 * 라우터 상품명에서 공급업체를 자동으로 매핑
 * @param productName 라우터 상품명
 * @returns 공급업체명 또는 null
 */
export function getSupplierFromProductName(productName: string): string | null {
  if (!productName) return null

  const normalizedName = productName.trim().toUpperCase()

  // 상품명 패턴 매핑
  const supplierMappings: { pattern: RegExp; supplier: string }[] = [
    { pattern: /ME-I71KT/i, supplier: '가이아씨앤에스' },
    { pattern: /TC720/i, supplier: '크린어스' },
    // 향후 추가 가능한 매핑
    // { pattern: /ROUTER-X/i, supplier: '다른업체' }
  ]

  for (const mapping of supplierMappings) {
    if (mapping.pattern.test(normalizedName)) {
      return mapping.supplier
    }
  }

  return null
}

/**
 * 상품명 목록을 기반으로 공급업체 매핑
 * @param productNames 상품명 배열
 * @returns 상품명별 공급업체 매핑 객체
 */
export function bulkMapSuppliers(
  productNames: string[]
): Record<string, string | null> {
  const mappings: Record<string, string | null> = {}

  for (const productName of productNames) {
    mappings[productName] = getSupplierFromProductName(productName)
  }

  return mappings
}

/**
 * 공급업체 목록 가져오기 (자동 매핑된 공급업체들)
 */
export function getAvailableSuppliers(): string[] {
  return ['가이아씨앤에스', '크린어스']
}

/**
 * 상품명이 특정 공급업체의 제품인지 확인
 * @param productName 라우터 상품명
 * @param supplier 공급업체명
 * @returns 매칭 여부
 */
export function isProductFromSupplier(
  productName: string,
  supplier: string
): boolean {
  const detectedSupplier = getSupplierFromProductName(productName)
  return detectedSupplier === supplier
}
