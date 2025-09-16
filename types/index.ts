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

// 인증 관련 타입 정의
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

export type UserRole = 1 | 2 | 3; // 1,2: 일반 사용자, 3: 관리자

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: Date;
  provider: SocialProvider;
}

export type SocialProvider = 'kakao' | 'naver' | 'google';

export interface SocialAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface LoginRequest {
  provider: SocialProvider;
  code: string;
  state?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}
