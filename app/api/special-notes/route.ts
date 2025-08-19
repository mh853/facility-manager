import { NextRequest, NextResponse } from 'next/server';
import { sheets } from '@/lib/google-client';

export async function POST(request: NextRequest) {
  try {
    console.log('📝 [SPECIAL-NOTES] 특이사항 저장 시작...');
    
    const body = await request.json();
    const { businessName, specialNotes, systemType } = body;

    console.log('📝 [SPECIAL-NOTES] 요청 데이터:', { 
      businessName, 
      notesLength: specialNotes?.length || 0,
      systemType 
    });

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
      console.error(`❌ ${envVarName}가 설정되지 않음`);
      return NextResponse.json(
        { success: false, message: `${envVarName}가 설정되지 않았습니다.` },
        { status: 500 }
      );
    }

    console.log('📝 [SPECIAL-NOTES] 사업장 행 검색 중:', businessName);

    // 전체 시트 데이터 읽기 (B열에서 사업장명 찾기)
    const range = `'${sheetName}'!A:H`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    console.log('📝 [SPECIAL-NOTES] 총 행 수:', rows.length);

    // 사업장명으로 행 찾기 (B열)
    let targetRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] && row[1].toString().trim() === businessName.trim()) {
        targetRowIndex = i + 1; // 시트는 1부터 시작
        console.log('📝 [SPECIAL-NOTES] 사업장 발견:', `행 ${targetRowIndex}`);
        break;
      }
    }

    if (targetRowIndex === -1) {
      return NextResponse.json(
        { success: false, message: `"${businessName}" 사업장을 찾을 수 없습니다.` },
        { status: 404 }
      );
    }

    // E열(특이사항)만 업데이트
    const updateRange = `'${sheetName}'!E${targetRowIndex}`;
    const updateValues = [[specialNotes || '']];

    console.log('📝 [SPECIAL-NOTES] 업데이트할 데이터:', { 
      range: updateRange, 
      value: specialNotes 
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: updateValues,
      },
    });

    console.log('📝 [SPECIAL-NOTES] ✅ 저장 완료 (E열 업데이트)');

    return NextResponse.json({
      success: true,
      message: '특이사항이 저장되었습니다.',
      data: {
        rowIndex: targetRowIndex,
        businessName,
        specialNotes: specialNotes || ''
      }
    });

  } catch (error) {
    console.error('📝 [SPECIAL-NOTES] ❌ 저장 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '특이사항 저장 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
