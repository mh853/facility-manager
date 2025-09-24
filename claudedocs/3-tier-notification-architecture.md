# 3-Tier Notification System Architecture

## Overview
개인, 팀, 전사 알림 계층을 지원하는 계층형 알림 시스템 설계

## Notification Tiers

### 1. Personal Level (개인 알림)
- **Target**: 특정 사용자에게만 전송
- **Use Cases**:
  - 개인 업무 할당
  - 개인 업무 완료 알림
  - 개인 계정 관련 알림
  - 개인 성과 피드백
- **Visibility**: 해당 사용자만 볼 수 있음

### 2. Team Level (팀/부서 알림)
- **Target**: 특정 팀/부서 구성원들에게 전송
- **Use Cases**:
  - 팀 회의 공지
  - 팀 프로젝트 업데이트
  - 팀 목표 달성 알림
  - 부서별 업무 공지
- **Visibility**: 해당 팀/부서 구성원들만 볼 수 있음

### 3. Company Level (전사 알림)
- **Target**: 모든 사용자에게 전송
- **Use Cases**:
  - 시스템 점검 공지
  - 회사 정책 변경
  - 긴급 공지사항
  - 시스템 업데이트 알림
- **Visibility**: 모든 사용자가 볼 수 있음

## Database Schema Changes

### Enhanced user_notifications Table
```sql
CREATE TABLE user_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  notification_id INTEGER REFERENCES notifications(id),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Enhanced notifications Table
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',

  -- Tier Configuration
  notification_tier TEXT NOT NULL CHECK (notification_tier IN ('personal', 'team', 'company')),

  -- Target Configuration
  target_user_id UUID REFERENCES auth.users(id), -- For personal notifications
  target_team_id INTEGER REFERENCES teams(id),   -- For team notifications
  target_department_id INTEGER REFERENCES departments(id), -- For department notifications

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  related_resource_type TEXT,
  related_resource_id TEXT,
  related_url TEXT,
  metadata JSONB,

  -- Lifecycle
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_target CHECK (
    (notification_tier = 'personal' AND target_user_id IS NOT NULL) OR
    (notification_tier = 'team' AND (target_team_id IS NOT NULL OR target_department_id IS NOT NULL)) OR
    (notification_tier = 'company' AND target_user_id IS NULL AND target_team_id IS NULL AND target_department_id IS NULL)
  )
);
```

### New teams Table
```sql
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### New departments Table
```sql
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Enhanced users Table
```sql
-- Add team/department references to existing users
ALTER TABLE users ADD COLUMN team_id INTEGER REFERENCES teams(id);
ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES departments(id);
```

## API Endpoints

### GET /api/notifications
Enhanced to support tier-based filtering:
```typescript
interface NotificationQueryParams {
  tier?: 'personal' | 'team' | 'company' | 'all';
  includeRead?: boolean;
  limit?: number;
  offset?: number;
}
```

### POST /api/notifications/create
```typescript
interface CreateNotificationRequest {
  title: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  notification_tier: 'personal' | 'team' | 'company';

  // Target configuration based on tier
  target_user_id?: string;     // For personal
  target_team_id?: number;     // For team
  target_department_id?: number; // For department

  related_resource_type?: string;
  related_resource_id?: string;
  related_url?: string;
  expires_at?: string;
  metadata?: Record<string, any>;
}
```

### GET /api/notifications/recipients/:notificationId
Returns list of users who should receive the notification based on tier:
```typescript
interface NotificationRecipient {
  user_id: string;
  user_name: string;
  user_email: string;
  is_read: boolean;
  read_at?: string;
}
```

## UI Components

### NotificationBell Component Updates
```typescript
interface NotificationBellProps {
  showTierFilter?: boolean;
  defaultTier?: 'all' | 'personal' | 'team' | 'company';
}

// Add tier filtering tabs
const TierFilter = () => (
  <div className="flex border-b border-gray-200">
    <button className={`px-3 py-2 text-sm ${selectedTier === 'all' ? 'border-b-2 border-blue-500' : ''}`}>
      전체
    </button>
    <button className={`px-3 py-2 text-sm ${selectedTier === 'personal' ? 'border-b-2 border-blue-500' : ''}`}>
      개인
    </button>
    <button className={`px-3 py-2 text-sm ${selectedTier === 'team' ? 'border-b-2 border-blue-500' : ''}`}>
      팀
    </button>
    <button className={`px-3 py-2 text-sm ${selectedTier === 'company' ? 'border-b-2 border-blue-500' : ''}`}>
      전사
    </button>
  </div>
);
```

