// types/index.ts
export interface Facility {
  outlet: number;
  number: number;
  name: string;
  capacity: string;
  quantity: number;
  displayName: string;
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
