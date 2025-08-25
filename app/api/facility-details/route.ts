import { NextRequest, NextResponse } from 'next/server';
import { sheets } from '@/lib/google-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, facilityDetails, gatewayInfo } = body;

    if (!businessName) {
      return NextResponse.json(
        { success: false, message: '사업장명이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`📝 [FACILITY-DETAILS] 상세정보 저장 시작: ${businessName}`);

    // 환경변수 확인
    const spreadsheetId = process.env.DATA_COLLECTION_SPREADSHEET_ID?.trim();
    const sheetName = '설치 전 실사';
    
    if (!spreadsheetId) {
      throw new Error('DATA_COLLECTION_SPREADSHEET_ID가 설정되지 않았습니다');
    }

    // 사업장 행 찾기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const values = response.data.values || [];
    let targetRowIndex = -1;

    // 사업장명이 있는 행 찾기 (B열에서 검색)
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[1] && row[1].toString().trim() === businessName.trim()) {
        targetRowIndex = i + 1; // 1-based index
        break;
      }
    }

    if (targetRowIndex === -1) {
      return NextResponse.json(
        { success: false, message: '해당 사업장을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    console.log(`📝 [FACILITY-DETAILS] 사업장 발견: 행 ${targetRowIndex}`);

    // JSON으로 직렬화하여 저장
    const detailsData = JSON.stringify({
      facilityDetails: facilityDetails || {},
      gatewayInfo: gatewayInfo || {},
      lastUpdated: new Date().toISOString()
    });

    // Q열에 상세정보 저장
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!Q${targetRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[detailsData]],
      },
    });

    console.log(`📝 [FACILITY-DETAILS] ✅ 상세정보 저장 완료`);

    return NextResponse.json({
      success: true,
      message: '시설 상세정보가 구글시트에 저장되었습니다.',
      updatedRow: targetRowIndex
    });

  } catch (error) {
    console.error(`📝 [FACILITY-DETAILS] ❌ 오류 발생:`, error);
    
    let errorMessage = '시설 상세정보 저장 실패';
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
        error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
      },
      { status: statusCode }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessName = searchParams.get('businessName');

    if (!businessName) {
      return NextResponse.json(
        { success: false, message: '사업장명이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`📝 [FACILITY-DETAILS] 상세정보 불러오기 시작: ${businessName}`);

    // 환경변수 확인
    const spreadsheetId = process.env.DATA_COLLECTION_SPREADSHEET_ID?.trim();
    const sheetName = '설치 전 실사';
    
    if (!spreadsheetId) {
      throw new Error('DATA_COLLECTION_SPREADSHEET_ID가 설정되지 않았습니다');
    }

    // 사업장 행 찾기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const values = response.data.values || [];
    let targetRowIndex = -1;

    // 사업장명이 있는 행 찾기 (B열에서 검색)
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[1] && row[1].toString().trim() === businessName.trim()) {
        targetRowIndex = i;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return NextResponse.json({
        success: true,
        data: { facilityDetails: {}, gatewayInfo: {} },
        message: '해당 사업장의 상세정보가 없습니다.'
      });
    }

    // Q열에서 상세정보 가져오기 (17번째 컬럼)
    const detailsRaw = values[targetRowIndex][16]; // 0-based index for Q column

    let facilityDetails = {};
    let gatewayInfo = {};

    if (detailsRaw) {
      try {
        const parsedData = JSON.parse(detailsRaw);
        facilityDetails = parsedData.facilityDetails || {};
        gatewayInfo = parsedData.gatewayInfo || {};
      } catch (parseError) {
        console.warn('📝 [FACILITY-DETAILS] JSON 파싱 실패, 기본값 사용:', parseError);
      }
    }

    console.log(`📝 [FACILITY-DETAILS] ✅ 상세정보 불러오기 완료`);

    return NextResponse.json({
      success: true,
      data: { facilityDetails, gatewayInfo },
      message: '시설 상세정보를 성공적으로 불러왔습니다.'
    });

  } catch (error) {
    console.error(`📝 [FACILITY-DETAILS] ❌ 불러오기 오류:`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '시설 상세정보 불러오기 실패',
        error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
      },
      { status: 500 }
    );
  }
}