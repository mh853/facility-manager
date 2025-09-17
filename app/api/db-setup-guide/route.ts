import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // SQL 파일 읽기
    const sqlFilePath = path.join(process.cwd(), 'sql', '01_users_schema.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    const setupInstructions = {
      message: "데이터베이스 스키마 수동 설정이 필요합니다",
      instructions: [
        "1. Supabase 대시보드에 로그인하세요",
        "2. 프로젝트: qdfqoykhmuiambtrrlnf 선택",
        "3. SQL Editor 메뉴로 이동",
        "4. 아래 SQL 스크립트를 복사하여 실행하세요",
        "5. 실행 완료 후 /api/test-db를 호출하여 확인하세요"
      ],
      supabaseUrl: "https://supabase.com/dashboard/project/qdfqoykhmuiambtrrlnf",
      sqlScript: sqlContent,
      testEndpoint: "/api/test-db",
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(setupInstructions);

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}