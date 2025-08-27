'use client';

import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { FacilitiesData, SystemType, Facility, UploadedFile } from '@/types';
import { Upload, Zap, Shield, Radio, Wind, Camera, Building, Wrench, Cpu, Power, Settings, Home, Clock, CheckCircle2, RefreshCw, Eye, Download, Trash2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import Image from 'next/image';
import { useFileContext } from '@/contexts/FileContext';

interface FileUploadSectionProps {
  businessName: string;
  systemType: SystemType;
  facilities: FacilitiesData | null;
}

// 고성능 이미지 압축 함수 (모바일 파일명 보정 강화)
const compressImage = async (file: File): Promise<File> => {
  console.log('🔍 [COMPRESS] 압축 전 파일 분석:', {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: new Date(file.lastModified).toISOString(),
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  });

  // 이미지 파일이 아니면 그대로 반환
  if (!file.type.startsWith('image/')) {
    console.warn('⚠️ [COMPRESS] 이미지가 아닌 파일:', file.type);
    return file;
  }
  
  // 500KB 이하면 그대로 반환 (단, 파일명은 보정)
  if (file.size <= 500 * 1024) {
    console.log('📦 [COMPRESS] 작은 파일, 압축 생략');
    return ensureProperFileName(file);
  }

  // 아이폰에서는 JPG가 더 안정적일 수 있음
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const shouldUseJpg = isIOS && (!file.name || !file.name.includes('.') || !file.type);
  
  const options = {
    maxSizeMB: 1, // 1MB로 압축
    maxWidthOrHeight: 1920, // 최대 해상도
    useWebWorker: true, // 웹워커 사용으로 성능 향상
    // 파일 정보 손실된 iOS 파일은 JPG로, 그 외는 WebP로
    fileType: shouldUseJpg ? 'image/jpeg' : 'image/webp'
  };
  
  console.log('🎯 [COMPRESS] 압축 옵션 결정:', {
    isIOS,
    hasFileName: !!file.name,
    hasExtension: file.name?.includes('.'),
    hasMimeType: !!file.type,
    shouldUseJpg,
    selectedFormat: options.fileType
  });

  try {
    console.log('⚙️ [COMPRESS] 압축 시작...');
    const compressedFile = await imageCompression(file, options);
    
    console.log('🔍 [COMPRESS] 압축 후 파일 분석:', {
      name: compressedFile.name,
      type: compressedFile.type,
      size: compressedFile.size
    });
    
    // 압축된 파일의 올바른 확장자로 강제 수정
    const originalName = file.name || `image_${Date.now()}`;
    const nameWithoutExt = originalName.includes('.') 
      ? originalName.substring(0, originalName.lastIndexOf('.'))
      : originalName;
    
    const targetExtension = shouldUseJpg ? 'jpg' : 'webp';
    const targetMimeType = shouldUseJpg ? 'image/jpeg' : 'image/webp';
    const correctedFileName = `${nameWithoutExt}.${targetExtension}`;
    
    // 새로운 File 객체 생성 (압축 형식에 맞는 올바른 이름과 타입)
    const correctedFile = new File([compressedFile], correctedFileName, {
      type: targetMimeType,
      lastModified: compressedFile.lastModified || Date.now()
    });
    
    console.log('✅ [COMPRESS] 압축 및 파일명 보정 완료:', {
      원본이름: file.name || '없음',
      원본타입: file.type || '없음',
      압축후이름: correctedFile.name,
      압축후타입: correctedFile.type,
      압축형식: targetExtension.toUpperCase(),
      원본크기: `${(file.size / 1024).toFixed(1)}KB`,
      압축후크기: `${(correctedFile.size / 1024).toFixed(1)}KB`,
      압축률: `${(100 - (correctedFile.size / file.size) * 100).toFixed(1)}%`,
      isIOSFix: shouldUseJpg
    });
    
    return correctedFile;
  } catch (error) {
    console.error('❌ [COMPRESS] 이미지 압축 실패:', error);
    return ensureProperFileName(file);
  }
};

// 파일명 및 타입 강제 보정 함수 (압축하지 않는 작은 파일용)
const ensureProperFileName = (file: File): File => {
  console.log('🔧 [FILE-FIX] 파일명 보정 시작:', { name: file.name, type: file.type });
  
  // 파일명이 없거나 확장자가 없는 경우
  if (!file.name || !file.name.includes('.')) {
    const extension = getExtensionFromMimeType(file.type) || 'jpg';
    const newName = file.name || `image_${Date.now()}`;
    const correctedName = `${newName}.${extension}`;
    
    const correctedFile = new File([file], correctedName, {
      type: file.type || `image/${extension}`,
      lastModified: file.lastModified
    });
    
    console.log('🔧 [FILE-FIX] 파일명 보정 완료:', {
      원본: file.name,
      보정후: correctedFile.name,
      타입: correctedFile.type
    });
    
    return correctedFile;
  }
  
  return file;
};

// MIME 타입에서 확장자 추출
const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'jpg', // HEIC는 JPG로 처리
    'image/heif': 'jpg', // HEIF는 JPG로 처리
    'image/bmp': 'jpg',
    'image/tiff': 'jpg'
  };
  
  return mimeToExt[mimeType?.toLowerCase()] || 'jpg';
};

