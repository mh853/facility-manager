import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 토큰에서 사용자 정보 추출
function getUserFromToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    // 임시 사용자 정보 (실제로는 토큰에서 추출)
    return {
      id: 'user_1',
      name: '관리자',
      email: 'admin@blueon.kr'
    };
  } catch (error) {
    console.error('토큰 파싱 오류:', error);
    return null;
  }
}

// 기본 알림 설정
const defaultSettings = {
  taskNotifications: true,
  systemNotifications: true,
  securityNotifications: true,
  reportNotifications: true,
  userNotifications: true,
  businessNotifications: true,
  fileNotifications: true,
  maintenanceNotifications: true,
  pushNotificationsEnabled: true,
  emailNotificationsEnabled: false,
  soundNotificationsEnabled: true,
  showLowPriority: true,
  showMediumPriority: true,
  showHighPriority: true,
  showCriticalPriority: true,
  quietHoursStart: '22:00:00',
  quietHoursEnd: '08:00:00',
  quietHoursEnabled: false
};

// GET: 사용자 알림 설정 조회
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    // 사용자 설정 조회
    const { data: settings, error } = await supabase
      .from('user_notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116은 "not found" 오류
      console.error('알림 설정 조회 오류:', error);
      return NextResponse.json(
        { success: false, error: { message: '설정 조회에 실패했습니다.' } },
        { status: 500 }
      );
    }

    // 설정이 없으면 기본 설정 반환
    if (!settings) {
      return NextResponse.json({
        success: true,
        data: defaultSettings,
        isDefault: true
      });
    }

    // 데이터베이스 필드명을 클라이언트 형식으로 변환
    const clientSettings = {
      taskNotifications: settings.task_notifications,
      systemNotifications: settings.system_notifications,
      securityNotifications: settings.security_notifications,
      reportNotifications: settings.report_notifications,
      userNotifications: settings.user_notifications,
      businessNotifications: settings.business_notifications,
      fileNotifications: settings.file_notifications,
      maintenanceNotifications: settings.maintenance_notifications,
      pushNotificationsEnabled: settings.push_notifications_enabled,
      emailNotificationsEnabled: settings.email_notifications_enabled,
      soundNotificationsEnabled: settings.sound_notifications_enabled,
      showLowPriority: settings.show_low_priority,
      showMediumPriority: settings.show_medium_priority,
      showHighPriority: settings.show_high_priority,
      showCriticalPriority: settings.show_critical_priority,
      quietHoursStart: settings.quiet_hours_start,
      quietHoursEnd: settings.quiet_hours_end,
      quietHoursEnabled: settings.quiet_hours_enabled
    };

    return NextResponse.json({
      success: true,
      data: clientSettings,
      isDefault: false
    });

  } catch (error) {
    console.error('알림 설정 조회 API 오류:', error);
    return NextResponse.json(
      { success: false, error: { message: '서버 내부 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}

// PUT: 사용자 알림 설정 업데이트
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const clientSettings = await request.json();

    // 클라이언트 형식을 데이터베이스 필드명으로 변환
    const dbSettings = {
      user_id: user.id,
      user_name: user.name,
      task_notifications: clientSettings.taskNotifications,
      system_notifications: clientSettings.systemNotifications,
      security_notifications: clientSettings.securityNotifications,
      report_notifications: clientSettings.reportNotifications,
      user_notifications: clientSettings.userNotifications,
      business_notifications: clientSettings.businessNotifications,
      file_notifications: clientSettings.fileNotifications,
      maintenance_notifications: clientSettings.maintenanceNotifications,
      push_notifications_enabled: clientSettings.pushNotificationsEnabled,
      email_notifications_enabled: clientSettings.emailNotificationsEnabled,
      sound_notifications_enabled: clientSettings.soundNotificationsEnabled,
      show_low_priority: clientSettings.showLowPriority,
      show_medium_priority: clientSettings.showMediumPriority,
      show_high_priority: clientSettings.showHighPriority,
      show_critical_priority: clientSettings.showCriticalPriority,
      quiet_hours_start: clientSettings.quietHoursStart,
      quiet_hours_end: clientSettings.quietHoursEnd,
      quiet_hours_enabled: clientSettings.quietHoursEnabled,
      updated_at: new Date().toISOString()
    };

    // UPSERT를 사용하여 설정 저장/업데이트
    const { data: updatedSettings, error } = await supabase
      .from('user_notification_settings')
      .upsert(dbSettings, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('알림 설정 업데이트 오류:', error);
      return NextResponse.json(
        { success: false, error: { message: '설정 업데이트에 실패했습니다.' } },
        { status: 500 }
      );
    }

    // 응답을 클라이언트 형식으로 변환
    const responseSettings = {
      taskNotifications: updatedSettings.task_notifications,
      systemNotifications: updatedSettings.system_notifications,
      securityNotifications: updatedSettings.security_notifications,
      reportNotifications: updatedSettings.report_notifications,
      userNotifications: updatedSettings.user_notifications,
      businessNotifications: updatedSettings.business_notifications,
      fileNotifications: updatedSettings.file_notifications,
      maintenanceNotifications: updatedSettings.maintenance_notifications,
      pushNotificationsEnabled: updatedSettings.push_notifications_enabled,
      emailNotificationsEnabled: updatedSettings.email_notifications_enabled,
      soundNotificationsEnabled: updatedSettings.sound_notifications_enabled,
      showLowPriority: updatedSettings.show_low_priority,
      showMediumPriority: updatedSettings.show_medium_priority,
      showHighPriority: updatedSettings.show_high_priority,
      showCriticalPriority: updatedSettings.show_critical_priority,
      quietHoursStart: updatedSettings.quiet_hours_start,
      quietHoursEnd: updatedSettings.quiet_hours_end,
      quietHoursEnabled: updatedSettings.quiet_hours_enabled
    };

    return NextResponse.json({
      success: true,
      data: responseSettings,
      message: '알림 설정이 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('알림 설정 업데이트 API 오류:', error);
    return NextResponse.json(
      { success: false, error: { message: '서버 내부 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}

// DELETE: 사용자 알림 설정 초기화 (기본값으로 복원)
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    // 사용자 설정 삭제 (기본값 사용)
    const { error } = await supabase
      .from('user_notification_settings')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('알림 설정 초기화 오류:', error);
      return NextResponse.json(
        { success: false, error: { message: '설정 초기화에 실패했습니다.' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: defaultSettings,
      message: '알림 설정이 기본값으로 초기화되었습니다.'
    });

  } catch (error) {
    console.error('알림 설정 초기화 API 오류:', error);
    return NextResponse.json(
      { success: false, error: { message: '서버 내부 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}