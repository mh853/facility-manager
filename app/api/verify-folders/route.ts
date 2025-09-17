// app/api/verify-folders/route.ts - Google Drive 폴더 검증 API
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [VERIFY] Starting folder verification');
    
    // 환경변수 확인
    const folderIds = {
      presurvey: process.env.PRESURVEY_FOLDER_ID,
      completion: process.env.COMPLETION_FOLDER_ID
    };
    
    console.log('📋 [VERIFY] Environment variables:', {
      presurvey: folderIds.presurvey ? `${folderIds.presurvey.substring(0, 10)}...` : 'MISSING',
      completion: folderIds.completion ? `${folderIds.completion.substring(0, 10)}...` : 'MISSING'
    });
    
    if (!folderIds.presurvey || !folderIds.completion) {
      return NextResponse.json({
        success: false,
        message: 'Missing folder environment variables',
        details: {
          presurvey: !!folderIds.presurvey,
          completion: !!folderIds.completion
        }
      }, { status: 400 });
    }
    
    // Google Drive 클라이언트 생성
    const { google } = await import('googleapis');
    
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    
    if (!clientEmail || !rawPrivateKey) {
      throw new Error('Google API credentials missing');
    }
    
    // Private Key 처리
    let privateKey = rawPrivateKey;
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = JSON.parse(privateKey);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    // 각 폴더 검증
    const verificationResults: Record<string, any> = {};
    
    for (const [folderType, folderId] of Object.entries(folderIds)) {
      try {
        console.log(`🔍 [VERIFY] Checking ${folderType} folder: ${folderId}`);
        
        const folderInfo = await drive.files.get({
          fileId: folderId,
          fields: 'id, name, mimeType, trashed, permissions, parents, capabilities'
        });
        
        // 권한 확인
        const permissions = await drive.permissions.list({
          fileId: folderId,
          fields: 'permissions(id, type, role, emailAddress)'
        });
        
        verificationResults[folderType] = {
          status: 'accessible',
          info: {
            id: folderInfo.data.id,
            name: folderInfo.data.name,
            mimeType: folderInfo.data.mimeType,
            trashed: folderInfo.data.trashed,
            parents: folderInfo.data.parents,
            capabilities: folderInfo.data.capabilities
          },
          permissions: permissions.data.permissions?.map(p => ({
            type: p.type,
            role: p.role,
            emailAddress: p.emailAddress
          })) || [],
          serviceAccountAccess: permissions.data.permissions?.some(p => 
            p.emailAddress === clientEmail || p.type === 'anyone'
          ) || false
        };
        
        console.log(`✅ [VERIFY] ${folderType} folder accessible:`, folderInfo.data.name);
        
      } catch (error) {
        console.error(`❌ [VERIFY] ${folderType} folder error:`, error);
        
        verificationResults[folderType] = {
          status: 'error',
          error: {
            message: error instanceof Error ? error.message : String(error),
            code: (error as any)?.code || 'unknown'
          }
        };
      }
    }
    
    // 결과 정리
    const allAccessible = Object.values(verificationResults).every(result => result.status === 'accessible');
    
    return NextResponse.json({
      success: allAccessible,
      message: allAccessible ? 'All folders accessible' : 'Some folders have issues',
      serviceAccount: clientEmail,
      folders: verificationResults,
      recommendations: generateRecommendations(verificationResults, clientEmail)
    });
    
  } catch (error) {
    console.error('❌ [VERIFY] Verification failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Folder verification failed',
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : 'UnknownError'
      }
    }, { status: 500 });
  }
}

function generateRecommendations(results: any, serviceAccount: string): string[] {
  const recommendations = [];
  
  for (const [folderType, result] of Object.entries(results)) {
    const resultData = result as any;
    if (resultData.status === 'error') {
      if (resultData.error.message.includes('not found') || resultData.error.code === 404) {
        recommendations.push(`❌ ${folderType.toUpperCase()}_FOLDER_ID가 잘못되었습니다. 올바른 Google Drive 폴더 ID를 확인하세요.`);
      } else if (resultData.error.message.includes('permission') || resultData.error.code === 403) {
        recommendations.push(`🔐 ${folderType} 폴더에 Service Account(${serviceAccount}) 권한이 없습니다. 폴더를 공유하세요.`);
      } else {
        recommendations.push(`⚠️ ${folderType} 폴더 접근 오류: ${resultData.error.message}`);
      }
    } else if (resultData.status === 'accessible' && !resultData.serviceAccountAccess) {
      recommendations.push(`⚠️ ${folderType} 폴더에 Service Account 권한이 명시적으로 설정되지 않았습니다. 편집자 권한으로 공유를 권장합니다.`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ 모든 폴더가 올바르게 설정되었습니다!');
  }
  
  return recommendations;
}