// 업로드 아이템 컴포넌트 메모화
const UploadItem = memo(({ 
  uploadId, 
  label, 
  fileType, 
  facilityInfo,
  IconComponent,
  facility,
  onUpload,
  uploadState,
  uploadedFiles,
  onDeleteFile,
  onRefreshFiles
}: {
  uploadId: string;
  label: string;
  fileType: string;
  facilityInfo: string;
  IconComponent: any;
  facility?: Facility;
  onUpload: (uploadId: string, fileType: string, facilityInfo: string) => void;
  uploadState: { files: File[]; status: string; uploading: boolean; progress?: number };
  uploadedFiles: UploadedFile[];
  onDeleteFile: (fileId: string, fileName: string) => void;
  onRefreshFiles: () => void;
}) => {
  // 업로드된 파일 수 변경 감지를 위한 디버깅 (안정화)
  useEffect(() => {
    console.log(`📋 [${uploadId}] 업로드된 파일 수 변경:`, {
      uploadId,
      facilityInfo,
      fileCount: uploadedFiles.length,
      files: uploadedFiles.map(f => ({ id: f.id, name: f.originalName, facilityInfo: f.facilityInfo }))
    });
  }, [uploadedFiles.length, uploadId, facilityInfo]);

  // 시설별 파일 고유 식별자 생성 (업로드 API와 일관된 구조)
  // 기본시설 인덱스 매핑 함수
  const getFacilityIndex = useCallback((facilityName: string) => {
    const name = facilityName.toLowerCase();
    if (name.includes('게이트웨이') || name.includes('gateway')) return '1';
    if (name.includes('제어반') || name.includes('배전함') || name.includes('control')) return '2';
    if (name.includes('송풍기') || name.includes('blower')) return '3';
    if (name.includes('기타') || name.includes('other')) return '4';
    return '0'; // 기본값
  }, []);

  const generateFacilityId = useCallback((facilityInfo: string, fileType: string) => {
    const facilityName = facilityInfo.split('(')[0].trim();
    const outletMatch = facilityInfo.match(/배출구:\s*(\d+)번/);
    const outletNumber = outletMatch ? outletMatch[1] : '0';
    
    if (fileType === 'discharge' || fileType === 'prevention') {
      // 배출/방지시설: outlet_X_disc/prev_facilityName
      const sanitizedFacilityName = facilityName
        .replace(/[가-힣]/g, '')
        .replace(/[^\w\-]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        || 'facility';
      return `outlet_${outletNumber}_${fileType.substring(0, 4)}_${sanitizedFacilityName}`;
    } else {
      // 기본시설: facility_X_basic_facilityName
      const facilityIndex = getFacilityIndex(facilityInfo);
      const sanitizedFacilityName = facilityName
        .replace(/[가-힣]/g, '')
        .replace(/[^\w\-]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        || 'facility';
      return `facility_${facilityIndex}_basic_${sanitizedFacilityName}`;
    }
  }, [getFacilityIndex]);

  // 필터링된 파일들을 메모화하여 안정성 확보 (최강 엄격한 매칭)
  const filteredUploadedFiles = useMemo(() => {
    if (!uploadedFiles || uploadedFiles.length === 0) return [];
    
    console.log(`🎯 [${uploadId}] 필터링 시작 - 현재 시설:`, {
      uploadId,
      currentFacilityInfo: facilityInfo,
      fileType,
      totalFiles: uploadedFiles.length
    });
    
    const filtered = uploadedFiles.filter(file => {
      // 기본적인 폴더 타입 매치 (상세 로깅)
      const expectedFolderName = fileType === 'discharge' ? '배출시설' :
                                fileType === 'prevention' ? '방지시설' : '기본사진';
      const folderMatch = file.folderName === expectedFolderName;
      
      console.log(`🔍 [${uploadId}] 1단계 폴더 검사: ${file.originalName}`, {
        파일폴더명: file.folderName,
        예상폴더명: expectedFolderName,
        파일타입: fileType,
        매치여부: folderMatch
      });
      
      if (!folderMatch) {
        console.log(`❌ [${uploadId}] 1단계 실패 - 폴더 불일치: ${file.originalName}`);
        return false;
      }

      // 🚨 시설정보 기반 필터링 (최근 업로드 파일은 항상 표시)
      const now = new Date().getTime();
      const fileTime = new Date(file.createdTime).getTime();
      const isVeryRecentUpload = now - fileTime < 3 * 60 * 1000; // 3분 이내
      
      console.log(`🔒 [${uploadId}] 2단계 시설정보 검증: ${file.originalName}`, {
        파일시설정보: file.facilityInfo,
        현재시설정보: facilityInfo,
        완전일치여부: file.facilityInfo === facilityInfo,
        최근업로드: isVeryRecentUpload,
        시간차이초: Math.round((now - fileTime) / 1000)
      });
      
      // 완전 일치하는 경우
      if (file.facilityInfo === facilityInfo) {
        console.log(`✅ [${uploadId}] 2단계 통과 - 완전 일치: ${file.originalName}`);
        return true;
      }
      
      // ⭐ 최근 업로드 파일은 무조건 표시 (사라지지 않게)
      if (isVeryRecentUpload) {
        console.log(`⭐ [${uploadId}] 최근 업로드 파일 - 무조건 표시: ${file.originalName}`);
        return true;
      }
      
      // 📁 시설명 기반 폴더 검증
      if (fileType === 'discharge' || fileType === 'prevention') {
        const currentFacilityName = facilityInfo.split('(')[0].trim();
        const currentFacilityNumber = currentFacilityName.match(/(\d+)/)?.[1] || '0';
        const shortType = fileType === 'discharge' ? 'discharge' : 'prevention';
        
        if (currentFacilityNumber && file.filePath) {
          const expectedPathPattern = `facility_${shortType}${currentFacilityNumber}`;
          const pathMatch = file.filePath.includes(expectedPathPattern);
          
          console.log(`📁 [${uploadId}] 시설명 기반 폴더 검증: ${file.originalName}`, {
            현재시설명: currentFacilityName,
            시설번호: currentFacilityNumber,
            시설타입: shortType,
            예상경로패턴: expectedPathPattern,
            실제파일경로: file.filePath,
            경로매치: pathMatch
          });
          
          if (pathMatch) {
            console.log(`✅ [${uploadId}] 시설명 폴더 매치 성공: ${file.originalName}`);
            return true;
          }
        }
      } else if (fileType === 'basic') {
        // 기본시설도 숫자 ID 기반 검증
        const facilityName = facilityInfo.split('(')[0].trim();
        const facilityIndex = getFacilityIndex(facilityName);
        
        if (file.filePath) {
          const expectedPathPattern = `facility_${facilityIndex}`;
          const pathMatch = file.filePath.includes(expectedPathPattern);
          
          console.log(`📁 [${uploadId}] 기본시설 숫자 ID 검증: ${file.originalName}`, {
            시설명: facilityName,
            시설인덱스: facilityIndex,
            예상경로패턴: expectedPathPattern,
            실제파일경로: file.filePath,
            경로매치: pathMatch
          });
          
          if (pathMatch) {
            console.log(`✅ [${uploadId}] 기본시설 숫자 ID 매치 성공: ${file.originalName}`);
            return true;
          }
        }
      }
      
      console.warn(`🚨 [${uploadId}] 2단계 실패 - 오래된 파일로 시설정보 불일치: ${file.originalName}`);
      return false;
    });
    
    console.log(`📋 [${uploadId}] 단순 시설정보 필터링 결과:`, {
      total: uploadedFiles.length,
      filtered: filtered.length,
      facilityInfo,
      fileType
    });
    
    return filtered;
  }, [uploadedFiles, facilityInfo, fileType, uploadId, generateFacilityId]);
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;
    
    // 중복 파일 감지 (클라이언트 측)
    const fileArray = Array.from(files);
    const duplicates: string[] = [];
    const sizeMap = new Map<number, string[]>();
    
    // 크기별로 파일 그룹화하여 중복 감지
    fileArray.forEach((file, index) => {
      const size = file.size;
      if (!sizeMap.has(size)) {
        sizeMap.set(size, []);
      }
      sizeMap.get(size)!.push(file.name);
    });
    
    // 같은 크기의 파일들이 있는지 확인
    sizeMap.forEach((names, size) => {
      if (names.length > 1) {
        duplicates.push(`크기 ${(size / 1024).toFixed(1)}KB: ${names.join(', ')}`);
      }
    });
    
    if (duplicates.length > 0) {
      alert(`중복 파일이 감지되었습니다:\n${duplicates.join('\n')}\n\n중복된 파일들을 제거한 후 다시 업로드하세요.`);
      return;
    }
    
    console.log(`파일 압축 시작: ${files.length}개 파일`);
    const startTime = Date.now();
    
    // 병렬 압축 처리
    const compressionPromises = Array.from(files).slice(0, 10).map(async (file, index) => {
      try {
        const optimizedFile = await compressImage(file);
        return { file: optimizedFile, index, success: true };
      } catch (error) {
        console.warn(`파일 ${index + 1} 압축 실패:`, error);
        return { file, index, success: false };
      }
    });
    
    const results = await Promise.all(compressionPromises);
    const optimizedFiles = results.map(r => r.file);
    const compressionTime = Date.now() - startTime;
    
    console.log(`파일 압축 완료: ${compressionTime}ms, 성공: ${results.filter(r => r.success).length}/${results.length}`);
    
    // 부모 컴포넌트에 최적화된 파일 전달
    const event = new CustomEvent('filesSelected', { 
      detail: { uploadId, files: optimizedFiles } 
    });
    window.dispatchEvent(event);
  }, [uploadId]);

  const handleUpload = useCallback(() => {
    onUpload(uploadId, fileType, facilityInfo);
  }, [uploadId, fileType, facilityInfo, onUpload]);

  return (
    <div className="bg-gray-50 rounded-xl p-4 md:p-6 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
      <div className="mb-4">
        <label className="block text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <IconComponent className="w-5 h-5" />
          {label}
        </label>
        
        {/* 시설 정보 표시 */}
        {facility && (
          <div className="bg-white rounded-lg p-3 mb-4 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 text-sm">
              <div>
                <span className="text-gray-600 font-medium">시설명:</span>
                <div className="text-gray-900 font-semibold break-words">{facility.name}</div>
              </div>
              <div>
                <span className="text-gray-600 font-medium">용량:</span>
                <div className="text-gray-900 font-semibold">{facility.capacity}</div>
              </div>
              <div>
                <span className="text-gray-600 font-medium">수량:</span>
                <div className="text-gray-900 font-semibold">{facility.quantity}개</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              배출구 {facility.outlet}번
            </div>
          </div>
        )}
      </div>
      
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="w-full p-3 border-2 border-gray-300 rounded-lg mb-4 bg-white cursor-pointer hover:border-blue-400 transition-colors text-sm"
        disabled={uploadState.uploading}
      />
      
      {/* 업로드 상태만 표시 (프로그레스바 제거) */}
      {uploadState.status && (
        <div className="mb-4">
          <div className="flex items-center gap-2">
            {uploadState.uploading ? (
              <Clock className="w-4 h-4 text-blue-600 animate-spin" />
            ) : uploadState.status.includes('✅') ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : uploadState.status.includes('❌') ? (
              <div className="w-4 h-4 text-red-600">❌</div>
            ) : null}
            <p className={`text-sm ${
              uploadState.status.includes('✅') ? 'text-green-600' : 
              uploadState.status.includes('❌') ? 'text-red-600' : 'text-gray-600'
            }`}>
              {uploadState.status}
            </p>
          </div>
        </div>
      )}
      
      <button
        onClick={handleUpload}
        disabled={!uploadState.files.length || uploadState.uploading}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 px-4 rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed hover:from-blue-700 hover:to-blue-600 transition-all flex items-center justify-center gap-2"
      >
        {uploadState.uploading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            업로드 중...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            업로드 {uploadState.files.length > 0 && `(${uploadState.files.length}개)`}
          </>
        )}
      </button>
      
      {/* 해당 시설의 업로드된 파일들 (안정화된 버전) */}
      {filteredUploadedFiles.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              업로드된 파일 ({filteredUploadedFiles.length}개)
            </h4>
            <button
              onClick={onRefreshFiles}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              새로고침
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredUploadedFiles.map((file) => (
              <div key={file.id} className="border border-gray-200 rounded-lg p-2 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-medium text-gray-900 truncate" title={`원본: ${file.originalName}`}>
                      {/* 시설명_용량_순서 형식으로 표시 */}
                      {(() => {
                        // facility 정보에서 시설명과 용량 추출
                        if (facility) {
                          const facilityName = facility.name.replace(/[^\w가-힣]/g, '').slice(0, 8);
                          // 용량에서 단위 포함하여 정리 (㎥, /, 분 등 단위 보존)
                          const capacity = facility.capacity.replace(/[^\w가-힣㎥\/분시]/g, '').slice(0, 12);
                          const fileIndex = filteredUploadedFiles.findIndex(f => f.id === file.id) + 1;
                          return `${facilityName}_${capacity}_${fileIndex}`;
                        }
                        
                        // facility 정보가 없는 경우 기본 형식
                        const facilityName = facilityInfo.split('(')[0].trim().replace(/[^\w가-힣]/g, '').slice(0, 8);
                        const fileIndex = filteredUploadedFiles.findIndex(f => f.id === file.id) + 1;
                        return `${facilityName}_${fileIndex}`;
                      })()}
                    </h5>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)}KB • {file.originalName}
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteFile(file.id, file.originalName)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="파일 삭제"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                
                {file.mimeType?.startsWith('image/') && (
                  <div className="mb-2 relative aspect-video bg-gray-100 rounded overflow-hidden">
                    <Image
                      src={file.thumbnailUrl}
                      alt={file.originalName}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  </div>
                )}
                
                <div className="flex gap-1">
                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                  >
                    <Eye className="w-3 h-3" />
                    보기
                  </a>
                  <a
                    href={file.downloadUrl}
                    download={file.originalName}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-600 rounded hover:bg-green-200"
                  >
                    <Download className="w-3 h-3" />
                    다운로드
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

UploadItem.displayName = 'UploadItem';

function FileUploadSection({ 
  businessName, 
  systemType, 
  facilities 
}: FileUploadSectionProps) {
  const [uploads, setUploads] = useState<Record<string, { files: File[]; status: string; uploading: boolean }>>({});
  const { uploadedFiles, refreshFiles, removeFile, addFiles, setBusinessInfo, loading: loadingFiles } = useFileContext();

  // FileContext에 사업장 정보 설정
  useEffect(() => {
    if (businessName && systemType) {
      setBusinessInfo(businessName, systemType);
      refreshFiles();
    }
  }, [businessName, systemType, setBusinessInfo, refreshFiles]);

  // loadUploadedFiles를 refreshFiles로 대체
  const loadUploadedFiles = refreshFiles;

  // 파일 선택 핸들러 (이벤트 기반으로 최적화)
  useState(() => {
    const handleFilesSelected = (event: CustomEvent) => {
      const { uploadId, files } = event.detail;
      setUploads(prev => ({
        ...prev,
        [uploadId]: {
          files,
          status: `선택된 파일: ${files.length}개`,
          uploading: false
        }
      }));
    };

    window.addEventListener('filesSelected', handleFilesSelected as EventListener);
    
    return () => {
      window.removeEventListener('filesSelected', handleFilesSelected as EventListener);
    };
  });

  // 최적화된 Google Drive 병렬 업로드 함수
  const uploadFiles = useCallback(async (uploadId: string, fileType: string, facilityInfo: string) => {
    const uploadData = uploads[uploadId];
    if (!uploadData || !uploadData.files.length) {
      console.warn('📁 업로드 데이터 없음:', { uploadId, uploadData });
      return;
    }

    console.log('📁 Google Drive 병렬 업로드 시작:', { uploadId, fileType, facilityInfo, fileCount: uploadData.files.length });

    setUploads(prev => ({
      ...prev,
      [uploadId]: { ...prev[uploadId], uploading: true, status: '업로드 중...' }
    }));

    try {
      // 병렬 업로드를 위한 FormData 생성 함수
      const createFormData = (file: File) => {
        const formData = new FormData();
        formData.append('businessName', businessName);
        formData.append('fileType', fileType);
        formData.append('facilityInfo', facilityInfo);
        formData.append('type', systemType);
        formData.append('uploadId', uploadId);
        formData.append('files', file);
        return formData;
      };

      // 모든 파일을 병렬로 업로드 (진짜 병렬 처리)
      console.log(`🚀 ${uploadData.files.length}개 파일 병렬 업로드 시작`);
      
      const uploadPromises = uploadData.files.map(async (file, index) => {
        console.log(`📄 파일 ${index + 1} 업로드 시작: ${file.name}`);
        
        try {
          const response = await fetch('/api/upload-supabase', {
            method: 'POST',
            body: createFormData(file)
          });

          const result = await response.json();
          console.log(`📋 [UPLOAD] 파일 ${index + 1} API 응답:`, result);
          
          if (!result.success) {
            throw new Error(result.message || '업로드 실패');
          }

          console.log(`✅ 파일 ${index + 1} 업로드 성공: ${file.name}`);
          return { success: true, fileName: file.name, data: result };
          
        } catch (error) {
          console.error(`❌ 파일 ${index + 1} 업로드 실패: ${file.name}`, error);
          return { 
            success: false, 
            fileName: file.name, 
            error: error instanceof Error ? error.message : '알 수 없는 오류' 
          };
        }
      });

      // 모든 업로드 완료까지 대기
      const results = await Promise.all(uploadPromises);
      
      // 결과 분석
      const successResults = results.filter(r => r.success);
      const failedResults = results.filter(r => !r.success);
      
      console.log('📊 업로드 결과:', {
        총파일: uploadData.files.length,
        성공: successResults.length,
        실패: failedResults.length
      });
      
      if (successResults.length === uploadData.files.length) {
        // 모든 파일 성공
        setUploads(prev => ({
          ...prev,
          [uploadId]: { 
            ...prev[uploadId], 
            uploading: false, 
            status: `✅ 업로드 완료! (${successResults.length}개 파일)` 
          }
        }));
        
        // 업로드된 파일들을 즉시 FileContext에 추가 (초고속 반응형)
        const newFiles = successResults
          .filter(result => result.data?.files)
          .flatMap(result => result.data.files);
        
        if (newFiles.length > 0) {
          console.log(`⚡ [UPLOAD] 초고속 파일 추가: ${newFiles.length}개 파일`, newFiles);
          
          // 1. 즉시 추가 (지연 없음)
          addFiles(newFiles);
          
          // 2. 즉시 강제 상태 업데이트 (컴포넌트 리렌더링)
          setUploads(prev => ({ ...prev })); // 강제 리렌더링 트리거
          
          // 3. DOM 즉시 업데이트
          if (typeof window !== 'undefined') {
            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent('fileListUpdated', { 
                detail: { files: newFiles, uploadId, immediate: true } 
              }));
            });
          }
          
          // 4. 백업용 단일 재시도 (100ms 후)
          setTimeout(() => {
            console.log(`🔄 [UPLOAD] 백업 추가`);
            addFiles(newFiles);
          }, 100);
        }
        
        // 성공 토스트 표시
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
        toast.textContent = `업로드 완료! ${successResults.length}개 파일`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
          toast.remove();
        }, 3000);
      } else if (successResults.length > 0) {
        // 일부 성공
        setUploads(prev => ({
          ...prev,
          [uploadId]: { 
            ...prev[uploadId], 
            uploading: false, 
            status: `⚠️ 일부 업로드 완료 (${successResults.length}/${uploadData.files.length})` 
          }
        }));
        
        // 성공한 파일들을 즉시 FileContext에 추가
        const newFiles = successResults
          .filter(result => result.data?.files)
          .flatMap(result => result.data.files);
        
        if (newFiles.length > 0) {
          console.log(`➕ [UPLOAD] 일부 성공한 파일을 즉시 추가: ${newFiles.length}개 파일`, newFiles);
          
          // 1. 즉시 추가
          addFiles(newFiles);
          
          // 2. 다중 재시도
          const retryTimes = [50, 100, 200, 500, 1000];
          retryTimes.forEach(delay => {
            setTimeout(() => {
              console.log(`🔄 [UPLOAD] 일부 성공 ${delay}ms 재시도`);
              addFiles(newFiles);
            }, delay);
          });
          
          // 3. 강제 새로고침
          setTimeout(async () => {
            console.log(`🔄 [UPLOAD] 일부 성공 강제 새로고침 (2초 후)`);
            await refreshFiles();
          }, 2000);
        }
        
        // 파일 목록 실시간 업데이트 (백업용)
        setTimeout(async () => {
          console.log(`🔄 [UPLOAD] 일부 성공 백업 새로고침 실행`);
          await refreshFiles();
        }, 1000);
        
        // 경고 토스트 표시
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
        toast.textContent = `일부 업로드 완료: ${successResults.length}/${uploadData.files.length}`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
          toast.remove();
        }, 4000);
      } else {
        // 모두 실패
        throw new Error(`모든 파일 업로드 실패: ${failedResults[0]?.error || '알 수 없는 오류'}`);
      }

    } catch (error) {
      console.error('🚫 업로드 오류:', error);
      
      const errorMessage = error instanceof Error ? error.message : '업로드 실패';
      
      setUploads(prev => ({
        ...prev,
        [uploadId]: { 
          ...prev[uploadId], 
          uploading: false, 
          status: `❌ 업로드 실패: ${errorMessage}` 
        }
      }));
      
      // 오류 토스트 표시
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
      toast.textContent = `업로드 실패: ${errorMessage}`;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 5000);
    }
  }, [uploads, businessName, systemType, loadUploadedFiles]);

  // 파일 삭제 핸들러
  const handleDeleteFile = useCallback(async (fileId: string, fileName: string) => {
    if (!confirm(`'${fileName}' 파일을 삭제하시겠습니까?`)) return;
    
    console.log(`🗑️ [UI] 파일 삭제 시작: ${fileId} (${fileName})`);
    
    try {
      const response = await fetch('/api/uploaded-files-supabase', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, fileName })
      });
      
      const result = await response.json();
      console.log(`🗑️ [UI] 삭제 API 응답:`, result);
      
      if (result.success) {
        // FileContext에서 파일 삭제 (즉시 UI 업데이트)
        console.log(`🗑️ [UI] FileContext에서 파일 제거: ${fileId}`);
        removeFile(fileId);
        
        // 성공 토스트
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg z-50';
        toast.textContent = `파일이 삭제되었습니다: ${fileName}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
        
        // 실시간 이벤트가 다른 클라이언트에 전파되는지 확인하기 위한 로그
        console.log(`🗑️ [UI] 실시간 DELETE 이벤트가 다른 클라이언트에 전파되기를 기대함: ${fileId}`);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('파일 삭제 실패:', error);
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg z-50';
      toast.textContent = '파일 삭제 실패';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  }, [removeFile]);


  // 메모화된 섹션들
  const preventionSection = useMemo(() => {
    if (!facilities || facilities.prevention.length === 0) return null;

    return (
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
          <Shield className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
          방지시설 사진 업로드
          <span className="text-sm font-normal text-gray-500">({facilities.prevention.length}개)</span>
        </h3>
        
        <div className="grid gap-4 md:gap-6">
          {facilities.prevention.map((facility, index) => (
            <UploadItem
              key={`prevention-${index}`}
              uploadId={`prevention-${index}`}
              label={facility.displayName}
              fileType="prevention"
              facilityInfo={`${facility.name} (${facility.capacity}, 수량: ${facility.quantity}개, 배출구: ${facility.outlet}번)`}
              IconComponent={Shield}
              facility={facility}
              onUpload={uploadFiles}
              uploadState={uploads[`prevention-${index}`] || { files: [], status: '', uploading: false }}
              uploadedFiles={uploadedFiles}
              onDeleteFile={handleDeleteFile}
              onRefreshFiles={loadUploadedFiles}
            />
          ))}
        </div>
      </div>
    );
  }, [facilities?.prevention, uploads, uploadFiles, uploadedFiles, handleDeleteFile, loadUploadedFiles]);

  const dischargeSection = useMemo(() => {
    if (!facilities || facilities.discharge.length === 0) return null;

    return (
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
          배출시설 사진 업로드
          <span className="text-sm font-normal text-gray-500">({facilities.discharge.length}개)</span>
        </h3>
        
        <div className="grid gap-4 md:gap-6">
          {facilities.discharge.map((facility, index) => (
            <UploadItem
              key={`discharge-${index}`}
              uploadId={`discharge-${index}`}
              label={facility.displayName}
              fileType="discharge"
              facilityInfo={`${facility.name} (${facility.capacity}, 수량: ${facility.quantity}개, 배출구: ${facility.outlet}번)`}
              IconComponent={Zap}
              facility={facility}
              onUpload={uploadFiles}
              uploadState={uploads[`discharge-${index}`] || { files: [], status: '', uploading: false }}
              uploadedFiles={uploadedFiles}
              onDeleteFile={handleDeleteFile}
              onRefreshFiles={loadUploadedFiles}
            />
          ))}
        </div>
      </div>
    );
  }, [facilities?.discharge, uploads, uploadFiles, uploadedFiles, handleDeleteFile, loadUploadedFiles]);

  const basicSection = useMemo(() => (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
        <Camera className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
        기본 시설 사진 업로드
      </h3>
      
      <div className="grid gap-4 md:gap-6">

        {/* 게이트웨이 시설 */}
        <div className="border-l-4 border-green-500 pl-4">
          <h4 className="text-md font-semibold text-gray-800 mb-3">📡 게이트웨이 시설</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <UploadItem
              uploadId="gateway"
              label="게이트웨이"
              fileType="basic"
              facilityInfo="게이트웨이 (IoT 통신장비, 수량: 1개, 시설번호: 1번)"
              IconComponent={Radio}
              onUpload={uploadFiles}
              uploadState={uploads.gateway || { files: [], status: '', uploading: false }}
              uploadedFiles={uploadedFiles}
              onDeleteFile={handleDeleteFile}
              onRefreshFiles={loadUploadedFiles}
            />
            <UploadItem
              uploadId="control-panel"
              label="제어반/전기시설(배전함, 차단기)"
              fileType="basic"
              facilityInfo="제어반-배전함 (전기제어장비, 수량: 1개, 시설번호: 2번)"
              IconComponent={Cpu}
              onUpload={uploadFiles}
              uploadState={uploads['control-panel'] || { files: [], status: '', uploading: false }}
              uploadedFiles={uploadedFiles}
              onDeleteFile={handleDeleteFile}
              onRefreshFiles={loadUploadedFiles}
            />
          </div>
        </div>

        {/* 송풍기 시설 */}
        <div className="border-l-4 border-purple-500 pl-4">
          <h4 className="text-md font-semibold text-gray-800 mb-3">💨 송풍기 시설</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <UploadItem
              uploadId="blower"
              label="송풍기"
              fileType="basic"
              facilityInfo="송풍기 (공기 공급장비, 수량: 1개, 시설번호: 3번)"
              IconComponent={Wind}
              onUpload={uploadFiles}
              uploadState={uploads.blower || { files: [], status: '', uploading: false }}
              uploadedFiles={uploadedFiles}
              onDeleteFile={handleDeleteFile}
              onRefreshFiles={loadUploadedFiles}
            />
          </div>
        </div>

        {/* 기타 시설 */}
        <div className="border-l-4 border-yellow-500 pl-4">
          <h4 className="text-md font-semibold text-gray-800 mb-3">📋 기타 시설</h4>
          <div className="grid md:grid-cols-1 gap-4">
            <UploadItem
              uploadId="other"
              label="기타 시설"
              fileType="basic"
              facilityInfo="기타 시설 (추가장비, 수량: 1개, 시설번호: 4번)"
              IconComponent={Camera}
              onUpload={uploadFiles}
              uploadState={uploads.other || { files: [], status: '', uploading: false }}
              uploadedFiles={uploadedFiles}
              onDeleteFile={handleDeleteFile}
              onRefreshFiles={loadUploadedFiles}
            />
          </div>
        </div>
      </div>
    </div>
  ), [uploads, uploadFiles, uploadedFiles, handleDeleteFile, loadUploadedFiles]);


  return (
    <div className="space-y-4 md:space-y-6">
      {/* 우선순위 순서: 방지시설 → 배출시설 → 기본사진 */}
      {preventionSection}
      {dischargeSection}
      {basicSection}
    </div>
  );
}

export default FileUploadSection;
