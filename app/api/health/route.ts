// app/api/health/route.ts - 헬스체크 및 환경 변수 검증 (Vercel 최적화)
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const requiredEnvVars = [
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
      'MAIN_SPREADSHEET_ID',
      'UPLOAD_SPREADSHEET_ID',
      'DATA_COLLECTION_SPREADSHEET_ID',
      'COMPLETION_SPREADSHEET_ID',
      'PRESURVEY_FOLDER_ID',
      'COMPLETION_FOLDER_ID'
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    // Google API 연결 테스트
    let googleApiStatus = 'unknown';
    let googleApiError = null;
    
    try {
      // Google Client 연결 테스트
      const { createOptimizedDriveClient } = await import('@/lib/google-client');
      const drive = await createOptimizedDriveClient();
      
      // 간단한 API 호출로 연결 테스트 (타임아웃 5초)
      const testPromise = drive.about.get({ fields: 'user' });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API timeout')), 5000)
      );
      
      await Promise.race([testPromise, timeoutPromise]);
      googleApiStatus = 'connected';
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
          ...(googleApiError && { error: googleApiError })
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