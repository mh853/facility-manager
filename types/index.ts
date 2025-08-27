// types/index.ts
export interface Facility {
  outlet: number;
  number: number;
  name: string;
  capacity: string;
  quantity: number;
  displayName: string;
  // 배출시설 추가 데이터
  dischargeCT?: string;
  // 방지시설 추가 데이터
  ph?: string;
  pressure?: string; // 차압
  temperature?: string; // 온도
  pump?: string; // 펌프
  fan?: string; // 송풍
}

export interface FacilitiesData {
  discharge: Facility[];
  prevention: Facility[];
  debugInfo?: any;
}

export interface BusinessInfo {
  found: boolean;
  businessName: string;
  manager?: string;
  position?: string;
  contact?: string;
  address?: string;
  rowIndex?: number;
  error?: string;
}

export interface FileInfo {
  id: string;
  name: string;
  url: string;
  downloadUrl: string;
  thumbnailUrl: string;
  size: number;
  dateCreated: Date;
  mimeType: string;
}

// Supabase 기반 업로드된 파일 정보
export interface UploadedFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdTime: string;
  webViewLink: string;
  downloadUrl: string;
  thumbnailUrl: string;
  folderName: string;
  uploadStatus: string;
  facilityInfo?: string;
  filePath?: string; // 시설별 스토리지 경로
  justUploaded?: boolean; // 업로드 직후 마커 (깜빡임 방지)
  uploadedAt?: number; // 업로드 시점 타임스탬프
}

export interface UploadedFiles {
  basic: FileInfo[];
  discharge: FileInfo[];
  prevention: FileInfo[];
}

export type SystemType = 'completion' | 'presurvey';

export interface SystemConfig {
  sheetName: string;
  folderId: string;
  title: string;
  urlParam: string;
}
