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

  // 계산서 및 입금 관리 (보조금 사업장)
  invoice_1st_date?: string;
  invoice_1st_amount?: number;
  payment_1st_date?: string;
  payment_1st_amount?: number;

  invoice_2nd_date?: string;
  invoice_2nd_amount?: number;
  payment_2nd_date?: string;
  payment_2nd_amount?: number;

  invoice_additional_date?: string;
  // invoice_additional_amount는 additional_cost 사용
  payment_additional_date?: string;
  payment_additional_amount?: number;

  // 계산서 및 입금 관리 (자비 사업장)
  invoice_advance_date?: string;
  invoice_advance_amount?: number;
  payment_advance_date?: string;
  payment_advance_amount?: number;

  invoice_balance_date?: string;
  invoice_balance_amount?: number;
  payment_balance_date?: string;
  payment_balance_amount?: number;
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

// 매출 관리 시스템 타입 정의
export interface BusinessRevenueSummary {
  business_id: string;
  business_name: string;
  sales_office: string;
  address: string;
  manager_name: string;
  manager_contact: string;

  // 업무 카테고리별 분류
  task_categories: {
    self_tasks: number;      // 자비 업무 수
    subsidy_tasks: number;   // 보조금 업무 수
    total_tasks: number;     // 전체 업무 수
  };

  // 측정기기 정보
  equipment_summary: {
    total_equipment_count: number;
    equipment_breakdown: {
      ph_meter: number;
      differential_pressure_meter: number;
      temperature_meter: number;
      discharge_current_meter: number;
      fan_current_meter: number;
      pump_current_meter: number;
      gateway: number;
      vpn_wired: number;
      vpn_wireless: number;
      explosion_proof_differential_pressure_meter_domestic: number;
      explosion_proof_temperature_meter_domestic: number;
      expansion_device: number;
      relay_8ch: number;
      relay_16ch: number;
      main_board_replacement: number;
      multiple_stack: number;
    };
  };

  // 매출 계산 결과 (캐시됨)
  revenue_calculation?: {
    calculation_date: string;
    total_revenue: number;
    total_cost: number;
    gross_profit: number;
    sales_commission: number;
    survey_costs: number;
    installation_costs: number;
    net_profit: number;
    profit_margin_percentage: number;
    calculation_status: 'success' | 'error' | 'pending';
    last_calculated: string;
  };

  // 계산 오류 정보
  calculation_error?: string;
}

export interface BusinessSummaryResponse {
  success: boolean;
  data: {
    businesses: BusinessRevenueSummary[];
    summary_stats: {
      total_businesses: number;
      businesses_with_revenue_data: number;
      total_tasks: number;
      total_equipment: number;
      aggregate_revenue: number;
      aggregate_profit: number;
    };
    calculation_status: {
      successful_calculations: number;
      failed_calculations: number;
      pending_calculations: number;
    };
  };
  message: string;
}