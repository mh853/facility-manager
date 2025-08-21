// app/api/business/[businessName]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sheets } from '@/lib/google-client';
import { memoryCache } from '@/lib/cache';
import { BusinessInfo } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { businessName: string } }
) {
  try {
    const businessName = decodeURIComponent(params.businessName);
    const cacheKey = `business:${businessName}`;
    
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, data: cached });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.MAIN_SPREADSHEET_ID,
      range: `${process.env.BUSINESS_INFO_SHEET_NAME}!A:Z`,
    });

    const values = response.data.values || [];
    const businessInfo = parseBusinessInfo(values, businessName);
    
    memoryCache.set(cacheKey, businessInfo, 60); // 1시간 캐시

    return NextResponse.json({ success: true, data: businessInfo });
  } catch (error) {
    console.error('Business info API error:', error);
    console.error('Environment variables:', {
      MAIN_SPREADSHEET_ID: process.env.MAIN_SPREADSHEET_ID ? 'SET' : 'NOT SET',
      BUSINESS_INFO_SHEET_NAME: process.env.BUSINESS_INFO_SHEET_NAME || 'NOT SET'
    });
    return NextResponse.json(
      { 
        success: false, 
        message: '사업장 정보 조회 실패', 
        error: error instanceof Error ? error.message : String(error),
        debug: {
          hasMainSpreadsheetId: !!process.env.MAIN_SPREADSHEET_ID,
          hasBusinessInfoSheetName: !!process.env.BUSINESS_INFO_SHEET_NAME
        }
      },
      { status: 500 }
    );
  }
}

function parseBusinessInfo(data: any[][], businessName: string): BusinessInfo {
  if (!data.length) {
    return { found: false, businessName, error: '데이터가 없습니다.' };
  }

  const headerRow = data[0];
  const columnMap = createColumnMap(headerRow);

  if (!columnMap.businessName) {
    return { found: false, businessName, error: '필수 컬럼을 찾을 수 없습니다.' };
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cellValue = row[columnMap.businessName - 1];
    
    if (cellValue && cellValue.toString().trim() === businessName) {
      return {
        found: true,
        businessName,
        manager: row[columnMap.manager - 1] || '',
        position: row[columnMap.position - 1] || '',
        contact: row[columnMap.contact - 1] || '',
        address: row[columnMap.address - 1] || '',
        rowIndex: i + 1
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
      case '사업장명':
        columnMap.businessName = i + 1;
        break;
      case '사업장담당자':
        columnMap.manager = i + 1;
        break;
      case '직급':
        columnMap.position = i + 1;
        break;
      case '연락처':
        columnMap.contact = i + 1;
        break;
      case '주소':
        columnMap.address = i + 1;
        break;
    }
  }
  
  return columnMap;
}
