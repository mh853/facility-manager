// app/api/business-list-legacy/route.ts - 기존 시스템 백업 (인증 없음)
import { NextRequest } from 'next/server';
import { sheets } from '@/lib/google-client';
import { withApiHandler, createSuccessResponse, withTimeout } from '@/lib/api-utils';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export const GET = withApiHandler(async (request: NextRequest) => {
  // 대기필증 DB가 포함된 스프레드시트 사용 (UPLOAD_SPREADSHEET_ID 우선)
  const uploadSpreadsheetId = process.env.UPLOAD_SPREADSHEET_ID || process.env.DATA_COLLECTION_SPREADSHEET_ID || process.env.MAIN_SPREADSHEET_ID;

  console.log('🔍 [DEBUG] 환경변수 확인:', {
    hasMainId: !!process.env.MAIN_SPREADSHEET_ID,
    hasUploadId: !!process.env.UPLOAD_SPREADSHEET_ID,
    hasDataCollectionId: !!process.env.DATA_COLLECTION_SPREADSHEET_ID,
    finalId: uploadSpreadsheetId?.slice(0, 10) + '...',
    hasGoogleEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    hasGoogleKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    keyStartsWithBegin: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.includes('-----BEGIN'),
    keyLength: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.length || 0
  });

  if (!uploadSpreadsheetId) {
    console.error('🔴 [BUSINESS-LIST] 환경변수 누락 - 샘플 데이터 반환');
    return createSuccessResponse({
      businesses: [
        '❌ 환경변수 누락',
        '⚠️ UPLOAD_SPREADSHEET_ID가 설정되지 않았습니다',
        '🔧 Vercel 환경변수를 확인하세요',
        '📚 VERCEL_ENV_SETUP.md 참조'
      ],
      count: 4,
      metadata: {
        error: 'MISSING_ENV_VARS',
        message: 'UPLOAD_SPREADSHEET_ID가 설정되지 않았습니다'
      }
    });
  }

  // 시트 메타데이터 조회 (타임아웃 적용)
  if (!sheets) {
    throw new Error('Google Sheets 클라이언트를 초기화할 수 없습니다');
  }

  const metadata = await withTimeout(
    sheets.spreadsheets.get({ spreadsheetId: uploadSpreadsheetId }),
    5000
  );

  const availableSheets = (metadata as any).data.sheets?.map((sheet: any) => sheet.properties?.title).filter(Boolean) || [];
  const possibleSheets = ['대기필증 DB', '설치 전 실사', '실사 데이터', '실사관리', '실사', 'Sheet1', '시트1'];

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

  const values = (response as any).data.values || [];
  if (values.length === 0) {
    throw new Error('B열에 데이터가 없습니다');
  }

  // 사업장명 추출 및 정제
  const businessNames = values
    .map((row: any) => row?.[0])
    .filter((name: any): name is string =>
      typeof name === 'string' &&
      name.trim() !== '' &&
      name !== '사업장명' &&
      !name.includes('사업장') &&
      !name.startsWith('#REF!') &&
      !name.startsWith('#') &&
      name.length > 1
    );

  // 중복 제거 및 정렬
  const uniqueBusinesses = [...new Set(businessNames)]
    .filter((name: any): name is string => typeof name === 'string' && name.trim() !== '')
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
      finalCount: uniqueBusinesses.length,
      dataSource: 'google-sheets',
      legacy: true
    }
  });
}, { logLevel: 'debug' });