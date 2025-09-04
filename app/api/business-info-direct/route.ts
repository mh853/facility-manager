// app/api/business-info-direct/route.ts - 직접 business_info 테이블 CRUD API
import { NextRequest, NextResponse } from 'next/server';
import BusinessBridge from '@/lib/business-bridge';

// UTF-8 정규화 함수
function normalizeUTF8(str: string): string {
  if (!str) return str;
  return str.normalize('NFC').trim();
}

// VARCHAR(20) 필드용 데이터 정리 함수
function cleanVarchar20(str: string): string {
  if (!str) return '';
  return str
    .replace(/\n/g, ' ')  // 줄바꿈을 공백으로 변경
    .replace(/\s+/g, ' ') // 연속된 공백을 하나로
    .trim()
    .substring(0, 20);    // 20자로 제한
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '1000');
    const id = searchParams.get('id');

    console.log(`📊 [BUSINESS-INFO-DIRECT] 직접 조회 시작 - 검색: "${search}", 제한: ${limit}, ID: ${id || 'N/A'}`);

    const { supabaseAdmin } = await import('@/lib/supabase');
    
    let query = supabaseAdmin
      .from('business_info')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false);

    // 특정 ID 조회
    if (id) {
      query = query.eq('id', id);
    } else {
      // 검색 조건 추가
      if (search.trim()) {
        query = query.or(`business_name.ilike.%${search}%,address.ilike.%${search}%,manager_name.ilike.%${search}%`);
      }
      query = query.order('business_name').limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`business_info 조회 실패: ${error.message}`);
    }
    
    console.log(`✅ [BUSINESS-INFO-DIRECT] 조회 완료 - ${data?.length || 0}개 사업장`);
    
    // 파일 통계 추가 (선택적 - includeFileStats 파라미터로 제어)
    const includeFileStats = searchParams.get('includeFileStats') === 'true';
    let enhancedData = data || [];
    
    if (includeFileStats && data && data.length > 0) {
      console.log(`📊 [BUSINESS-INFO-DIRECT] 파일 통계 추가 중...`);
      
      try {
        const fileStatsMap = await BusinessBridge.batchCorrelateBusinesses(data);
        
        enhancedData = data.map((business: any) => ({
          ...business,
          fileStats: fileStatsMap.get(business.id) || null,
          hasFileRecords: fileStatsMap.has(business.id)
        }));
        
        console.log(`✅ [BUSINESS-INFO-DIRECT] 파일 통계 추가 완료 - ${fileStatsMap.size}개 매칭`);
      } catch (error) {
        console.warn(`⚠️ [BUSINESS-INFO-DIRECT] 파일 통계 추가 실패, 기본 데이터로 진행:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      data: enhancedData,
      count: enhancedData.length,
      enhanced: includeFileStats,
      timestamp: new Date().toLocaleString('ko-KR')
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      }
    });

  } catch (error) {
    console.error('❌ [BUSINESS-INFO-DIRECT] GET 실패:', error);
    return NextResponse.json({
      success: false,
      message: 'business_info 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'),
      data: [],
      count: 0
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      }
    });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updateData } = body;

    if (!id) {
      throw new Error('ID가 필요합니다');
    }

    console.log(`🔄 [BUSINESS-INFO-DIRECT] 업데이트 시작 - ID: ${id}`, updateData);

    const { supabaseAdmin } = await import('@/lib/supabase');

    // 선택적 필드 업데이트 객체 생성
    const updateObject: any = {
      updated_at: new Date().toISOString()
    };

    // 필드별 개별 업데이트 (null 값 제외)
    if (updateData.business_name && updateData.business_name.trim()) {
      updateObject.business_name = normalizeUTF8(updateData.business_name);
    }
    if (updateData.address !== undefined) {
      updateObject.address = normalizeUTF8(updateData.address || '');
    }
    if (updateData.manager_name !== undefined) {
      updateObject.manager_name = normalizeUTF8(updateData.manager_name || '');
    }
    if (updateData.manager_position !== undefined) {
      updateObject.manager_position = normalizeUTF8(updateData.manager_position || '');
    }
    if (updateData.manager_contact !== undefined) {
      updateObject.manager_contact = cleanVarchar20(updateData.manager_contact || '');
    }
    if (updateData.representative_name !== undefined) {
      updateObject.representative_name = normalizeUTF8(updateData.representative_name || '');
    }
    if (updateData.business_registration_number !== undefined) {
      updateObject.business_registration_number = cleanVarchar20(updateData.business_registration_number || '');
    }
    if (updateData.business_type !== undefined) {
      updateObject.business_type = normalizeUTF8(updateData.business_type || '');
    }
    if (updateData.business_contact !== undefined) {
      updateObject.business_contact = cleanVarchar20(updateData.business_contact || '');
    }

    // additional_info 업데이트 (contacts 배열)
    if (updateData.contacts && Array.isArray(updateData.contacts)) {
      updateObject.additional_info = {
        contacts: updateData.contacts.map((contact: any) => ({
          name: normalizeUTF8(contact.name || ''),
          position: normalizeUTF8(contact.position || ''),
          phone: normalizeUTF8(contact.phone || ''),
          role: normalizeUTF8(contact.role || '')
        }))
      };
    }

    console.log(`📝 [BUSINESS-INFO-DIRECT] 업데이트 객체:`, updateObject);

    // 데이터베이스 업데이트
    const { data, error } = await supabaseAdmin
      .from('business_info')
      .update(updateObject)
      .eq('id', id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .select('*');

    if (error) {
      throw new Error(`업데이트 실패: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('업데이트된 데이터가 없습니다. ID를 확인해주세요.');
    }

    console.log(`✅ [BUSINESS-INFO-DIRECT] 업데이트 성공:`, data[0]);

    return NextResponse.json({
      success: true,
      message: '사업장 정보가 성공적으로 수정되었습니다.',
      data: data[0]
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      }
    });

  } catch (error) {
    console.error('❌ [BUSINESS-INFO-DIRECT] PUT 실패:', error);
    return NextResponse.json({
      success: false,
      message: 'business_info 업데이트 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supabaseAdmin } = await import('@/lib/supabase');

    // 배치 업로드 처리
    if (body.isBatchUpload && Array.isArray(body.businesses)) {
      console.log(`🔄 [BUSINESS-INFO-DIRECT] 배치 업로드 시작: ${body.businesses.length}개 사업장`);
      
      const results = {
        total: body.businesses.length,
        created: 0,
        updated: 0,
        errors: 0,
        errorDetails: [] as Array<{business: string, error: string}>
      };

      for (const business of body.businesses) {
        try {
          if (!business.business_name || !business.business_name.trim()) {
            results.errors++;
            results.errorDetails.push({
              business: business.business_name || 'Unknown',
              error: '사업장명은 필수입니다'
            });
            continue;
          }

          const insertObject = {
            business_name: normalizeUTF8(business.business_name),
            address: normalizeUTF8(business.address || ''),
            manager_name: normalizeUTF8(business.manager_name || ''),
            manager_position: normalizeUTF8(business.manager_position || ''),
            manager_contact: cleanVarchar20(business.manager_contact || ''),
            representative_name: normalizeUTF8(business.representative_name || ''),
            business_registration_number: cleanVarchar20(business.business_registration_number || ''),
            business_type: normalizeUTF8(business.business_type || ''),
            business_contact: cleanVarchar20(business.business_contact || ''),
            fax_number: cleanVarchar20(business.fax_number || ''),
            ph_meter: parseInt(business.ph_meter || '0') || 0,
            differential_pressure_meter: parseInt(business.differential_pressure_meter || '0') || 0,
            temperature_meter: parseInt(business.temperature_meter || '0') || 0,
            discharge_current_meter: parseInt(business.discharge_current_meter || '0') || 0,
            fan_current_meter: parseInt(business.fan_current_meter || '0') || 0,
            pump_current_meter: parseInt(business.pump_current_meter || '0') || 0,
            gateway: parseInt(business.gateway || '0') || 0,
            vpn_wired: parseInt(business.vpn_wired || '0') || 0,
            vpn_wireless: parseInt(business.vpn_wireless || '0') || 0,
            multiple_stack: parseInt(business.multiple_stack || '0') || 0,
            negotiation: normalizeUTF8(business.negotiation || ''),
            additional_info: { contacts: [] },
            is_active: true,
            is_deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // 기존 사업장 확인
          const { data: existingBusiness } = await supabaseAdmin
            .from('business_info')
            .select('id')
            .eq('business_name', normalizeUTF8(business.business_name))
            .eq('is_active', true)
            .eq('is_deleted', false)
            .single();

          const isExisting = !!existingBusiness;

          const { error } = await supabaseAdmin
            .from('business_info')
            .upsert(insertObject, { 
              onConflict: 'business_name',
              ignoreDuplicates: false 
            });

          if (error) {
            results.errors++;
            results.errorDetails.push({
              business: business.business_name,
              error: `${isExisting ? '업데이트' : '생성'} 실패: ${error.message}`
            });
          } else {
            if (isExisting) {
              results.updated++;
            } else {
              results.created++;
            }
          }

        } catch (error) {
          results.errors++;
          results.errorDetails.push({
            business: business.business_name || 'Unknown',
            error: error instanceof Error ? error.message : '알 수 없는 오류'
          });
        }
      }

      console.log(`✅ [BUSINESS-INFO-DIRECT] 배치 업로드 완료:`, results);

      return NextResponse.json({
        success: true,
        message: `배치 업로드 완료: 생성 ${results.created}개, 오류 ${results.errors}개`,
        data: { results }
      }, {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // 단일 사업장 생성 (기존 로직)
    console.log(`🆕 [BUSINESS-INFO-DIRECT] 새 사업장 생성 시작:`, body);

    // 필수 필드 검증
    if (!body.business_name || !body.business_name.trim()) {
      throw new Error('사업장명은 필수입니다');
    }

    const insertObject = {
      business_name: normalizeUTF8(body.business_name),
      address: normalizeUTF8(body.address || ''),
      manager_name: normalizeUTF8(body.manager_name || ''),
      manager_position: normalizeUTF8(body.manager_position || ''),
      manager_contact: cleanVarchar20(body.manager_contact || ''),
      representative_name: normalizeUTF8(body.representative_name || ''),
      business_registration_number: cleanVarchar20(body.business_registration_number || ''),
      business_type: normalizeUTF8(body.business_type || ''),
      business_contact: cleanVarchar20(body.business_contact || ''),
      fax_number: cleanVarchar20(body.fax_number || ''),
      negotiation: normalizeUTF8(body.negotiation || ''),
      additional_info: body.contacts ? {
        contacts: body.contacts.map((contact: any) => ({
          name: normalizeUTF8(contact.name || ''),
          position: normalizeUTF8(contact.position || ''),
          phone: normalizeUTF8(contact.phone || ''),
          role: normalizeUTF8(contact.role || '')
        }))
      } : { contacts: [] },
      is_active: true,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('business_info')
      .insert(insertObject)
      .select('*');

    if (error) {
      throw new Error(`생성 실패: ${error.message}`);
    }

    console.log(`✅ [BUSINESS-INFO-DIRECT] 생성 성공:`, data[0]);

    return NextResponse.json({
      success: true,
      message: '새 사업장이 성공적으로 생성되었습니다.',
      data: data[0]
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      }
    });

  } catch (error) {
    console.error('❌ [BUSINESS-INFO-DIRECT] POST 실패:', error);
    return NextResponse.json({
      success: false,
      message: 'business_info 생성 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      }
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new Error('삭제할 사업장 ID가 필요합니다');
    }

    console.log(`🗑️ [BUSINESS-INFO-DIRECT] 삭제 시작 - ID: ${id}`);

    const { supabaseAdmin } = await import('@/lib/supabase');

    // 소프트 삭제 (is_deleted = true)
    const { data, error } = await supabaseAdmin
      .from('business_info')
      .update({
        is_deleted: true,
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*');

    if (error) {
      throw new Error(`삭제 실패: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('삭제할 사업장을 찾을 수 없습니다');
    }

    console.log(`✅ [BUSINESS-INFO-DIRECT] 삭제 성공:`, data[0]);

    return NextResponse.json({
      success: true,
      message: '사업장이 성공적으로 삭제되었습니다.',
      data: data[0]
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      }
    });

  } catch (error) {
    console.error('❌ [BUSINESS-INFO-DIRECT] DELETE 실패:', error);
    return NextResponse.json({
      success: false,
      message: 'business_info 삭제 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      }
    });
  }
}