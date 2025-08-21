// app/api/generate-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import jsPDF from 'jspdf';

// Google API 설정
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, type = 'completion' } = body;

    if (!businessName) {
      return NextResponse.json(
        { success: false, message: '사업장명이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`📄 PDF 보고서 생성 시작: ${businessName}`);

    // 데이터 수집
    const [facilities, businessInfo, completionStatus] = await Promise.all([
      getFacilities(businessName),
      getBusinessInfo(businessName),
      getCompletionStatus(businessName, type)
    ]);

    // PDF 생성
    const pdfBuffer = await generatePDFReport({
      businessName,
      facilities,
      businessInfo,
      completionStatus,
      type
    });

    const fileName = `${businessName}_${type === 'completion' ? '설치완료' : '사전실사'}_보고서_${new Date().toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1)}.pdf`;

    console.log(`✅ PDF 보고서 생성 완료: ${fileName}`);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('❌ PDF 생성 실패:', error);
    return NextResponse.json(
      { success: false, message: 'PDF 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function getFacilities(businessName: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.PERMIT_SHEET_ID,
      range: `대기필증 DB!A:CZ`,
    });

    const values = response.data.values || [];
    return parseFacilitiesFromSheet(values, businessName);
  } catch (error) {
    console.error('시설 정보 조회 실패:', error);
    return { discharge: [], prevention: [] };
  }
}

async function getBusinessInfo(businessName: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.PERMIT_SHEET_ID,
      range: `사업장 정보!A:Z`,
    });

    const values = response.data.values || [];
    return parseBusinessInfo(values, businessName);
  } catch (error) {
    console.error('사업장 정보 조회 실패:', error);
    return { found: false, businessName };
  }
}

async function getCompletionStatus(businessName: string, type: string) {
  try {
    const sheetName = type === 'completion' ? '설치 후 사진' : '설치 전 실사';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.PERMIT_SHEET_ID,
      range: `${sheetName}!A:I`,
    });

    const values = response.data.values || [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[1] && row[1].toString().trim() === businessName.trim()) {
        return {
          status: row[2] || '',
          memo: row[4] || '',
          installer: row[5] || '',
          contact: row[6] || '',
          installDate: row[7] || '',
          completed: (row[2] || '').includes('최종 완료'),
        };
      }
    }

    return { completed: false };
  } catch (error) {
    console.error('완료 상태 조회 실패:', error);
    return { completed: false };
  }
}

function parseFacilitiesFromSheet(data: any[][], businessName: string) {
  const facilities = { discharge: [], prevention: [] };
  // 이전에 구현한 파싱 로직 재사용
  // (간단하게 구현, 실제로는 기존 로직 복사)
  return facilities;
}

function parseBusinessInfo(data: any[][], businessName: string) {
  if (!data.length) return { found: false, businessName };

  const headerRow = data[0];
  const columnMap = createColumnMap(headerRow);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cellValue = row[columnMap.businessName - 1];
    
    if (cellValue && cellValue.toString().trim() === businessName.trim()) {
      return {
        found: true,
        businessName,
        manager: row[columnMap.manager - 1] || '',
        position: row[columnMap.position - 1] || '',
        contact: row[columnMap.contact - 1] || '',
        address: row[columnMap.address - 1] || '',
      };
    }
  }

  return { found: false, businessName };
}

function createColumnMap(headerRow: any[]) {
  const columnMap: any = {};
  
  for (let i = 0; i < headerRow.length; i++) {
    const header = headerRow[i]?.toString().trim();
    
    switch (header) {
      case '사업장명': columnMap.businessName = i + 1; break;
      case '사업장담당자': columnMap.manager = i + 1; break;
      case '직급': columnMap.position = i + 1; break;
      case '연락처': columnMap.contact = i + 1; break;
      case '주소': columnMap.address = i + 1; break;
    }
  }
  
  return columnMap;
}

async function generatePDFReport(data: any): Promise<Buffer> {
  const { businessName, facilities, businessInfo, completionStatus, type } = data;
  
  // 한글 폰트 설정을 위한 기본 PDF 생성
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // 제목
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const title = `${businessName} ${type === 'completion' ? '설치완료' : '사전실사'} 보고서`;
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPos);
  yPos += 15;

  // 생성일시
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const generateDate = `생성일시: ${new Date().toLocaleString('ko-KR')}`;
  doc.text(generateDate, pageWidth - margin - doc.getTextWidth(generateDate), yPos);
  yPos += 15;

  // 사업장 정보
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('사업장 정보', margin, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  if (businessInfo.found) {
    const infoLines = [
      `사업장명: ${businessName}`,
      `담당자: ${businessInfo.manager || '정보 없음'} ${businessInfo.position ? `(${businessInfo.position})` : ''}`,
      `연락처: ${businessInfo.contact || '정보 없음'}`,
      `주소: ${businessInfo.address || '정보 없음'}`
    ];

    infoLines.forEach(line => {
      doc.text(line, margin, yPos);
      yPos += 7;
    });
  } else {
    doc.text('사업장 정보를 찾을 수 없습니다.', margin, yPos);
    yPos += 7;
  }

  yPos += 10;

  // 시설 현황
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('시설 현황', margin, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const outlets = new Set([
    ...facilities.discharge.map((f: any) => f.outlet),
    ...facilities.prevention.map((f: any) => f.outlet)
  ]);

  const facilityStats = [
    `배출구: ${outlets.size}개`,
    `배출시설: ${facilities.discharge.length}개`,
    `방지시설: ${facilities.prevention.length}개`
  ];

  facilityStats.forEach(stat => {
    doc.text(stat, margin, yPos);
    yPos += 7;
  });

  yPos += 10;

  // 설치 정보 (완료 시에만)
  if (type === 'completion' && completionStatus.installer) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('설치 정보', margin, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const installLines = [
      `설치담당자: ${completionStatus.installer}`,
      `연락처: ${completionStatus.contact || '정보 없음'}`,
      `설치일: ${completionStatus.installDate || '정보 없음'}`,
      `상태: ${completionStatus.completed ? '완료' : '진행중'}`
    ];

    installLines.forEach(line => {
      doc.text(line, margin, yPos);
      yPos += 7;
    });

    yPos += 10;
  }

  // 특이사항
  if (completionStatus.memo) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('특이사항', margin, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    // 긴 텍스트를 여러 줄로 분할
    const memoLines = doc.splitTextToSize(completionStatus.memo, contentWidth);
    memoLines.forEach((line: string) => {
      if (yPos > 270) { // 페이지 넘김
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, margin, yPos);
      yPos += 7;
    });

    yPos += 10;
  }

  // 시설 상세 목록
  if (facilities.discharge.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('배출시설 목록', margin, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    facilities.discharge.forEach((facility: any, index: number) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      const facilityLine = `${index + 1}. ${facility.displayName} - ${facility.name} (${facility.capacity})`;
      doc.text(facilityLine, margin, yPos);
      yPos += 6;
    });

    yPos += 10;
  }

  if (facilities.prevention.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('방지시설 목록', margin, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    facilities.prevention.forEach((facility: any, index: number) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      const facilityLine = `${index + 1}. ${facility.displayName} - ${facility.name} (${facility.capacity})`;
      doc.text(facilityLine, margin, yPos);
      yPos += 6;
    });
  }

  // 푸터
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`페이지 ${i} / ${pageCount}`, pageWidth - margin - 20, 285);
    doc.text('시설관리 시스템', margin, 285);
  }

  return Buffer.from(doc.output('arraybuffer'));
}