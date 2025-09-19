// app/api/business-unified/route.ts - 통합된 사업장 정보 API
import { NextRequest, NextResponse } from 'next/server';

interface Contact {
  name: string;
  position: string;
  phone: string;
  role: string;
}

interface BusinessInfo {
  id: string;
  사업장명: string;
  주소: string;
  담당자명: string;
  담당자연락처: string;
  담당자직급: string;
  contacts: Contact[];
  대표자: string;
  사업자등록번호: string;
  업종: string;
  사업장연락처: string;
  상태: string;
  배출시설수: number;
  방지시설수: number;
  총측정기기수: number;
  PH센서?: number;
  차압계?: number;
  온도계?: number;
  배출전류계?: number;
  송풍전류계?: number;
  펌프전류계?: number;
  게이트웨이?: number;
  등록일: string;
  수정일: string;
}

interface BusinessFiles {
  id: string;
  name: string;
  status: string;
  fileStats: {
    total: number;
    uploaded: number;
    syncing: number;
    synced: number;
    failed: number;
  };
  url: string;
  createdAt: string;
  updatedAt: string;
}

interface UnifiedBusinessInfo extends BusinessInfo {
  files?: BusinessFiles | null;
  hasFiles: boolean;
  fileCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '1500');

    console.log(`🔗 [BUSINESS-UNIFIED] 통합 사업장 정보 조회 시작 - 검색: "${search}", 제한: ${limit}`);

    // 현재 서버의 기본 URL 결정
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://${request.headers.get('host')}`
      : `http://localhost:${process.env.PORT || 3000}`;

    // 1. business_info 데이터 조회 (직접 Supabase에서 조회)
    console.log(`📊 [BUSINESS-UNIFIED] business_info 데이터 조회 중...`);
    
    const { supabaseAdmin } = await import('@/lib/supabase');
    
    let query = supabaseAdmin
      .from('business_info')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('business_name');
    
    // 검색 조건 추가
    if (search.trim()) {
      query = query.or(`business_name.ilike.%${search}%,address.ilike.%${search}%,manager_name.ilike.%${search}%`);
    }
    
    const { data: businessInfoData, error: businessInfoError } = await query.limit(limit);
    
    if (businessInfoError) {
      throw new Error(`business_info 조회 실패: ${businessInfoError.message}`);
    }
    
    if (!businessInfoData || !Array.isArray(businessInfoData)) {
      throw new Error('business_info 데이터를 가져올 수 없습니다');
    }

    // 2. businesses 데이터 조회 (파일 정보)
    console.log(`📁 [BUSINESS-UNIFIED] businesses 파일 정보 조회 중...`);
    const businessesResponse = await fetch(`${baseUrl}/api/business-list-supabase`);
    
    if (!businessesResponse.ok) {
      throw new Error(`businesses 조회 실패: ${businessesResponse.status}`);
    }
    
    const businessesData = await businessesResponse.json();
    
    if (!businessesData.success || !businessesData.data) {
      console.warn('⚠️ [BUSINESS-UNIFIED] businesses 데이터 없음, 파일 정보 없이 진행');
    }

    // business_info 데이터를 한국어 필드로 변환
    const businessInfoList: BusinessInfo[] = businessInfoData.map((business: any) => ({
      id: business.id,
      사업장명: business.business_name,
      주소: business.address || '',
      담당자명: business.manager_name || '',
      담당자연락처: business.manager_contact || '',
      담당자직급: business.manager_position || '',
      contacts: business.additional_info?.contacts || [],
      대표자: business.representative_name || '',
      사업자등록번호: business.business_registration_number || '',
      업종: business.business_type || '',
      사업장연락처: business.business_contact || '',
      상태: business.is_active ? '활성' : '비활성',
      배출시설수: business.facility_summary?.totals?.total_discharge || 0,
      방지시설수: business.facility_summary?.totals?.total_prevention || 0,
      총측정기기수: (business.ph_meter || 0) + (business.differential_pressure_meter || 0) + (business.temperature_meter || 0) + (business.discharge_current_meter || 0) + (business.fan_current_meter || 0) + (business.pump_current_meter || 0) + (business.gateway || 0),
      PH센서: business.ph_meter || 0,
      차압계: business.differential_pressure_meter || 0,
      온도계: business.temperature_meter || 0,
      배출전류계: business.discharge_current_meter || 0,
      송풍전류계: business.fan_current_meter || 0,
      펌프전류계: business.pump_current_meter || 0,
      게이트웨이: business.gateway || 0,
      manufacturer: business.manufacturer || '',
      지자체: business.local_government || '',
      팩스번호: business.fax_number || '',
      이메일: business.email || '',
      사업장관리코드: business.business_management_code || '',
      그린링크ID: business.greenlink_id || '',
      그린링크PW: business.greenlink_pw || '',
      영업점: business.sales_office || '',
      등록일: business.created_at,
      수정일: business.updated_at
    }));
    
    const businessFilesList = (businessesData.success ? businessesData.data : []) as BusinessFiles[];

    console.log(`🔍 [BUSINESS-UNIFIED] 데이터 조회 완료 - business_info: ${businessInfoList.length}개, businesses: ${businessFilesList.length}개`);

    // 3. 사업장명 기반으로 데이터 병합
    const unifiedBusinesses: UnifiedBusinessInfo[] = businessInfoList.map(business => {
      // 사업장명으로 매칭 (정확 일치)
      const matchingFiles = businessFilesList.find(filesBusiness => 
        filesBusiness.name === business.사업장명
      );

      const unifiedBusiness: UnifiedBusinessInfo = {
        ...business,
        files: matchingFiles || null,
        hasFiles: !!matchingFiles,
        fileCount: matchingFiles ? matchingFiles.fileStats.total : 0
      };

      return unifiedBusiness;
    });

    // 4. 파일이 있는 사업장 우선 정렬 (선택적)
    unifiedBusinesses.sort((a, b) => {
      // 파일이 있는 사업장 우선
      if (a.hasFiles && !b.hasFiles) return -1;
      if (!a.hasFiles && b.hasFiles) return 1;
      // 같은 조건이면 파일 수 많은 순
      return b.fileCount - a.fileCount;
    });

    console.log(`✅ [BUSINESS-UNIFIED] 통합 완료 - 총 ${unifiedBusinesses.length}개 사업장, 파일보유: ${unifiedBusinesses.filter(b => b.hasFiles).length}개`);

    return NextResponse.json({
      success: true,
      data: {
        businesses: unifiedBusinesses,
        count: unifiedBusinesses.length,
        metadata: {
          source: 'business-unified',
          totalBusinessInfo: businessInfoList.length,
          totalWithFiles: businessFilesList.length,
          matchedWithFiles: unifiedBusinesses.filter(b => b.hasFiles).length,
          searchTerm: search,
          isUnified: true
        }
      },
      timestamp: new Date().toLocaleString('ko-KR')
    });

  } catch (error) {
    console.error('❌ [BUSINESS-UNIFIED] 통합 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: '통합 사업장 정보 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'),
      data: {
        businesses: [],
        count: 0,
        metadata: {
          source: 'business-unified-error',
          error: true
        }
      }
    }, { status: 500 });
  }
}

// POST 메서드도 지원 (향후 확장용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, action } = body;

    if (action === 'create-file-record') {
      // 필요시 businesses 테이블에 새 레코드 생성
      console.log(`🆕 [BUSINESS-UNIFIED] 새 사업장 파일 레코드 생성: ${businessName}`);
      
      const baseUrl = process.env.NODE_ENV === 'production'
        ? `https://${request.headers.get('host')}`
        : `http://localhost:${process.env.PORT || 3000}`;

      // businesses 테이블에 새 사업장 추가
      const createResponse = await fetch(`${baseUrl}/api/business-list-supabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: businessName,
          facilityInfo: {}
        })
      });

      if (!createResponse.ok) {
        throw new Error('파일 레코드 생성 실패');
      }

      const createResult = await createResponse.json();
      
      return NextResponse.json({
        success: true,
        message: '새 사업장 파일 레코드가 생성되었습니다.',
        data: createResult
      });
    }

    return NextResponse.json({
      success: false,
      message: '지원하지 않는 작업입니다.'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ [BUSINESS-UNIFIED] POST 요청 실패:', error);
    return NextResponse.json({
      success: false,
      message: 'POST 요청 처리 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}