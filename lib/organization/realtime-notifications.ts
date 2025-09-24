import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 클라이언트용 Supabase 클라이언트
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// 조직 변경 알림 타입
export interface OrganizationChangeNotification {
  id: string;
  employee_id: string;
  change_type: 'hire' | 'team_join' | 'team_leave' | 'promotion' | 'role_change' | 'transfer' | 'assignment_change';
  old_data?: any;
  new_data?: any;
  from_team_id?: string;
  to_team_id?: string;
  old_position_level?: number;
  new_position_level?: number;
  affected_task_id?: string;
  task_change_type?: 'assigned' | 'reassigned' | 'unassigned';
  changed_by: string;
  changed_at: string;
  reason?: string;
  employee?: {
    name: string;
    email: string;
    position_title?: string;
  };
  changer?: {
    name: string;
    email: string;
  };
}

// 실시간 알림 이벤트 리스너
export type RealtimeNotificationListener = (notification: OrganizationChangeNotification) => void;

// 실시간 알림 관리 클래스
export class OrganizationRealtimeManager {
  private channels: Map<string, any> = new Map();
  private listeners: Map<string, RealtimeNotificationListener[]> = new Map();

  // 조직 변경 실시간 구독
  subscribeToOrganizationChanges(
    scope: 'all' | 'department' | 'team' | 'user',
    scopeId?: string,
    listener?: RealtimeNotificationListener
  ) {
    const channelName = `org_changes_${scope}${scopeId ? `_${scopeId}` : ''}`;

    // 이미 구독 중인 채널인지 확인
    if (this.channels.has(channelName)) {
      if (listener) {
        this.addListener(channelName, listener);
      }
      return this.channels.get(channelName);
    }

    console.log(`🔔 조직 변경 실시간 구독 시작: ${channelName}`);

    // 새 채널 생성 및 구독
    const channel = supabaseClient
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'organization_changes_detailed',
          ...(scopeId && scope !== 'all' && {
            filter: this.getFilterForScope(scope, scopeId)
          })
        },
        (payload) => {
          console.log('📥 조직 변경 알림 수신:', payload);
          this.handleOrganizationChange(payload.new as OrganizationChangeNotification, channelName);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: 'type=eq.organization_change'
        },
        (payload) => {
          console.log('📥 알림 업데이트 수신:', payload);
          this.handleNotificationUpdate(payload.new, channelName);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ 실시간 구독 성공: ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ 실시간 구독 실패: ${channelName}`);
        }
      });

    this.channels.set(channelName, channel);
    this.listeners.set(channelName, []);

    if (listener) {
      this.addListener(channelName, listener);
    }

    return channel;
  }

  // 업무 담당자 변경 실시간 구독
  subscribeToTaskAssignmentChanges(
    employeeId?: string,
    taskId?: string,
    listener?: RealtimeNotificationListener
  ) {
    const channelName = `task_assignments${employeeId ? `_emp_${employeeId}` : ''}${taskId ? `_task_${taskId}` : ''}`;

    if (this.channels.has(channelName)) {
      if (listener) {
        this.addListener(channelName, listener);
      }
      return this.channels.get(channelName);
    }

    console.log(`🔔 업무 담당자 변경 실시간 구독 시작: ${channelName}`);

    const channel = supabaseClient
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'organization_changes_detailed',
          filter: 'change_type=eq.assignment_change'
        },
        (payload) => {
          const change = payload.new as OrganizationChangeNotification;

          // 필터링 조건 확인
          if (employeeId && change.employee_id !== employeeId) return;
          if (taskId && change.affected_task_id !== taskId) return;

          console.log('📥 업무 담당자 변경 알림 수신:', payload);
          this.handleOrganizationChange(change, channelName);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    this.listeners.set(channelName, []);

    if (listener) {
      this.addListener(channelName, listener);
    }

    return channel;
  }

  // 리스너 추가
  private addListener(channelName: string, listener: RealtimeNotificationListener) {
    const channelListeners = this.listeners.get(channelName) || [];
    channelListeners.push(listener);
    this.listeners.set(channelName, channelListeners);
  }

  // 범위별 필터 생성
  private getFilterForScope(scope: string, scopeId: string): string {
    switch (scope) {
      case 'department':
        return `new_data->primary_department_id=eq.${scopeId}`;
      case 'team':
        return `to_team_id=eq.${scopeId}`;
      case 'user':
        return `employee_id=eq.${scopeId}`;
      default:
        return '';
    }
  }

  // 조직 변경 처리
  private async handleOrganizationChange(
    change: OrganizationChangeNotification,
    channelName: string
  ) {
    try {
      // 추가 데이터 조회 (필요한 경우)
      const enrichedChange = await this.enrichNotificationData(change);

      // 모든 리스너에게 알림 전달
      const channelListeners = this.listeners.get(channelName) || [];
      channelListeners.forEach(listener => {
        try {
          listener(enrichedChange);
        } catch (error) {
          console.error('리스너 실행 오류:', error);
        }
      });

      // 브라우저 알림 표시 (권한이 있는 경우)
      if (Notification.permission === 'granted') {
        this.showBrowserNotification(enrichedChange);
      }

    } catch (error) {
      console.error('조직 변경 처리 오류:', error);
    }
  }

  // 알림 업데이트 처리
  private handleNotificationUpdate(notification: any, channelName: string) {
    console.log('알림 상태 업데이트:', notification);

    // 알림 읽음 상태 등의 업데이트 처리
    // UI에서 알림 상태 반영 로직 구현
  }

  // 알림 데이터 보강
  private async enrichNotificationData(
    change: OrganizationChangeNotification
  ): Promise<OrganizationChangeNotification> {
    try {
      // 직원 및 변경자 정보 조회
      const { data: employeeData } = await supabaseClient
        .from('v_organization_full')
        .select('name, email, position_title')
        .eq('id', change.employee_id)
        .single();

      const { data: changerData } = await supabaseClient
        .from('employees')
        .select('name, email')
        .eq('id', change.changed_by)
        .single();

      return {
        ...change,
        employee: employeeData || undefined,
        changer: changerData || undefined
      };
    } catch (error) {
      console.error('알림 데이터 보강 오류:', error);
      return change;
    }
  }

  // 브라우저 알림 표시
  private showBrowserNotification(change: OrganizationChangeNotification) {
    const titles: Record<string, string> = {
      'team_join': '팀 합류 알림',
      'promotion': '승진 축하드립니다!',
      'transfer': '조직 이동 알림',
      'assignment_change': '담당 업무 변경 알림'
    };

    const messages: Record<string, string> = {
      'team_join': `${change.employee?.name}님이 새로운 팀에 합류했습니다.`,
      'promotion': `${change.employee?.name}님이 승진하셨습니다.`,
      'transfer': `${change.employee?.name}님의 조직이 변경되었습니다.`,
      'assignment_change': '업무 담당자가 변경되었습니다.'
    };

    new Notification(
      titles[change.change_type] || '조직 변경 알림',
      {
        body: messages[change.change_type] || '조직 정보가 변경되었습니다.',
        icon: '/favicon.ico',
        tag: `org_change_${change.id}`,
        requireInteraction: false
      }
    );
  }

  // 알림 권한 요청
  static async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('이 브라우저는 데스크톱 알림을 지원하지 않습니다.');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  // 특정 채널 구독 해제
  unsubscribe(channelName?: string) {
    if (channelName) {
      const channel = this.channels.get(channelName);
      if (channel) {
        supabaseClient.removeChannel(channel);
        this.channels.delete(channelName);
        this.listeners.delete(channelName);
        console.log(`📪 실시간 구독 해제: ${channelName}`);
      }
    } else {
      // 모든 채널 구독 해제
      this.channels.forEach((channel, name) => {
        supabaseClient.removeChannel(channel);
        console.log(`📪 실시간 구독 해제: ${name}`);
      });
      this.channels.clear();
      this.listeners.clear();
    }
  }

  // 연결 상태 확인
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    // Supabase Realtime 연결 상태 확인
    return 'connected'; // 실제 구현 시 supabaseClient의 상태 확인
  }

  // 활성 구독 목록
  getActiveSubscriptions(): string[] {
    return Array.from(this.channels.keys());
  }
}

// 전역 실시간 관리자 인스턴스
export const organizationRealtimeManager = new OrganizationRealtimeManager();

// React Hook 형태의 간편한 사용법
export const useOrganizationRealtime = (
  scope: 'all' | 'department' | 'team' | 'user',
  scopeId?: string
) => {
  const [notifications, setNotifications] = React.useState<OrganizationChangeNotification[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    const listener: RealtimeNotificationListener = (notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 49)]); // 최대 50개 유지
    };

    const channel = organizationRealtimeManager.subscribeToOrganizationChanges(
      scope,
      scopeId,
      listener
    );

    setIsConnected(true);

    return () => {
      organizationRealtimeManager.unsubscribe(`org_changes_${scope}${scopeId ? `_${scopeId}` : ''}`);
      setIsConnected(false);
    };
  }, [scope, scopeId]);

  const clearNotifications = () => setNotifications([]);

  return {
    notifications,
    isConnected,
    clearNotifications,
    connectionStatus: organizationRealtimeManager.getConnectionStatus()
  };
};

// 업무 담당자 변경 실시간 Hook
export const useTaskAssignmentRealtime = (employeeId?: string, taskId?: string) => {
  const [assignments, setAssignments] = React.useState<OrganizationChangeNotification[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    const listener: RealtimeNotificationListener = (notification) => {
      setAssignments(prev => [notification, ...prev.slice(0, 19)]); // 최대 20개 유지
    };

    const channel = organizationRealtimeManager.subscribeToTaskAssignmentChanges(
      employeeId,
      taskId,
      listener
    );

    setIsConnected(true);

    return () => {
      organizationRealtimeManager.unsubscribe(
        `task_assignments${employeeId ? `_emp_${employeeId}` : ''}${taskId ? `_task_${taskId}` : ''}`
      );
      setIsConnected(false);
    };
  }, [employeeId, taskId]);

  return {
    assignments,
    isConnected,
    clearAssignments: () => setAssignments([])
  };
};

// 알림 검증 및 테스트 유틸리티
export class NotificationValidator {
  // 알림 발송 테스트
  static async testNotificationDelivery(
    changeType: OrganizationChangeNotification['change_type'],
    employeeId: string,
    additionalData?: Partial<OrganizationChangeNotification>
  ): Promise<boolean> {
    try {
      console.log('🧪 알림 발송 테스트 시작:', { changeType, employeeId });

      // 테스트용 조직 변경 기록 생성
      const testChange: Partial<OrganizationChangeNotification> = {
        employee_id: employeeId,
        change_type: changeType,
        changed_by: 'test-admin',
        reason: '알림 시스템 테스트',
        ...additionalData
      };

      const response = await fetch('/api/organization/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          action: 'test_notification',
          ...testChange
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 알림 발송 테스트 성공');
        return true;
      } else {
        console.error('❌ 알림 발송 테스트 실패:', result.error);
        return false;
      }

    } catch (error) {
      console.error('❌ 알림 발송 테스트 오류:', error);
      return false;
    }
  }

  // 실시간 연결 테스트
  static async testRealtimeConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      let hasReceived = false;
      const timeout = setTimeout(() => {
        if (!hasReceived) {
          console.error('❌ 실시간 연결 테스트 타임아웃');
          resolve(false);
        }
      }, 5000);

      const testListener: RealtimeNotificationListener = (notification) => {
        if (notification.reason?.includes('연결 테스트')) {
          hasReceived = true;
          clearTimeout(timeout);
          console.log('✅ 실시간 연결 테스트 성공');
          resolve(true);
        }
      };

      // 테스트용 구독
      organizationRealtimeManager.subscribeToOrganizationChanges(
        'all',
        undefined,
        testListener
      );

      // 테스트 알림 발송
      this.testNotificationDelivery('role_change', 'test-employee', {
        reason: '실시간 연결 테스트'
      });
    });
  }

  // 알림 누락 검증
  static async validateNotificationDelivery(
    startTime: Date,
    endTime: Date
  ): Promise<{
    total_changes: number;
    notifications_sent: number;
    missing_notifications: number;
    success_rate: number;
  }> {
    try {
      // 해당 기간의 조직 변경 건수 조회
      const changesResponse = await fetch(
        `/api/organization/task-assignments?start_time=${startTime.toISOString()}&end_time=${endTime.toISOString()}`
      );
      const changesData = await changesResponse.json();

      // 해당 기간의 알림 발송 건수 조회
      const notificationsResponse = await fetch(
        `/api/notifications?type=organization_change&start_time=${startTime.toISOString()}&end_time=${endTime.toISOString()}`
      );
      const notificationsData = await notificationsResponse.json();

      const totalChanges = changesData.data?.length || 0;
      const notificationsSent = notificationsData.data?.length || 0;
      const missingNotifications = Math.max(0, totalChanges - notificationsSent);
      const successRate = totalChanges > 0 ? (notificationsSent / totalChanges) * 100 : 100;

      console.log('📊 알림 전달 검증 결과:', {
        total_changes: totalChanges,
        notifications_sent: notificationsSent,
        missing_notifications: missingNotifications,
        success_rate: successRate.toFixed(2) + '%'
      });

      return {
        total_changes: totalChanges,
        notifications_sent: notificationsSent,
        missing_notifications: missingNotifications,
        success_rate: successRate
      };

    } catch (error) {
      console.error('❌ 알림 전달 검증 오류:', error);
      throw error;
    }
  }
}