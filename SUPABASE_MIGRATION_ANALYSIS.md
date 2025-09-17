# Facility Management System - Supabase Database Migration Analysis

## Executive Summary

This document provides a comprehensive analysis of the current facility management system and a detailed roadmap for replacing mock data with real Supabase database operations. The system currently operates with mock data in several key areas and requires systematic database integration to enable full CRUD functionality.

## Current System Architecture Analysis

### 1. Infrastructure Status ✅
- **Supabase Configuration**: Environment variables configured, client setup created
- **Authentication System**: Mock-based user management with JWT-like tokens
- **API Framework**: Comprehensive API client with proper structure
- **Database Service**: Extensive service layer exists but not connected to Supabase

### 2. Current Mock Data Implementation

#### A. Authentication & User Management 🔴 HIGH PRIORITY
**Location**: `/utils/auth.ts`
```typescript
// Current: Mock users array
export const MOCK_USERS: User[] = [
  {
    id: 'admin-1',
    email: 'admin@facility.blueon-iot.com',
    name: '시스템 관리자',
    role: 3,
    // ...
  }
];
```
**Database Required**: `employees` table with proper user management

#### B. Business & Facility Management 🟡 MEDIUM PRIORITY
**Location**: `/lib/database-service.ts`
```typescript
// Current: Extensive service exists but uses null clients
const supabase: any = null;
const supabaseAdmin: any = null;
```
**Database Required**: Full integration with existing comprehensive service layer

#### C. Task & Workflow Management 🟡 MEDIUM PRIORITY
**Location**: `/app/admin/page.tsx`
```typescript
// Current: Mock tasks in dashboard
const loadMyTasks = async () => {
  setMyTasks([
    {
      id: '1',
      title: '농업회사법인 주식회사 건양 2공장 점검',
      status: 'in_progress',
      // ...
    }
  ])
}
```
**Database Required**: `work_tasks`, `work_task_templates`, `task_collaboration` tables

#### D. Notification System 🔴 HIGH PRIORITY
**Location**: `/app/admin/page.tsx`
```typescript
// Current: Fallback mock notifications
setNotifications([
  {
    id: '1',
    title: '새로운 업무 할당',
    message: '농업회사법인 주식회사 건양 2공장 점검 업무가 할당되었습니다.',
    // ...
  }
])
```
**Database Required**: `notifications` table with real-time capabilities

### 3. API Integration Analysis

#### Existing API Routes Status:
- ✅ `/api/business-list` - Connected to Google Sheets (working)
- ❌ `/api/auth/*` - Mock user authentication
- ❌ `/api/employees` - Not implemented, needs Supabase
- ❌ `/api/tasks` - Not implemented, needs full task management
- ❌ `/api/notifications` - Partially implemented, needs real database

## Required Database Schema

### Core Tables Needed:

```sql
-- 1. User Management (Priority 1)
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text,
  permission_level integer NOT NULL DEFAULT 1,
  department text,
  team text,
  position text,
  phone text,
  mobile text,
  is_active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  additional_info jsonb DEFAULT '{}'
);

-- 2. Enhanced Business Info (Priority 2)
-- Already exists from database-service.ts definition

-- 3. Work Management (Priority 2)
CREATE TABLE work_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  priority integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT '대기',
  requester_id uuid REFERENCES employees(id),
  assignee_id uuid REFERENCES employees(id),
  previous_assignee_id uuid REFERENCES employees(id),
  start_date timestamptz,
  due_date timestamptz,
  completed_at timestamptz,
  business_id uuid REFERENCES business_info(id),
  template_id uuid,
  category text,
  tags text[],
  progress_percentage integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  additional_data jsonb DEFAULT '{}'
);

-- 4. Notifications (Priority 1)
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text DEFAULT '기타',
  related_task_id uuid REFERENCES work_tasks(id),
  related_collaboration_id uuid,
  related_report_id uuid,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  priority text DEFAULT '보통',
  action_url text,
  action_label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Data History (Priority 3)
CREATE TABLE data_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  user_id uuid REFERENCES employees(id),
  session_id text,
  user_agent text,
  ip_address inet,
  change_reason text,
  change_type text,
  source_system text DEFAULT 'web_app'
);
```

