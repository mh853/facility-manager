// app/api/install-info/route.ts
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

// 시스템 설정
const SYSTEM_CONFIG = {
  completion: {
    sheetName: '설치 후 사진'
  },
  presurvey: {
    sheetName: '설치 전 실사'
  }
};

export async function POST(request: NextRequest) {
  try {
    console.log('💾 설치 정보 저장 시작...');

    const body = await request.json();
    const { 
      businessName, 
      installer, 
      contact, 
      installDate, 
      type = 'completion' 
    } = body;

    if (!businessName || !installer) {
      return NextResponse.json(
        { success: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const config = SYSTEM_CONFIG[type as keyof typeof SYSTEM_CONFIG];
    console.log(`📋 시트 업데이트: ${config.sheetName}, 사업장: ${businessName}`);

    // 연락처 형식 정리
    const formattedContact = formatPhoneNumber(contact || '');

    const success = await saveInstallInfo(
      businessName,
      installer,
      formattedContact,
      installDate,
      config.sheetName
    );

    if (success) {
      console.log(`✅ 설치 정보 저장 완료: ${businessName}`);
      return NextResponse.json({
        success: true,
        message: '설치 정보가 성공적으로 저장되었습니다.',
        data: {
          businessName,
          installer,
          contact: formattedContact,
          installDate
        }
      });
    } else {
      throw new Error('시트 업데이트에 실패했습니다.');
    }

  } catch (error) {
    console.error('❌ 설치 정보 저장 실패:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '설치 정보 저장 실패' 
      },
      { status: 500 }
    );
  }
}

async function saveInstallInfo(
  businessName: string,
  installer: string,
  contact: string,
  installDate: string,
  sheetName: string
): Promise<boolean> {
  try {
    // 시트에서 해당 사업장 행 찾기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.PERMIT_SHEET_ID,
      range: `${sheetName}!A:H`, // A부터 H열까지 (설치일까지)
    });

    const values = response.data.values || [];
    
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
      return false;
    }

    console.log(`📝 업데이트 대상 행: ${targetRow}`);

    // 해당 행의 F, G, H 열 업데이트 (설치담당자, 연락처, 설치일)
    const updates = [
      {
        range: `${sheetName}!F${targetRow}`,
        values: [[installer]]
      },
      {
        range: `${sheetName}!G${targetRow}`,
        values: [[contact]]
      },
      {
        range: `${sheetName}!H${targetRow}`,
        values: [[installDate]]
      }
    ];

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.PERMIT_SHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates
      }
    });

    console.log(`✅ 시트 업데이트 완료: ${sheetName} 행 ${targetRow}`);
    return true;

  } catch (error) {
    console.error('❌ 시트 업데이트 실패:', error);
    return false;
  }
}

function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  const cleaned = phone.replace(/[^\d]/g, '');
  
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  
  return phone; // 형식이 맞지 않으면 원본 반환
}