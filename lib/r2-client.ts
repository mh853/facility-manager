import { S3Client } from '@aws-sdk/client-s3';

// R2 설정 검증
const validateR2Config = () => {
  const required = {
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key);

  if (missing.length > 0) {
    console.warn('⚠️ R2 설정 누락:', missing.join(', '));
    return false;
  }

  return true;
};

export const R2_ENABLED = validateR2Config();

// Cloudflare R2 클라이언트 설정 (에러 처리 강화)
export const r2Client = R2_ENABLED ? new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
  maxAttempts: 3, // 재시도 3회
  requestHandler: {
    requestTimeout: 30000, // 30초 타임아웃
  }
}) : null;

export const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || '';
export const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || '';

// R2 상태 체크 함수
export const checkR2Health = async (): Promise<boolean> => {
  if (!R2_ENABLED || !r2Client) {
    return false;
  }

  try {
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
    await r2Client.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
    return true;
  } catch (error) {
    console.warn('⚠️ R2 상태 체크 실패:', error);
    return false;
  }
};