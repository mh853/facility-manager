// types/index.ts
export interface Facility {
  outlet: number;
  number: number; // Per-outlet facility number (existing)
  sequentialNumber?: number; // NEW: Sequential across all outlets (배1,배2,배3... or 방1,방2,방3...)
  name: string;
  capacity: string;
  quantity: number;
  displayName: string;
  notes?: string;
  
  // 배출시설 추가 데이터
  dischargeCT?: string;
  exemptionReason?: 'none' | '무동력' | '통합전원' | '연속공정' | '연간 30일 미만 가동' | '물리적으로 부착 불가능';
  remarks?: string; // 비고
  
  // 방지시설 추가 데이터
  ph?: string;
  pressure?: string; // 차압계
  temperature?: string; // 온도계
  pump?: string; // 펌프CT
  fan?: string; // 송풍CT
  
  // 게이트웨이 정보
  gatewayInfo?: {
    id?: string;
    ip?: string;
    mac?: string;
    firmware?: string;
    status?: 'connected' | 'disconnected' | 'error';
  };
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
  
  // Supabase 확장 정보
  id?: string;
  사업장명?: string;
  주소?: string;
  담당자명?: string;
  담당자연락처?: string;
  담당자직급?: string;
  사업장연락처?: string;
  사업자등록번호?: string;
  대표자?: string;
  업종?: string;
  
  // 측정기기 수량 정보
  equipmentCounts?: {
    phSensor: number;
    differentialPressureMeter: number;
    temperatureMeter: number;
    dischargeCT: number;
    fanCT: number;
    pumpCT: number;
    gateway: number;
    totalDevices: number;
  };
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

// 새로운 사진 단계별 구분 타입 (3단계 확장)
export type SystemPhase = 'presurvey' | 'postinstall' | 'aftersales';

export interface SystemConfig {
  sheetName: string;
  folderId: string;
  title: string;
  urlParam: string;
}

// 프로젝트 관리 타입 정의
export interface Project {
  id: string;
  name: string;
  description?: string;
  project_type: '자체자금' | '보조금';
  business_name: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  department_id: string;
  manager_id: string;
  start_date: string;
  expected_end_date?: string;
  actual_end_date?: string;
  total_budget?: number;
  subsidy_amount?: number;
  current_budget_used?: number;
  progress_percentage?: number;
  created_at: string;
  updated_at: string;

  // 조인된 정보
  department?: {
    id: string;
    name: string;
  };
  manager?: {
    id: string;
    name: string;
    email: string;
  };
  task_stats?: {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;

  // 조인된 정보
  project?: {
    id: string;
    name: string;
    project_type: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ProjectDashboardStats {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  overdue_projects: number;
  total_budget: number;
  used_budget: number;
  total_tasks: number;
  completed_tasks: number;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department_id: string;
  permission_level: number;
  is_active: boolean;
}

export interface Department {
  id: string;
  name: string;
  parent_id?: string;
  description?: string;
  is_active: boolean;
}