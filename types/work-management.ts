// types/work-management.ts
// 업무관리 시스템 TypeScript 타입 정의

// ============================================================================
// 기본 엔티티 타입들
// ============================================================================

export interface Employee {
  id: string;
  employeeId: string; // 사번
  name: string;
  email: string;
  passwordHash?: string; // 보안상 선택적
  permissionLevel: 1 | 2 | 3; // 1: 일반직원, 2: 팀장급, 3: 관리자급
  department?: string;
  team?: string;
  position?: string;
  phone?: string;
  mobile?: string;
  isActive: boolean;
  isDeleted: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  additionalInfo?: Record<string, any>;
}

export interface WorkTaskTemplate {
  id: string;
  templateName: string;
  description?: string;
  estimatedDurationDays: number;
  defaultPriority: TaskPriority;
  templateContent?: Record<string, any>;
  requiredFields?: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkTask {
  id: string;
  title: string;
  content: string;
  priority: TaskPriority;
  status: TaskStatus;
  requesterId: string;
  assigneeId: string;
  previousAssigneeId?: string;
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  businessId?: string; // business_info와 연결
  templateId?: string;
  category?: string;
  tags?: string[];
  progressPercentage: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  additionalData?: Record<string, any>;

  // 조인된 데이터 (API 응답용)
  requester?: Pick<Employee, 'id' | 'name' | 'email' | 'position'>;
  assignee?: Pick<Employee, 'id' | 'name' | 'email' | 'position'>;
  business?: {
    id: string;
    businessName: string;
    address?: string;
  };
  template?: Pick<WorkTaskTemplate, 'id' | 'templateName'>;
}

export interface TaskCollaboration {
  id: string;
  taskId: string;
  requesterId: string;
  collaboratorId: string;
  collaborationType: string;
  requestContent: string;
  responseContent?: string;
  status: CollaborationStatus;
  requestedDueDate?: Date;
  completedAt?: Date;
  urgencyLevel: UrgencyLevel;
  createdAt: Date;
  updatedAt: Date;

  // 조인된 데이터
  task?: Pick<WorkTask, 'id' | 'title' | 'status'>;
  requester?: Pick<Employee, 'id' | 'name' | 'position'>;
  collaborator?: Pick<Employee, 'id' | 'name' | 'position'>;
}

export interface WeeklyReport {
  id: string;
  authorId: string;
  reportWeek: Date; // 주의 시작일 (월요일)
  reportType: ReportType;
  businessId?: string;
  majorTasks?: string;
  completedTasks?: string;
  ongoingTasks?: string;
  plannedTasks?: string;
  issuesAndChallenges?: string;
  nextWeekGoals?: string;
  totalTasksCount: number;
  completedTasksCount: number;
  ongoingTasksCount: number;
  status: ReportStatus;
  submittedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  attachments?: FileAttachment[];
  createdAt: Date;
  updatedAt: Date;

  // 조인된 데이터
  author?: Pick<Employee, 'id' | 'name' | 'position' | 'department'>;
  business?: Pick<any, 'id' | 'businessName'>;
  approver?: Pick<Employee, 'id' | 'name' | 'position'>;
}

export interface Notification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  notificationType: NotificationType;
  relatedTaskId?: string;
  relatedCollaborationId?: string;
  relatedReportId?: string;
  isRead: boolean;
  readAt?: Date;
  priority: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: Date;
  updatedAt: Date;

  // 조인된 데이터
  relatedTask?: Pick<WorkTask, 'id' | 'title' | 'status'>;
  relatedCollaboration?: Pick<TaskCollaboration, 'id' | 'requestContent'>;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  subject?: string;
  content: string;
  messageType: MessageType;
  relatedTaskId?: string;
  isRead: boolean;
  readAt?: Date;
  attachments?: FileAttachment[];
  parentMessageId?: string; // 답장인 경우
  threadId?: string;
  createdAt: Date;
  updatedAt: Date;

