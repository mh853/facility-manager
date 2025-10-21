// app/api/download-excel-template/route.ts - 업데이트된 엑셀 템플릿 다운로드
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(request: NextRequest) {
  try {
    console.log('📊 [EXCEL-TEMPLATE] 템플릿 생성 시작...');

    // 간단한 템플릿 생성 (데이터베이스 조회 없이)
    console.log(`📋 [EXCEL-TEMPLATE] 간단 템플릿 생성 중...`);

    // 현재 데이터베이스 스키마에 맞는 헤더 정의
    const headers = [
      // 기본 정보
      '연번',
      '사업장명',
      '주소',
      '사업장담당자',
      '담당자직급',
      '연락처',
      '사업장연락처',
      '팩스번호',
      '이메일',
      '대표자명',
      '사업자등록번호',
      '업종',
      
      // 센서/미터 정보 (INTEGER 타입)
      'PH센서',
      '차압계',
      '온도계',
      '배출전류계',
      '송풍전류계',
      '펌프전류계',
      
      // 네트워크 장비 (INTEGER 타입)
      '게이트웨이',
      'VPN(유선)',
      'VPN(무선)',
      '복수굴뚝(설치비)',
      
      // 기타 정보
      '담당부서',
      '지자체',
      '제조사',
      '진행구분',
      '사업 진행연도',
      '그린링크ID',
      '그린링크PW',
      '사업장관리코드',
      '발주담당',
      '발주일',
      '출고일',
      '설치일',
      '설치팀',
      '영업점',
      '기타',
      '추가공사비',
      '네고'
    ];

    // 샘플 데이터 (1개 예시 행)
    const sampleData = [
      1, // 연번
      '(주)샘플사업장', // 사업장명
      '서울시 강남구 테헤란로 123', // 주소
      '홍길동', // 사업장담당자
      '과장', // 담당자직급
      '010-1234-5678', // 연락처
      '02-1234-5678', // 사업장연락처
      '02-1234-5679', // 팩스번호
      'sample@company.com', // 이메일
      '김대표', // 대표자명
      '123-45-67890', // 사업자등록번호
      '제조업', // 업종
      
      // 센서/미터 정보 (숫자로 입력)
      1, // PH센서
      2, // 차압계
      1, // 온도계
      1, // 배출전류계
      1, // 송풍전류계
      0, // 펌프전류계
      
      // 네트워크 장비 (숫자로 입력)
      1, // 게이트웨이
      1, // VPN(유선)
      0, // VPN(무선)
      0, // 복수굴뚝(설치비)
      
      // 기타 정보
      '영업1팀', // 담당부서
      '강남구', // 지자체
      '에코센스', // 제조사
      '자비', // 진행구분
      2025, // 사업 진행연도
      'greenlink123', // 그린링크ID
      'password123', // 그린링크PW
      'BIZ001', // 사업장관리코드
      '김발주', // 발주담당
      '2025-01-15', // 발주일
      '2025-01-20', // 출고일
      '2025-02-01', // 설치일
      '설치1팀', // 설치팀
      '서울영업소', // 영업점
      '특이사항 없음', // 기타
      0, // 추가공사비
      '기본 가격' // 네고
    ];

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    
    // 빈 템플릿 (헤더만 포함)
    const businessRows: any[] = [];

    // 헤더와 실제 데이터를 포함한 워크시트 생성
    const wsData = [headers, ...businessRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 컬럼 너비 설정 (가독성 향상)
    ws['!cols'] = headers.map((header) => {
      if (['주소', '사업장명'].includes(header)) return { wch: 30 };
      if (['연락처', '사업장연락처', '팩스번호', '이메일'].includes(header)) return { wch: 15 };
      if (['담당자직급', '업종', '제조사'].includes(header)) return { wch: 12 };
      return { wch: 10 };
    });

    // 헤더 스타일 설정
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4F81BD' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    // 헤더에 스타일 적용
    for (let i = 0; i < headers.length; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
      if (!ws[cellRef]) ws[cellRef] = {};
      ws[cellRef].s = headerStyle;
    }

    // 워크시트 추가
    XLSX.utils.book_append_sheet(wb, ws, '사업장정보');

    // 설명 시트 생성
    const instructionData = [
      ['🏢 사업장 정보 업로드 템플릿'],
      [''],
      ['📋 작성 가이드:'],
      [''],
      ['1. 기본 정보 섹션'],
      ['   - 사업장명: 필수 입력 (매칭 기준)'],
      ['   - 주소, 담당자 정보: 선택 입력'],
      ['   - 사업자등록번호: 하이픈(-) 포함 가능'],
      [''],
      ['2. 센서/미터 섹션 (숫자만 입력)'],
      ['   - PH센서, 차압계, 온도계: 설치 개수'],
      ['   - 배출전류계, 송풍전류계, 펌프전류계: 설치 개수'],
      [''],
      ['3. 네트워크 장비 섹션 (숫자만 입력)'],
      ['   - 게이트웨이, VPN(유선), VPN(무선): 설치 개수'],
      ['   - 복수굴뚝(설치비): 설치 개수'],
      [''],
      ['4. 제조사 입력 가이드'],
      ['   - 권장 제조사명: 에코센스, 크린어스, 가이아씨앤에스, 이브이에스, 원에너지'],
      ['   - 기타 제조사명도 입력 가능 (최대 100자)'],
      ['   - 번호나 기호는 제외하고 입력 (예: "2. 크린어스" → "크린어스")'],
      [''],
      ['⚠️ 주의사항:'],
      ['   - 첫 번째 행(헤더)은 수정하지 마세요'],
      ['   - 숫자 필드는 반드시 숫자로 입력하세요 (0도 유효)'],
      ['   - 사업장명이 비어있는 행은 처리되지 않습니다'],
      [''],
      ['📊 현재 데이터베이스 스키마 (2025.09):'],
      ['   - ph_meter: INTEGER'],
      ['   - differential_pressure_meter: INTEGER'],
      ['   - temperature_meter: INTEGER'],
      ['   - discharge_current_meter: INTEGER (배출전류계)'],
      ['   - fan_current_meter: INTEGER (송풍전류계)'],
      ['   - pump_current_meter: INTEGER (펌프전류계)'],
      ['   - gateway: INTEGER'],
      ['   - vpn_wired: INTEGER (VPN유선)'],
      ['   - vpn_wireless: INTEGER (VPN무선)'],
      ['   - multiple_stack: INTEGER (복수굴뚝)'],
      ['   - negotiation: STRING (네고)']
    ];

    const instructionWs = XLSX.utils.aoa_to_sheet(instructionData);
    instructionWs['!cols'] = [{ wch: 50 }];
    
    // 제목 스타일
    instructionWs['A1'].s = {
      font: { bold: true, size: 16, color: { rgb: '2F5496' } },
      alignment: { horizontal: 'center' }
    };

    XLSX.utils.book_append_sheet(wb, instructionWs, '작성가이드');

    // 엑셀 파일을 Buffer로 변환
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const currentDate = new Date().toISOString().slice(0, 10);
    const fileName = `사업장정보_업로드템플릿_${currentDate}.xlsx`;

    console.log(`✅ [EXCEL-TEMPLATE] 템플릿 생성 완료: ${fileName}`);

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('❌ [EXCEL-TEMPLATE] 템플릿 생성 실패:', error);
    return NextResponse.json({
      success: false,
      message: '템플릿 생성 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}