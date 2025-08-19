import { NextRequest, NextResponse } from 'next/server';
import { sheets } from '@/lib/google-client';

// 구글시트와 시스템 간 양방향 동기화 API
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const businessName = url.searchParams.get('businessName');
    const systemType = url.searchParams.get('systemType') || 'presurvey';
    
    console.log('🔄 [SYNC] 동기화 데이터 조회 시작...', { businessName, systemType });
    
    if (!businessName) {
      return NextResponse.json(
        { success: false, message: '사업장명이 필요합니다.' },
        { status: 400 }
      );
    }

    // systemType에 따라 다른 시트 사용
    const spreadsheetId = systemType === 'completion' 
      ? process.env.COMPLETION_SPREADSHEET_ID 
      : process.env.DATA_COLLECTION_SPREADSHEET_ID;
    const sheetName = systemType === 'completion' ? '설치 후 사진' : '설치 전 실사';
    
    if (!spreadsheetId) {
      const envVarName = systemType === 'completion' ? 'COMPLETION_SPREADSHEET_ID' : 'DATA_COLLECTION_SPREADSHEET_ID';
      console.error(`🔄 [SYNC] ❌ ${envVarName}가 설정되지 않음`);
      return NextResponse.json(
        { success: false, message: `${envVarName}가 설정되지 않았습니다.` },
        { status: 500 }
      );
    }

    console.log('🔄 [SYNC] 사용할 시트:', { spreadsheetId, sheetName });

    // 해당 시트에서 사업장 데이터 조회
    const range = `'${sheetName}'!A:H`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    
    // 사업장명으로 행 찾기
    let businessData = null;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] && row[1].toString().trim() === businessName.trim()) {
        businessData = {
          rowIndex: i + 1,
          번호: row[0] || '',
          사업장명: row[1] || '',
          상태: row[2] || '',
          URL: row[3] || '',
          특이사항: row[4] || '',
          설치담당자: row[5] || '',
          연락처: row[6] || '',
          설치일: row[7] || '',
          lastUpdated: new Date().toISOString()
        };
        break;
      }
    }

    if (!businessData) {
      return NextResponse.json(
        { success: false, message: `"${businessName}" 사업장 데이터를 찾을 수 없습니다.` },
        { status: 404 }
      );
    }

    console.log('🔄 [SYNC] 동기화 데이터 조회 완료:', businessData);

    return NextResponse.json({
      success: true,
      data: businessData,
      message: '동기화 데이터 조회 완료'
    });

  } catch (error) {
    console.error('🔄 [SYNC] ❌ 동기화 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '동기화 데이터 조회 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

// 시스템에서 구글시트로 데이터 업데이트 (A, B열 보호)
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [SYNC] 시스템 → 구글시트 동기화 시작...');
    
    const body = await request.json();
    const { businessName, updateData, systemType } = body;

    console.log('🔄 [SYNC] POST 요청 데이터:', { businessName, updateData, systemType });

    if (!businessName || !updateData) {
      return NextResponse.json(
        { success: false, message: '사업장명과 업데이트 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 연락처 형식 검증 함수
    const formatPhoneNumber = (phone: string): string => {
      if (!phone) return '';
      const numbers = phone.replace(/[^0-9]/g, '');
      if (numbers.length === 11 && numbers.startsWith('010')) {
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
      }
      return phone;
    };

    // systemType에 따라 다른 시트 사용
    const spreadsheetId = systemType === 'completion' 
      ? process.env.COMPLETION_SPREADSHEET_ID 
      : process.env.DATA_COLLECTION_SPREADSHEET_ID;
    const sheetName = systemType === 'completion' ? '설치 후 사진' : '설치 전 실사';
    
    console.log('🔄 [SYNC] POST 사용할 시트:', { spreadsheetId, sheetName, systemType });

    if (!spreadsheetId) {
      const envVarName = systemType === 'completion' ? 'COMPLETION_SPREADSHEET_ID' : 'DATA_COLLECTION_SPREADSHEET_ID';
      console.error(`🔄 [SYNC] ❌ ${envVarName}가 설정되지 않음`);
      return NextResponse.json(
        { success: false, message: `${envVarName}가 설정되지 않았습니다.` },
        { status: 500 }
      );
    }
    
    // 해당 사업장 행 찾기
    const range = `'${sheetName}'!A:H`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    let targetRowIndex = -1;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] && row[1].toString().trim() === businessName.trim()) {
        targetRowIndex = i + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return NextResponse.json(
        { success: false, message: `"${businessName}" 사업장을 찾을 수 없습니다.` },
        { status: 404 }
      );
    }

    // 현재 행 데이터 가져오기
    const currentRow = rows[targetRowIndex - 1] || [];
    
    // 연락처 포맷팅 적용
    const formattedContact = updateData.연락처 ? formatPhoneNumber(updateData.연락처) : (currentRow[6] || '');
    
    // ⚠️ A, B열 완전 보호 - 절대 수정하지 않음, C열부터 H열까지만 업데이트
    // C열에는 업로드 로그 추가 (기존 상태에 로그 추가)
    let newStatus = currentRow[2] || '';
    if (updateData.uploadLog) {
      const timestamp = new Date().toLocaleString('ko-KR');
      const logEntry = `[${timestamp}] ${updateData.uploadLog}`;
      newStatus = newStatus ? `${newStatus}\n${logEntry}` : logEntry;
    } else if (updateData.상태) {
      newStatus = updateData.상태;
    }
    
    // C열부터 H열까지만 업데이트 (A, B열 완전 보호)
    const updateRange = `'${sheetName}'!C${targetRowIndex}:H${targetRowIndex}`;
    const updatedRow = [
      newStatus,                                              // C열: 상태 (업로드 로그 포함)
      updateData.URL || currentRow[3] || '',                  // D열: URL
      updateData.특이사항 || currentRow[4] || '',               // E열: 특이사항
      updateData.설치담당자 || currentRow[5] || '',              // F열: 설치담당자
      formattedContact,                                       // G열: 연락처 (포맷팅됨)
      updateData.설치일 || currentRow[7] || ''                 // H열: 설치일
    ];

    console.log('🔄 [SYNC] ⚠️ A, B열 완전 보호 - 수정하지 않음');
    console.log('🔄 [SYNC] 포맷된 연락처:', formattedContact);
    console.log('🔄 [SYNC] 업데이트할 데이터 (C~H열):', updatedRow);

    // C열부터 H열까지만 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [updatedRow],
      },
    });

    console.log('🔄 [SYNC] ✅ 시스템 → 구글시트 동기화 완료');

    return NextResponse.json({
      success: true,
      message: '구글시트가 업데이트되었습니다.',
      data: {
        rowIndex: targetRowIndex,
        updatedData: updatedRow
      }
    });

  } catch (error) {
    console.error('🔄 [SYNC] ❌ 동기화 업데이트 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '동기화 업데이트 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

// 전체 사업장 목록 조회 (구글시트 기준)
export async function PUT(request: NextRequest) {
  try {
    console.log('🔄 [SYNC] 전체 사업장 동기화 데이터 조회...');
    
    const url = new URL(request.url);
    const systemType = url.searchParams.get('systemType') || 'presurvey';
    
    console.log('🔄 [SYNC] PUT 요청:', { systemType });
    
    // systemType에 따라 다른 시트 사용
    const spreadsheetId = systemType === 'completion' 
      ? process.env.COMPLETION_SPREADSHEET_ID 
      : process.env.DATA_COLLECTION_SPREADSHEET_ID;
    const sheetName = systemType === 'completion' ? '설치 후 사진' : '설치 전 실사';
    
    console.log('🔄 [SYNC] PUT 사용할 시트:', { spreadsheetId, sheetName });

    if (!spreadsheetId) {
      const envVarName = systemType === 'completion' ? 'COMPLETION_SPREADSHEET_ID' : 'DATA_COLLECTION_SPREADSHEET_ID';
      console.error(`🔄 [SYNC] ❌ ${envVarName}가 설정되지 않음`);
      return NextResponse.json(
        { success: false, message: `${envVarName}가 설정되지 않았습니다.` },
        { status: 500 }
      );
    }
    
    const range = `'${sheetName}'!A:H`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    const businessList = [];

    // 헤더 제외하고 데이터 행만 처리
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[1]) { // B열에 사업장명이 있는 경우만
        businessList.push({
          rowIndex: i + 1,
          번호: row[0] || '',
          사업장명: row[1] || '',
          상태: row[2] || '',
          URL: row[3] || '',
          특이사항: row[4] || '',
          설치담당자: row[5] || '',
          연락처: row[6] || '',
          설치일: row[7] || ''
        });
      }
    }

    console.log('🔄 [SYNC] 전체 동기화 데이터 조회 완료:', businessList.length, '개 사업장');

    return NextResponse.json({
      success: true,
      data: businessList,
      totalCount: businessList.length,
      message: '전체 동기화 데이터 조회 완료'
    });

  } catch (error) {
    console.error('🔄 [SYNC] ❌ 전체 동기화 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '전체 동기화 데이터 조회 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
