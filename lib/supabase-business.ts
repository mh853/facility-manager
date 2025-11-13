// lib/supabase-business.ts - 비즈니스 데이터 Supabase 서비스 (기존 시스템 활용)
import { supabase, supabaseAdmin, getSupabaseAdminClient } from './supabase';
import type {
  BusinessInfo,
  AirPermitInfo,
  DischargeOutlet,
  DischargeFacility,
  PreventionFacility,
  BusinessMemo,
  CreateBusinessMemoInput,
  UpdateBusinessMemoInput
} from '@/types/database';

// =====================================================
// 비즈니스 정보 관리
// =====================================================

export async function getAllBusinesses(options?: {
  limit?: number;
  offset?: number;
  search?: string;
  isActive?: boolean;
}) {
  const adminClient = getSupabaseAdminClient();

  let query = adminClient
    .from('business_info')
    .select(`
      id,
      business_name,
      business_registration_number,
      local_government,
      address,
      manager_name,
      manager_contact,
      is_active,
      created_at,
      updated_at
    `)
    .eq('is_deleted', false);

  if (options?.isActive !== undefined) {
    query = query.eq('is_active', options.isActive);
  }

  if (options?.search) {
    query = query.or(`business_name.ilike.%${options.search}%,address.ilike.%${options.search}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  query = query.order('business_name');

  const { data, error } = await query;

  if (error) {
    console.error('❌ [SUPABASE] 사업장 목록 조회 실패:', error);
    throw new Error(`사업장 목록 조회 실패: ${error.message}`);
  }

  return data as BusinessInfo[];
}

export async function getBusinessById(id: string) {
  const adminClient = getSupabaseAdminClient();
  const { data, error } = await adminClient
    .from('business_info')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (error) {
    console.error('❌ [SUPABASE] 사업장 상세 조회 실패:', error);
    throw new Error(`사업장 조회 실패: ${error.message}`);
  }

  return data as BusinessInfo;
}

export async function getBusinessByName(businessName: string) {
  const { data, error } = await supabaseAdmin
    .from('business_info')
    .select('*')
    .eq('business_name', businessName)
    .eq('is_deleted', false)
    .single();

  if (error) {
    console.error('❌ [SUPABASE] 사업장명 조회 실패:', error);
    return null;
  }

  return data as BusinessInfo;
}

export async function createBusiness(businessData: Omit<BusinessInfo, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabaseAdmin
    .from('business_info')
    .insert([businessData])
    .select()
    .single();

  if (error) {
    console.error('❌ [SUPABASE] 사업장 생성 실패:', error);
    throw new Error(`사업장 생성 실패: ${error.message}`);
  }

  return data as BusinessInfo;
}

export async function updateBusiness(id: string, updates: Partial<BusinessInfo>) {
  const { data, error } = await supabaseAdmin
    .from('business_info')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('❌ [SUPABASE] 사업장 업데이트 실패:', error);
    throw new Error(`사업장 업데이트 실패: ${error.message}`);
  }

  return data as BusinessInfo;
}

export async function deleteBusiness(id: string, hardDelete: boolean = false) {
  if (hardDelete) {
    const { error } = await supabaseAdmin
      .from('business_info')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [SUPABASE] 사업장 영구 삭제 실패:', error);
      throw new Error(`사업장 삭제 실패: ${error.message}`);
    }
  } else {
    const { error } = await supabaseAdmin
      .from('business_info')
      .update({ is_deleted: true, is_active: false })
      .eq('id', id);

    if (error) {
      console.error('❌ [SUPABASE] 사업장 소프트 삭제 실패:', error);
      throw new Error(`사업장 삭제 실패: ${error.message}`);
    }
  }

  return true;
}

// =====================================================
// 대기배출허가 정보 관리
// =====================================================

export async function getAirPermitsByBusinessId(businessId: string) {
  const { data, error } = await supabaseAdmin
    .from('air_permit_info')
    .select(`
      *,
      business:business_info!inner(
        business_name,
        local_government
      )
    `)
    .eq('business_id', businessId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ [SUPABASE] 대기배출허가 조회 실패:', error);
    throw new Error(`대기배출허가 조회 실패: ${error.message}`);
  }

  return data as AirPermitInfo[];
}

export async function createAirPermit(permitData: Omit<AirPermitInfo, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabaseAdmin
    .from('air_permit_info')
    .insert([permitData])
    .select()
    .single();

  if (error) {
    console.error('❌ [SUPABASE] 대기배출허가 생성 실패:', error);
    throw new Error(`대기배출허가 생성 실패: ${error.message}`);
  }

  return data as AirPermitInfo;
}

// =====================================================
// 배출구 및 시설 관리
// =====================================================

export async function getOutletsByPermitId(permitId: string) {
  const { data, error } = await supabaseAdmin
    .from('discharge_outlets')
    .select(`
      *,
      discharge_facilities(*),
      prevention_facilities(*)
    `)
    .eq('air_permit_id', permitId)
    .order('outlet_number');

  if (error) {
    console.error('❌ [SUPABASE] 배출구 조회 실패:', error);
    throw new Error(`배출구 조회 실패: ${error.message}`);
  }

  return data;
}

// =====================================================
// 메모 관리
// =====================================================

export async function getBusinessMemos(businessId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_memos')
    .select(`
      *,
      created_by_user:users!business_memos_created_by_fkey(
        name,
        email
      )
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ [SUPABASE] 메모 조회 실패:', error);
    throw new Error(`메모 조회 실패: ${error.message}`);
  }

  return data as BusinessMemo[];
}

export async function createBusinessMemo(memoData: CreateBusinessMemoInput) {
  const { data, error } = await supabaseAdmin
    .from('business_memos')
    .insert([memoData])
    .select(`
      *,
      created_by_user:users!business_memos_created_by_fkey(
        name,
        email
      )
    `)
    .single();

  if (error) {
    console.error('❌ [SUPABASE] 메모 생성 실패:', error);
    throw new Error(`메모 생성 실패: ${error.message}`);
  }

  // ✅ 메모 생성 시 사업장 updated_at 업데이트 (리스트 상단 표시)
  const { error: updateError } = await supabaseAdmin
    .from('business_info')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', memoData.business_id);

  if (updateError) {
    console.warn('⚠️ [SUPABASE] 사업장 updated_at 업데이트 실패:', updateError);
    // 메모 생성은 성공했으므로 에러 throw 하지 않음
  }

  return data as BusinessMemo;
}

export async function updateBusinessMemo(id: string, updates: UpdateBusinessMemoInput) {
  const { data, error } = await supabaseAdmin
    .from('business_memos')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      created_by_user:users!business_memos_created_by_fkey(
        name,
        email
      )
    `)
    .single();

  if (error) {
    console.error('❌ [SUPABASE] 메모 업데이트 실패:', error);
    throw new Error(`메모 업데이트 실패: ${error.message}`);
  }

  // ✅ 메모 수정 시 사업장 updated_at 업데이트 (리스트 상단 표시)
  if (data?.business_id) {
    const { error: updateError } = await supabaseAdmin
      .from('business_info')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', data.business_id);

    if (updateError) {
      console.warn('⚠️ [SUPABASE] 사업장 updated_at 업데이트 실패:', updateError);
      // 메모 수정은 성공했으므로 에러 throw 하지 않음
    }
  }

  return data as BusinessMemo;
}

export async function deleteBusinessMemo(id: string) {
  // ✅ 삭제 전 business_id 조회 (사업장 updated_at 업데이트용)
  const { data: memo } = await supabaseAdmin
    .from('business_memos')
    .select('business_id')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('business_memos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('❌ [SUPABASE] 메모 삭제 실패:', error);
    throw new Error(`메모 삭제 실패: ${error.message}`);
  }

  // ✅ 메모 삭제 시 사업장 updated_at 업데이트 (리스트 상단 표시)
  if (memo?.business_id) {
    const { error: updateError } = await supabaseAdmin
      .from('business_info')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', memo.business_id);

    if (updateError) {
      console.warn('⚠️ [SUPABASE] 사업장 updated_at 업데이트 실패:', updateError);
      // 메모 삭제는 성공했으므로 에러 throw 하지 않음
    }
  }

  return true;
}

// =====================================================
// 검색 및 통계
// =====================================================

export async function searchBusinesses(query: string, limit: number = 20) {
  const { data, error } = await supabaseAdmin
    .from('business_info')
    .select('id, business_name, local_government, address, manager_name')
    .or(`business_name.ilike.%${query}%,address.ilike.%${query}%,manager_name.ilike.%${query}%`)
    .eq('is_deleted', false)
    .eq('is_active', true)
    .limit(limit)
    .order('business_name');

  if (error) {
    console.error('❌ [SUPABASE] 사업장 검색 실패:', error);
    throw new Error(`사업장 검색 실패: ${error.message}`);
  }

  return data;
}

export async function getBusinessStats() {
  const { data, error } = await supabaseAdmin
    .from('business_stats')
    .select('*')
    .single();

  if (error) {
    console.error('❌ [SUPABASE] 통계 조회 실패:', error);
    throw new Error(`통계 조회 실패: ${error.message}`);
  }

  return data;
}

// =====================================================
// 유틸리티 함수
// =====================================================

export async function getBusinessWithPermits(businessName: string) {
  const { data, error } = await supabaseAdmin
    .rpc('get_business_with_permits', {
      business_name_param: businessName
    });

  if (error) {
    console.error('❌ [SUPABASE] 사업장+허가 조회 실패:', error);
    throw new Error(`사업장 정보 조회 실패: ${error.message}`);
  }

  return data;
}

// 레거시 호환성을 위한 간단한 사업장명 목록 조회
export async function getBusinessNamesList() {
  const { data, error } = await supabaseAdmin
    .from('business_info')
    .select('business_name')
    .eq('is_deleted', false)
    .eq('is_active', true)
    .order('business_name');

  if (error) {
    console.error('❌ [SUPABASE] 사업장명 목록 조회 실패:', error);
    throw new Error(`사업장명 목록 조회 실패: ${error.message}`);
  }

  return data.map(item => item.business_name);
}