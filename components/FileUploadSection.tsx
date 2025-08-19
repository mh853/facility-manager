'use client';

import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { FacilitiesData, SystemType, Facility } from '@/types';
import { Upload, Zap, Shield, Radio, Wind, Camera, Building, Wrench, Cpu, Power, Settings, Home } from 'lucide-react';

interface FileUploadSectionProps {
  businessName: string;
  systemType: SystemType;
  facilities: FacilitiesData | null;
}

// 단순화된 이미지 압축 함수
const compressImage = async (file: File): Promise<File> => {
  // 5MB 이하면 그대로 반환
  if (file.size <= 5 * 1024 * 1024) return file;

  try {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        try {
          // 최대 해상도 제한 (1920x1920)
          const maxSize = 1920;
          let { width, height } = img;
          
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // 이미지 그리기
          ctx.drawImage(img, 0, 0, width, height);
          
          // WebP로 압축 (품질 75%)
          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                  type: 'image/webp',
                  lastModified: Date.now()
                });
                console.log(`🗜️ 이미지 압축: ${file.name} ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
                resolve(compressedFile);
              } else {
                resolve(file); // 압축 실패하면 원본 반환
              }
            },
            'image/webp',
            0.75
          );
        } catch (error) {
          console.warn('이미지 압축 중 오류:', error);
          resolve(file);
        }
      };
      
      img.onerror = () => {
        console.warn('이미지 로드 실패:', file.name);
        resolve(file);
      };
      
      img.src = URL.createObjectURL(file);
      
      // 5초 타임아웃
      setTimeout(() => {
        console.warn('이미지 압축 타임아웃:', file.name);
        resolve(file);
      }, 5000);
    });
  } catch (error) {
    console.warn('이미지 압축 실패:', error);
    return file;
  }
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
  uploadState
}: {
  uploadId: string;
  label: string;
  fileType: string;
  facilityInfo: string;
  IconComponent: any;
  facility?: Facility;
  onUpload: (uploadId: string, fileType: string, facilityInfo: string) => void;
  uploadState: { files: File[]; status: string; uploading: boolean };
}) => {
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;
    
    // 파일 압축 및 최적화
    const optimizedFiles: File[] = [];
    
    for (let i = 0; i < Math.min(files.length, 10); i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        try {
          const optimizedFile = await compressImage(file);
          optimizedFiles.push(optimizedFile);
        } catch (error) {
          console.warn('이미지 압축 실패:', error);
          optimizedFiles.push(file);
        }
      } else {
        optimizedFiles.push(file);
      }
    }
    
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
      
      {uploadState.status && (
        <p className={`text-sm mb-4 ${
          uploadState.status.includes('✅') ? 'text-green-600' : 
          uploadState.status.includes('❌') ? 'text-red-600' : 'text-gray-600'
        }`}>
          {uploadState.status}
        </p>
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

  // 파일 선택 핸들러 (이벤트 기반으로 최적화)
  useEffect(() => {
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
  }, []);

  // 간소화된 업로드 함수
  const uploadFiles = useCallback(async (uploadId: string, fileType: string, facilityInfo: string) => {
    const uploadData = uploads[uploadId];
    if (!uploadData || !uploadData.files.length) {
      console.warn('📁 업로드 데이터 없음:', { uploadId, uploadData });
      showToast('업로드할 파일이 없습니다.', 'error');
      return;
    }

    console.log('🚀 [CLIENT] 업로드 시작:', { 
      uploadId, 
      fileType, 
      fileCount: uploadData.files.length,
      totalSize: `${(uploadData.files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)}MB`
    });

    // 업로드 시작 상태 설정
    setUploads(prev => ({
      ...prev,
      [uploadId]: { ...prev[uploadId], uploading: true, status: '업로드 준비 중...' }
    }));

    // 기본 검증
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const maxTotalSize = 50 * 1024 * 1024; // 50MB
    const totalSize = uploadData.files.reduce((sum, file) => sum + file.size, 0);
    
    // 파일 크기 검증
    if (totalSize > maxTotalSize) {
      const errorMsg = `전체 파일 크기 초과: ${(totalSize / 1024 / 1024).toFixed(1)}MB (최대 50MB)`;
      setUploads(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], uploading: false, status: `❌ ${errorMsg}` }
      }));
      showToast(errorMsg, 'error');
      return;
    }
    
    const oversizedFiles = uploadData.files.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      const errorMsg = `파일 크기 초과: ${oversizedFiles[0].name} (${(oversizedFiles[0].size / 1024 / 1024).toFixed(1)}MB > 10MB)`;
      setUploads(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], uploading: false, status: `❌ ${errorMsg}` }
      }));
      showToast(errorMsg, 'error');
      return;
    }

    try {
      // FormData 생성
      const formData = new FormData();
      formData.append('businessName', businessName);
      formData.append('fileType', fileType);
      formData.append('type', systemType);
      
      // 파일 추가
      uploadData.files.forEach((file, index) => {
        console.log(`📄 [CLIENT] 파일 추가: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        formData.append('files', file);
      });

      // 업로드 진행 상태 업데이트
      setUploads(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], status: '서버에 업로드 중...' }
      }));

      console.log('📡 [CLIENT] API 요청 전송');

      // 업로드 요청 (90초 타임아웃)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 90000);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`📡 [CLIENT] 응답 받음: ${response.status} ${response.statusText}`);

      // 응답 처리
      const result = await response.json();
      console.log('📡 [CLIENT] 응답 데이터:', result);
      
      if (response.ok && result.success) {
        const successMsg = `✅ ${result.message} (${result.stats?.success}/${result.stats?.total})`;
        
        setUploads(prev => ({
          ...prev,
          [uploadId]: { 
            ...prev[uploadId], 
            uploading: false, 
            status: successMsg,
            files: [] // 성공 시 파일 목록 초기화
          }
        }));
        
        showToast(result.message, 'success');
      } else {
        throw new Error(result.message || `Server error: ${response.status}`);
      }
      
    } catch (error) {
      console.error('💥 [CLIENT] 업로드 실패:', error);
      
      let errorMessage = '업로드 실패';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '업로드 시간 초과 (90초) - 파일 크기를 줄이거나 네트워크를 확인하세요';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = '네트워크 연결 오류 - 인터넷 연결을 확인하세요';
        } else {
          errorMessage = error.message;
        }
      }
      
      setUploads(prev => ({
        ...prev,
        [uploadId]: { 
          ...prev[uploadId], 
          uploading: false, 
          status: `❌ ${errorMessage}` 
        }
      }));
      
      showToast(errorMessage, 'error');
    }
  }, [uploads, businessName, systemType]);

  // 토스트 메시지 표시 함수
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg z-50 shadow-lg max-w-sm break-words`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 애니메이션 추가
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-in-out';
    
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    const duration = type === 'error' ? 7000 : 4000;
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }, []);

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
            />
          ))}
        </div>
      </div>
    );
  }, [facilities?.prevention, uploads, uploadFiles]);

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
            />
          ))}
        </div>
      </div>
    );
  }, [facilities?.discharge, uploads, uploadFiles]);

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
              facilityInfo="게이트웨이"
              IconComponent={Radio}
              onUpload={uploadFiles}
              uploadState={uploads.gateway || { files: [], status: '', uploading: false }}
            />
            <UploadItem
              uploadId="control-panel"
              label="제어반/전기시설(배전함)"
              fileType="basic"
              facilityInfo="제어반-배전함"
              IconComponent={Cpu}
              onUpload={uploadFiles}
              uploadState={uploads['control-panel'] || { files: [], status: '', uploading: false }}
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
              facilityInfo="송풍기"
              IconComponent={Wind}
              onUpload={uploadFiles}
              uploadState={uploads.blower || { files: [], status: '', uploading: false }}
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
              facilityInfo="기타"
              IconComponent={Camera}
              onUpload={uploadFiles}
              uploadState={uploads.other || { files: [], status: '', uploading: false }}
            />
          </div>
        </div>
      </div>
    </div>
  ), [uploads, uploadFiles]);

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
