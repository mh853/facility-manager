// app/api/business-list/route.ts - 최적화된 버전
import { NextRequest } from 'next/server';
import { sheets } from '@/lib/google-client';
import { withApiHandler, createSuccessResponse, withTimeout } from '@/lib/api-utils';

export const GET = withApiHandler(async (request: NextRequest) => {
  const uploadSpreadsheetId = process.env.UPLOAD_SPREADSHEET_ID || process.env.DATA_COLLECTION_SPREADSHEET_ID;
  
  if (!uploadSpreadsheetId) {
    throw new Error('UPLOAD_SPREADSHEET_ID가 설정되지 않았습니다');
  }

  // 시트 메타데이터 조회 (타임아웃 적용)
  const metadata = await withTimeout(
    sheets.spreadsheets.get({ spreadsheetId: uploadSpreadsheetId }), 
    5000
  );
  
  const availableSheets = metadata.data.sheets?.map(sheet => sheet.properties?.title).filter(Boolean) || [];
  const possibleSheets = ['설치 전 실사', '실사 데이터', '실사관리', '실사', 'Sheet1', '시트1'];
  
  const targetSheet = possibleSheets.find(sheet => availableSheets.includes(sheet)) || availableSheets[0];
  
  if (!targetSheet) {
    throw new Error('사용 가능한 시트를 찾을 수 없습니다');
  }
  
  // B열에서 사업장명 추출 (타임아웃 적용)
  const response = await withTimeout(
    sheets.spreadsheets.values.get({
      spreadsheetId: uploadSpreadsheetId,
      range: `'${targetSheet}'!B1:B1000`,
    }),
    8000
  );
  
  const values = response.data.values || [];
  if (values.length === 0) {
    throw new Error('B열에 데이터가 없습니다');
  }
  
  // 사업장명 추출 및 정제
  const businessNames = values
    .map(row => row?.[0])
    .filter((name): name is string => 
      typeof name === 'string' && 
      name.trim() !== '' &&
      name !== '사업장명' && 
      !name.includes('사업장') &&
      name.length > 1
    );
  
  // 중복 제거 및 정렬
  const uniqueBusinesses = [...new Set(businessNames)]
    .filter(name => name.trim() !== '')
    .sort();
  
  if (uniqueBusinesses.length === 0) {
    throw new Error('사업장 데이터를 찾을 수 없습니다');
  }
  
  return createSuccessResponse({
    businesses: uniqueBusinesses,
    count: uniqueBusinesses.length,
    metadata: {
      spreadsheetId: uploadSpreadsheetId,
      sheetName: targetSheet,
      totalRows: values.length,
      extractedCount: businessNames.length,
      finalCount: uniqueBusinesses.length
    }
  });
}, { logLevel: 'debug' });