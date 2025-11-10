// utils/supabase-direct-upload.ts
// Supabase Storage 직접 업로드 유틸리티
// Vercel 4.5MB 제한을 우회하고 안정적인 대용량 파일 업로드 지원

import { createClient } from '@supabase/supabase-js';
import { compressImage } from './client-image-processor';

// Supabase 클라이언트 생성 (클라이언트 측)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface DirectUploadOptions {
  businessName: string;
  systemType: 'presurvey' | 'completion';
  fileType: 'basic' | 'discharge' | 'prevention';
  facilityInfo?: string;
  facilityId?: string;
  facilityNumber?: string;
  onProgress?: (percent: number) => void;
}

export interface DirectUploadResult {
  success: boolean;
  filePath?: string;
  publicUrl?: string;
  fileId?: string;
  fileData?: any;
  error?: string;
}

/**
 * Supabase Storage에 직접 파일 업로드
 * Progressive Compression 자동 적용
 */
export async function uploadToSupabaseStorage(
  file: File,
  options: DirectUploadOptions
): Promise<DirectUploadResult> {
  const startTime = Date.now();

  try {
    console.log(`🚀 [DIRECT-UPLOAD] Supabase Storage 직접 업로드 시작: ${file.name} (${(file.size/1024/1024).toFixed(2)}MB)`);

    // 1단계: Progressive Compression (클라이언트 측)
    options.onProgress?.(10);
    console.log(`🗜️ [DIRECT-UPLOAD] Progressive Compression 시작...`);

    const compressedResult = await compressImage(file);
    const compressedFile = compressedResult.file;

    console.log(`✅ [DIRECT-UPLOAD] 압축 완료:`, {
      원본: `${(file.size/1024/1024).toFixed(2)}MB`,
      압축후: `${(compressedFile.size/1024/1024).toFixed(2)}MB`,
      압축률: `${((1 - compressedResult.compressionRatio) * 100).toFixed(1)}% 감소`,
      처리시간: `${compressedResult.processingTime.toFixed(0)}ms`
    });

    options.onProgress?.(30);

    // 2단계: 파일 경로 생성 (ASCII 호환)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sanitizedBusinessName = options.businessName
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      || 'business';

    // 파일 확장자 추출
    const fileExtension = compressedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const baseFilename = compressedFile.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

    const filename = `${timestamp}_${baseFilename}.${fileExtension}`;
    const filePath = `${sanitizedBusinessName}/${options.systemType}/${options.fileType}/${filename}`;

    console.log(`📁 [DIRECT-UPLOAD] 업로드 경로: ${filePath}`);

    options.onProgress?.(40);

    // 3단계: Supabase Storage에 직접 업로드
    console.log(`📤 [DIRECT-UPLOAD] Supabase Storage 업로드 중...`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('facility-files')
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: compressedFile.type
      });

    if (uploadError) {
      console.error(`❌ [DIRECT-UPLOAD] Storage 업로드 실패:`, uploadError);
      throw new Error(`Storage 업로드 실패: ${uploadError.message}`);
    }

    console.log(`✅ [DIRECT-UPLOAD] Supabase Storage 업로드 완료: ${uploadData.path}`);

    options.onProgress?.(70);

    // 4단계: Public URL 생성
    const { data: publicUrlData } = supabase.storage
      .from('facility-files')
      .getPublicUrl(uploadData.path);

    console.log(`🔗 [DIRECT-UPLOAD] Public URL 생성: ${publicUrlData.publicUrl}`);

    options.onProgress?.(80);

    // 5단계: 메타데이터를 Vercel API로 전송 (DB 저장)
    console.log(`💾 [DIRECT-UPLOAD] 메타데이터 저장 중...`);

    const metadataResponse = await fetch('/api/upload-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: options.businessName,
        systemType: options.systemType,
        fileType: options.fileType,
        facilityInfo: options.facilityInfo,
        facilityId: options.facilityId,
        facilityNumber: options.facilityNumber,
        filename: compressedFile.name,
        originalFilename: file.name,
        filePath: uploadData.path,
        fileSize: compressedFile.size,
        originalSize: file.size,
        mimeType: compressedFile.type,
        publicUrl: publicUrlData.publicUrl
      })
    });

    let fileId: string | undefined;
    let fileData: any = null;

    if (!metadataResponse.ok) {
      console.warn('⚠️ [DIRECT-UPLOAD] 메타데이터 저장 실패, 파일은 이미 업로드됨');
    } else {
      const metadataResult = await metadataResponse.json();
      fileId = metadataResult.fileId;
      fileData = metadataResult.fileData;
      console.log(`✅ [DIRECT-UPLOAD] 메타데이터 저장 완료: ${fileId}`);
    }

    options.onProgress?.(100);

    const uploadTime = Date.now() - startTime;
    console.log(`🎉 [DIRECT-UPLOAD] 전체 완료:`, {
      파일: file.name,
      총처리시간: `${uploadTime}ms`,
      최종크기: `${(compressedFile.size/1024/1024).toFixed(2)}MB`,
      URL: publicUrlData.publicUrl
    });

    return {
      success: true,
      filePath: uploadData.path,
      publicUrl: publicUrlData.publicUrl,
      fileId,
      fileData
    };

  } catch (error) {
    console.error('❌ [DIRECT-UPLOAD] 실패:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 여러 파일 병렬 업로드
 * 안정성을 위해 동시 업로드 수 제한
 */
export async function uploadMultipleToSupabase(
  files: File[],
  options: DirectUploadOptions,
  onFileProgress?: (fileIndex: number, percent: number) => void,
  concurrency: number = 3 // 동시 업로드 수 (기본 3개)
): Promise<DirectUploadResult[]> {
  console.log(`📦 [BATCH-DIRECT-UPLOAD] ${files.length}개 파일 업로드 시작 (동시: ${concurrency}개)`);

  const results: DirectUploadResult[] = [];

  // 청크 단위로 병렬 업로드
  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    console.log(`📦 [BATCH-DIRECT-UPLOAD] 청크 ${Math.floor(i / concurrency) + 1}/${Math.ceil(files.length / concurrency)} 처리 중 (${chunk.length}개 파일)`);

    const chunkPromises = chunk.map((file, chunkIndex) => {
      const globalIndex = i + chunkIndex;
      return uploadToSupabaseStorage(file, {
        ...options,
        onProgress: (percent) => onFileProgress?.(globalIndex, percent)
      });
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    const successCount = chunkResults.filter(r => r.success).length;
    console.log(`✅ [BATCH-DIRECT-UPLOAD] 청크 완료: ${successCount}/${chunk.length} 성공`);
  }

  const totalSuccess = results.filter(r => r.success).length;
  console.log(`🎉 [BATCH-DIRECT-UPLOAD] 전체 완료: ${totalSuccess}/${files.length} 성공`);

  return results;
}
