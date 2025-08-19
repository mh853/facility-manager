// lib/google-client.ts - 최적화된 Google API 클라이언트
import { google } from 'googleapis';

// 환경변수 확인 (한 번만)
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

// Vercel 환경에서 private key 처리 개선
if (privateKey) {
  // 이스케이프된 개행 문자를 실제 개행으로 변환
  privateKey = privateKey.replace(/\\n/g, '\n');
  
  // 만약 base64로 인코딩되어 있다면 디코딩
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    try {
      privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
    } catch (e) {
      console.error('🔴 [GOOGLE-CLIENT] Base64 디코딩 실패:', e);
    }
  }
  
  // 키 형식 검증
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
    console.error('🔴 [GOOGLE-CLIENT] Private key 형식이 올바르지 않습니다');
    privateKey = undefined;
  }
}

if (!clientEmail || !privateKey) {
  console.error('🔴 [GOOGLE-CLIENT] 환경변수 누락:', {
    hasEmail: !!clientEmail,
    hasKey: !!privateKey,
    keyLength: privateKey?.length || 0
  });
  throw new Error(`Google API 환경변수가 설정되지 않았습니다. Email: ${!!clientEmail}, Key: ${!!privateKey}`);
}

// 단일 인스턴스 패턴으로 인증 객체 생성
let auth;
try {
  auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  console.log('✅ [GOOGLE-CLIENT] 인증 객체 생성 성공');
} catch (error) {
  console.error('🔴 [GOOGLE-CLIENT] 인증 객체 생성 실패:', error);
  throw new Error(`Google Auth 초기화 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

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
