// lib/database-service.ts - 사업장 및 대기필증 관리 데이터베이스 서비스
import { supabase, supabaseAdmin } from './supabase'

// 유사도 계산 함수 (레벤슈타인 거리 기반)
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

// 새로운 데이터베이스 타입 정의
export interface BusinessInfo {
  id: string
  created_at: string
  updated_at: string
  business_name: string
  local_government: string | null
  address: string | null
  manager_name: string | null
  manager_position: string | null
  manager_contact: string | null
  business_contact: string | null
  email: string | null
  representative_name: string | null
  representative_birth_date: string | null
  business_registration_number: string | null
  additional_info: Record<string, any>
  is_active: boolean
  is_deleted: boolean
  
  // 이 필드들은 additional_info에서 관리되지만 UI에서 사용하기 위해 optional로 유지
  fax_number?: string | null
  manufacturer?: string | null
  ph_meter?: number
  differential_pressure_meter?: number
  temperature_meter?: number
  discharge_ct?: string | null
  fan_ct?: number
  pump_ct?: number
  gateway?: string | null
  vpn_wired?: number
  vpn_wireless?: number
  multiple_stack?: number
}

export interface AirPermitInfo {
  id: string
  business_id: string
  created_at: string
  updated_at: string
  business_type: string | null
  annual_emission_amount: number | null
  first_report_date: string | null
  operation_start_date: string | null
  additional_info: Record<string, any>
  is_active: boolean
  is_deleted: boolean
}

export interface DischargeOutlet {
  id: string
  air_permit_id: string
  created_at: string
  updated_at: string
  outlet_number: number
  outlet_name: string | null
  additional_info: Record<string, any>
}

export interface DischargeFacility {
  id: string
  outlet_id: string
  created_at: string
  updated_at: string
  facility_name: string
  capacity: string | null
  quantity: number
  additional_info: Record<string, any>
}

export interface PreventionFacility {
  id: string
  outlet_id: string
  created_at: string
  updated_at: string
  facility_name: string
  capacity: string | null
  quantity: number
  additional_info: Record<string, any>
}

export interface DataHistory {
  id: string
  created_at: string
  table_name: string
  record_id: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: Record<string, any> | null
  new_data: Record<string, any> | null
  user_id: string | null
  change_reason: string | null
}

export interface OutletWithFacilities extends DischargeOutlet {
  discharge_facilities: DischargeFacility[]
  prevention_facilities: PreventionFacility[]
}

export interface AirPermitWithOutlets extends AirPermitInfo {
  outlets: OutletWithFacilities[]
}

export interface BusinessWithPermits extends BusinessInfo {
  air_permits: AirPermitWithOutlets[]
}

// Database Service Class
export class DatabaseService {
  // === 사업장 정보 관리 ===
  
  /**
   * 모든 활성 사업장 목록 조회
   */
  static async getBusinessList(): Promise<BusinessInfo[]> {
    const { data, error } = await supabase
      .from('business_info')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('business_name')

    if (error) throw new Error(`사업장 목록 조회 실패: ${error.message}`)
    return data || []
  }

