// lib/google-client.ts - 빌드 안전 Google API 클라이언트
import { google } from 'googleapis';

// 캐시된 클라이언트
let cachedAuth: any = null;
let cachedSheets: any = null;
let cachedDrive: any = null;

// 환경변수 처리 (런타임에만 실행)
function getGoogleCredentials() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    console.warn('🔴 [GOOGLE-CLIENT] Google API 환경변수가 설정되지 않았습니다.');
    return null;
  }

  try {
    // JSON 파싱이 필요한 경우 (따옴표로 감싸진 경우)
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = JSON.parse(privateKey);
    }

    // 이스케이프된 개행 문자를 실제 개행으로 변환
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    return { clientEmail, privateKey };
  } catch (error) {
    console.error('🔴 [GOOGLE-CLIENT] Private key 처리 중 오류:', error);
    return null;
  }
}

// 인증 객체 생성 (런타임에만 실행)
function createGoogleAuth() {
  if (cachedAuth) {
    return cachedAuth;
  }

  const credentials = getGoogleCredentials();
  if (!credentials) {
    throw new Error('Google API 환경변수가 설정되지 않았습니다.');
  }

  try {
    cachedAuth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.clientEmail,
        private_key: credentials.privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    console.log('✅ [GOOGLE-CLIENT] 인증 객체 생성 성공');
    return cachedAuth;
  } catch (error) {
    console.error('🔴 [GOOGLE-CLIENT] 인증 객체 생성 실패:', error);
    throw new Error(`Google Auth 초기화 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Sheets 클라이언트 생성 (런타임에만 실행)
export function getSheets() {
  if (cachedSheets) {
    return cachedSheets;
  }

  try {
    const auth = createGoogleAuth();
    cachedSheets = google.sheets({
      version: 'v4',
      auth,
      timeout: 10000, // 10초 타임아웃
    });

    console.log('✅ [GOOGLE-CLIENT] Sheets 클라이언트 생성 성공');
    return cachedSheets;
  } catch (error) {
    console.error('🔴 [GOOGLE-CLIENT] Sheets 클라이언트 생성 실패:', error);
    throw error;
  }
}

// Drive 클라이언트 생성 (런타임에만 실행)
export function getDrive() {
  if (cachedDrive) {
    return cachedDrive;
  }

  try {
    const auth = createGoogleAuth();
    cachedDrive = google.drive({
      version: 'v3',
      auth,
      timeout: 15000, // 15초 타임아웃 (파일 업로드용)
    });

    console.log('✅ [GOOGLE-CLIENT] Drive 클라이언트 생성 성공');
    return cachedDrive;
  } catch (error) {
    console.error('🔴 [GOOGLE-CLIENT] Drive 클라이언트 생성 실패:', error);
    throw error;
  }
}

// 레거시 호환성을 위한 기본 export (런타임에 초기화)
export const sheets = new Proxy({} as any, {
  get(target, prop) {
    const sheetsClient = getSheets();
    return sheetsClient[prop];
  }
});

export const drive = new Proxy({} as any, {
  get(target, prop) {
    const driveClient = getDrive();
    return driveClient[prop];
  }
});

// 재사용 가능한 클라이언트 생성 함수들
export async function createOptimizedDriveClient() {
  return getDrive();
}

export async function createOptimizedSheetsClient() {
  return getSheets();
}

// 헬스 체크 함수
export function isGoogleClientAvailable(): boolean {
  try {
    const credentials = getGoogleCredentials();
    return !!credentials;
  } catch {
    return false;
  }
}