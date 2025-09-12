// lib/system-config.ts
import { SystemConfig, SystemType, SystemPhase } from '@/types';

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

// 새로운 사진 단계별 구분 설정
export const PHASE_CONFIG: Record<SystemPhase, {
  name: string;
  description: string;
  icon: string;
  color: string;
  storagePrefix: string;
}> = {
  presurvey: {
    name: '설치 전 실사',
    description: '설치 전 현장 상태 사진',
    icon: '🔍',
    color: 'blue',
    storagePrefix: 'presurvey'
  },
  postinstall: {
    name: '설치 후 사진',
    description: '설치 완료 후 상태 사진',
    icon: '📸',
    color: 'green', 
    storagePrefix: 'postinstall'
  },
  aftersales: {
    name: 'AS 사진',
    description: 'A/S 작업 관련 사진',
    icon: '🔧',
    color: 'orange',
    storagePrefix: 'aftersales'
  }
};

export function getSystemConfig(type: SystemType): SystemConfig {
  return SYSTEM_CONFIG[type];
}

export function getPhaseConfig(phase: SystemPhase) {
  return PHASE_CONFIG[phase];
}

// SystemType을 SystemPhase로 매핑
export function mapSystemTypeToPhase(systemType: SystemType): SystemPhase {
  switch (systemType) {
    case 'presurvey':
      return 'presurvey';
    case 'completion':
      return 'postinstall';
    default:
      return 'presurvey';
  }
}

// SystemPhase를 SystemType으로 매핑 (기존 호환성)
export function mapPhaseToSystemType(phase: SystemPhase): SystemType {
  switch (phase) {
    case 'presurvey':
      return 'presurvey';
    case 'postinstall':
      return 'completion';
    case 'aftersales':
      return 'completion'; // AS 사진도 completion으로 분류
    default:
      return 'presurvey';
  }
}
