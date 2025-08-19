import { NextRequest, NextResponse } from 'next/server';
import { sheets } from '@/lib/google-client';

export async function POST(request: NextRequest) {
  try {
    console.log('👤 [INSPECTOR] 실사자 정보 저장 시작...');
    
    const body = await request.json();
    const { businessName, inspectorInfo, systemType } = body;

    console.log('👤 [INSPECTOR] 요청 데이터:', { 
      businessName, 
      inspectorInfo,
      systemType 
    });

    if (!businessName) {
      return NextResponse.json(
        { success: false, message: '사업장명이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!inspectorInfo || !inspectorInfo.name) {
      return NextResponse.json(
        { success: false, message: '실사자 성명이 필요합니다.' },
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

    console.log('👤 [INSPECTOR] 사업장 행 검색 중:', businessName);

    // 전체 시트 데이터 읽기 (B열에서 사업장명 찾기)
    const range = `'${sheetName}'!A:H`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    console.log('👤 [INSPECTOR] 총 행 수:', rows.length);

    // 사업장명으로 행 찾기 (B열)
    let targetRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] && row[1].toString().trim() === businessName.trim()) {
        targetRowIndex = i + 1; // 시트는 1부터 시작
        console.log('👤 [INSPECTOR] 사업장 발견:', `행 ${targetRowIndex}`);
        break;
      }
    }

    if (targetRowIndex === -1) {
      return NextResponse.json(
        { success: false, message: `"${businessName}" 사업장을 찾을 수 없습니다.` },
        { status: 404 }
      );
    }

    // 연락처 형식 검증 (010-0000-0000)
    const formatPhoneNumber = (phone: string): string => {
      if (!phone) return '';
      
      // 숫자만 추출
      const numbers = phone.replace(/[^0-9]/g, '');
      
      // 010으로 시작하는 11자리 숫자 검증
      if (numbers.length === 11 && numbers.startsWith('010')) {
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
      }
      
      return phone; // 형식이 맞지 않으면 원본 반환
    };

    // 시설 정보 자동 입력 제거 (사용자 요청)

    // 업데이트할 데이터 준비
    // ⚠️ A, B열은 절대 수정하지 않음 - C열부터 H열까지만 업데이트
    const currentRow = rows[targetRowIndex - 1] || [];
    const siteUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/business/${encodeURIComponent(businessName)}`;
    const formattedContact = formatPhoneNumber(inspectorInfo.contact || '');
    
    // 상태는 기존값 유지 (자동 입력 제거)
    const currentStatus = currentRow[2] || '';
    
    // C열부터 H열까지만 업데이트 (A, B열 완전 보호)
    const updateRange = `'${sheetName}'!C${targetRowIndex}:H${targetRowIndex}`;
    const updateValues = [
      [
        currentStatus,           // C열: 상태 (기존값 유지)
        siteUrl,                 // D열: URL
        currentRow[4] || '',     // E열: 특이사항 (기존값 유지)
        inspectorInfo.name || '', // F열: 설치담당자 (실사자명)
        formattedContact,        // G열: 연락처 (형식 검증됨)
        inspectorInfo.date || '' // H열: 설치일
      ]
    ];

    console.log('👤 [INSPECTOR] 포맷된 연락처:', formattedContact);
    console.log('👤 [INSPECTOR] A, B열 완전 보호 - 수정하지 않음');
    console.log('👤 [INSPECTOR] 현재 상태 유지:', currentStatus);
    console.log('👤 [INSPECTOR] 업데이트할 데이터 (C~H열):', updateValues);

    // C열부터 H열까지만 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: updateValues,
      },
    });

    console.log('👤 [INSPECTOR] ✅ 저장 완료 (행 업데이트)');

    return NextResponse.json({
      success: true,
      message: '실사자 정보가 저장되었습니다.',
      data: {
        rowIndex: targetRowIndex,
        businessName,
        url: siteUrl
      }
    });

  } catch (error) {
    console.error('👤 [INSPECTOR] ❌ 저장 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '실사자 정보 저장 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
