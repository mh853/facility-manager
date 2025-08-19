// app/api/health/route.ts - 헬스체크 및 환경 변수 검증
import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

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
    
    const health = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      region: process.env.VERCEL_REGION || 'local',
      checks: {
        envVars: {
          status: missingEnvVars.length === 0 ? 'pass' : 'fail',
          required: requiredEnvVars.length,
          missing: missingEnvVars.length,
          ...(missingEnvVars.length > 0 && { missingVars: missingEnvVars })
        },
        googleAuth: {
          status: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ? 'pass' : 'fail'
        },
        spreadsheets: {
          main: !!process.env.MAIN_SPREADSHEET_ID,
          upload: !!process.env.UPLOAD_SPREADSHEET_ID,
          dataCollection: !!process.env.DATA_COLLECTION_SPREADSHEET_ID,
          completion: !!process.env.COMPLETION_SPREADSHEET_ID
        },
        folders: {
          presurvey: !!process.env.PRESURVEY_FOLDER_ID,
          completion: !!process.env.COMPLETION_FOLDER_ID
        }
      }
    };

    return createSuccessResponse(health);
  } catch (error) {
    return createErrorResponse(
      '헬스체크 실패',
      500,
      error instanceof Error ? error.message : '알 수 없는 오류'
    );
  }
}