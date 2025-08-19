// lib/email-service.ts
import { Resend } from 'resend';
import { render } from '@react-email/render';
import CompletionNotification from '@/emails/CompletionNotification';
import { SystemType } from '@/types';

const resend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_dummy_key_not_used' 
  ? new Resend(process.env.RESEND_API_KEY) 
  : null;

export interface CompletionEmailData {
  businessName: string;
  systemType: SystemType;
  installer: string;
  contact: string;
  installDate: string;
  uploadedFileCount: number;
  memo?: string;
  completedAt: string;
  driveUrl?: string;
}

export interface ErrorEmailData {
  businessName: string;
  systemType: SystemType;
  errorMessage: string;
  errorTime: string;
  userAgent?: string;
}

export class EmailService {
  private static instance: EmailService;
  
  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private isEmailEnabled(): boolean {
    return !!(resend && 
             process.env.EMAIL_FROM && 
             process.env.EMAIL_TO_ADMIN &&
             process.env.EMAIL_FROM !== 'noreply@example.com');
  }

  async sendCompletionNotification(data: CompletionEmailData): Promise<boolean> {
    if (!this.isEmailEnabled()) {
      console.log('📧 이메일 기능이 비활성화되어 있습니다. 완료 알림을 건너뜁니다.');
      return true; // 비활성화 상태를 성공으로 간주
    }

    try {
      const systemTitle = data.systemType === 'presurvey' ? '설치 전 실사' : '설치완료 보고서';
      
      const emailHtml = render(CompletionNotification(data));
      
      // 관리자에게 이메일 전송
      const adminEmail = await resend!.emails.send({
        from: process.env.EMAIL_FROM!,
        to: [process.env.EMAIL_TO_ADMIN!],
        subject: `[시설관리] ${systemTitle} 작업 완료 - ${data.businessName}`,
        html: emailHtml,
      });

      // 사업장 담당자가 있으면 추가 전송
      if (data.contact && this.isValidEmail(data.contact)) {
        await resend!.emails.send({
          from: process.env.EMAIL_FROM!,
          to: [data.contact],
          subject: `[시설관리] ${data.businessName} ${systemTitle} 작업 완료 안내`,
          html: emailHtml,
        });
      }

      console.log('✅ 완료 알림 이메일이 전송되었습니다:', adminEmail.data?.id);
      return true;
    } catch (error) {
      console.error('❌ 완료 알림 이메일 전송 실패:', error);
      return false; // 이메일 실패는 전체 작업을 막지 않음
    }
  }

  async sendErrorNotification(data: ErrorEmailData): Promise<boolean> {
    if (!this.isEmailEnabled()) {
      console.log('📧 이메일 기능이 비활성화되어 있습니다. 오류 알림을 건너뜁니다.');
      return true;
    }

    try {
      const simpleErrorHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">⚠️ 시스템 오류 발생</h2>
          <p><strong>${data.businessName}</strong>에서 오류가 발생했습니다.</p>
          <div style="background: #fef2f2; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>오류 시간:</strong> ${data.errorTime}</p>
            <p><strong>오류 메시지:</strong> ${data.errorMessage}</p>
          </div>
        </div>
      `;
      
      const result = await resend!.emails.send({
        from: process.env.EMAIL_FROM!,
        to: [process.env.EMAIL_TO_ADMIN!],
        subject: `[시설관리 오류] ${data.businessName} - 시스템 오류 발생`,
        html: simpleErrorHtml,
        priority: 'high',
      });

      console.log('✅ 오류 알림 이메일이 전송되었습니다:', result.data?.id);
      return true;
    } catch (error) {
      console.error('❌ 오류 알림 이메일 전송 실패:', error);
      return false;
    }
  }

  async sendFileUploadNotification(
    businessName: string, 
    systemType: SystemType, 
    fileCount: number,
    facilityInfo: string
  ): Promise<boolean> {
    if (!this.isEmailEnabled()) {
      console.log('📧 이메일 기능이 비활성화되어 있습니다. 업로드 알림을 건너뜁니다.');
      return true;
    }

    try {
      const systemTitle = systemType === 'presurvey' ? '설치 전 실사' : '설치완료 보고서';
      
      const simpleEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1976d2;">📁 파일 업로드 완료</h2>
          <p><strong>${businessName}</strong>에서 ${facilityInfo} 파일 ${fileCount}장이 업로드되었습니다.</p>
          <p style="color: #6b7280; font-size: 14px;">시스템: ${systemTitle}</p>
          <p style="color: #6b7280; font-size: 14px;">업로드 시간: ${new Date().toLocaleString('ko-KR')}</p>
        </div>
      `;

      await resend!.emails.send({
        from: process.env.EMAIL_FROM!,
        to: [process.env.EMAIL_TO_ADMIN!],
        subject: `[시설관리] ${businessName} - 파일 업로드 완료 (${fileCount}장)`,
        html: simpleEmailHtml,
      });

      return true;
    } catch (error) {
      console.error('❌ 업로드 알림 이메일 전송 실패:', error);
      return false;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// 에러 핸들링 유틸리티
export class ErrorHandler {
  static async handleError(
    error: Error,
    context: {
      businessName?: string;
      systemType?: SystemType;
      userAgent?: string;
    }
  ) {
    console.error('Application error:', error);
    
    // 중요한 오류인 경우 이메일 알림 전송 (이메일이 활성화된 경우만)
    if (context.businessName && context.systemType) {
      try {
        const emailService = EmailService.getInstance();
        await emailService.sendErrorNotification({
          businessName: context.businessName,
          systemType: context.systemType,
          errorMessage: error.message,
          errorTime: new Date().toLocaleString('ko-KR'),
          userAgent: context.userAgent,
        });
      } catch (emailError) {
        console.error('이메일 알림 전송 실패 (무시됨):', emailError);
      }
    }
  }
}