## Implementation Roadmap

### Phase 1: Core Authentication & User Management (Week 1-2) 🔴

#### Tasks:
1. **Database Setup**
   - Create `employees` table with proper schema
   - Set up Row Level Security (RLS) policies
   - Create authentication functions

2. **Service Layer Integration**
   ```typescript
   // Update /lib/database-service.ts
   import { supabase, supabaseAdmin } from './supabase'

   export class UserManagementService {
     static async authenticateUser(email: string): Promise<Employee | null>
     static async createEmployee(data: CreateEmployeeRequest): Promise<Employee>
     static async updateEmployee(id: string, data: UpdateEmployeeRequest): Promise<Employee>
     static async getEmployees(filters?: EmployeeFilters): Promise<PaginatedResponse<Employee>>
   }
   ```

3. **API Route Updates**
   - `/api/auth/login` - Connect to Supabase employee lookup
   - `/api/auth/verify` - Real token validation with database
   - `/api/employees` - Full CRUD operations

4. **Authentication Flow**
   - Replace mock user array with database queries
   - Implement proper session management
   - Update AuthContext to use real user data

#### Expected Outcome:
- Real user authentication and management
- Admin user creation and role management
- Secure session handling

### Phase 2: Business & Facility Data Integration (Week 2-3) 🟡

#### Tasks:
1. **Enable Database Service**
   ```typescript
   // Update /lib/database-service.ts
   // Remove: const supabase: any = null;
   // Add: import { supabase, supabaseAdmin } from './supabase'
   ```

2. **Business Management Pages**
   - `/admin/business` - Connect to real database operations
   - `/admin/air-permit` - Enable CRUD operations
   - `/admin/air-permit-detail` - Real data visualization

3. **API Enhancement**
   - Enhance existing Google Sheets integration
   - Add business synchronization between Sheets and Supabase
   - Implement data validation and error handling

#### Expected Outcome:
- Full business and facility CRUD operations
- Data consistency between Google Sheets and database
- Real-time facility management

### Phase 3: Task & Workflow Management (Week 3-4) 🟡

#### Tasks:
1. **Task Management Database**
   - Create work_tasks table and related schema
   - Implement task assignment and tracking
   - Create task templates and categories

2. **Dashboard Integration**
   ```typescript
   // Update /app/admin/page.tsx
   // Replace mock task loading with real API calls
   const loadMyTasks = async () => {
     const response = await workTaskAPI.getTasks({
       assigneeId: user.id,
       status: ['대기', '진행중']
     })
     // Handle real data
   }
   ```

3. **Task Management Pages**
   - `/admin/tasks` - Real task listing and filtering
   - `/admin/tasks/create` - Task creation with business linkage
   - `/admin/tasks/[id]` - Task details and updates

#### Expected Outcome:
- Complete task lifecycle management
- Real-time task assignment and tracking
- Integration with business data

### Phase 4: Notification & Messaging System (Week 4-5) 🔴

