// app/api/business-list-supabase/route.ts - Supabase 기반 사업장 목록 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const search = searchParams.get('search') || '';

    console.log(`🏢 [BUSINESS-LIST-SUPABASE] 사업장 목록 조회: 검색="${search}", 제한=${limit}`);

    let query = supabaseAdmin
      .from('businesses')
      .select(`
        id,
        name,
        status,
        created_at,
        updated_at,
        uploaded_files (
          id,
          upload_status
        )
      `)
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(limit);

    // 검색어가 있는 경우 필터링
    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data: businesses, error } = await query;

    if (error) {
      throw error;
    }

    // 사업장별 파일 통계 계산
    const businessList = businesses?.map((business: any) => {
      const files = business.uploaded_files || [];
      const fileStats = {
        total: files.length,
        uploaded: files.filter((f: any) => f.upload_status === 'uploaded').length,
        syncing: files.filter((f: any) => f.upload_status === 'syncing').length,
        synced: files.filter((f: any) => f.upload_status === 'synced').length,
        failed: files.filter((f: any) => f.upload_status === 'failed').length
      };

      return {
        id: business.id,
        name: business.name,
        status: business.status,
        createdAt: business.created_at,
        updatedAt: business.updated_at,
        fileStats,
        url: `/business/${encodeURIComponent(business.name)}`
      };
    }) || [];

    console.log(`✅ [BUSINESS-LIST-SUPABASE] 조회 완료: ${businessList.length}개 사업장`);

    return NextResponse.json({
      success: true,
      data: businessList,
      totalCount: businessList.length,
      searchTerm: search
    });

  } catch (error) {
    console.error('❌ [BUSINESS-LIST-SUPABASE] 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: '사업장 목록 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'),
      data: []
    }, { status: 500 });
  }
}

// 새 사업장 생성 (POST)
export async function POST(request: NextRequest) {
  try {
    const { name, facilityInfo } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({
        success: false,
        message: '사업장명이 필요합니다.'
      }, { status: 400 });
    }

    console.log(`🏭 [BUSINESS-CREATE-SUPABASE] 새 사업장 생성: ${name}`);

    const { data: newBusiness, error } = await supabaseAdmin
      .from('businesses')
      .insert({
        name: name.trim(),
        status: 'active',
        facility_info: facilityInfo || {}
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // 중복 키 에러
        return NextResponse.json({
          success: false,
          message: '이미 존재하는 사업장명입니다.'
        }, { status: 409 });
      }
      throw error;
    }

    console.log(`✅ [BUSINESS-CREATE-SUPABASE] 생성 완료: ${newBusiness.id}`);

    return NextResponse.json({
      success: true,
      message: '사업장이 생성되었습니다.',
      data: {
        id: newBusiness.id,
        name: newBusiness.name,
        status: newBusiness.status,
        createdAt: newBusiness.created_at
      }
    });

  } catch (error) {
    console.error('❌ [BUSINESS-CREATE-SUPABASE] 생성 실패:', error);
    return NextResponse.json({
      success: false,
      message: '사업장 생성 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}