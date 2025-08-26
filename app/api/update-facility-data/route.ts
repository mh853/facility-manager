import { NextRequest, NextResponse } from 'next/server';
import { sheets } from '@/lib/google-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, data, gatewayInfo } = body;

    if (!businessName || !data) {
      return NextResponse.json(
        { success: false, message: '사업장명과 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`📊 [FACILITY-UPDATE] 시설 데이터 업데이트 시작: ${businessName}`);

    // 환경변수 확인
    const spreadsheetId = process.env.DATA_COLLECTION_SPREADSHEET_ID?.trim();
    const sheetName = '설치 전 실사';
    
    if (!spreadsheetId) {
      throw new Error('DATA_COLLECTION_SPREADSHEET_ID가 설정되지 않았습니다');
    }

    // 사업장 행 찾기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Q`,
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

    console.log(`📊 [FACILITY-UPDATE] 사업장 발견: 행 ${targetRowIndex}`);

    // 게이트웨이 정보 문자열 생성
    let gatewayString = '';
    if (gatewayInfo && Object.keys(gatewayInfo).length > 0) {
      const gatewayEntries = Object.entries(gatewayInfo)
        .filter(([outlet, info]: [string, any]) => info.gateway && info.gateway.trim())
        .map(([outlet, info]: [string, any]) => `배출구${outlet}-게이트웨이${info.gateway}`);
      gatewayString = gatewayEntries.join(', ');
    }

    // 두 개의 업데이트 수행
    const updates = [];

    // 1. C열 (상태) - 게이트웨이 정보 업데이트
    if (gatewayString) {
      updates.push(
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!C${targetRowIndex}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[gatewayString]],
          },
        })
      );
    }

    // 2. I~Q열 - 시설 데이터 업데이트
    const updateValues = [
      [
        data.ph || 0,        // I열 (9번째)
        data.pressure || 0,  // J열 (10번째)
        data.temperature || 0, // K열 (11번째)
        data.dischargeCT || 0, // L열 (12번째)
        data.fan || 0,       // M열 (13번째) - 송풍
        data.pump || 0,      // N열 (14번째) - 펌프
        data.assistCT || 0,  // O열 (15번째) - 보조CT
        data.wired || 0,     // P열 (16번째) - 유선
        data.wireless || 0   // Q열 (17번째) - 무선
      ]
    ];

    updates.push(
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!I${targetRowIndex}:Q${targetRowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: updateValues,
        },
      })
    );

    // 모든 업데이트 동시 수행
    const updateResponses = await Promise.all(updates);

    console.log(`📊 [FACILITY-UPDATE] ✅ 업데이트 완료:`, {
      gatewayInfo: gatewayString,
      facilityData: updateValues[0]
    });

    return NextResponse.json({
      success: true,
      message: '시설 데이터와 게이트웨이 정보가 구글시트에 업데이트되었습니다.',
      updatedRow: targetRowIndex,
      gatewayInfo: gatewayString,
      facilityData: updateValues[0]
    });

  } catch (error) {
    console.error(`📊 [FACILITY-UPDATE] ❌ 오류 발생:`, error);
    
    let errorMessage = '시설 데이터 업데이트 실패';
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