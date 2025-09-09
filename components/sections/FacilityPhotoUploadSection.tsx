'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Camera, Upload, Factory, Shield, Building2, AlertCircle, Eye, Download, Trash2, RefreshCw, X, Zap, Router, Cpu } from 'lucide-react';
import { FacilitiesData, Facility, UploadedFile } from '@/types';
import imageCompression from 'browser-image-compression';
import LazyImage from '@/components/ui/LazyImage';
import { 
  generateFacilityFileName, 
  generateBasicFileName, 
  calculateFacilityIndex, 
  calculatePhotoIndex, 
  calculateBasicPhotoIndex 
} from '@/utils/filename-generator';

interface FacilityPhotoUploadSectionProps {
  businessName: string;
  facilities: FacilitiesData | null;
}

const compressImage = async (file: File): Promise<File> => {
  // 모바일 최적화: 2MB 이하 파일은 압축 건너뛰기 (즉시 반응성)
  if (!file.type.startsWith('image/') || file.size <= 2 * 1024 * 1024) {
    return file;
  }

  const options = {
    maxSizeMB: 3, // 2MB → 3MB로 완화 (압축 시간 최소화)
    maxWidthOrHeight: 1200, // 1440 → 1200으로 축소 (더 빠른 처리)
    useWebWorker: true,
    initialQuality: 0.9, // 0.8 → 0.9로 품질 향상 (압축 시간 단축)
    alwaysKeepResolution: false,
    fileType: 'image/jpeg' // JPEG 강제로 빠른 처리
  };

  const startTime = Date.now();
  try {
    const compressedFile = await imageCompression(file, options);
    const compressionTime = Date.now() - startTime;
    
    console.log(`⚡ [COMPRESS] ${file.name}: ${(file.size/1024/1024).toFixed(1)}MB → ${(compressedFile.size/1024/1024).toFixed(1)}MB (${compressionTime}ms)`);
    
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now()
    });
  } catch (error) {
    console.warn(`⚠️ [COMPRESS] 압축 실패, 원본 사용: ${file.name}`, error);
    return file;
  }
};

