// lib/system-config.ts
import { SystemConfig, SystemType } from '@/types';

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
