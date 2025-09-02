// utils/email-helpers.ts
import { SystemType } from '@/types';

export function generateStorageUrl(businessName: string, systemType: SystemType): string {
  // Supabase 스토리지 URL 생성 로직
  const bucketName = 'facility-files';
  const folderPath = `business/${systemType}/${businessName}`;
  
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucketName}/${folderPath}`;
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