export default function FacilityPhotoUploadSection({ 
  businessName, 
  facilities 
}: FacilityPhotoUploadSectionProps) {
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [basicPhotoCategory, setBasicPhotoCategory] = useState<'gateway' | 'fan' | 'electrical' | 'others'>('gateway');
  const modalRef = useRef<HTMLDivElement>(null);

  // 업로드된 파일 로드 - 스마트 캐싱 및 병렬 로딩 적용
  const loadUploadedFiles = useCallback(async (forceRefresh = false) => {
    if (!businessName) return;
    
    setLoadingFiles(true);
    try {
      // 병렬 요청: completion과 presurvey 동시에 시도
      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const [completionResponse, presurveyResponse] = await Promise.allSettled([
        fetch(`/api/uploaded-files-supabase?businessName=${encodeURIComponent(businessName)}&systemType=completion${refreshParam}`, {
          headers: { 'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=300' }
        }),
        fetch(`/api/uploaded-files-supabase?businessName=${encodeURIComponent(businessName)}&systemType=presurvey${refreshParam}`, {
          headers: { 'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=300' }
        })
      ]);

      let allFiles: any[] = [];

      // completion 결과 처리
      if (completionResponse.status === 'fulfilled' && completionResponse.value.ok) {
        const result = await completionResponse.value.json();
        if (result.success) {
          allFiles.push(...(result.data?.files || []));
          console.log('[PERFORMANCE] completion 파일 로드:', result.data?.files?.length || 0);
        }
      }

      // presurvey 결과 처리
      if (presurveyResponse.status === 'fulfilled' && presurveyResponse.value.ok) {
        const result = await presurveyResponse.value.json();
        if (result.success) {
          const presurveyFiles = result.data?.files || [];
          // 중복 제거
          const existingIds = new Set(allFiles.map(f => f.id));
          const uniquePresurveyFiles = presurveyFiles.filter((f: any) => !existingIds.has(f.id));
          allFiles.push(...uniquePresurveyFiles);
          console.log('[PERFORMANCE] presurvey 파일 로드:', uniquePresurveyFiles.length);
        }
      }
      
      console.log('[PERFORMANCE] 총 로드된 파일:', allFiles.length);
      setUploadedFiles(allFiles);
      
    } catch (error) {
      console.error('파일 목록 로드 실패:', error);
    } finally {
      setLoadingFiles(false);
    }
  }, [businessName]);

  useEffect(() => {
    loadUploadedFiles();
  }, [loadUploadedFiles]);

  // 백그라운드 새로고침 (60초마다, optimistic UI 보완용)
  useEffect(() => {
    const interval = setInterval(() => {
      loadUploadedFiles(true);
    }, 60000); // optimistic UI가 주요 방식이므로 백그라운드에서만 동기화

    return () => clearInterval(interval);
  }, [loadUploadedFiles]);

  // 모달 키보드 및 클릭 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedFile) {
        setSelectedFile(null);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setSelectedFile(null);
      }
    };

    if (selectedFile) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden'; // 스크롤 방지
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [selectedFile]);

  // 시설별 파일 업로드
  const handleFacilityUpload = useCallback(async (files: FileList, facility: Facility, facilityType: 'discharge' | 'prevention') => {
    if (!files.length) return;

    const uploadKey = `${facilityType}-${facility.outlet}-${facility.number}`;
    
    // 시설 순번 계산
    const allFacilities = facilityType === 'discharge' ? 
      facilities?.discharge || [] : facilities?.prevention || [];
    const facilityIndex = calculateFacilityIndex(allFacilities, facility, facilityType);
    
    // 현재 업로드된 파일들에서 해당 시설의 사진 개수 확인
    const existingFacilityFiles = getFilesForFacility(facility, facilityType);
    
    // 모바일 즉시 반응: 파일 선택 즉시 미리보기 생성 (새로운 파일명 적용)
    const previewFiles = Array.from(files).map((file, index) => {
      const photoIndex = calculatePhotoIndex(existingFacilityFiles, facility, facilityType) + index;
      const newFileName = generateFacilityFileName({
        facility,
        facilityType,
        facilityIndex,
        photoIndex,
        originalFileName: file.name
      });
      
      return {
        id: `preview-${Date.now()}-${Math.random()}`,
        name: newFileName, // 새로운 구조화된 파일명 적용
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
        webViewLink: URL.createObjectURL(file),
        downloadUrl: URL.createObjectURL(file),
        thumbnailUrl: URL.createObjectURL(file),
        publicUrl: URL.createObjectURL(file),
        directUrl: URL.createObjectURL(file),
        folderName: facilityType === 'discharge' ? '배출시설' : '방지시설',
        uploadStatus: 'uploading',
        syncedAt: null,
        googleFileId: null,
        facilityInfo: `배출구${facility.outlet}-${facilityType === 'discharge' ? '배출시설' : '방지시설'}${facility.number}`,
        filePath: undefined,
        justUploaded: true,
        uploadedAt: Date.now(),
        isPreview: true // 미리보기 표시
      } as unknown as UploadedFile & { isPreview: boolean };
    });
    
    // 즉시 미리보기 파일 추가
    setUploadedFiles(prev => [...previewFiles, ...prev]);
    setUploading(prev => ({ ...prev, [uploadKey]: true }));
    setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

    try {
      // 병렬 이미지 압축으로 성능 개선
      const compressedFiles = await Promise.all(
        Array.from(files).map(file => compressImage(file))
      );
      
      const uploadPromises = compressedFiles.map(async (compressedFile, index) => {
        const originalFile = files[index];
        
        // 새로운 파일명 생성
        const photoIndex = calculatePhotoIndex(existingFacilityFiles, facility, facilityType) + index;
        const newFileName = generateFacilityFileName({
          facility,
          facilityType,
          facilityIndex,
          photoIndex,
          originalFileName: originalFile.name
        });
        
        // 새로운 파일명으로 File 객체 재생성
        const renamedFile = new File([compressedFile], newFileName, {
          type: compressedFile.type,
          lastModified: compressedFile.lastModified
        });
        
        const formData = new FormData();
        formData.append('files', renamedFile); // 새로운 파일명이 적용된 파일 업로드
        formData.append('businessName', businessName);
        formData.append('fileType', facilityType);
        formData.append('type', 'completion');
        formData.append('facilityInfo', `배출구${facility.outlet}-${facilityType === 'discharge' ? '배출시설' : '방지시설'}${facility.number}`);

        const response = await fetch('/api/upload-supabase', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        setUploadProgress(prev => ({ 
          ...prev, 
          [uploadKey]: ((index + 1) / compressedFiles.length) * 100 
        }));

        // 업로드 성공 시 미리보기를 실제 파일로 교체
        if (result.success && result.files && result.files.length > 0) {
          const newFile = result.files[0];
          // 미리보기 파일을 실제 업로드된 파일로 즉시 교체
          setUploadedFiles(prev => prev.map(f => {
            if (f.name === originalFile.name && (f as any).isPreview) {
              // 기존 Object URL 정리 (메모리 누수 방지)
              if (f.thumbnailUrl.startsWith('blob:')) {
                URL.revokeObjectURL(f.thumbnailUrl);
                URL.revokeObjectURL(f.webViewLink);
                URL.revokeObjectURL(f.downloadUrl);
              }
              return { ...newFile, justUploaded: true, uploadedAt: Date.now() };
            }
            return f;
          }));
          
          // 즉시 업로드 상태 업데이트
          setUploadProgress(prev => ({ ...prev, [uploadKey]: 100 }));
          
          // 0.5초 후 깜빡임 효과 제거
          setTimeout(() => {
            setUploadedFiles(prev => prev.map(f => 
              f.id === newFile.id ? { ...f, justUploaded: false } : f
            ));
          }, 500);
        } else {
          // 업로드 실패 시 미리보기 파일 제거
          setUploadedFiles(prev => prev.filter(f => 
            !(f.name === originalFile.name && (f as any).isPreview)
          ));
        }

        return result;
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r.success).length;
      
      // 완전한 optimistic UI: 서버 동기화 완전 제거 (즉시 반영)
      console.log(`✅ [UPLOAD-SUCCESS] 시설 업로드 완료: ${successCount}/${compressedFiles.length} (완전 optimistic UI)`);
      
      // 실패한 업로드가 있는 경우 미리보기 파일만 제거
      if (successCount < files.length) {
        console.log(`❌ [UPLOAD-PARTIAL] 부분 실패, 미리보기 파일 정리`);
        // 실패한 미리보기 파일만 제거 (서버 호출 없음)
        setUploadedFiles(prev => prev.filter(f => !(f as any).isPreview));
      }

    } catch (error) {
      console.error('업로드 오류:', error);
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: false }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
      }, 2000);
    }
  }, [businessName, loadUploadedFiles]);

  // 기본사진 업로드 (카테고리별)
  const handleBasicUpload = useCallback(async (files: FileList, category: string) => {
    if (!files.length) return;

    const uploadKey = `basic-photos-${category}`;
    
    // 기존 기본사진들 중 해당 카테고리의 개수 확인
    const existingBasicFiles = getBasicFiles(category);
    
    // 모바일 즉시 반응: 기본사진 선택 즉시 미리보기 생성 (새로운 파일명 적용)
    const previewFiles = Array.from(files).map((file, index) => {
      const photoIndex = calculateBasicPhotoIndex(existingBasicFiles, category) + index;
      const newFileName = generateBasicFileName(category, photoIndex, file.name);
      
      return {
        id: `preview-basic-${Date.now()}-${Math.random()}`,
        name: newFileName, // 새로운 구조화된 파일명 적용
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
        webViewLink: URL.createObjectURL(file),
        downloadUrl: URL.createObjectURL(file),
        thumbnailUrl: URL.createObjectURL(file),
        publicUrl: URL.createObjectURL(file),
        directUrl: URL.createObjectURL(file),
        folderName: '기본사진',
        uploadStatus: 'uploading',
        syncedAt: null,
        googleFileId: null,
        facilityInfo: category,
        filePath: undefined,
        justUploaded: true,
        uploadedAt: Date.now(),
        subcategory: category,
        isPreview: true // 미리보기 표시
      } as unknown as UploadedFile & { isPreview: boolean };
    });
    
    // 즉시 미리보기 파일 추가
    setUploadedFiles(prev => [...previewFiles, ...prev]);
    setUploading(prev => ({ ...prev, [uploadKey]: true }));
    setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const compressedFile = await compressImage(file);
        
        // 새로운 파일명 생성
        const photoIndex = calculateBasicPhotoIndex(existingBasicFiles, category) + index;
        const newFileName = generateBasicFileName(category, photoIndex, file.name);
        
        // 새로운 파일명으로 File 객체 재생성
        const renamedFile = new File([compressedFile], newFileName, {
          type: compressedFile.type,
          lastModified: compressedFile.lastModified
        });
        
        const formData = new FormData();
        formData.append('files', renamedFile); // 새로운 파일명이 적용된 파일 업로드
        formData.append('businessName', businessName);
        formData.append('fileType', 'basic');
        formData.append('type', 'completion');
        formData.append('facilityInfo', category);

        const response = await fetch('/api/upload-supabase', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        setUploadProgress(prev => ({ 
          ...prev, 
          [uploadKey]: ((index + 1) / files.length) * 100 
        }));

        // 업로드 성공 시 미리보기를 실제 파일로 교체
        if (result.success && result.files && result.files.length > 0) {
          const newFile = result.files[0];
          // 미리보기 파일을 실제 업로드된 파일로 즉시 교체
          setUploadedFiles(prev => prev.map(f => 
            f.name === file.name && (f as any).isPreview 
              ? { ...newFile, justUploaded: true, uploadedAt: Date.now(), subcategory: category }
              : f
          ));
          
          // 0.5초 후 깜빡임 효과 제거
          setTimeout(() => {
            setUploadedFiles(prev => prev.map(f => 
              f.id === newFile.id ? { ...f, justUploaded: false } : f
            ));
          }, 500);
        } else {
          // 업로드 실패 시 미리보기 파일 제거
          setUploadedFiles(prev => prev.filter(f => 
            !(f.name === file.name && (f as any).isPreview)
          ));
        }

        return result;
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r.success).length;
      
      // 완전한 optimistic UI: 서버 동기화 완전 제거 (즉시 반영)
      console.log(`✅ [UPLOAD-SUCCESS] 기본사진 업로드 완료: ${successCount}/${files.length} (완전 optimistic UI)`);
      
      // 실패한 업로드가 있는 경우 미리보기 파일만 제거
      if (successCount < files.length) {
        console.log(`❌ [UPLOAD-PARTIAL] 기본사진 부분 실패, 미리보기 파일 정리`);
        // 실패한 미리보기 파일만 제거 (서버 호출 없음)
        setUploadedFiles(prev => prev.filter(f => !(f as any).isPreview));
      }

    } catch (error) {
      console.error('업로드 오류:', error);
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: false }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
      }, 2000);
    }
  }, [businessName, loadUploadedFiles]);

  // 파일 삭제 - 안정적인 optimistic UI 구현
  const deleteFile = useCallback(async (file: UploadedFile) => {
    if (!confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) return;

    // 1. 즉시 optimistic 삭제 (UI 반응성 확보)
    setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
    setSelectedFile(null);
    console.log(`🗑️ [OPTIMISTIC-DELETE] 로컬 삭제: ${file.name}`);

    try {
      const response = await fetch('/api/uploaded-files-supabase', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ 
          fileId: file.id, 
          fileName: file.name,
          businessName: businessName
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ [DELETE-SUCCESS] 서버 삭제 완료: ${file.name} (optimistic UI 유지)`);
      } else {
        console.log(`❌ [DELETE-FAILED] 서버 삭제 실패, 롤백: ${file.name}`);
        // 실패 시 즉시 롤백
        setUploadedFiles(prev => [file, ...prev]);
        alert('파일 삭제에 실패했습니다: ' + result.message);
      }
    } catch (error) {
      console.error('파일 삭제 오류:', error);
      // 오류 시 즉시 롤백
      setUploadedFiles(prev => [file, ...prev]);
      alert('파일 삭제 중 오류가 발생했습니다.');
    }
  }, [businessName, loadUploadedFiles]);

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 시설별 업로드된 파일 필터링 - 실제 API 데이터 형식에 맞춘 로직
  const getFilesForFacility = (facility: Facility, facilityType: 'discharge' | 'prevention') => {
    const expectedFolderName = facilityType === 'discharge' ? '배출시설' : '방지시설';
    
    const filteredFiles = uploadedFiles.filter(file => {
      // 1차: 폴더명이 맞는지 확인
      if (file.folderName !== expectedFolderName) {
        return false;
      }
      
      // 2차: facilityInfo에서 배출구 번호 추출하여 매칭
      if (file.facilityInfo) {
        // "흡착에의한시설 (200㎥/분, 수량: 1개, 배출구: 4번)" 형식에서 배출구 번호 추출
        const outletMatch = file.facilityInfo.match(/배출구[:\s]*(\d+)/);
        if (outletMatch) {
          const fileOutlet = parseInt(outletMatch[1]);
          if (fileOutlet === facility.outlet) {
            return true;
          }
        }
      }
      
      // 3차: 파일 경로 매칭 (outlet_X 패턴)
      if (file.filePath) {
        const facilityPathType = facilityType === 'discharge' ? 'discharge' : 'prevention';
        const outletPattern = new RegExp(`outlet_${facility.outlet}_.*${facilityPathType}`);
        if (outletPattern.test(file.filePath)) {
          return true;
        }
      }
      
      // 4차: 기존 정확한 매칭 방식 (하위 호환성)
      const expectedFacilityInfo = `배출구${facility.outlet}-${facilityType === 'discharge' ? '배출시설' : '방지시설'}${facility.number}`;
      if (file.facilityInfo === expectedFacilityInfo) {
        return true;
      }
      
      return false;
    });

    console.log(`[FACILITY-FILTER] ${facilityType}${facility.number} (outlet ${facility.outlet}): ${filteredFiles.length}개 파일 매칭`);
    return filteredFiles;
  };

  // 기본사진 필터링 (카테고리별) - 단순화된 안정적 로직
  const getBasicFiles = (category?: string) => {
    const basicFiles = uploadedFiles.filter(file => {
      // 기본사진 폴더 확인 (명확한 조건)
      const isBasicFolder = file.folderName === '기본사진' || 
                           file.folderName === 'basic' ||
                           (!file.folderName || file.folderName === '') ||
                           (file.folderName !== '배출시설' && file.folderName !== '방지시설');
      
      if (!isBasicFolder) return false;
      
      // 카테고리별 필터링
      if (category) {
        const fileCategory = (file as any).subcategory || extractCategoryFromFileName(file.name);
        return fileCategory === category;
      }
      
      return true;
    });
    
    console.log(`[BASIC-FILTER] ${category || 'all'}: ${basicFiles.length}개 파일`);
    return basicFiles;
  };

  // 파일명에서 카테고리 추출
  const extractCategoryFromFileName = (fileName: string): string => {
    const name = fileName.toLowerCase();
    if (name.includes('게이트웨이') || name.includes('gateway')) return 'gateway';
    if (name.includes('송풍') || name.includes('fan')) return 'fan';
    if (name.includes('배전') || name.includes('차단기') || name.includes('electrical')) return 'electrical';
    return 'others';
  };

  if (!facilities) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-xl border-2 border-gray-200/80 hover:shadow-2xl hover:border-gray-300/80 transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Camera className="w-6 h-6 text-gray-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">사진 업로드</h2>
        </div>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">시설 정보를 먼저 불러와주세요.</p>
        </div>
      </div>
    );
  }

  // 배출구별 시설 그룹화
  const facilitiesByOutlet = () => {
    const grouped: { [outlet: number]: { discharge: Facility[], prevention: Facility[] } } = {};
    
    facilities.discharge.forEach(facility => {
      if (!grouped[facility.outlet]) {
        grouped[facility.outlet] = { discharge: [], prevention: [] };
      }
      grouped[facility.outlet].discharge.push(facility);
    });
    
    facilities.prevention.forEach(facility => {
      if (!grouped[facility.outlet]) {
        grouped[facility.outlet] = { discharge: [], prevention: [] };
      }
      grouped[facility.outlet].prevention.push(facility);
    });
    
    return grouped;
  };

  const outletFacilities = facilitiesByOutlet();
  const outlets = Object.keys(outletFacilities).map(Number).sort((a, b) => a - b);

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-xl border-2 border-gray-200/80 hover:shadow-2xl hover:border-gray-300/80 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Camera className="w-6 h-6 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">시설별 사진 업로드</h2>
        </div>
        <button
          onClick={() => loadUploadedFiles(true)}
          disabled={loadingFiles}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <div className="space-y-6">
        {/* 배출구별 시설 */}
        {outlets.map(outlet => {
          const outletData = outletFacilities[outlet];
          const outletPrevention = outletData.prevention || [];
          const outletDischarge = outletData.discharge || [];
          
          return (
            <div key={outlet} className="bg-white rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                  배출구 {outlet}
                </span>
              </h3>
              
              {/* 방지시설 */}
              {outletPrevention.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-green-600 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    방지시설 ({outletPrevention.reduce((total, f) => total + f.quantity, 0)}개)
                  </h4>
                  
                  {outletPrevention.map((facility) => {
                    const uploadKey = `prevention-${facility.outlet}-${facility.number}`;
                    const isUploading = uploading[uploadKey];
                    const progress = uploadProgress[uploadKey] || 0;
                    const facilityFiles = getFilesForFacility(facility, 'prevention');

                    return (
                      <div key={`prevention-${facility.number}`} className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
                        {/* 시설 정보 */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="bg-green-600 text-white px-2 py-1 rounded text-sm font-medium">
                            방지시설 {facility.number}
                          </span>
                          <span className="text-gray-600 text-sm">배출구 {facility.outlet}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <span className="text-sm text-gray-600 font-medium">시설명:</span>
                            <div className="text-gray-900 font-semibold">{facility.name}</div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600 font-medium">용량:</span>
                            <div className="text-gray-900 font-semibold">{facility.capacity}</div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600 font-medium">수량:</span>
                            <div className="text-gray-900 font-semibold">{facility.quantity}개</div>
                          </div>
                        </div>

                        {/* 사진 업로드 */}
                        {isUploading && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                              <span>업로드 중...</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="relative mb-3">
                          <input
                            type="file"
                            id={`upload-prevention-${facility.outlet}-${facility.number}`}
                            multiple
                            accept="image/*"
                            onChange={(e) => e.target.files && handleFacilityUpload(e.target.files, facility, 'prevention')}
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <div className={`
                            flex items-center justify-center gap-3 p-3 border-2 border-dashed rounded-lg
                            ${isUploading ? 'border-gray-300 bg-gray-50' : 'border-green-300 hover:bg-green-100'}
                            transition-colors cursor-pointer
                          `}>
                            <Upload className={`w-4 h-4 ${isUploading ? 'text-gray-400' : 'text-green-600'}`} />
                            <span className={`text-sm font-medium ${isUploading ? 'text-gray-400' : 'text-green-600'}`}>
                              {isUploading ? '업로드 중...' : '방지시설 사진 선택'}
                            </span>
                          </div>
                        </div>

                        {/* 업로드된 사진 표시 */}
                        {facilityFiles.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                            {facilityFiles.map((file) => (
                              <div key={file.id} className={`bg-white rounded border p-2 transition-all duration-500 ${
                                file.justUploaded ? 'animate-pulse border-green-400 bg-green-50' : ''
                              }`}>
                                <div 
                                  className="relative aspect-square mb-1 bg-gray-100 rounded overflow-hidden cursor-pointer"
                                  onClick={() => setSelectedFile(file)}
                                >
                                  <LazyImage
                                    src={file.thumbnailUrl}
                                    alt={file.name}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                                    quality={75}
                                    placeholder={true}
                                    onLoad={() => {
                                      console.log(`[IMAGE-SUCCESS] 이미지 로드 성공: ${file.name}`);
                                    }}
                                    onError={() => {
                                      console.error(`[IMAGE-ERROR] 이미지 로드 실패:`, {
                                        url: file.thumbnailUrl,
                                        fileName: file.name,
                                        filePath: file.filePath
                                      });
                                    }}
                                  />
                                </div>
                                <div className="text-xs">
                                  <p className="font-medium truncate" title={file.name}>{file.name}</p>
                                  <div className="flex gap-1 mt-1">
                                    <button
                                      onClick={() => setSelectedFile(file)}
                                      className="flex-1 bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs"
                                    >
                                      보기
                                    </button>
                                    <button
                                      onClick={() => deleteFile(file)}
                                      className="bg-red-100 text-red-800 px-1 py-0.5 rounded text-xs"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 배출시설 */}
              {outletDischarge.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-orange-600 mb-3 flex items-center gap-2">
                    <Factory className="w-4 h-4" />
                    배출시설 ({outletDischarge.reduce((total, f) => total + f.quantity, 0)}개)
                  </h4>
                  
                  {outletDischarge.map((facility) => {
                    const uploadKey = `discharge-${facility.outlet}-${facility.number}`;
                    const isUploading = uploading[uploadKey];
                    const progress = uploadProgress[uploadKey] || 0;
                    const facilityFiles = getFilesForFacility(facility, 'discharge');

                    return (
                      <div key={`discharge-${facility.number}`} className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-3">
                        {/* 시설 정보 */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="bg-orange-600 text-white px-2 py-1 rounded text-sm font-medium">
                            배출시설 {facility.number}
                          </span>
                          <span className="text-gray-600 text-sm">배출구 {facility.outlet}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <span className="text-sm text-gray-600 font-medium">시설명:</span>
                            <div className="text-gray-900 font-semibold">{facility.name}</div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600 font-medium">용량:</span>
                            <div className="text-gray-900 font-semibold">{facility.capacity}</div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600 font-medium">수량:</span>
                            <div className="text-gray-900 font-semibold">{facility.quantity}개</div>
                          </div>
                        </div>

                        {/* 사진 업로드 */}
                        {isUploading && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                              <span>업로드 중...</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="relative mb-3">
                          <input
                            type="file"
                            id={`upload-discharge-${facility.outlet}-${facility.number}`}
                            multiple
                            accept="image/*"
                            onChange={(e) => e.target.files && handleFacilityUpload(e.target.files, facility, 'discharge')}
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <div className={`
                            flex items-center justify-center gap-3 p-3 border-2 border-dashed rounded-lg
                            ${isUploading ? 'border-gray-300 bg-gray-50' : 'border-orange-300 hover:bg-orange-100'}
                            transition-colors cursor-pointer
                          `}>
                            <Upload className={`w-4 h-4 ${isUploading ? 'text-gray-400' : 'text-orange-600'}`} />
                            <span className={`text-sm font-medium ${isUploading ? 'text-gray-400' : 'text-orange-600'}`}>
                              {isUploading ? '업로드 중...' : '배출시설 사진 선택'}
                            </span>
                          </div>
                        </div>

                        {/* 업로드된 사진 표시 */}
                        {facilityFiles.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                            {facilityFiles.map((file) => (
                              <div key={file.id} className={`bg-white rounded border p-2 transition-all duration-500 ${
                                file.justUploaded ? 'animate-pulse border-orange-400 bg-orange-50' : ''
                              }`}>
                                <div 
                                  className="relative aspect-square mb-1 bg-gray-100 rounded overflow-hidden cursor-pointer"
                                  onClick={() => setSelectedFile(file)}
                                >
                                  <LazyImage
                                    src={file.thumbnailUrl}
                                    alt={file.name}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                                    quality={75}
                                    placeholder={true}
                                    onLoad={() => {
                                      console.log(`[IMAGE-SUCCESS] 이미지 로드 성공: ${file.name}`);
                                    }}
                                    onError={() => {
                                      console.error(`[IMAGE-ERROR] 이미지 로드 실패:`, {
                                        url: file.thumbnailUrl,
                                        fileName: file.name,
                                        filePath: file.filePath
                                      });
                                    }}
                                  />
                                </div>
                                <div className="text-xs">
                                  <p className="font-medium truncate" title={file.name}>{file.name}</p>
                                  <div className="flex gap-1 mt-1">
                                    <button
                                      onClick={() => setSelectedFile(file)}
                                      className="flex-1 bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs"
                                    >
                                      보기
                                    </button>
                                    <button
                                      onClick={() => deleteFile(file)}
                                      className="bg-red-100 text-red-800 px-1 py-0.5 rounded text-xs"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* 기본사진 섹션 - 확장 형태 */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            기본사진 (사업장 전경, 출입구 등)
          </h3>

          <div className="space-y-6">
            {/* 게이트웨이 */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="text-md font-medium text-purple-600 mb-3 flex items-center gap-2">
                <Router className="w-4 h-4" />
                게이트웨이 ({getBasicFiles('gateway').length}개)
              </h4>

              {uploading['basic-photos-gateway'] && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>업로드 중...</span>
                    <span>{Math.round(uploadProgress['basic-photos-gateway'] || 0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress['basic-photos-gateway'] || 0}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="relative mb-3">
                <input
                  type="file"
                  id="upload-basic-gateway"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleBasicUpload(e.target.files, 'gateway')}
                  disabled={uploading['basic-photos-gateway']}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className={`
                  flex items-center justify-center gap-3 p-3 border-2 border-dashed rounded-lg
                  ${uploading['basic-photos-gateway'] ? 'border-gray-300 bg-gray-50' : 'border-purple-300 hover:bg-purple-100'}
                  transition-colors cursor-pointer
                `}>
                  <Upload className={`w-4 h-4 ${uploading['basic-photos-gateway'] ? 'text-gray-400' : 'text-purple-600'}`} />
                  <span className={`text-sm font-medium ${uploading['basic-photos-gateway'] ? 'text-gray-400' : 'text-purple-600'}`}>
                    {uploading['basic-photos-gateway'] ? '업로드 중...' : '게이트웨이 사진 선택'}
                  </span>
                </div>
              </div>

              {getBasicFiles('gateway').length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                  {getBasicFiles('gateway').map((file) => (
                    <div key={file.id} className={`bg-white rounded border p-2 transition-all duration-500 ${
                      file.justUploaded ? 'animate-pulse border-purple-400 bg-purple-50' : ''
                    }`}>
                      <div 
                        className="relative aspect-square mb-1 bg-gray-100 rounded overflow-hidden cursor-pointer"
                        onClick={() => setSelectedFile(file)}
                      >
                        <LazyImage
                          src={file.thumbnailUrl}
                          alt={file.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                          quality={75}
                          placeholder={true}
                          onLoad={() => {
                            console.log(`[IMAGE-SUCCESS] 기본사진 로드 성공: ${file.name}`);
                          }}
                          onError={() => {
                            console.error(`[IMAGE-ERROR] 기본사진 로드 실패:`, {
                              url: file.thumbnailUrl,
                              fileName: file.name,
                              category: extractCategoryFromFileName(file.name)
                            });
                          }}
                        />
                      </div>
                      <div className="text-xs">
                        <p className="font-medium truncate" title={file.name}>{file.name}</p>
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => setSelectedFile(file)}
                            className="flex-1 bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs"
                          >
                            보기
                          </button>
                          <button
                            onClick={() => deleteFile(file)}
                            className="bg-red-100 text-red-800 px-1 py-0.5 rounded text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 송풍기 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-md font-medium text-yellow-600 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                송풍기 ({getBasicFiles('fan').length}개)
              </h4>

              {uploading['basic-photos-fan'] && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>업로드 중...</span>
                    <span>{Math.round(uploadProgress['basic-photos-fan'] || 0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress['basic-photos-fan'] || 0}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="relative mb-3">
                <input
                  type="file"
                  id="upload-basic-fan"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleBasicUpload(e.target.files, 'fan')}
                  disabled={uploading['basic-photos-fan']}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className={`
                  flex items-center justify-center gap-3 p-3 border-2 border-dashed rounded-lg
                  ${uploading['basic-photos-fan'] ? 'border-gray-300 bg-gray-50' : 'border-yellow-300 hover:bg-yellow-100'}
                  transition-colors cursor-pointer
                `}>
                  <Upload className={`w-4 h-4 ${uploading['basic-photos-fan'] ? 'text-gray-400' : 'text-yellow-600'}`} />
                  <span className={`text-sm font-medium ${uploading['basic-photos-fan'] ? 'text-gray-400' : 'text-yellow-600'}`}>
                    {uploading['basic-photos-fan'] ? '업로드 중...' : '송풍기 사진 선택'}
                  </span>
                </div>
              </div>

              {getBasicFiles('fan').length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                  {getBasicFiles('fan').map((file) => (
                    <div key={file.id} className={`bg-white rounded border p-2 transition-all duration-500 ${
                      file.justUploaded ? 'animate-pulse border-yellow-400 bg-yellow-50' : ''
                    }`}>
                      <div 
                        className="relative aspect-square mb-1 bg-gray-100 rounded overflow-hidden cursor-pointer"
                        onClick={() => setSelectedFile(file)}
                      >
                        <LazyImage
                          src={file.thumbnailUrl}
                          alt={file.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                          quality={75}
                          placeholder={true}
                          onLoad={() => {
                            console.log(`[IMAGE-SUCCESS] 기본사진 로드 성공: ${file.name}`);
                          }}
                          onError={() => {
                            console.error(`[IMAGE-ERROR] 기본사진 로드 실패:`, {
                              url: file.thumbnailUrl,
                              fileName: file.name,
                              category: extractCategoryFromFileName(file.name)
                            });
                          }}
                        />
                      </div>
                      <div className="text-xs">
                        <p className="font-medium truncate" title={file.name}>{file.name}</p>
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => setSelectedFile(file)}
                            className="flex-1 bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs"
                          >
                            보기
                          </button>
                          <button
                            onClick={() => deleteFile(file)}
                            className="bg-red-100 text-red-800 px-1 py-0.5 rounded text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 배전함 내,외부(차단기) */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h4 className="text-md font-medium text-indigo-600 mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                배전함 내,외부(차단기) ({getBasicFiles('electrical').length}개)
              </h4>

              {uploading['basic-photos-electrical'] && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>업로드 중...</span>
                    <span>{Math.round(uploadProgress['basic-photos-electrical'] || 0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress['basic-photos-electrical'] || 0}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="relative mb-3">
                <input
                  type="file"
                  id="upload-basic-electrical"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleBasicUpload(e.target.files, 'electrical')}
                  disabled={uploading['basic-photos-electrical']}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className={`
                  flex items-center justify-center gap-3 p-3 border-2 border-dashed rounded-lg
                  ${uploading['basic-photos-electrical'] ? 'border-gray-300 bg-gray-50' : 'border-indigo-300 hover:bg-indigo-100'}
                  transition-colors cursor-pointer
                `}>
                  <Upload className={`w-4 h-4 ${uploading['basic-photos-electrical'] ? 'text-gray-400' : 'text-indigo-600'}`} />
                  <span className={`text-sm font-medium ${uploading['basic-photos-electrical'] ? 'text-gray-400' : 'text-indigo-600'}`}>
                    {uploading['basic-photos-electrical'] ? '업로드 중...' : '배전함 사진 선택'}
                  </span>
                </div>
              </div>

              {getBasicFiles('electrical').length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                  {getBasicFiles('electrical').map((file) => (
                    <div key={file.id} className={`bg-white rounded border p-2 transition-all duration-500 ${
                      file.justUploaded ? 'animate-pulse border-indigo-400 bg-indigo-50' : ''
                    }`}>
                      <div 
                        className="relative aspect-square mb-1 bg-gray-100 rounded overflow-hidden cursor-pointer"
                        onClick={() => setSelectedFile(file)}
                      >
                        <LazyImage
                          src={file.thumbnailUrl}
                          alt={file.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                          quality={75}
                          placeholder={true}
                          onLoad={() => {
                            console.log(`[IMAGE-SUCCESS] 기본사진 로드 성공: ${file.name}`);
                          }}
                          onError={() => {
                            console.error(`[IMAGE-ERROR] 기본사진 로드 실패:`, {
                              url: file.thumbnailUrl,
                              fileName: file.name,
                              category: extractCategoryFromFileName(file.name)
                            });
                          }}
                        />
                      </div>
                      <div className="text-xs">
                        <p className="font-medium truncate" title={file.name}>{file.name}</p>
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => setSelectedFile(file)}
                            className="flex-1 bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs"
                          >
                            보기
                          </button>
                          <button
                            onClick={() => deleteFile(file)}
                            className="bg-red-100 text-red-800 px-1 py-0.5 rounded text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 기타시설 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-md font-medium text-gray-600 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                기타시설 ({getBasicFiles('others').length}개)
              </h4>

              {uploading['basic-photos-others'] && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>업로드 중...</span>
                    <span>{Math.round(uploadProgress['basic-photos-others'] || 0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gray-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress['basic-photos-others'] || 0}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="relative mb-3">
                <input
                  type="file"
                  id="upload-basic-others"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleBasicUpload(e.target.files, 'others')}
                  disabled={uploading['basic-photos-others']}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className={`
                  flex items-center justify-center gap-3 p-3 border-2 border-dashed rounded-lg
                  ${uploading['basic-photos-others'] ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:bg-gray-100'}
                  transition-colors cursor-pointer
                `}>
                  <Upload className={`w-4 h-4 ${uploading['basic-photos-others'] ? 'text-gray-400' : 'text-gray-600'}`} />
                  <span className={`text-sm font-medium ${uploading['basic-photos-others'] ? 'text-gray-400' : 'text-gray-600'}`}>
                    {uploading['basic-photos-others'] ? '업로드 중...' : '기타시설 사진 선택'}
                  </span>
                </div>
              </div>

              {getBasicFiles('others').length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                  {getBasicFiles('others').map((file) => (
                    <div key={file.id} className={`bg-white rounded border p-2 transition-all duration-500 ${
                      file.justUploaded ? 'animate-pulse border-gray-400 bg-gray-50' : ''
                    }`}>
                      <div 
                        className="relative aspect-square mb-1 bg-gray-100 rounded overflow-hidden cursor-pointer"
                        onClick={() => setSelectedFile(file)}
                      >
                        <LazyImage
                          src={file.thumbnailUrl}
                          alt={file.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                          quality={75}
                          placeholder={true}
                          onLoad={() => {
                            console.log(`[IMAGE-SUCCESS] 기본사진 로드 성공: ${file.name}`);
                          }}
                          onError={() => {
                            console.error(`[IMAGE-ERROR] 기본사진 로드 실패:`, {
                              url: file.thumbnailUrl,
                              fileName: file.name,
                              category: extractCategoryFromFileName(file.name)
                            });
                          }}
                        />
                      </div>
                      <div className="text-xs">
                        <p className="font-medium truncate" title={file.name}>{file.name}</p>
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => setSelectedFile(file)}
                            className="flex-1 bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs"
                          >
                            보기
                          </button>
                          <button
                            onClick={() => deleteFile(file)}
                            className="bg-red-100 text-red-800 px-1 py-0.5 rounded text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 향상된 이미지 미리보기 모달 */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div 
            ref={modalRef}
            className="bg-white rounded-xl shadow-2xl max-w-5xl max-h-[95vh] overflow-hidden transform transition-all duration-300 scale-100"
          >
            {/* 모달 헤더 */}
            <div className="p-4 bg-white/90 backdrop-blur-sm border-b border-gray-100/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{selectedFile.name}</h3>
                  <p className="text-sm text-gray-600">{selectedFile.facilityInfo || '기본사진'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                title="닫기 (ESC)"
              >
                <X className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
              </button>
            </div>
            
            {/* 모달 바디 */}
            <div className="p-6 overflow-auto max-h-[calc(95vh-140px)]">
              {/* 이미지 영역 */}
              <div className="flex justify-center mb-6">
                <LazyImage
                  src={selectedFile.thumbnailUrl}
                  alt={selectedFile.name}
                  className="max-w-full max-h-[60vh] rounded-lg shadow-lg object-contain"
                  priority={true}
                  quality={90}
                  onError={() => {
                    console.error(`[MODAL-IMAGE-ERROR] 모달 이미지 로드 실패:`, {
                      url: selectedFile.thumbnailUrl,
                      fileName: selectedFile.name
                    });
                  }}
                />
              </div>
              
              {/* 파일 정보 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  파일 정보
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">파일명:</span>
                    <span className="text-gray-900">{selectedFile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">크기:</span>
                    <span className="text-gray-900">{formatFileSize(selectedFile.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">시설정보:</span>
                    <span className="text-gray-900">{selectedFile.facilityInfo || '기본사진'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">업로드:</span>
                    <span className="text-gray-900">{new Date(selectedFile.createdTime).toLocaleString('ko-KR')}</span>
                  </div>
                </div>
              </div>
              
              {/* 액션 버튼 */}
              <div className="flex gap-3 justify-center">
                <a
                  href={selectedFile.downloadUrl}
                  download={selectedFile.name}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Download className="w-4 h-4" />
                  다운로드
                </a>
                
                <button
                  onClick={() => deleteFile(selectedFile)}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            </div>

            {/* ESC 힌트 */}
            <div className="absolute top-4 right-16 text-xs text-gray-500 bg-white bg-opacity-90 px-2 py-1 rounded">
              ESC 또는 외부 클릭으로 닫기
            </div>
          </div>
        </div>
      )}

      {/* 모달 애니메이션 스타일 */}
      <style jsx>{`
        @keyframes fade-in {
          from { 
            opacity: 0; 
            backdrop-filter: blur(0px);
          }
          to { 
            opacity: 1; 
            backdrop-filter: blur(4px);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}