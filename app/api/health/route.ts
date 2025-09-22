// app/api/health/route.ts - 헬스체크 및 환경 변수 검증 (Vercel 최적화)
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(request: NextRequest) {
  try {
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    // Google API 연결 테스트
    let googleApiStatus = 'unknown';
    let googleApiError = null;
    let privateKeyInfo = null;
    
    try {
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
      
      // 환경변수 상세 정보
      privateKeyInfo = {
        hasEmail: !!clientEmail,
        hasKey: !!privateKey,
        emailLength: clientEmail?.length || 0,
        keyLength: privateKey?.length || 0,
        keyStart: privateKey?.substring(0, 30) || 'N/A',
        keyFormat: privateKey?.includes('-----BEGIN PRIVATE KEY-----') ? 'PEM' : 
                  privateKey?.startsWith('"') ? 'JSON-wrapped' : 
                  privateKey && !privateKey.includes('\n') ? 'possible-base64' : 'unknown'
      };
      
      if (!clientEmail || !privateKey) {
        throw new Error(`Missing credentials: email=${!!clientEmail}, key=${!!privateKey}`);
      }
      
      // Google Client 연결 테스트
      const { google } = await import('googleapis');
      
      let processedKey = privateKey;
      
      // Private key 처리
      if (processedKey.startsWith('"') && processedKey.endsWith('"')) {
        processedKey = JSON.parse(processedKey);
      }
      processedKey = processedKey.replace(/\\n/g, '\n');
      
      // Base64 디코딩 시도
      if (!processedKey.includes('-----BEGIN PRIVATE KEY-----')) {
        try {
          const decoded = Buffer.from(processedKey, 'base64').toString('utf8');
          if (decoded.includes('-----BEGIN PRIVATE KEY-----')) {
            processedKey = decoded;
          }
        } catch (e) {
          // Base64 디코딩 실패해도 계속 진행
        }
      }
      
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: processedKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      
      const drive = google.drive({ version: 'v3', auth });
      
      // 간단한 API 호출로 연결 테스트 (타임아웃 10초)
      const testPromise = drive.about.get({ fields: 'user' });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API timeout (10s)')), 10000)
      );
      
      await Promise.race([testPromise, timeoutPromise]);
      googleApiStatus = 'connected';
      console.log('✅ [HEALTH] Google API 연결 성공');
      
    } catch (error) {
      googleApiStatus = 'failed';
      googleApiError = error instanceof Error ? error.message : 'Unknown error';
      console.error('🔴 [HEALTH] Google API 연결 실패:', error);
    }
    
    const health = {
      status: missingEnvVars.length === 0 && googleApiStatus === 'connected' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      region: process.env.VERCEL_REGION || 'local',
      vercel: {
        deployment: process.env.VERCEL_URL || 'local',
        branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown'
      },
      checks: {
        envVars: {
          status: missingEnvVars.length === 0 ? 'pass' : 'fail',
          required: requiredEnvVars.length,
          missing: missingEnvVars.length,
          ...(missingEnvVars.length > 0 && { missingVars: missingEnvVars })
        },
        googleAuth: {
          status: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ? 'pass' : 'fail',
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 
            `${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.substring(0, 20)}...` : 'missing',
          privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ? 
            `${process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.length} chars` : 'missing'
        },
        googleApi: {
          status: googleApiStatus,
          ...(googleApiError && { error: googleApiError }),
          ...(privateKeyInfo && { keyInfo: privateKeyInfo })
        },
        spreadsheets: {
          status: requiredEnvVars.filter(v => v.includes('SPREADSHEET')).every(v => !!process.env[v]) ? 'pass' : 'fail',
          main: !!process.env.MAIN_SPREADSHEET_ID,
          upload: !!process.env.UPLOAD_SPREADSHEET_ID,
          dataCollection: !!process.env.DATA_COLLECTION_SPREADSHEET_ID,
          completion: !!process.env.COMPLETION_SPREADSHEET_ID
        },
        folders: {
          status: requiredEnvVars.filter(v => v.includes('FOLDER')).every(v => !!process.env[v]) ? 'pass' : 'fail',
          presurvey: !!process.env.PRESURVEY_FOLDER_ID,
          completion: !!process.env.COMPLETION_FOLDER_ID
        },
        uploadLimits: {
          maxFileSize: '10MB',
          maxTotalSize: '30MB',
          maxDuration: '60s',
          runtime: 'nodejs'
        }
      }
    };

    return NextResponse.json(health, { 
      status: health.status === 'healthy' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('🔴 [HEALTH] 헬스체크 실패:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        message: '헬스체크 실패',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  }
}