  /**
   * ID로 사업장 정보 조회
   */
  static async getBusinessById(id: string): Promise<BusinessInfo | null> {
    const { data, error } = await supabase
      .from('business_info')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`사업장 조회 실패: ${error.message}`)
    }
    return data
  }

  /**
   * 사업장명으로 검색
   */
  static async searchBusinessByName(searchTerm: string): Promise<BusinessInfo[]> {
    const { data, error } = await supabase
      .from('business_info')
      .select('*')
      .ilike('business_name', `%${searchTerm}%`)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('business_name')

    if (error) throw new Error(`사업장 검색 실패: ${error.message}`)
    return data || []
  }

  /**
   * 사업장명으로 사업장 정보 조회 (중복 체크용)
   */
  static async getBusinessByName(businessName: string): Promise<BusinessInfo | null> {
    const { data, error } = await supabase
      .from('business_info')
      .select('*')
      .eq('business_name', businessName)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      console.log(`사업장명 조회 결과 없음: ${businessName}`)
      return null
    }

    return data
  }

  /**
   * 유사한 사업장명 검색 (중복 의심 체크용)
   */
  static async findSimilarBusinessNames(businessName: string): Promise<BusinessInfo[]> {
    // 공백 제거 및 소문자 변환으로 유사도 체크
    const normalizedName = businessName.replace(/\s+/g, '').toLowerCase()
    
    const { data, error } = await supabase
      .from('business_info')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false)
    
    if (error) {
      console.error('유사 사업장명 검색 오류:', error)
      return []
    }

    // 클라이언트 측에서 유사도 체크
    const similarBusinesses = data?.filter(business => {
      const existingNormalized = business.business_name.replace(/\s+/g, '').toLowerCase()
      
      // 1. 완전 일치 (정규화된 이름)
      if (existingNormalized === normalizedName) return true
      
      // 2. 포함 관계 체크
      if (existingNormalized.includes(normalizedName) || normalizedName.includes(existingNormalized)) return true
      
      // 3. 편집 거리 기반 유사도 (간단한 버전)
      const similarity = calculateSimilarity(normalizedName, existingNormalized)
      return similarity > 0.8 // 80% 이상 유사하면 의심
    }) || []

    return similarBusinesses
  }

  /**
   * 사업장 생성
   */
  static async createBusiness(businessData: Omit<BusinessInfo, 'id' | 'created_at' | 'updated_at'>): Promise<BusinessInfo> {
    console.log('💾 데이터베이스에 전송할 데이터:', JSON.stringify(businessData, null, 2))
    
    const { data, error } = await supabase
      .from('business_info')
      .insert([businessData])
      .select()
      .single()

    if (error) {
      console.error('💥 데이터베이스 오류 상세:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      throw new Error(`사업장 생성 실패: ${error.message}`)
    }
    return data
  }

  /**
   * 사업장 정보 업데이트
   */
  static async updateBusiness(id: string, businessData: Partial<BusinessInfo>): Promise<BusinessInfo> {
    const { data, error } = await supabase
      .from('business_info')
      .update({ ...businessData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`사업장 업데이트 실패: ${error.message}`)
    return data
  }

  /**
   * 사업장 논리 삭제
   */
  static async deleteBusiness(id: string): Promise<void> {
    const { error } = await supabase
      .from('business_info')
      .update({ 
        is_deleted: true, 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw new Error(`사업장 삭제 실패: ${error.message}`)
  }

  // === 대기필증 정보 관리 ===

  /**
   * 사업장의 모든 대기필증 조회
   */
  static async getAirPermitsByBusinessId(businessId: string): Promise<AirPermitInfo[]> {
    const { data, error } = await supabase
      .from('air_permit_info')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`대기필증 목록 조회 실패: ${error.message}`)
    return data || []
  }

  /**
   * 대기필증 정보 조회 (배출구 및 시설 정보 포함)
   */
  static async getAirPermitWithDetails(permitId: string): Promise<AirPermitWithOutlets | null> {
    // 기본 허가 정보 조회
    const { data: permit, error: permitError } = await supabase
      .from('air_permit_info')
      .select('*')
      .eq('id', permitId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single()

    if (permitError) {
      if (permitError.code === 'PGRST116') return null
      throw new Error(`대기필증 조회 실패: ${permitError.message}`)
    }

    // 배출구 및 시설 정보 조회
    const outlets = await this.getDischargeOutlets(permitId)
    
    return {
      ...permit,
      outlets
    }
  }

  /**
   * 대기필증 생성
   */
  static async createAirPermit(permitData: Omit<AirPermitInfo, 'id' | 'created_at' | 'updated_at'>): Promise<AirPermitInfo> {
    const { data, error } = await supabase
      .from('air_permit_info')
      .insert([permitData])
      .select()
      .single()

    if (error) throw new Error(`대기필증 생성 실패: ${error.message}`)
    return data
  }

  /**
   * 대기필증 정보 업데이트
   */
  static async updateAirPermit(id: string, permitData: Partial<AirPermitInfo>): Promise<AirPermitInfo> {
    console.log('💾 대기필증 업데이트 시작:', { id, permitData })
    
    const updatePayload = { ...permitData, updated_at: new Date().toISOString() }
    console.log('💾 Supabase에 전송할 데이터:', updatePayload)
    
    const { data, error } = await supabase
      .from('air_permit_info')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('💥 대기필증 업데이트 상세 오류:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      throw new Error(`대기필증 업데이트 실패: ${error.message}`)
    }
    
    console.log('✅ 대기필증 업데이트 성공:', data)
    return data
  }

  /**
   * 대기필증 논리 삭제
   */
  static async deleteAirPermit(id: string): Promise<void> {
    const { error } = await supabase
      .from('air_permit_info')
      .update({ 
        is_deleted: true, 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw new Error(`대기필증 삭제 실패: ${error.message}`)
  }

  // === 배출구 및 시설 관리 ===

  /**
   * 대기필증의 모든 배출구 조회 (시설 정보 포함)
   */
  static async getDischargeOutlets(airPermitId: string): Promise<OutletWithFacilities[]> {
    const { data: outlets, error: outletError } = await supabase
      .from('discharge_outlets')
      .select('*')
      .eq('air_permit_id', airPermitId)
      .order('outlet_number')

    if (outletError) throw new Error(`배출구 조회 실패: ${outletError.message}`)

    if (!outlets || outlets.length === 0) return []

    // 각 배출구의 시설 정보 조회
    const outletsWithFacilities = await Promise.all(
      outlets.map(async (outlet) => {
        const [dischargeFacilities, preventionFacilities] = await Promise.all([
          this.getDischargeFacilities(outlet.id),
          this.getPreventionFacilities(outlet.id)
        ])

        return {
          ...outlet,
          discharge_facilities: dischargeFacilities,
          prevention_facilities: preventionFacilities
        }
      })
    )

    return outletsWithFacilities
  }

  /**
   * 배출구 생성
   */
  static async createDischargeOutlet(outletData: Omit<DischargeOutlet, 'id' | 'created_at' | 'updated_at'>): Promise<DischargeOutlet> {
    const { data, error } = await supabase
      .from('discharge_outlets')
      .insert([outletData])
      .select()
      .single()

    if (error) throw new Error(`배출구 생성 실패: ${error.message}`)
    return data
  }

  /**
   * 배출시설 정보 조회
   */
  static async getDischargeFacilities(outletId: string): Promise<DischargeFacility[]> {
    const { data, error } = await supabase
      .from('discharge_facilities')
      .select('*')
      .eq('outlet_id', outletId)
      .order('created_at')

    if (error) throw new Error(`배출시설 조회 실패: ${error.message}`)
    return data || []
  }

  /**
   * 방지시설 정보 조회
   */
  static async getPreventionFacilities(outletId: string): Promise<PreventionFacility[]> {
    const { data, error } = await supabase
      .from('prevention_facilities')
      .select('*')
      .eq('outlet_id', outletId)
      .order('created_at')

    if (error) throw new Error(`방지시설 조회 실패: ${error.message}`)
    return data || []
  }

  /**
   * 배출시설 생성
   */
  static async createDischargeFacility(facilityData: Omit<DischargeFacility, 'id' | 'created_at' | 'updated_at'>): Promise<DischargeFacility> {
    const { data, error } = await supabase
      .from('discharge_facilities')
      .insert([facilityData])
      .select()
      .single()

    if (error) throw new Error(`배출시설 생성 실패: ${error.message}`)
    return data
  }

  /**
   * 방지시설 생성
   */
  static async createPreventionFacility(facilityData: Omit<PreventionFacility, 'id' | 'created_at' | 'updated_at'>): Promise<PreventionFacility> {
    const { data, error } = await supabase
      .from('prevention_facilities')
      .insert([facilityData])
      .select()
      .single()

    if (error) throw new Error(`방지시설 생성 실패: ${error.message}`)
    return data
  }

  // === 데이터 이력 및 복구 ===

  /**
   * 데이터 변경 이력 조회
   */
  static async getDataHistory(options?: {
    tableNames?: string[]
    recordId?: string
    limit?: number
  }): Promise<DataHistory[]> {
    let query = supabase
      .from('data_history')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.tableNames?.length) {
      query = query.in('table_name', options.tableNames)
    }

    if (options?.recordId) {
      query = query.eq('record_id', options.recordId)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query
    if (error) throw new Error(`이력 조회 실패: ${error.message}`)
    return data || []
  }

  /**
   * 이력에서 데이터 복구
   */
  static async restoreFromHistory(historyId: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('restore_data_from_history', { p_history_id: historyId })

    if (error) throw new Error(`데이터 복구 실패: ${error.message}`)
    return data === true
  }

  // === 통합 조회 ===

  /**
   * 사업장과 모든 관련 정보 조회
   */
  static async getBusinessWithAllDetails(businessId: string): Promise<BusinessWithPermits | null> {
    const business = await this.getBusinessById(businessId)
    if (!business) return null

    const airPermits = await this.getAirPermitsByBusinessId(businessId)
    
    const airPermitsWithOutlets = await Promise.all(
      airPermits.map(async (permit) => {
        const outlets = await this.getDischargeOutlets(permit.id)
        return {
          ...permit,
          outlets
        }
      })
    )

    return {
      ...business,
      air_permits: airPermitsWithOutlets
    }
  }

  // === 유틸리티 ===

  /**
   * 사업장 요약 정보 조회 (뷰 사용)
   */
  static async getBusinessSummary(): Promise<any[]> {
    const { data, error } = await supabase
      .from('business_summary')
      .select('*')
      .order('business_name')

    if (error) throw new Error(`사업장 요약 조회 실패: ${error.message}`)
    return data || []
  }

  /**
   * 데이터베이스 연결 테스트
   */
  static async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('business_info')
        .select('count')
        .limit(1)

      return !error
    } catch (e) {
      return false
    }
  }
}

// 에러 핸들링 헬퍼
export class DatabaseError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message)
    this.name = 'DatabaseError'
  }
}

// 유틸리티 함수들
export const databaseUtils = {
  /**
   * JSON 데이터 안전하게 파싱
   */
  safeParseJSON: (jsonString: string | null | undefined): any => {
    if (!jsonString) return {}
    try {
      return JSON.parse(jsonString)
    } catch {
      return {}
    }
  },

  /**
   * 날짜 포맷팅
   */
  formatDate: (dateString: string | null): string => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('ko-KR')
  },

  /**
   * 사업자등록번호 포맷팅
   */
  formatBusinessNumber: (number: string | null): string => {
    if (!number) return ''
    const clean = number.replace(/\D/g, '')
    if (clean.length === 10) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5)}`
    }
    return number
  }
}