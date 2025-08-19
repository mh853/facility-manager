// app/api/completion/route.ts - 한글 시트명 안전 처리 버전
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Google API 설정
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// 시스템 설정 - 안전한 시트명 처리
const SYSTEM_CONFIG = {
  completion: {
    sheetName: '설치 후 사진',
    sheetNameSafe: '설치 후 사진'  // 필요시 영문명으로 대체 가능
  },
  presurvey: {
    sheetName: '설치 전 실사',
    sheetNameSafe: '설치 전 실사'  // 필요시 영문명으로 대체 가능
  }
};

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 최종 완료 처리 시작...');

    const body = await request.json();
    const { 
      businessName, 
      memo = '', 
      type = 'completion' 
    } = body;

    if (!businessName) {
      return NextResponse.json(
        { success: false, message: '사업장명이 필요합니다.' },
        { status: 400 }
      );
    }

    const config = SYSTEM_CONFIG[type as keyof typeof SYSTEM_CONFIG];
    console.log(`🏁 완료 처리: ${config.sheetName}, 사업장: ${businessName}`);

    const success = await recordCompletion(businessName, memo, config.sheetName);

    if (success) {
      console.log(`✅ 완료 처리 성공: ${businessName}`);
      return NextResponse.json({
        success: true,
        message: `${type === 'presurvey' ? '실사' : '설치'} 작업이 성공적으로 완료되었습니다.`,
        data: {
          businessName,
          memo,
          completedAt: new Date().toISOString(),
          type
        }
      });
    } else {
      throw new Error('완료 처리 중 오류가 발생했습니다.');
    }

  } catch (error) {
    console.error('❌ 완료 처리 실패:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '완료 처리 실패' 
      },
      { status: 500 }
    );
  }
}

async function recordCompletion(
  businessName: string,
  memo: string,
  sheetName: string
): Promise<boolean> {
  try {
    // 안전한 시트명 처리: 따옴표로 감싸고 URL 인코딩
    const safeSheetName = `'${sheetName}'`;
    console.log(`🔒 안전한 시트명 사용: ${safeSheetName}`);
    
    // 시트에서 해당 사업장 행 찾기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.PERMIT_SHEET_ID || process.env.MAIN_SPREADSHEET_ID,
      range: `${safeSheetName}!A:I`, // A부터 I열까지 (특이사항까지)
    });

    const values = response.data.values || [];
    console.log(`📊 ${sheetName} 시트에서 ${values.length}개 행 확인`);
    
    // 사업장명으로 행 찾기 (B열)
    let targetRow = -1;
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[1] && row[1].toString().trim() === businessName) {
        targetRow = i + 1; // 1-based index
        break;
      }
    }

    if (targetRow === -1) {
      console.log(`⚠️ 사업장을 찾을 수 없음: ${businessName}`);
      
      // 디버그를 위해 B열의 모든 값 출력
      const businessListInSheet = values.slice(1).map(row => row[1]).filter(Boolean);
      console.log('🔍 시트의 사업장 목록:', businessListInSheet.slice(0, 5));
      
      return false;
    }

    console.log(`🎯 완료 처리 대상 행: ${targetRow}`);

    const currentTime = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul'
    });
    
    // C열: 상태, E열: 특이사항 업데이트
    const completionStatus = `✅ 최종 완료 (${currentTime})`;
    
    const updates = [
      {
        range: `${safeSheetName}!C${targetRow}`,
        values: [[completionStatus]]
      }
    ];

    // 메모가 있으면 E열(특이사항)에 추가
    if (memo.trim()) {
      updates.push({
        range: `${safeSheetName}!E${targetRow}`,
        values: [[memo.trim()]]
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.PERMIT_SHEET_ID || process.env.MAIN_SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates
      }
    });

    console.log(`✅ 완료 상태 업데이트 완료: ${sheetName} 행 ${targetRow}`);
    return true;

  } catch (error) {
    console.error('❌ 완료 처리 실패:', error);
    console.error('❌ 시트명:', sheetName);
    console.error('❌ 사업장명:', businessName);
    return false;
  }
}

// GET 메서드로 완료 상태 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessName = searchParams.get('businessName');
    const type = searchParams.get('type') || 'completion';

    if (!businessName) {
      return NextResponse.json(
        { success: false, message: '사업장명이 필요합니다.' },
        { status: 400 }
      );
    }

    const config = SYSTEM_CONFIG[type as keyof typeof SYSTEM_CONFIG];
    const status = await getCompletionStatus(businessName, config.sheetName);

    return NextResponse.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('❌ 완료 상태 조회 실패:', error);
    return NextResponse.json(
      { success: false, message: '완료 상태 조회 실패' },
      { status: 500 }
    );
  }
}

async function getCompletionStatus(businessName: string, sheetName: string) {
  try {
    const safeSheetName = `'${sheetName}'`;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.PERMIT_SHEET_ID || process.env.MAIN_SPREADSHEET_ID,
      range: `${safeSheetName}!A:I`,
    });

    const values = response.data.values || [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[1] && row[1].toString().trim() === businessName) {
        return {
          businessName,
          status: row[2] || '', // C열: 상태
          memo: row[4] || '', // E열: 특이사항
          installer: row[5] || '', // F열: 설치담당자
          contact: row[6] || '', // G열: 연락처
          installDate: row[7] || '', // H열: 설치일
          completed: (row[2] || '').includes('최종 완료'),
          rowIndex: i + 1
        };
      }
    }

    return {
      businessName,
      found: false,
      completed: false
    };

  } catch (error) {
    console.error('❌ 상태 조회 실패:', error);
    return {
      businessName,
      error: error instanceof Error ? error.message : 'Unknown error',
      completed: false
    };
  }
}
