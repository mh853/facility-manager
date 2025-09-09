// lib/object-factories.ts - Factory functions for consistent object creation
import { OutletWithFacilities } from '@/lib/database-service'

/**
 * Creates a complete outlet object that satisfies the OutletWithFacilities interface
 * Prevents recurring TypeScript interface compliance errors
 */
export function createDefaultOutlet(overrides: Partial<OutletWithFacilities> = {}): OutletWithFacilities {
  const now = new Date().toISOString()
  
  return {
    id: overrides.id || `new-outlet-${Date.now()}`,
    air_permit_id: overrides.air_permit_id || '',
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
    outlet_number: overrides.outlet_number || 1,
    outlet_name: overrides.outlet_name || '배출구 1',
    additional_info: overrides.additional_info || {},
    discharge_facilities: overrides.discharge_facilities || [],
    prevention_facilities: overrides.prevention_facilities || [],
    ...overrides
  }
}

/**
 * Creates multiple default outlets with incremental numbering
 */
export function createDefaultOutlets(count: number, baseProps: Partial<OutletWithFacilities> = {}): OutletWithFacilities[] {
  const outlets: OutletWithFacilities[] = []
  
  for (let i = 1; i <= count; i++) {
    outlets.push(createDefaultOutlet({
      ...baseProps,
      id: baseProps.id ? `${baseProps.id}-${i}` : `new-outlet-${i}`,
      outlet_number: i,
      outlet_name: `배출구 ${i}`
    }))
  }
  
  return outlets
}

/**
 * Type guard to ensure an object satisfies the OutletWithFacilities interface
 */
export function isValidOutlet(obj: any): obj is OutletWithFacilities {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.air_permit_id === 'string' &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string' &&
    typeof obj.outlet_number === 'number' &&
    (typeof obj.outlet_name === 'string' || obj.outlet_name === null) &&
    typeof obj.additional_info === 'object' &&
    Array.isArray(obj.discharge_facilities) &&
    Array.isArray(obj.prevention_facilities)
  )
}

/**
 * Validates and corrects outlet objects to ensure interface compliance
 * Used to prevent runtime TypeScript errors
 */
export function ensureOutletCompliance(obj: Partial<OutletWithFacilities>): OutletWithFacilities {
  if (isValidOutlet(obj)) {
    return obj
  }
  
  console.warn('🔧 Outlet object does not comply with interface, creating compliant version:', obj)
  return createDefaultOutlet(obj)
}