  // 조인된 데이터
  sender?: Pick<Employee, 'id' | 'name' | 'position'>;
  recipient?: Pick<Employee, 'id' | 'name' | 'position'>;
  relatedTask?: Pick<WorkTask, 'id' | 'title'>;
  replies?: Message[]; // 답장들
}

export interface WorkTaskHistory {
  id: string;
  taskId: string;
  changedBy: string;
  changeType: TaskChangeType;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;

  // 조인된 데이터
  changedByEmployee?: Pick<Employee, 'id' | 'name' | 'position'>;
}

// ============================================================================
// Enum 타입들
// ============================================================================

export type TaskPriority = 1 | 2 | 3 | 4 | 5; // 1: 최고, 5: 최저

export type TaskStatus =
  | '대기'
  | '진행중'
  | '완료'
  | '해결불가'
  | '이관됨'
  | '취소됨';

export type CollaborationStatus =
  | '요청됨'
  | '진행중'
  | '완료됨'
  | '거절됨'
  | '취소됨';

export type UrgencyLevel = 1 | 2 | 3 | 4 | 5; // 1: 최고, 5: 최저

export type ReportType = '개인' | '사업장별' | '팀별' | '부서별';

export type ReportStatus = '작성중' | '제출됨' | '승인됨' | '반려됨';

export type NotificationType =
  | '업무요청'
  | '업무완료'
  | '업무이관'
  | '협조요청'
  | '마감임박'
  | '보고서제출'
  | '시스템공지'
  | '기타';

export type NotificationPriority = '낮음' | '보통' | '높음' | '긴급';

export type MessageType = '일반' | '업무관련' | '공지' | '긴급';

export type TaskChangeType =
  | '생성'
  | '수정'
  | '상태변경'
  | '담당자변경'
  | '완료'
  | '취소'
  | '이관';

export type PermissionLevel = 1 | 2 | 3; // 1: 일반직원, 2: 팀장급, 3: 관리자급

// ============================================================================
// 유틸리티 타입들
// ============================================================================

export interface FileAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

// ============================================================================
// 폼 및 요청 타입들
// ============================================================================

export interface CreateEmployeeRequest {
  employeeId: string;
  name: string;
  email: string;
  password: string;
  permissionLevel: PermissionLevel;
  department?: string;
  team?: string;
  position?: string;
  phone?: string;
  mobile?: string;
}

export interface UpdateEmployeeRequest {
  name?: string;
  email?: string;
  permissionLevel?: PermissionLevel;
  department?: string;
  team?: string;
  position?: string;
  phone?: string;
  mobile?: string;
  isActive?: boolean;
}

export interface CreateTaskRequest {
  title: string;
  content: string;
  priority: TaskPriority;
  assigneeId: string;
  startDate?: Date;
  dueDate?: Date;
  businessId?: string;
  templateId?: string;
  category?: string;
  tags?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  content?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigneeId?: string;
  startDate?: Date;
  dueDate?: Date;
  progressPercentage?: number;
  notes?: string;
  category?: string;
  tags?: string[];
}

export interface CreateCollaborationRequest {
  taskId: string;
  collaboratorId: string;
  collaborationType?: string;
  requestContent: string;
  requestedDueDate?: Date;
  urgencyLevel: UrgencyLevel;
}

export interface CreateWeeklyReportRequest {
  reportWeek: Date;
  reportType: ReportType;
  businessId?: string;
  majorTasks?: string;
  completedTasks?: string;
  ongoingTasks?: string;
  plannedTasks?: string;
  issuesAndChallenges?: string;
  nextWeekGoals?: string;
}

export interface CreateMessageRequest {
  recipientId: string;
  subject?: string;
  content: string;
  messageType: MessageType;
  relatedTaskId?: string;
  parentMessageId?: string;
}

