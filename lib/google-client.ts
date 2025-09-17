import { google } from 'googleapis';

// Google API 클라이언트 설정
function createGoogleClient() {
  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!email || !privateKey) {
      console.error('Google 서비스 계정 정보가 누락되었습니다.');
      return null;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    return {
      auth,
      sheets: google.sheets({ version: 'v4', auth }),
      drive: google.drive({ version: 'v3', auth }),
    };
  } catch (error) {
    console.error('Google 클라이언트 생성 실패:', error);
    return null;
  }
}

// Google 클라이언트 인스턴스
const googleClient = createGoogleClient();

// Google Sheets API
export const sheets = googleClient?.sheets || null;

// Google Drive API
export const drive = googleClient?.drive || null;

// Google Auth
export const googleAuth = googleClient?.auth || null;

// 기본 내보내기
export default googleClient;

// Google API 상태 확인
export function isGoogleConfigured(): boolean {
  return !!googleClient;
}

// 스프레드시트 데이터 읽기 헬퍼 함수
export async function readSheetData(spreadsheetId: string, range: string) {
  if (!sheets) {
    throw new Error('Google Sheets API가 구성되지 않았습니다.');
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || [];
  } catch (error) {
    console.error('스프레드시트 읽기 오류:', error);
    throw error;
  }
}

// 스프레드시트에 데이터 쓰기 헬퍼 함수
export async function writeSheetData(
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  if (!sheets) {
    throw new Error('Google Sheets API가 구성되지 않았습니다.');
  }

  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    return response.data;
  } catch (error) {
    console.error('스프레드시트 쓰기 오류:', error);
    throw error;
  }
}

// 스프레드시트에 데이터 추가 헬퍼 함수
export async function appendSheetData(
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  if (!sheets) {
    throw new Error('Google Sheets API가 구성되지 않았습니다.');
  }

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    return response.data;
  } catch (error) {
    console.error('스프레드시트 추가 오류:', error);
    throw error;
  }
}

// 드라이브 폴더 생성 헬퍼 함수
export async function createDriveFolder(name: string, parentFolderId?: string) {
  if (!drive) {
    throw new Error('Google Drive API가 구성되지 않았습니다.');
  }

  try {
    const folderMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId && { parents: [parentFolderId] }),
    };

    const response = await drive.files.create({
      requestBody: folderMetadata,
    });

    return response.data;
  } catch (error) {
    console.error('드라이브 폴더 생성 오류:', error);
    throw error;
  }
}

// 드라이브 파일 업로드 헬퍼 함수
export async function uploadToDrive(
  filename: string,
  fileData: Buffer,
  mimeType: string,
  parentFolderId?: string
) {
  if (!drive) {
    throw new Error('Google Drive API가 구성되지 않았습니다.');
  }

  try {
    const fileMetadata = {
      name: filename,
      ...(parentFolderId && { parents: [parentFolderId] }),
    };

    const media = {
      mimeType,
      body: fileData,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
    });

    return response.data;
  } catch (error) {
    console.error('드라이브 파일 업로드 오류:', error);
    throw error;
  }
}