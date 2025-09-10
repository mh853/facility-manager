// app/api/file-count/route.ts - 파일 개수 조회 API (사진 순서 계산용)
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessName = searchParams.get('businessName');
    const facilityInfo = searchParams.get('facilityInfo');
    const fileType = searchParams.get('fileType'); // 'discharge', 'prevention', 'basic'
    const category = searchParams.get('category'); // for basic photos

    if (!businessName) {
      return NextResponse.json({
        success: false,
        message: '사업장명이 필요합니다.'
      }, { status: 400 });
    }

    console.log(`🔢 [FILE-COUNT] 파일 개수 조회: ${businessName}, ${fileType}, ${facilityInfo || category}`);

    // 사업장 조회
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('name', businessName)
      .single();

    if (businessError || !business) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: '사업장을 찾을 수 없습니다.'
      });
    }

    let query = supabaseAdmin
      .from('uploaded_files')
      .select('filename', { count: 'exact' })
      .eq('business_id', business.id);

    // 파일 타입별 필터링
    if (fileType === 'discharge' || fileType === 'prevention') {
      // 시설별 사진 개수 계산
      if (facilityInfo) {
        // facilityInfo가 "discharge_facilityId_number" 또는 "prevention_facilityId_number" 형태인 경우
        if (facilityInfo.includes('_')) {
          const parts = facilityInfo.split('_');
          if (parts.length >= 2 && parts[0] === fileType) {
            // 정확한 facilityInfo로 DB에서 필터링
            query = query.eq('facility_info', facilityInfo);
          } else {
            // 호환성을 위해 facilityInfo가 포함된 모든 레코드 찾기
            query = query.ilike('facility_info', `%${facilityInfo}%`);
          }
        } else {
          // 기존 형태의 facilityInfo (하위 호환성)
          query = query.ilike('facility_info', `%${facilityInfo}%`);
        }
        
        console.log(`🔍 [FILE-COUNT] ${fileType} 시설별 검색: ${facilityInfo}`);
      }
      
    } else if (fileType === 'basic' && category) {
      // 기본사진 카테고리별 개수 계산
      const categoryMap: { [key: string]: string } = {
        'gateway': '게이트웨이',
        'fan': '송풍기', 
        'electrical': '배전함',
        'others': '기타시설'
      };
      
      const categoryName = categoryMap[category] || category;
      query = query.like('filename', `기본_${categoryName}%`);
      
      console.log(`🔍 [FILE-COUNT-BASIC] 기본사진 패턴: 기본_${categoryName}%`);
    }

    const { count, error: countError } = await query;

    if (countError) {
      console.error('파일 개수 조회 오류:', countError);
      throw countError;
    }

    const fileCount = count || 0;
    const nextPhotoIndex = fileCount + 1;

    console.log(`✅ [FILE-COUNT] 결과: ${fileCount}개 기존 파일, 다음 순서: ${nextPhotoIndex}`);

    return NextResponse.json({
      success: true,
      count: fileCount,
      nextIndex: nextPhotoIndex
    });

  } catch (error) {
    console.error('파일 개수 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: '파일 개수 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}