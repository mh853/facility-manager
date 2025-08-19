// lib/system-config.ts
import { SystemConfig, SystemType } from '@/types';

export const CONSTANTS = {
  MAX_FILE_SIZE: 15 * 1024 * 1024, // 15MB
  MAX_FILES_PER_UPLOAD: 20,
  SUPPORTED_FILE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
};

export const SYSTEM_CONFIG: Record<SystemType, SystemConfig> = {
  completion: {
    sheetName: '설치 후 사진',
    folderId: process.env.COMPLETION_FOLDER_ID || '',
    title: '설치완료 보고서',
    urlParam: ''
  },
  presurvey: {
    sheetName: '설치 전 실사',
    folderId: process.env.PRESURVEY_FOLDER_ID || '',
    title: '설치 전 실사',
    urlParam: 'type=presurvey&'
  }
};

export function getSystemConfig(type: SystemType): SystemConfig {
  return SYSTEM_CONFIG[type];
}
