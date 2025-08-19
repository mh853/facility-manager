// lib/google-client.ts - 최적화된 Google API 클라이언트
import { google } from 'googleapis';

// 환경변수 확인 (한 번만)
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!clientEmail || !privateKey) {
  console.error('🔴 [GOOGLE-CLIENT] 환경변수 누락:', {
    hasEmail: !!clientEmail,
    hasKey: !!privateKey,
    keyLength: privateKey?.length || 0
  });
  throw new Error(`Google API 환경변수가 설정되지 않았습니다. Email: ${!!clientEmail}, Key: ${!!privateKey}`);
}

// 단일 인스턴스 패턴으로 인증 객체 생성
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
});

// 클라이언트 캐싱 및 연결 풀링
export const sheets = google.sheets({ 
  version: 'v4', 
  auth,
  timeout: 10000, // 10초 타임아웃
});

export const drive = google.drive({ 
  version: 'v3', 
  auth,
  timeout: 15000, // 15초 타임아웃 (파일 업로드용)
});

console.log('✅ [GOOGLE-CLIENT] 클라이언트 초기화 완료:', {
  hasSheets: !!sheets,
  hasDrive: !!drive,
  clientEmail: clientEmail?.substring(0, 20) + '...'
});

// 재사용 가능한 Drive 클라이언트 생성 함수
export async function createOptimizedDriveClient() {
  return drive;
}

// 재사용 가능한 Sheets 클라이언트 생성 함수
export async function createOptimizedSheetsClient() {
  return sheets;
}
