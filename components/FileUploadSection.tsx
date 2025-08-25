'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { FacilitiesData, SystemType, Facility } from '@/types';
import { Upload, Zap, Shield, Radio, Wind, Camera, Building, Wrench, Cpu, Power, Settings, Home, Clock, CheckCircle2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface FileUploadSectionProps {
  businessName: string;
  systemType: SystemType;
  facilities: FacilitiesData | null;
}

// 고성능 이미지 압축 함수 (확장자 보정 포함)
const compressImage = async (file: File): Promise<File> => {
  // 이미지 파일이 아니면 그대로 반환
  if (!file.type.startsWith('image/')) return file;
  
  // 500KB 이하면 그대로 반환
  if (file.size <= 500 * 1024) return file;

  const options = {
    maxSizeMB: 1, // 1MB로 압축
    maxWidthOrHeight: 1920, // 최대 해상도
    useWebWorker: true, // 웹워커 사용으로 성능 향상
    fileType: 'image/webp' // WebP 포맷으로 변환
  };

  try {
    const compressedFile = await imageCompression(file, options);
    
    // 압축된 파일의 이름을 WebP 확장자로 수정
    const originalName = file.name;
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const webpFileName = `${nameWithoutExt}.webp`;
    
    // 새로운 File 객체 생성 (올바른 이름과 타입으로)
    const correctedFile = new File([compressedFile], webpFileName, {
      type: 'image/webp',
      lastModified: compressedFile.lastModified
    });
    
    console.log('이미지 압축 완료:', {
      원본이름: originalName,
      압축후이름: webpFileName,
      원본크기: `${(file.size / 1024).toFixed(1)}KB`,
      압축후크기: `${(compressedFile.size / 1024).toFixed(1)}KB`,
      압축률: `${(100 - (compressedFile.size / file.size) * 100).toFixed(1)}%`
    });
    
    return correctedFile;
  } catch (error) {
    console.error('이미지 압축 실패:', error);
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
  uploadState: { files: File[]; status: string; uploading: boolean; progress?: number };
}) => {
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;
    
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
        formData.append('files', file);
        return formData;
      };

      // 모든 파일을 병렬로 업로드 (진짜 병렬 처리)
      console.log(`🚀 ${uploadData.files.length}개 파일 병렬 업로드 시작`);
      
      const uploadPromises = uploadData.files.map(async (file, index) => {
        console.log(`📄 파일 ${index + 1} 업로드 시작: ${file.name}`);
        
        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: createFormData(file)
          });

          const result = await response.json();
          
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
  }, [uploads, businessName, systemType]);

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
              label="제어반/전기시설(배전함, 차단기)"
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
