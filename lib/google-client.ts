// lib/google-client.ts - 최적화된 Google API 클라이언트
import { google } from 'googleapis';

// 환경변수 확인 (한 번만)
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

console.log('🔍 [GOOGLE-CLIENT] 환경변수 초기값:', {
  hasEmail: !!clientEmail,
  hasKey: !!privateKey,
  keyLength: privateKey?.length || 0,
  keyPreview: privateKey?.substring(0, 50) + '...'
});

// Vercel 환경에서 private key 처리 개선
if (privateKey) {
  try {
    // JSON 파싱이 필요한 경우 (따옴표로 감싸진 경우)
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = JSON.parse(privateKey);
      console.log('✅ [GOOGLE-CLIENT] JSON 파싱 완료');
    }
    
    // 이스케이프된 개행 문자를 실제 개행으로 변환
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // base64로 인코딩된 경우 처리
    if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.log('🔍 [GOOGLE-CLIENT] Base64 디코딩 시도');
      try {
        const decoded = Buffer.from(privateKey, 'base64').toString('utf8');
        if (decoded.includes('-----BEGIN PRIVATE KEY-----')) {
          privateKey = decoded;
          console.log('✅ [GOOGLE-CLIENT] Base64 디코딩 성공');
        }
      } catch (e) {
        console.error('🔴 [GOOGLE-CLIENT] Base64 디코딩 실패:', e);
      }
    }
    
    // 키 형식 최종 검증
    if (!privateKey || !privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
      console.error('🔴 [GOOGLE-CLIENT] Private key 형식이 올바르지 않습니다');
      console.error('🔴 [GOOGLE-CLIENT] Key 내용:', {
        startsWithBegin: privateKey?.includes('-----BEGIN') || false,
        endsWithEnd: privateKey?.includes('-----END') || false,
        hasPrivateKey: privateKey?.includes('PRIVATE KEY') || false,
        keyStart: privateKey?.substring(0, 100) || 'N/A'
      });
      privateKey = undefined;
    } else {
      console.log('✅ [GOOGLE-CLIENT] Private key 형식 검증 통과');
    }
  } catch (error) {
    console.error('🔴 [GOOGLE-CLIENT] Private key 처리 중 오류:', error);
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

// 단일 인스턴스 패턴으로 인증 객체 생성 - 대안 방법들 시도
let auth;
try {
  // 방법 1: 개선된 처리
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
  console.log('✅ [GOOGLE-CLIENT] 인증 객체 생성 성공 (방법 1)');
} catch (error) {
  console.error('🔴 [GOOGLE-CLIENT] 방법 1 실패:', error);
  
  // 방법 2: JSON 전체 환경변수 시도
  try {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      console.log('🔍 [GOOGLE-CLIENT] 방법 2 시도: JSON 환경변수');
      const credentials = JSON.parse(serviceAccountJson);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive',
        ],
      });
      console.log('✅ [GOOGLE-CLIENT] 인증 객체 생성 성공 (방법 2)');
    } else {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON도 없음');
    }
  } catch (error2) {
    console.error('🔴 [GOOGLE-CLIENT] 방법 2도 실패:', error2);
    
    // 방법 3: 원본 키로 재시도
    try {
      console.log('🔍 [GOOGLE-CLIENT] 방법 3 시도: 원본 키 사용');
      const originalKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
      if (originalKey) {
        auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: clientEmail,
            private_key: originalKey.replace(/\\n/g, '\n'),
          },
          scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive',
          ],
        });
        console.log('✅ [GOOGLE-CLIENT] 인증 객체 생성 성공 (방법 3)');
      } else {
        throw new Error('원본 키도 없음');
      }
    } catch (error3) {
      console.error('🔴 [GOOGLE-CLIENT] 모든 방법 실패:', error3);
      throw new Error(`Google Auth 초기화 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
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
