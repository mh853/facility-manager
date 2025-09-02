'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Camera, Upload, Factory, Shield, Building2, AlertCircle, Eye, Download, Trash2, RefreshCw, X, Zap, Router, Cpu } from 'lucide-react';
import { FacilitiesData, Facility, UploadedFile } from '@/types';
import imageCompression from 'browser-image-compression';
import LazyImage from '@/components/ui/LazyImage';

interface FacilityPhotoUploadSectionProps {
  businessName: string;
  facilities: FacilitiesData | null;
}

const compressImage = async (file: File): Promise<File> => {
  // 1MB 이하 파일은 압축 건너뛰기 (속도 개선)
  if (!file.type.startsWith('image/') || file.size <= 1024 * 1024) {
    return file;
  }

  const options = {
    maxSizeMB: 2, // 1MB → 2MB로 완화 (압축 시간 단축)
    maxWidthOrHeight: 1440, // 1920 → 1440으로 축소 (처리 시간 단축)
    useWebWorker: true,
    initialQuality: 0.8, // 초기 품질 설정 (빠른 압축)
    alwaysKeepResolution: false // 해상도 유연성 (속도 개선)
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
    setUploading(prev => ({ ...prev, [uploadKey]: true }));
    setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const compressedFile = await compressImage(file);
        
        const formData = new FormData();
        formData.append('files', compressedFile);
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
          [uploadKey]: ((index + 1) / files.length) * 100 
        }));

        // 업로드 성공 시 즉시 optimistic UI 업데이트
        if (result.success && result.files && result.files.length > 0) {
          const newFile = result.files[0];
          setUploadedFiles(prev => [
            {
              ...newFile,
              justUploaded: true,
              uploadedAt: Date.now()
            },
            ...prev
          ]);
          
          // 3초 후 깜빡임 효과 제거
          setTimeout(() => {
            setUploadedFiles(prev => prev.map(f => 
              f.id === newFile.id ? { ...f, justUploaded: false } : f
            ));
          }, 3000);
        }

        return result;
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r.success).length;
      
      if (successCount === files.length) {
        loadUploadedFiles(); // 파일 목록 새로고침
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
    setUploading(prev => ({ ...prev, [uploadKey]: true }));
    setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const compressedFile = await compressImage(file);
        
        const formData = new FormData();
        formData.append('files', compressedFile);
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

        // 업로드 성공 시 즉시 optimistic UI 업데이트
        if (result.success && result.files && result.files.length > 0) {
          const newFile = result.files[0];
          setUploadedFiles(prev => [
            {
              ...newFile,
              justUploaded: true,
              uploadedAt: Date.now(),
              subcategory: category
            },
            ...prev
          ]);
          
          // 3초 후 깜빡임 효과 제거
          setTimeout(() => {
            setUploadedFiles(prev => prev.map(f => 
              f.id === newFile.id ? { ...f, justUploaded: false } : f
            ));
          }, 3000);
        }

        return result;
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r.success).length;
      
      if (successCount === files.length) {
        loadUploadedFiles();
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

  // 파일 삭제
  const deleteFile = useCallback(async (file: UploadedFile) => {
    if (!confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch('/api/uploaded-files-supabase', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId: file.id, 
          fileName: file.name,
          businessName: businessName
        })
      });

      const result = await response.json();
      if (result.success) {
        // 즉시 로컬 상태 업데이트
        setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
        setSelectedFile(null);
        // 서버에서 최신 데이터 다시 로드 (캐시 우회)
        setTimeout(() => {
          loadUploadedFiles(true);
        }, 500);
      }
    } catch (error) {
      console.error('파일 삭제 오류:', error);
    }
  }, []);

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 시설별 업로드된 파일 필터링 (파일 경로 기반 정확한 매칭)
  const getFilesForFacility = (facility: Facility, facilityType: 'discharge' | 'prevention') => {
    const newFacilityInfo = `배출구${facility.outlet}-${facilityType === 'discharge' ? '배출시설' : '방지시설'}${facility.number}`;
    
    const filteredFiles = uploadedFiles.filter(file => {
      // 새로운 형식 매칭
      if (file.facilityInfo === newFacilityInfo) {
        return true;
      }
      
      // 올바른 폴더 타입인지 확인
      const correctFolderType = file.folderName === (facilityType === 'discharge' ? '배출시설' : '방지시설');
      if (!correctFolderType) {
        return false;
      }
      
      // 파일 경로에서 시설 번호 추출하여 정확한 매칭
      if (file.filePath) {
        const facilityPathType = facilityType === 'discharge' ? 'discharge' : 'prevention';
        const pathPattern = new RegExp(`facility_${facilityPathType}(\\d+)`);
        const match = file.filePath.match(pathPattern);
        
        if (match) {
          const filesFacilityNumber = parseInt(match[1]);
          // 파일 경로의 시설 번호와 현재 시설 번호가 정확히 일치하는 경우만
          if (filesFacilityNumber === facility.number) {
            return true;
          }
        }
      }
      
      // 기존 형식에서 시설명과 용량이 정확히 일치하는 경우 (중복 방지)
      if (file.facilityInfo && file.facilityInfo.includes(`배출구: ${facility.outlet}번`)) {
        const facilityNameInFile = file.facilityInfo.split(' (')[0];
        const capacityInFile = file.facilityInfo.match(/\(([^,]+),/)?.[1];
        
        // 시설명과 용량이 모두 정확히 일치하는 경우만
        if (facility.name === facilityNameInFile && facility.capacity === capacityInFile) {
          return true;
        }
      }
      
      return false;
    });

    // 디버깅 로그
    console.log(`[DEBUG] ${facilityType} ${facility.number} (배출구 ${facility.outlet}) 매칭:`, {
      facilityName: facility.name,
      facilityCapacity: facility.capacity,
      expectedNew: newFacilityInfo,
      foundFiles: filteredFiles.length,
      allFiles: uploadedFiles.filter(f => f.folderName === (facilityType === 'discharge' ? '배출시설' : '방지시설')).length,
      fileDetails: filteredFiles.map(f => ({ 
        name: f.originalName, 
        facilityInfo: f.facilityInfo,
        filePath: f.filePath,
        pathNumber: f.filePath?.match(new RegExp(`facility_${facilityType === 'discharge' ? 'discharge' : 'prevention'}(\\d+)`))?.[1]
      }))
    });

    return filteredFiles;
  };

  // 기본사진 필터링 (카테고리별) - 이전 작동 버전 로직으로 복원
  const getBasicFiles = (category?: string) => {
    console.log('[DEBUG] 전체 업로드된 파일들:', uploadedFiles.map(f => ({ 
      name: f.name, 
      folderName: f.folderName, 
      filePath: f.filePath || 'no path' 
    })));
    
    const basicFiles = uploadedFiles.filter(file => {
      // 기본사진 폴더 확인 - 매우 관대한 조건으로 복원
      const isBasicFolder = !file.folderName || 
                           file.folderName === '' ||
                           file.folderName === 'basic' || 
                           file.folderName === '기본사진' ||
                           file.folderName.includes('기본') ||
                           // 시설 폴더가 아닌 경우도 기본사진으로 간주 (이전 작동 로직)
                           (file.folderName !== '배출시설' && file.folderName !== '방지시설');
      
      if (!isBasicFolder) return false;
      
      // 카테고리별 필터링 (없으면 모든 기본사진 반환)
      if (category) {
        const fileCategory = (file as any).subcategory || extractCategoryFromFileName(file.name);
        return fileCategory === category;
      }
      
      return true;
    });
    
    console.log('[DEBUG] 기본사진 필터링 (복원된 로직):', { 
      category: category || 'all',
      totalFiles: uploadedFiles.length, 
      basicFiles: basicFiles.length,
      basicFileNames: basicFiles.map(f => f.name)
    });
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
      <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 shadow-sm border border-gray-100">
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
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 shadow-sm border border-purple-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Camera className="w-6 h-6 text-purple-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">시설별 사진 업로드</h2>
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
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b flex items-center justify-between">
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