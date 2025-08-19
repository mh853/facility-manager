// emails/CompletionNotification.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
} from '@react-email/components';

interface CompletionNotificationProps {
  businessName: string;
  systemType: 'completion' | 'presurvey';
  installer: string;
  contact: string;
  installDate: string;
  uploadedFileCount: number;
  memo?: string;
  completedAt: string;
  driveUrl?: string;
}

export default function CompletionNotification({
  businessName,
  systemType,
  installer,
  contact,
  installDate,
  uploadedFileCount,
  memo,
  completedAt,
  driveUrl
}: CompletionNotificationProps) {
  const systemTitle = systemType === 'presurvey' ? '설치 전 실사' : '설치완료 보고서';
  
  return (
    <Html>
      <Head />
      <Preview>{systemTitle} 작업 완료 - {businessName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            🏢 {systemTitle} 작업 완료
          </Heading>
          
          <Section style={section}>
            <Text style={text}>
              <strong>{businessName}</strong>의 {systemTitle} 작업이 완료되었습니다.
            </Text>
          </Section>

          <Section style={infoSection}>
            <Heading style={h2}>📋 작업 정보</Heading>
            <div style={infoGrid}>
              <div style={infoItem}>
                <Text style={label}>🏢 사업장명</Text>
                <Text style={value}>{businessName}</Text>
              </div>
              <div style={infoItem}>
                <Text style={label}>👤 {systemType === 'presurvey' ? '실사담당자' : '설치담당자'}</Text>
                <Text style={value}>{installer}</Text>
              </div>
              <div style={infoItem}>
                <Text style={label}>📞 연락처</Text>
                <Text style={value}>{contact}</Text>
              </div>
              <div style={infoItem}>
                <Text style={label}>📅 {systemType === 'presurvey' ? '실사일' : '설치일'}</Text>
                <Text style={value}>{installDate}</Text>
              </div>
              <div style={infoItem}>
                <Text style={label}>📁 업로드된 파일</Text>
                <Text style={value}>{uploadedFileCount}장</Text>
              </div>
              <div style={infoItem}>
                <Text style={label}>⏰ 완료 시간</Text>
                <Text style={value}>{completedAt}</Text>
              </div>
            </div>
          </Section>

          {memo && (
            <Section style={memoSection}>
              <Heading style={h2}>📝 특이사항 및 전달사항</Heading>
              <Text style={memoText}>{memo}</Text>
            </Section>
          )}

          {driveUrl && (
            <Section style={section}>
              <Button style={button} href={driveUrl}>
                📁 Google Drive에서 파일 확인하기
              </Button>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}

// 스타일 정의
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
  borderRadius: '8px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
};

const section = {
  padding: '0 24px',
  marginBottom: '24px',
};

const h1 = {
  color: '#1976d2',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '40px 0 24px',
  textAlign: 'center' as const,
};

const h2 = {
  color: '#374151',
  fontSize: '20px',
  fontWeight: '600',
  margin: '24px 0 16px',
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const infoSection = {
  padding: '24px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  margin: '24px',
};

const infoGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '16px',
  marginTop: '16px',
};

const infoItem = {
  borderBottom: '1px solid #e2e8f0',
  paddingBottom: '12px',
};

const label = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: '500',
  margin: '0 0 4px 0',
};

const value = {
  color: '#1976d2',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
};

const memoSection = {
  padding: '24px',
  backgroundColor: '#fff7ed',
  borderRadius: '8px',
  margin: '24px',
  border: '2px solid #fed7aa',
};

const memoText = {
  color: '#9a3412',
  fontSize: '16px',
  lineHeight: '24px',
  fontWeight: '500',
  whiteSpace: 'pre-wrap' as const,
};

const button = {
  backgroundColor: '#1976d2',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '16px 24px',
  margin: '24px auto',
  maxWidth: '300px',
};