### NotificationHistory Page Updates
- Add tier filtering sidebar
- Show notification source (personal/team/company)
- Display target information (team name, department name)

### Admin Notification Management
New admin page for creating and managing notifications:
- `/admin/notifications/create` - Create notifications for different tiers
- `/admin/notifications/manage` - View and manage all notifications
- `/admin/notifications/analytics` - Notification delivery and read statistics

## Context Updates

### NotificationContext Enhancement
```typescript
interface NotificationContextType {
  // Existing
  notifications: Notification[];
  unreadCount: number;

  // Enhanced with tier support
  personalNotifications: Notification[];
  teamNotifications: Notification[];
  companyNotifications: Notification[];

  unreadCountByTier: {
    personal: number;
    team: number;
    company: number;
  };

  // New methods
  createNotification: (notification: CreateNotificationRequest) => Promise<void>;
  getNotificationsByTier: (tier: NotificationTier) => Notification[];
  markTierAsRead: (tier: NotificationTier) => Promise<void>;
}
```

## Real-time Subscription Strategy

### Supabase Real-time Channels
```typescript
// Subscribe to notifications based on user's tier eligibility
const subscribeToNotifications = () => {
  const userId = user.id;
  const teamId = user.team_id;
  const departmentId = user.department_id;

  // Personal notifications
  supabase
    .channel('personal-notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `target_user_id=eq.${userId}`
    }, handleNewNotification)
    .subscribe();

  // Team notifications
  if (teamId) {
    supabase
      .channel('team-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `target_team_id=eq.${teamId}`
      }, handleNewNotification)
      .subscribe();
  }

  // Department notifications
  if (departmentId) {
    supabase
      .channel('department-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `target_department_id=eq.${departmentId}`
      }, handleNewNotification)
      .subscribe();
  }

  // Company-wide notifications
  supabase
    .channel('company-notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: 'notification_tier=eq.company'
    }, handleNewNotification)
    .subscribe();
};
```

## Migration Strategy

### Phase 1: Database Schema
1. Create new tables (teams, departments)
2. Add columns to existing tables
3. Migrate existing data to new structure

### Phase 2: API Enhancement
1. Update existing endpoints to support tier filtering
2. Create new tier-specific endpoints
3. Implement proper authorization checks

### Phase 3: UI Updates
1. Update NotificationBell with tier filtering
2. Enhance NotificationHistory page
3. Create admin management interfaces

### Phase 4: Real-time Updates
1. Implement tier-based Supabase subscriptions
2. Update NotificationContext with tier support
3. Test real-time delivery across all tiers

## Security Considerations

### Row Level Security (RLS) Policies
```sql
-- Personal notifications: users can only see their own
CREATE POLICY "Users can view personal notifications" ON notifications
  FOR SELECT USING (
    notification_tier = 'personal' AND target_user_id = auth.uid()
  );

-- Team notifications: users can see their team's notifications
CREATE POLICY "Users can view team notifications" ON notifications
  FOR SELECT USING (
    notification_tier = 'team' AND (
      target_team_id = (SELECT team_id FROM users WHERE id = auth.uid()) OR
      target_department_id = (SELECT department_id FROM users WHERE id = auth.uid())
    )
  );

-- Company notifications: everyone can see
CREATE POLICY "Users can view company notifications" ON notifications
  FOR SELECT USING (notification_tier = 'company');
```

### Authorization Checks
- Verify user belongs to target team/department before showing notifications
- Implement admin-only creation permissions for company-wide notifications
- Validate notification tier permissions in API endpoints

## Implementation Benefits

1. **Scalable**: Clear separation of notification scopes
2. **Flexible**: Easy to add new tiers or modify existing ones
3. **Secure**: Proper authorization and visibility controls
4. **Performant**: Efficient real-time subscriptions and queries
5. **User-friendly**: Clear indication of notification source and relevance

## Next Steps

1. Review and approve architecture design
2. Create database migration scripts
3. Implement API endpoint modifications
4. Update UI components with tier support
5. Test tier-based real-time delivery
6. Deploy and monitor system performance