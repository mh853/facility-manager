// lib/google-auth-alternative.ts - 대안 Google 인증 방법
import { google } from 'googleapis';

// 대안 1: 환경변수를 JSON으로 처리
export function createGoogleAuthFromEnv() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  
  if (!clientEmail || !privateKey) {
    throw new Error('Google 인증 환경변수가 누락되었습니다');
  }

  // 여러 방법으로 private key 처리 시도
  let processedKey = privateKey;
  
  try {
    // 1. JSON 문자열로 감싸져 있는 경우
    if (processedKey.startsWith('"') && processedKey.endsWith('"')) {
      processedKey = JSON.parse(processedKey);
    }
    
    // 2. 이스케이프 문자 처리
    processedKey = processedKey.replace(/\\n/g, '\n');
    
    // 3. Base64 인코딩된 경우
    if (!processedKey.includes('-----BEGIN PRIVATE KEY-----')) {
      const decoded = Buffer.from(processedKey, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN PRIVATE KEY-----')) {
        processedKey = decoded;
      }
    }
    
    console.log('🔍 [AUTH-ALT] Private key 처리 결과:', {
      hasBegin: processedKey.includes('-----BEGIN'),
      hasEnd: processedKey.includes('-----END'),
      length: processedKey.length
    });
    
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: processedKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });
  } catch (error) {
    console.error('🔴 [AUTH-ALT] 인증 생성 실패:', error);
    throw error;
  }
}

// 대안 2: Service Account JSON 전체를 환경변수로 처리
export function createGoogleAuthFromJSON() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON 환경변수가 필요합니다');
  }
  
  try {
    const credentials = JSON.parse(serviceAccountJson);
    
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });
  } catch (error) {
    console.error('🔴 [AUTH-JSON] JSON 파싱 실패:', error);
    throw error;
  }
}

// 대안 3: 단계별 디버깅을 통한 인증
export function createGoogleAuthWithDebug() {
  console.log('🔍 [AUTH-DEBUG] 환경변수 확인 시작');
  
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  
  console.log('🔍 [AUTH-DEBUG] 환경변수 상태:', {
    hasEmail: !!clientEmail,
    hasKey: !!privateKeyRaw,
    keyLength: privateKeyRaw?.length || 0,
    keyStart: privateKeyRaw?.substring(0, 30) || 'N/A'
  });
  
  if (!clientEmail || !privateKeyRaw) {
    throw new Error('필수 환경변수 누락');
  }
  
  // 단계별 키 처리
  let privateKey = privateKeyRaw;
  
  console.log('🔍 [AUTH-DEBUG] Step 1 - JSON 파싱 확인');
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    try {
      privateKey = JSON.parse(privateKey);
      console.log('✅ [AUTH-DEBUG] JSON 파싱 성공');
    } catch (e) {
      console.error('🔴 [AUTH-DEBUG] JSON 파싱 실패:', e);
    }
  }
  
  console.log('🔍 [AUTH-DEBUG] Step 2 - 개행 문자 처리');
  privateKey = privateKey.replace(/\\n/g, '\n');
  
  console.log('🔍 [AUTH-DEBUG] Step 3 - 키 형식 확인');
  console.log('🔍 [AUTH-DEBUG] 처리된 키 정보:', {
    hasBegin: privateKey.includes('-----BEGIN PRIVATE KEY-----'),
    hasEnd: privateKey.includes('-----END PRIVATE KEY-----'),
    lines: privateKey.split('\n').length,
    firstLine: privateKey.split('\n')[0],
    lastLine: privateKey.split('\n').slice(-2)[0]
  });
  
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
    console.error('🔴 [AUTH-DEBUG] Private key 형식이 올바르지 않습니다');
    throw new Error('Private key 형식 오류');
  }
  
  console.log('🔍 [AUTH-DEBUG] Step 4 - Google Auth 객체 생성');
  try {
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
    
    console.log('✅ [AUTH-DEBUG] Google Auth 객체 생성 성공');
    return auth;
  } catch (error) {
    console.error('🔴 [AUTH-DEBUG] Google Auth 생성 실패:', error);
    throw error;
  }
}