// app/api/create-folders/route.ts - Google Drive 폴더 자동 생성 API
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🗂️ [CREATE-FOLDERS] 폴더 생성 시작');
    
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
    
    // 루트 폴더 생성
    console.log('📁 [CREATE-FOLDERS] 루트 폴더들 생성 중');
    
    const presurveyFolder = await drive.files.create({
      requestBody: {
        name: '설치전실사_업로드폴더',
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id, name'
    });
    
    const completionFolder = await drive.files.create({
      requestBody: {
        name: '설치후사진_업로드폴더', 
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id, name'
    });
    
    const presurveyFolderId = presurveyFolder.data.id!;
    const completionFolderId = completionFolder.data.id!;
    
    console.log('✅ [CREATE-FOLDERS] 루트 폴더 생성 완료:', {
      presurvey: { id: presurveyFolderId, name: presurveyFolder.data.name },
      completion: { id: completionFolderId, name: completionFolder.data.name }
    });
    
    // Service Account에 편집 권한 부여
    await Promise.all([
      drive.permissions.create({
        fileId: presurveyFolderId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: clientEmail
        }
      }),
      drive.permissions.create({
        fileId: completionFolderId,
        requestBody: {
          role: 'writer', 
          type: 'user',
          emailAddress: clientEmail
        }
      })
    ]);
    
    // 공개 읽기 권한도 추가 (선택사항)
    await Promise.all([
      drive.permissions.create({
        fileId: presurveyFolderId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      }),
      drive.permissions.create({
        fileId: completionFolderId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      })
    ]);
    
    console.log('🔐 [CREATE-FOLDERS] 권한 설정 완료');
    
    // 테스트 사업장 폴더 생성
    const testBusinessFolder = await drive.files.create({
      requestBody: {
        name: '테스트사업장',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [presurveyFolderId]
      },
      fields: 'id, name'
    });
    
    // 하위 폴더들 생성
    const subFolders = ['기본사진', '배출시설', '방지시설'];
    const testSubFolders = [];
    
    for (const folderName of subFolders) {
      const subFolder = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [testBusinessFolder.data.id!]
        },
        fields: 'id, name'
      });
      testSubFolders.push({ name: folderName, id: subFolder.data.id });
    }
    
    console.log('📂 [CREATE-FOLDERS] 테스트 폴더 구조 생성 완료');
    
    const result = {
      success: true,
      message: 'Google Drive 폴더 구조가 성공적으로 생성되었습니다',
      folders: {
        presurvey: {
          id: presurveyFolderId,
          name: presurveyFolder.data.name,
          url: `https://drive.google.com/drive/folders/${presurveyFolderId}`
        },
        completion: {
          id: completionFolderId,
          name: completionFolder.data.name,
          url: `https://drive.google.com/drive/folders/${completionFolderId}`
        }
      },
      testFolder: {
        id: testBusinessFolder.data.id,
        name: testBusinessFolder.data.name,
        subFolders: testSubFolders
      },
      envVariables: {
        PRESURVEY_FOLDER_ID: presurveyFolderId,
        COMPLETION_FOLDER_ID: completionFolderId
      },
      serviceAccount: clientEmail
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ [CREATE-FOLDERS] 폴더 생성 실패:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Folder creation failed',
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : 'UnknownError'
      }
    }, { status: 500 });
  }
}