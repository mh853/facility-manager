// utils/email-helpers.ts
import { SystemType } from '@/types';

export function generateDriveUrl(businessName: string, systemType: SystemType): string {
  // Google Drive 폴더 URL 생성 로직
  const folderId = systemType === 'presurvey' 
    ? process.env.PRESURVEY_FOLDER_ID 
    : process.env.COMPLETION_FOLDER_ID;
  
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function formatKoreanDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul'
  }).format(date);
}

export function sanitizeFileName(fileName: string): string {
  // 파일명에서 문제가 될 수 있는 문자 제거
  return fileName.replace(/[<>:"/\\|?*]/g, '_');
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