#### Tasks:
1. **Notification Infrastructure**
   ```sql
   -- Real-time notifications with Supabase subscriptions
   CREATE OR REPLACE FUNCTION notify_task_changes()
   RETURNS trigger AS $$
   BEGIN
     INSERT INTO notifications (recipient_id, title, message, notification_type, related_task_id)
     VALUES (NEW.assignee_id, '업무 배정', NEW.title || ' 업무가 배정되었습니다.', '업무요청', NEW.id);
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Real-time Updates**
   - Implement Supabase subscriptions for live notifications
   - Update notification components to handle real data
   - Create notification management system

3. **Integration Updates**
   - Connect task creation to notification generation
   - Implement email/SMS integration for critical notifications
   - Create notification preferences system

#### Expected Outcome:
- Real-time notification system
- Automated task-related notifications
- User preference management

### Phase 5: Advanced Features & Optimization (Week 5-6) 🟢

#### Tasks:
1. **Data History & Audit Trail**
   - Implement comprehensive change tracking
   - Create data recovery mechanisms
   - Add audit report generation

2. **Performance Optimization**
   - Implement database indexing strategies
   - Add caching for frequently accessed data
   - Optimize API response times

3. **Advanced Admin Features**
   - User role management interface
   - System configuration management
   - Data export/import tools

#### Expected Outcome:
- Complete audit trail system
- Optimized performance
- Advanced administrative capabilities

## Security Considerations

### Row Level Security (RLS) Policies:

```sql
-- Employee data access control
CREATE POLICY "Employees can view own data" ON employees
  FOR SELECT USING (id = auth.uid() OR
    (SELECT permission_level FROM employees WHERE id = auth.uid()) >= 3);

-- Business data access based on role
CREATE POLICY "Business access by permission" ON business_info
  FOR ALL USING (
    (SELECT permission_level FROM employees WHERE id = auth.uid()) >= 2
  );

-- Task access control
CREATE POLICY "Task access control" ON work_tasks
  FOR ALL USING (
    assignee_id = auth.uid() OR
    requester_id = auth.uid() OR
    (SELECT permission_level FROM employees WHERE id = auth.uid()) >= 3
  );
```

### Authentication Flow:
1. Social login → User verification in `employees` table
2. JWT token generation with user permissions
3. RLS policy enforcement for all database operations
4. Regular token refresh and validation

## Migration Strategy

### Data Migration Steps:
1. **Export existing mock data** to seed database
2. **Create admin user** through Supabase direct insert
3. **Test authentication flow** with real database
4. **Gradually replace mock API responses** with database calls
5. **Validate data integrity** at each step

### Rollback Plan:
- Keep mock data system as fallback
- Feature flags for enabling/disabling database integration
- Comprehensive testing at each phase

## Success Metrics

### Technical Metrics:
- ✅ All mock data replaced with database operations
- ✅ Response times < 500ms for common operations
- ✅ 99.9% uptime for database operations
- ✅ Zero data loss during migration

### Functional Metrics:
- ✅ Full user management with role-based access
- ✅ Complete business and facility CRUD operations
- ✅ Real-time task assignment and tracking
- ✅ Automated notification system

### User Experience Metrics:
- ✅ No service interruption during migration
- ✅ Improved performance over mock system
- ✅ Enhanced functionality with real data relationships

## Risk Assessment

### High Risk 🔴
- **Authentication system failure**: Mitigation - Keep mock fallback during transition
- **Data corruption during migration**: Mitigation - Database backups and validation
- **Performance degradation**: Mitigation - Load testing and optimization

### Medium Risk 🟡
- **API compatibility issues**: Mitigation - Incremental API updates
- **User role conflicts**: Mitigation - Careful permission mapping
- **Integration timing**: Mitigation - Feature flags and gradual rollout

### Low Risk 🟢
- **Minor UI adjustments needed**: Standard development iteration
- **Configuration tweaks**: Well-documented environment setup

## Conclusion

The facility management system has a solid architectural foundation with comprehensive service layers and well-structured APIs. The main task is connecting the existing infrastructure to Supabase rather than rebuilding core functionality. The phased approach ensures minimal disruption while systematically replacing mock data with real database operations.

The implementation should focus on:
1. **Authentication first** - Foundation for all other features
2. **Core data operations** - Business and facility management
3. **Workflow features** - Task and notification systems
4. **Performance optimization** - Ensuring scalable operations

With the existing codebase quality and proper Supabase integration, this migration will transform the system from a demo application to a production-ready facility management platform.