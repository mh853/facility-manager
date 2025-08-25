import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL, R2_ENABLED, checkR2Health } from '@/lib/r2-client';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  // R2 비활성화 시 즉시 에러 반환
  if (!R2_ENABLED) {
    return NextResponse.json(
      { 
        error: 'R2가 비활성화되어 있습니다. 환경변수를 확인하세요.',
        details: 'Cloudflare R2 환경변수가 설정되지 않았습니다.'
      },
      { status: 503 }
    );
  }

  // R2 상태 체크
  const isHealthy = await checkR2Health();
  if (!isHealthy) {
    return NextResponse.json(
      { 
        error: 'R2 서비스에 연결할 수 없습니다.',
        details: 'Cloudflare R2 서비스가 일시적으로 이용할 수 없습니다.'
      },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const businessName = formData.get('businessName') as string;
    const category = formData.get('category') as string;

    if (!file || !businessName || !category) {
      return NextResponse.json(
        { error: '파일, 사업장명, 카테고리가 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 확장자 추출
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !['jpg', 'jpeg', 'png', 'webp'].includes(fileExtension)) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다. (jpg, png, webp만 지원)' },
        { status: 400 }
      );
    }

    // 고유 파일명 생성 (타임스탬프 + 랜덤)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomId = crypto.randomBytes(8).toString('hex');
    const fileName = `${timestamp}-${randomId}.${fileExtension}`;
    
    // R2 저장 경로
    const key = `${businessName}/${category}/${fileName}`;

    // 파일을 Buffer로 변환
    const buffer = Buffer.from(await file.arrayBuffer());

    // R2에 업로드
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        originalName: file.name,
        businessName: businessName,
        category: category,
        uploadedAt: new Date().toISOString(),
      },
    });

    if (!r2Client) {
      throw new Error('R2 클라이언트가 초기화되지 않았습니다.');
    }
    
    await r2Client.send(command);

    // 공개 URL 생성
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      success: true,
      data: {
        fileName: fileName,
        originalName: file.name,
        r2Url: publicUrl,
        r2Key: key,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('R2 업로드 에러:', error);
    return NextResponse.json(
      { 
        error: 'R2 업로드에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}