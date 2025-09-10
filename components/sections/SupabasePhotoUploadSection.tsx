'use client';

import { useState, useCallback, useEffect } from 'react';
import { Camera, Upload, Factory, Shield, Building2, AlertCircle, CheckCircle2, Eye, Download, Trash2, RefreshCw, X } from 'lucide-react';
import { FacilitiesData, Facility, UploadedFile } from '@/types';
import imageCompression from 'browser-image-compression';

interface SupabasePhotoUploadSectionProps {
  businessName: string;
  facilities: FacilitiesData | null;
}

interface PhotoCategory {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

const compressImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/') || file.size <= 500 * 1024) {
    return file;
  }

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/webp' as const
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now()
    });
  } catch (error) {
    console.warn('압축 실패, 원본 파일 사용:', error);
    return file;
  }
};

export default function SupabasePhotoUploadSection({ 
  businessName, 
  facilities 
}: SupabasePhotoUploadSectionProps) {
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadSuccess, setUploadSuccess] = useState<{ [key: string]: boolean }>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);

  const dischargeCount = facilities?.discharge?.reduce((total, facility) => total + facility.quantity, 0) || 0;
  const preventionCount = facilities?.prevention?.reduce((total, facility) => total + facility.quantity, 0) || 0;
  const outletCount = facilities ? [...new Set([...facilities.discharge.map(f => f.outlet), ...facilities.prevention.map(f => f.outlet)])].length : 0;

  // 업로드된 파일 로드 - 향상된 로딩 및 디버깅
  const loadUploadedFiles = useCallback(async () => {
    if (!businessName) return;
    
    setLoadingFiles(true);
    console.log(`📂 [LOAD-FILES] 파일 로드 시작: ${businessName}`);
    
    try {
      const response = await fetch(`/api/uploaded-files-supabase?businessName=${encodeURIComponent(businessName)}&systemType=presurvey&refresh=true`);
      const result = await response.json();
      
      console.log(`📂 [LOAD-FILES] API 응답:`, result);
      
      if (result.success) {
        const files = result.data?.files || result.files || [];
        setUploadedFiles(files);
        console.log(`✅ [LOAD-FILES] 파일 로드 완료: ${files.length}개`);
      } else {
        console.warn(`⚠️ [LOAD-FILES] API 오류: ${result.message}`);
        setUploadedFiles([]);
      }
    } catch (error) {
      console.error('❌ [LOAD-FILES] 파일 목록 로드 실패:', error);
      setUploadedFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [businessName]);

  useEffect(() => {
    loadUploadedFiles();
  }, [loadUploadedFiles]);

  // 파일 삭제
  const deleteFile = useCallback(async (file: UploadedFile) => {
    if (!confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch('/api/uploaded-files-supabase', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId: file.id, 
          fileName: file.name 
        })
      });

      const result = await response.json();
      if (result.success) {
        setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
        setSelectedFile(null);
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

  // 폴더별 파일 그룹화
  const filesByCategory = uploadedFiles.reduce((acc, file) => {
    const category = file.folderName || 'basic';
    if (!acc[category]) acc[category] = [];
    acc[category].push(file);
    return acc;
  }, {} as { [key: string]: UploadedFile[] });

  const categories: PhotoCategory[] = [
    {
      id: 'basic',
      name: '기본사진',
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      description: '사업장 전경, 출입구, 간판 등'
    },
    {
      id: 'discharge',
      name: '배출시설',
      icon: Factory,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      description: `${dischargeCount}개 시설의 사진`
    },
    {
      id: 'prevention',
      name: '방지시설',
      icon: Shield,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      description: `${preventionCount}개 시설의 사진`
    }
  ];

  const handleFileUpload = useCallback(async (files: FileList, category: string) => {
    if (!files.length) return;

    const categoryKey = `${category}-${Date.now()}`;
    
    // 🎯 즉시 미리보기 파일 생성 (optimistic UI)
    const previewFiles = Array.from(files).map((file) => {
      const objectUrl = URL.createObjectURL(file);
      return {
        id: `preview-${Date.now()}-${Math.random()}`,
        name: file.name,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
        webViewLink: objectUrl,
        downloadUrl: objectUrl,
        thumbnailUrl: objectUrl,
        publicUrl: objectUrl,
        directUrl: objectUrl,
        folderName: category === 'basic' ? '기본사진' : category === 'discharge' ? '배출시설' : '방지시설',
        uploadStatus: 'uploading',
        syncedAt: null,
        googleFileId: null,
        facilityInfo: category,
        filePath: `preview/${category}/${file.name}`,
        justUploaded: true,
        isPreview: true
      } as unknown as UploadedFile & { isPreview: boolean; justUploaded: boolean };
    });
    
    // 즉시 미리보기 파일 추가 (깜빡거리는 효과와 함께)
    setUploadedFiles(prev => [...previewFiles, ...prev]);
    setUploading(prev => ({ ...prev, [categoryKey]: true }));
    setUploadProgress(prev => ({ ...prev, [categoryKey]: 0 }));

    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const compressedFile = await compressImage(file);
        
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('businessName', businessName);
        formData.append('category', category);
        formData.append('systemType', 'presurvey');

        const response = await fetch('/api/upload-supabase', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        setUploadProgress(prev => ({ 
          ...prev, 
          [categoryKey]: ((index + 1) / files.length) * 100 
        }));

        // 업로드 성공 시 미리보기를 실제 파일로 교체
        if (result.success && result.files && result.files.length > 0) {
          const newFile = result.files[0];
          
          // 미리보기 파일을 실제 업로드된 파일로 교체
          setUploadedFiles(prev => prev.map(f => {
            if (f.originalName === file.name && (f as any).isPreview) {
              // Object URL 정리 (메모리 누수 방지)
              if (f.thumbnailUrl && f.thumbnailUrl.startsWith('blob:')) {
                URL.revokeObjectURL(f.thumbnailUrl);
                URL.revokeObjectURL(f.webViewLink);
                URL.revokeObjectURL(f.downloadUrl);
              }
              
              return {
                ...newFile,
                justUploaded: true,
                uploadedAt: Date.now()
              };
            }
            return f;
          }));
          
          console.log(`✅ [UPLOAD-SUCCESS] 미리보기를 실제 파일로 교체: ${file.name} → ${newFile.name}`);
          
          // 0.5초 후 깜빡임 효과 제거
          setTimeout(() => {
            setUploadedFiles(prev => prev.map(f => 
              f.id === newFile.id ? { ...f, justUploaded: false } : f
            ));
          }, 500);
        } else {
          // 업로드 실패 시 미리보기 파일 제거
          console.warn(`❌ [UPLOAD-FAILED] 미리보기 파일 제거: ${file.name}`);
          setUploadedFiles(prev => prev.filter(f => 
            !(f.originalName === file.name && (f as any).isPreview)
          ));
        }

        return result;
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r.success).length;
      
      if (successCount === files.length) {
        setUploadSuccess(prev => ({ ...prev, [categoryKey]: true }));
        setTimeout(() => {
          setUploadSuccess(prev => ({ ...prev, [categoryKey]: false }));
        }, 3000);
      }

      // 실패한 업로드가 있는 경우 미리보기 파일만 제거
      if (successCount < files.length) {
        console.log(`❌ [UPLOAD-PARTIAL] 부분 실패, 미리보기 파일 정리`);
        setUploadedFiles(prev => prev.filter(f => !(f as any).isPreview));
      }

    } catch (error) {
      console.error('업로드 오류:', error);
      // 오류 시 모든 미리보기 파일 제거
      setUploadedFiles(prev => prev.filter(f => !(f as any).isPreview));
    } finally {
      setUploading(prev => ({ ...prev, [categoryKey]: false }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [categoryKey]: 0 }));
      }, 2000);
    }
  }, [businessName, loadUploadedFiles]);

  if (!facilities) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-gray-100/50">
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

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-gray-100/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Camera className="w-6 h-6 text-purple-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">사진 업로드 (Supabase)</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 text-center shadow-sm border border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Factory className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm font-medium text-gray-600">배출시설</h3>
          </div>
          <p className="text-2xl font-bold text-orange-600">{dischargeCount}</p>
          <p className="text-xs text-gray-500">개</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 text-center shadow-sm border border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-green-500" />
            <h3 className="text-sm font-medium text-gray-600">방지시설</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">{preventionCount}</p>
          <p className="text-xs text-gray-500">개</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 text-center shadow-sm border border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-medium text-gray-600">배출구</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">{outletCount}</p>
          <p className="text-xs text-gray-500">개</p>
        </div>
      </div>

      <div className="space-y-4">
        {categories.map((category) => {
          const categoryKey = `${category.id}-upload`;
          const isUploading = uploading[categoryKey];
          const progress = uploadProgress[categoryKey] || 0;
          const isSuccess = uploadSuccess[categoryKey];

          return (
            <div key={category.id} className={`${category.bgColor} rounded-lg p-4 border ${category.borderColor}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <category.icon className={`w-5 h-5 ${category.color}`} />
                  <div>
                    <h3 className={`font-semibold ${category.color}`}>{category.name}</h3>
                    <p className="text-sm text-gray-600">{category.description}</p>
                  </div>
                </div>
                
                {isSuccess && (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                )}
              </div>

              {isUploading && (
                <div className="mb-3 animate-pulse">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 border border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      업로드 중...
                    </span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-purple-600 h-2.5 rounded-full transition-all duration-500 ease-out shadow-sm"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="relative">
                <input
                  type="file"
                  id={`upload-${category.id}`}
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files, category.id)}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className={`
                  flex items-center justify-center gap-3 p-4 border-2 border-dashed rounded-lg
                  ${isUploading ? 'border-gray-300 bg-gray-50' : `${category.borderColor} hover:bg-white`}
                  transition-colors cursor-pointer
                `}>
                  <Upload className={`w-5 h-5 ${isUploading ? 'text-gray-400' : category.color}`} />
                  <span className={`font-medium ${isUploading ? 'text-gray-400' : category.color}`}>
                    {isUploading ? '업로드 중...' : `${category.name} 사진 선택`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 로딩 상태 표시 */}
      {loadingFiles && (
        <div className="mt-6 bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-600">업로드된 사진을 불러오는 중...</span>
          </div>
        </div>
      )}

      {/* 업로드된 사진 표시 */}
      {!loadingFiles && uploadedFiles.length > 0 && (
        <div className="mt-6 bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-600" />
              업로드된 사진 ({uploadedFiles.length}개)
            </h3>
            <button
              onClick={loadUploadedFiles}
              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {Object.entries(filesByCategory).map(([categoryId, files]) => {
            const category = categories.find(c => c.id === categoryId);
            if (!category || !files.length) return null;

            return (
              <div key={categoryId} className={`mb-4 ${category.bgColor} rounded-lg p-3 border ${category.borderColor}`}>
                <h4 className={`${category.color} font-medium mb-3 flex items-center gap-2`}>
                  <category.icon className="w-4 h-4" />
                  {category.name} ({files.length}개)
                </h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {files.map((file) => (
                    <div key={file.id} className={`bg-white rounded-lg border p-2 shadow-sm transition-all duration-500 ${
                      (file as any).justUploaded ? 'animate-pulse border-green-400 bg-green-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <div 
                        className="relative aspect-square mb-2 bg-gray-100 rounded overflow-hidden cursor-pointer group"
                        onClick={() => setSelectedFile(file)}
                      >
                        <img
                          src={file.thumbnailUrl}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="50" text-anchor="middle" dy="0.3em" font-family="Arial" font-size="8" fill="%236b7280">이미지</text></svg>`;
                          }}
                        />
                        
                        {/* 🎉 업로드 완료 표시 (NEW 뱃지) */}
                        {(file as any).justUploaded && (
                          <div className="absolute top-1 right-1">
                            <div className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium animate-pulse">
                              NEW
                            </div>
                          </div>
                        )}
                        
                        {/* 업로드 중 표시 (스피너) */}
                        {(file as any).isPreview && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs">
                        <p className="font-medium text-gray-900 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-gray-500">{formatFileSize(file.size)}</p>
                        
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => setSelectedFile(file)}
                            className="flex-1 bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs hover:bg-blue-200 transition-colors"
                          >
                            보기
                          </button>
                          <button
                            onClick={() => deleteFile(file)}
                            className="bg-red-100 text-red-800 px-1 py-0.5 rounded text-xs hover:bg-red-200 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 text-center">
        <span className="bg-gray-100 px-2 py-1 rounded-full">
          📋 대기필증 관리 시스템 기반 업로드
        </span>
      </div>

      {/* 🎨 Popup-Style Photo Preview - Non-Intrusive Design */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* Subtle Backdrop Overlay - Optional dimming */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-[1px] pointer-events-auto cursor-pointer animate-in fade-in duration-200" 
            onClick={() => setSelectedFile(null)}
          />
          
          {/* Popup Container - Positioned like a floating window */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[90vw] max-w-2xl max-h-[85vh] pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-3 duration-300 overflow-hidden border border-gray-200/50">
            
            {/* 🎯 Compact Header - Popup style */}
            <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Eye className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-800 leading-tight">{selectedFile.originalName || selectedFile.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      <span className="px-2 py-0.5 bg-purple-100 rounded-md text-purple-700 text-xs">
                        {categories.find(c => c.id === selectedFile.folderName)?.name || selectedFile.folderName || '기본사진'}
                      </span>
                      <span>•</span>
                      <span>{formatFileSize(selectedFile.size)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Close Button */}
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
                  title="닫기 (ESC)"
                >
                  <X className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
                </button>
              </div>
            </div>
            
            {/* 📷 Image Display Area - Popup optimized */}
            <div className="p-3 flex justify-center items-center bg-gray-50 min-h-[250px] max-h-[40vh] overflow-hidden">              
              {/* Main Image - Popup sized */}
              <div className="relative">
                <img
                  src={selectedFile.webViewLink || selectedFile.thumbnailUrl}
                  alt={selectedFile.name}
                  className="max-w-full max-h-[35vh] rounded-lg shadow-md object-contain transition-transform duration-200 hover:scale-105 cursor-pointer"
                  onClick={(e) => {
                    // Optional: open in new tab for full size view
                    window.open(selectedFile.webViewLink || selectedFile.downloadUrl, '_blank');
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    // Fallback to other URLs if main fails
                    if (target.src !== selectedFile.downloadUrl) {
                      target.src = selectedFile.downloadUrl;
                    } else if (target.src !== selectedFile.publicUrl) {
                      target.src = selectedFile.publicUrl || selectedFile.directUrl || '';
                    }
                  }}
                />
              </div>
            </div>
            
            {/* 📋 Action Panel - Popup style */}
            <div className="p-3 bg-white border-t border-gray-100 rounded-b-2xl">
              <div className="text-center text-xs text-gray-500 mb-3">
                업로드: {new Date(selectedFile.createdTime).toLocaleDateString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              
              {/* 🎬 Action Buttons - Popup optimized */}
              <div className="flex gap-2 justify-center">
                <a
                  href={selectedFile.downloadUrl}
                  download={selectedFile.originalName || selectedFile.name}
                  className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors duration-200 text-sm"
                >
                  <Download className="w-3 h-3" />
                  다운로드
                </a>
                
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedFile.webViewLink);
                    // Show brief feedback
                    const btn = document.activeElement as HTMLButtonElement;
                    const originalText = btn.textContent;
                    btn.textContent = '복사됨!';
                    setTimeout(() => btn.textContent = originalText, 1000);
                  }}
                  className="flex items-center gap-1 bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors duration-200 text-sm"
                >
                  <Eye className="w-3 h-3" />
                  링크 복사
                </button>
                
                <button
                  onClick={() => {
                    if (confirm(`"${selectedFile.name}" 파일을 삭제하시겠습니까?`)) {
                      deleteFile(selectedFile);
                    }
                  }}
                  className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors duration-200 text-sm"
                >
                  <Trash2 className="w-3 h-3" />
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}