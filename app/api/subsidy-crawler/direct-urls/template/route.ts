import { NextResponse } from 'next/server';

// ============================================================
// CSV Template Download API
// ============================================================
// 목적: direct_url_sources 테이블용 CSV 템플릿 다운로드
// 엔드포인트: GET /api/subsidy-crawler/direct-urls/template
// ============================================================

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // CSV 헤더
    const headers = ['url', 'region_code', 'region_name', 'category', 'notes'];

    // 샘플 데이터 (가이드용)
    const sampleData = [
      // region_code 있는 예시
      ['https://www.seoul.go.kr/main/index.jsp', '11000', '서울특별시', 'IoT지원', '서울시 공고'],
      ['https://www.busan.go.kr/index', '26000', '부산광역시', 'IoT지원', '부산시 공고'],
      // region_code 없는 예시 (선택 사항)
      ['https://www.daegu.go.kr/index.do', '', '대구광역시', 'IoT지원', 'region_code 생략 가능'],
      // 인천광역시
      ['https://www.incheon.go.kr/index', '28000', '인천광역시', 'IoT지원', '인천시 공고'],
      // 광주광역시
      ['https://www.gwangju.go.kr/index.jsp', '29000', '광주광역시', 'IoT지원', '광주시 공고'],
      // 대전광역시
      ['https://www.daejeon.go.kr/index.do', '30000', '대전광역시', 'IoT지원', '대전시 공고'],
      // 울산광역시
      ['https://www.ulsan.go.kr/index', '31000', '울산광역시', 'IoT지원', '울산시 공고'],
      // 세종특별자치시
      ['https://www.sejong.go.kr/index.do', '36000', '세종특별자치시', 'IoT지원', '세종시 공고'],
      // 경기도
      ['https://www.gg.go.kr/main', '41000', '경기도', 'IoT지원', '경기도 공고'],
      // 강원특별자치도
      ['https://www.provin.gangwon.kr/gw/main.do', '51000', '강원특별자치도', 'IoT지원', '강원도 공고'],
      // 충청북도
      ['https://www.chungbuk.go.kr/www/index.do', '43000', '충청북도', 'IoT지원', '충북 공고'],
      // 충청남도
      ['https://www.chungnam.go.kr/main.do', '44000', '충청남도', 'IoT지원', '충남 공고'],
      // 전북특별자치도
      ['https://www.jeonbuk.go.kr/index.jeonbuk', '52000', '전북특별자치도', 'IoT지원', '전북 공고'],
      // 전라남도
      ['https://www.jeonnam.go.kr/index.es?sid=a1', '46000', '전라남도', 'IoT지원', '전남 공고'],
      // 경상북도
      ['https://www.gb.go.kr/Main/open_contents/section/wel/index.var', '47000', '경상북도', 'IoT지원', '경북 공고'],
      // 경상남도
      ['https://www.gyeongnam.go.kr/index.gyeong', '48000', '경상남도', 'IoT지원', '경남 공고'],
      // 제주특별자치도
      ['https://www.jeju.go.kr/index.htm', '50000', '제주특별자치도', 'IoT지원', '제주도 공고'],
    ];

    // CSV 생성
    const csvLines = [
      headers.join(','),
      ...sampleData.map(row => row.map(escapeCSV).join(',')),
      '',
      '# 추가 URL을 아래에 입력하세요 (샘플 데이터는 삭제 가능)',
      '# 형식: url,region_code,region_name,category,notes',
      '# 필수 필드: url, region_name',
      '# 선택 필드: region_code (5자리 숫자), category, notes',
      '# region_code 예시: 11000=서울, 26000=부산, 27000=대구',
      '# region_code를 모르면 비워두세요 (예: "https://example.com,,경기도,IoT지원,메모")',
      '',
    ];

    const csvContent = csvLines.join('\n');

    // UTF-8 BOM 추가 (Excel 한글 호환성)
    const bom = '\uFEFF';
    const blob = bom + csvContent;

    // 파일명 생성 (타임스탬프 포함)
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `direct_urls_template_${timestamp}.csv`;

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Template download error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate template',
      },
      { status: 500 }
    );
  }
}

// CSV 값 이스케이프 (쉼표, 따옴표, 줄바꿈 처리)
function escapeCSV(value: string): string {
  if (!value) return '';

  // 쉼표, 따옴표, 줄바꿈이 있으면 따옴표로 감싸기
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    // 따옴표는 두 개로 이스케이프
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