// ============================================================================
// 필터 및 검색 타입들
// ============================================================================

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assigneeId?: string[];
  requesterId?: string[];
  businessId?: string[];
  category?: string[];
  tags?: string[];
  dueDateFrom?: Date;
  dueDateTo?: Date;
  createdDateFrom?: Date;
  createdDateTo?: Date;
  search?: string; // 제목, 내용 검색
}

export interface NotificationFilters {
  isRead?: boolean;
  notificationType?: NotificationType[];
  priority?: NotificationPriority[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ReportFilters {
  authorId?: string[];
  reportType?: ReportType[];
  status?: ReportStatus[];
  businessId?: string[];
  weekFrom?: Date;
  weekTo?: Date;
}

// ============================================================================
// 대시보드 및 통계 타입들
// ============================================================================

export interface TaskSummary {
  assigneeName: string;
  department?: string;
  totalTasks: number;
  completedTasks: number;
  ongoingTasks: number;
  pendingTasks: number;
  overdueTasks: number;
}

export interface WorkloadAnalysis {
  employeeId: string;
  employeeName: string;
  department?: string;
  currentTasks: number;
  overdueTasksThisWeek: number;
  completedTasksThisWeek: number;
  averageTaskCompletionDays: number;
  workloadScore: number; // 1-10 점수
}

export interface NotificationSummary {
  employeeName: string;
  unreadCount: number;
  urgentCount: number;
  oldestNotification?: Date;
}

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  ongoingTasks: number;
  overdueTasks: number;
  averageCompletionTime: number; // 일 단위
  taskCompletionRate: number; // 퍼센트
  mostBusyEmployee: string;
  mostCommonTaskCategory: string;
}

// ============================================================================
// 실시간 업데이트 타입들
// ============================================================================

export interface RealtimeUpdate<T = any> {
  type: 'task_created' | 'task_updated' | 'task_completed' | 'notification_created' | 'message_received';
  payload: T;
  timestamp: Date;
  userId: string;
}

export interface TaskRealtimeUpdate {
  taskId: string;
  task: WorkTask;
  changeType: TaskChangeType;
  changedBy: string;
}

export interface NotificationRealtimeUpdate {
  notificationId: string;
  notification: Notification;
  recipientId: string;
}

// ============================================================================
// 권한 체크 타입들
// ============================================================================

export interface PermissionCheck {
  canViewAllTasks: boolean;
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canViewReports: boolean;
  canApproveReports: boolean;
  canAccessAdminPages: boolean;
  canViewSensitiveData: boolean; // 원가, 매출 등
}

export interface UserSession {
  user: Employee;
  permissions: PermissionCheck;
  lastActivity: Date;
  sessionId: string;
}

// ============================================================================
// 기존 타입과의 통합을 위한 확장
// ============================================================================

// 기존 types/index.ts의 BusinessInfo 확장
export interface ExtendedBusinessInfo {
  // 기존 BusinessInfo 속성들 유지
  found: boolean;
  businessName: string;
  manager?: string;
  position?: string;
  contact?: string;
  address?: string;

  // 새로 추가되는 업무관리 관련 정보
  assignedEmployees?: Pick<Employee, 'id' | 'name' | 'position'>[];
  recentTasks?: Pick<WorkTask, 'id' | 'title' | 'status' | 'dueDate'>[];
  taskSummary?: {
    totalTasks: number;
    completedTasks: number;
    ongoingTasks: number;
  };
}

// 기존 Facility 타입에 업무 연결
export interface FacilityWithTasks {
  // 기존 Facility 속성들
  outlet: number;
  number: number;
  name: string;
  capacity: string;
  quantity: number;
  displayName: string;

  // 업무 관련 추가 정보
  relatedTasks?: Pick<WorkTask, 'id' | 'title' | 'status'>[];
  lastInspectionTask?: Pick<WorkTask, 'id' | 'title' | 'completedAt'>;
  nextScheduledTask?: Pick<WorkTask, 'id' | 'title' | 'dueDate'>;
}

export default {};