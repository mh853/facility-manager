// app/api/email-notification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 이메일 설정 인터페이스
interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
}

// 환경변수에서 이메일 설정 로드
function getEmailConfig(): EmailConfig {
  return {
    enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    fromEmail: process.env.FROM_EMAIL || '',
    fromName: process.env.FROM_NAME || '시설관리 시스템',
  };
}

// POST: 이메일 발송
export async function POST(request: NextRequest) {
  try {
    const emailConfig = getEmailConfig();
    
    if (!emailConfig.enabled) {
      return NextResponse.json({
        success: true,
        message: '이메일 알림이 비활성화되어 있습니다.',
        sent: false
      });
    }

    const body = await request.json();
    const { 
      businessName, 
      type = 'completion', 
      recipientEmail,
      facilityCount,
      completedBy,
      completedAt,
      memo = ''
    } = body;

    if (!businessName || !recipientEmail) {
      return NextResponse.json(
        { success: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    console.log(`📧 이메일 발송 시작: ${recipientEmail}`);

    // 이메일 내용 생성
    const emailContent = generateEmailContent({
      businessName,
      type,
      facilityCount,
      completedBy,
      completedAt,
      memo
    });

    const result = await sendEmail({
      config: emailConfig,
      to: recipientEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    });

    if (result.success) {
      console.log(`✅ 이메일 발송 완료: ${recipientEmail}`);
      return NextResponse.json({
        success: true,
        message: '이메일이 성공적으로 발송되었습니다.',
        sent: true,
        recipient: recipientEmail
      });
    } else {
      throw new Error(result.error || '이메일 발송 실패');
    }

  } catch (error) {
    console.error('❌ 이메일 발송 실패:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '이메일 발송 실패',
        sent: false
      },
      { status: 500 }
    );
  }
}

// GET: 이메일 설정 상태 조회
export async function GET() {
  try {
    const emailConfig = getEmailConfig();
    
    return NextResponse.json({
      success: true,
      data: {
        enabled: emailConfig.enabled,
        configured: !!(emailConfig.smtpUser && emailConfig.smtpPass && emailConfig.fromEmail),
        fromName: emailConfig.fromName
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: '설정 조회 실패' },
      { status: 500 }
    );
  }
}

async function sendEmail({ config, to, subject, html, text }: {
  config: EmailConfig;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  try {
    // SMTP 전송기 생성
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
      tls: {
        rejectUnauthorized: false // 개발 환경에서 인증서 문제 해결
      }
    });

    // 이메일 발송
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: to,
      subject: subject,
      text: text,
      html: html,
    });

    console.log('이메일 발송 완료:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('SMTP 발송 실패:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

function generateEmailContent({ businessName, type, facilityCount, completedBy, completedAt, memo }: {
  businessName: string;
  type: string;
  facilityCount?: any;
  completedBy?: string;
  completedAt?: string;
  memo?: string;
}) {
  const isCompletion = type === 'completion';
  const typeText = isCompletion ? '설치완료' : '사전실사';
  
  const subject = `[시설관리] ${businessName} ${typeText} 작업 완료 알림`;
  
  const text = `
${businessName} ${typeText} 작업이 완료되었습니다.

📋 작업 정보:
- 사업장: ${businessName}
- 작업 유형: ${typeText}
- 완료자: ${completedBy || '정보 없음'}
- 완료 시간: ${completedAt || new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
${facilityCount ? `- 시설 수: 배출구 ${facilityCount.outlets}개, 배출시설 ${facilityCount.discharge}개, 방지시설 ${facilityCount.prevention}개` : ''}

${memo ? `📝 특이사항:\n${memo}` : ''}

본 메일은 시설관리 시스템에서 자동으로 발송되었습니다.
  `.trim();

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .status-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; font-size: 14px; margin-top: 10px; }
    .content { padding: 30px; }
    .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .info-item { margin: 10px 0; }
    .info-label { font-weight: bold; color: #555; }
    .info-value { color: #333; }
    .memo-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 5px; margin: 20px 0; }
    .memo-title { font-weight: bold; color: #856404; margin-bottom: 10px; }
    .memo-content { color: #856404; white-space: pre-line; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e9ecef; }
    .emoji { font-size: 1.2em; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat-item { text-align: center; }
    .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
    .stat-label { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1><span class="emoji">🏭</span> ${businessName}</h1>
      <div class="status-badge">${typeText} 작업 완료</div>
    </div>
    
    <div class="content">
      <h2 style="color: #667eea; margin-top: 0;"><span class="emoji">✅</span> 작업이 완료되었습니다!</h2>
      
      <div class="info-box">
        <div class="info-item">
          <span class="info-label"><span class="emoji">🏢</span> 사업장:</span>
          <span class="info-value">${businessName}</span>
        </div>
        <div class="info-item">
          <span class="info-label"><span class="emoji">📋</span> 작업 유형:</span>
          <span class="info-value">${typeText}</span>
        </div>
        <div class="info-item">
          <span class="info-label"><span class="emoji">👤</span> 완료자:</span>
          <span class="info-value">${completedBy || '정보 없음'}</span>
        </div>
        <div class="info-item">
          <span class="info-label"><span class="emoji">🕐</span> 완료 시간:</span>
          <span class="info-value">${completedAt || new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
        </div>
      </div>

      ${facilityCount ? `
      <h3 style="color: #667eea;"><span class="emoji">📊</span> 시설 현황</h3>
      <div class="stats">
        <div class="stat-item">
          <div class="stat-number">${facilityCount.outlets}</div>
          <div class="stat-label">배출구</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${facilityCount.discharge}</div>
          <div class="stat-label">배출시설</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${facilityCount.prevention}</div>
          <div class="stat-label">방지시설</div>
        </div>
      </div>
      ` : ''}

      ${memo ? `
      <div class="memo-box">
        <div class="memo-title"><span class="emoji">📝</span> 특이사항</div>
        <div class="memo-content">${memo}</div>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p><span class="emoji">🤖</span> 본 메일은 시설관리 시스템에서 자동으로 발송되었습니다.</p>
      <p>시스템 문의: <a href="mailto:admin@facility-manager.com">admin@facility-manager.com</a></p>
    </div>
  </div>
</body>
</html>
  `;

  return { subject, text, html };
}