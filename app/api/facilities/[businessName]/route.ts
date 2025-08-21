// app/api/facilities/[businessName]/route.ts - 최적화된 API
import { NextRequest, NextResponse } from 'next/server';
import { sheets } from '@/lib/google-client';
import { memoryCache } from '@/lib/cache';
import { FacilitiesData, Facility } from '@/types';

// HTTP 캐시 헤더 설정
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=60', // 5분 캐시, 1분 stale
  'CDN-Cache-Control': 'public, max-age=600', // CDN에서 10분 캐시
};

export async function GET(
  request: NextRequest,
  { params }: { params: { businessName: string } }
) {
  const startTime = Date.now();
  
  try {
    const businessName = decodeURIComponent(params.businessName);
    console.log('🏭 [FACILITIES] API 시작:', businessName);
    
    // 입력 검증
    if (!businessName || businessName.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: '사업장명이 유효하지 않습니다.' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }
    
    const cacheKey = `facilities:${businessName}`;
    
    // 강제 캐시 무효화 옵션
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    if (forceRefresh) {
      console.log('🔄 [FACILITIES] 강제 캐시 클리어');
      memoryCache.delete(cacheKey);
    }
    
    // 캐시 확인
    const cached = memoryCache.get(cacheKey);
    if (cached && !forceRefresh) {
      console.log(`🏭 [FACILITIES] 캐시에서 데이터 반환 (${Date.now() - startTime}ms)`);
      return NextResponse.json({ success: true, data: cached }, { headers: CACHE_HEADERS });
    }

    // 환경변수 확인 (개행문자 제거)
    const spreadsheetId = process.env.MAIN_SPREADSHEET_ID?.trim();
    const facilitySheetName = (process.env.FACILITY_SHEET_NAME || '대기필증 DB')?.trim();
    
    if (!spreadsheetId) {
      throw new Error('MAIN_SPREADSHEET_ID가 설정되지 않았습니다');
    }

    console.log('🏭 [FACILITIES] Google Sheets 조회 시작');
    console.log('🏭 [FACILITIES] 사용 중인 설정:', {
      spreadsheetId,
      facilitySheetName,
      range: `${facilitySheetName}!A:C`
    });
    
    // 시트 메타데이터 먼저 확인
    try {
      const metadata = await sheets.spreadsheets.get({ spreadsheetId });
      const availableSheets = metadata.data.sheets?.map(sheet => ({
        title: sheet.properties?.title,
        sheetId: sheet.properties?.sheetId
      })) || [];
      console.log('🏭 [FACILITIES] 사용 가능한 시트들:', availableSheets);
    } catch (metaError) {
      console.error('🏭 [FACILITIES] 메타데이터 조회 실패:', metaError);
    }
    
    // 병렬 조회로 성능 개선
    const sheetQueries = Promise.allSettled([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${facilitySheetName}!A:C`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${facilitySheetName}!D:DD`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${facilitySheetName}!DE:GZ`,
      })
    ]);

    const [basicResult, dischargeResult, preventionResult] = await sheetQueries;

    // 결과 검증 및 데이터 추출
    const basicData = basicResult.status === 'fulfilled' ? (basicResult.value.data.values || []) : [];
    const dischargeData = dischargeResult.status === 'fulfilled' ? (dischargeResult.value.data.values || []) : [];
    const preventionData = preventionResult.status === 'fulfilled' ? (preventionResult.value.data.values || []) : [];

    console.log('🏭 [FACILITIES] 조회 완료:', {
      basic: basicData.length,
      discharge: dischargeData.length,
      prevention: preventionData.length
    });

    // 오류 체크
    if (basicResult.status === 'rejected' || basicData.length === 0) {
      console.error('🏭 [FACILITIES] 기본 데이터 조회 실패');
      return NextResponse.json(
        { success: false, message: '기본 데이터를 불러올 수 없습니다.' },
        { status: 503, headers: CACHE_HEADERS }
      );
    }

    // 사업장 데이터 찾기 및 파싱
    console.log(`🏭 [FACILITIES] "${businessName}" 사업장 데이터 검색 중...`);
    
    const facilities = parseFacilitiesFromSheets(basicData, dischargeData, preventionData, businessName);
    
    // 결과 검증
    if (!facilities || (facilities.discharge.length === 0 && facilities.prevention.length === 0)) {
      console.log(`🏭 [FACILITIES] ⚠️ "${businessName}" 사업장에서 시설을 찾을 수 없습니다`);
      const emptyResult = {
        facilities: { discharge: [], prevention: [] },
        outlets: { outlets: [1], count: 1, maxOutlet: 1, minOutlet: 1 },
        dischargeCount: 0,
        preventionCount: 0,
        note: '해당 사업장의 시설 정보를 찾을 수 없습니다.'
      };
      
      // 짧은 시간 캐시 (재시도 가능하도록)
      memoryCache.set(cacheKey, emptyResult, 1);
      
      return NextResponse.json(
        { success: true, data: emptyResult },
        { headers: CACHE_HEADERS }
      );
    }

    console.log('🏭 [FACILITIES] 파싱 결과:', {
      discharge: facilities.discharge.length,
      prevention: facilities.prevention.length,
      시간: `${Date.now() - startTime}ms`
    });
    
    // 결과 데이터 구성
    const resultData = {
      facilities,
      outlets: analyzeOutlets(facilities),
      dischargeCount: facilities.discharge.length,
      preventionCount: facilities.prevention.length,
      lastUpdated: new Date().toISOString(),
      processingTime: Date.now() - startTime
    };
    
    // 캐시 저장 (성공 시 긴 시간, 부분 실패 시 짧은 시간)
    const cacheTTL = (facilities.discharge.length > 0 || facilities.prevention.length > 0) ? 10 : 3;
    memoryCache.set(cacheKey, resultData, cacheTTL);
    
    console.log(`🏭 [FACILITIES] ✅ 성공적으로 완료 (${Date.now() - startTime}ms)`);

    return NextResponse.json(
      { success: true, data: resultData },
      { headers: CACHE_HEADERS }
    );
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`🏭 [FACILITIES] ❌ 오류 발생 (${processingTime}ms):`, error);
    
    // 구체적인 에러 메시지 제공
    let errorMessage = '시설 정보 조회 실패';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('spreadsheet')) {
        errorMessage = '스프레드시트 접근 오류';
        statusCode = 503;
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorMessage = '네트워크 연결 오류';
        statusCode = 503;
      } else if (error.message.includes('authorization') || error.message.includes('permission')) {
        errorMessage = '접근 권한 오류';
        statusCode = 403;
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined,
        processingTime
      },
      { 
        status: statusCode,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate', // 에러는 캐시하지 않음
        }
      }
    );
  }
}

// 최적화된 파싱 함수
function parseFacilitiesFromSheets(
  basicData: any[][], 
  dischargeData: any[][], 
  preventionData: any[][], 
  businessName: string
): FacilitiesData {
  console.log(`🏭 [PARSE] "${businessName}" 파싱 시작`);
  
  const facilities: FacilitiesData = { discharge: [], prevention: [] };
  const businessRows: Array<{ rowIndex: number; outlet: number }> = [];

  // 비즈니스 행 찾기 최적화 (조기 종료)
  let businessFound = false;
  const maxSearchRows = Math.min(basicData.length, 1000); // 최대 1000행까지만 검색
  
  for (let i = 1; i < maxSearchRows; i++) {
    const currentRow = basicData[i];
    if (!currentRow || currentRow.length < 2) continue;
    
    const businessCell = currentRow[1]?.toString().trim();
    const outletCell = currentRow[2];

    // 디버깅: 처음 10개 행의 데이터 로깅
    if (i <= 10) {
      console.log(`🏭 [DEBUG] 행 ${i+1}: "${businessCell}" vs "${businessName}" (찾는중)`);
    }

    if (businessCell.trim() === businessName.trim()) {
      businessFound = true;
      console.log(`🏭 [PARSE] 사업장 발견 (행 ${i+1})`);
      businessRows.push({
        rowIndex: i,
        outlet: parseInt(outletCell) || 1
      });
      continue;
    }

    if (businessFound && !businessCell && outletCell) {
      console.log(`🏭 [PARSE] 추가 배출구 발견 (행 ${i+1})`);
      businessRows.push({
        rowIndex: i,
        outlet: parseInt(outletCell) || 1
      });
      continue;
    }

    if (businessFound && businessCell && businessCell.trim() !== businessName.trim()) {
      console.log(`🏭 [PARSE] 다른 사업장 발견, 파싱 종료 (행 ${i+1})`);
      break;
    }
  }

  console.log(`🏭 [PARSE] 총 ${businessRows.length}개 행 발견`);

  if (businessRows.length === 0) {
    console.log(`🏭 [PARSE] ❌ "${businessName}" 사업장을 찾을 수 없습니다`);
    return facilities;
  }

  // 시설 파싱 최적화
  let totalDischargeNumber = 1;
  let totalPreventionNumber = 1;

  for (const rowInfo of businessRows) {
    const { outlet, rowIndex } = rowInfo;
    console.log(`🏭 [PARSE] 배출구 ${outlet} 처리 중...`);

    // 배출시설 데이터 파싱
    const dischargeRow = dischargeData[rowIndex] || [];
    const dischargeFacilities = parseFacilitiesFromRow(dischargeRow, '배출시설');

    // 방지시설 데이터 파싱
    const preventionRow = preventionData[rowIndex] || [];
    const preventionFacilities = parseFacilitiesFromRow(preventionRow, '방지시설');

    console.log(`📈 [SUMMARY] 배출구 ${outlet}: 배출시설 ${dischargeFacilities.length}개, 방지시설 ${preventionFacilities.length}개`);

    // 배출시설 추가
    for (const facility of dischargeFacilities) {
      for (let q = 0; q < facility.quantity; q++) {
        facilities.discharge.push({
          outlet,
          number: totalDischargeNumber,
          name: facility.name,
          capacity: facility.capacity,
          quantity: facility.quantity,
          displayName: `배출구${outlet}-배출시설${totalDischargeNumber}`
        });
        totalDischargeNumber++;
      }
    }

    // 방지시설 추가
    for (const facility of preventionFacilities) {
      for (let q = 0; q < facility.quantity; q++) {
        facilities.prevention.push({
          outlet,
          number: totalPreventionNumber,
          name: facility.name,
          capacity: facility.capacity,
          quantity: facility.quantity,
          displayName: `배출구${outlet}-방지시설${totalPreventionNumber}`
        });
        totalPreventionNumber++;
      }
    }
  }

  console.log(`🏭 [PARSE] 전체 파싱 완료 - 배출시설: ${facilities.discharge.length}, 방지시설: ${facilities.prevention.length}`);
  return facilities;
}

// 행별 시설 파싱 최적화
function parseFacilitiesFromRow(rowData: any[], facilityType: string): Array<{name: string, capacity: string, quantity: number}> {
  const facilities: Array<{name: string, capacity: string, quantity: number}> = [];
  
  for (let col = 0; col < rowData.length; col += 3) {
    const facilityName = rowData[col]?.toString().trim();
    
    if (facilityName && facilityName.length > 0) {
      const capacity = rowData[col + 1]?.toString().trim() || '확인 중';
      const quantityStr = rowData[col + 2]?.toString().trim() || '1';
      const quantity = parseInt(quantityStr) || 1;

      facilities.push({
        name: facilityName,
        capacity,
        quantity
      });
      
      console.log(`🔧 [${facilityType}] 발견: ${facilityName} (${capacity}, ${quantity}개)`);
    }
  }
  
  return facilities;
}

// 배출구 분석 최적화
function analyzeOutlets(facilities: FacilitiesData) {
  const allOutlets = [
    ...facilities.discharge.map(f => f.outlet || 1),
    ...facilities.prevention.map(f => f.outlet || 1)
  ];
  
  const uniqueOutlets = [...new Set(allOutlets)].sort((a, b) => a - b);
  
  if (uniqueOutlets.length === 0) uniqueOutlets.push(1);

  return {
    outlets: uniqueOutlets,
    count: uniqueOutlets.length,
    maxOutlet: Math.max(...uniqueOutlets),
    minOutlet: Math.min(...uniqueOutlets)
  };
}
