'use client';

import { useState, useCallback, useEffect } from 'react';
import { Camera, Upload, Factory, Shield, Building2, AlertCircle, CheckCircle2, Eye, Download, Trash2, RefreshCw } from 'lucide-react';
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

  // 업로드된 파일 로드
  const loadUploadedFiles = useCallback(async () => {
    if (!businessName) return;
    
    setLoadingFiles(true);
    try {
      const response = await fetch(`/api/uploaded-files-supabase?businessName=${encodeURIComponent(businessName)}&systemType=presurvey`);
      const result = await response.json();
      
      if (result.success) {
        setUploadedFiles(result.files || []);
      }
    } catch (error) {
      console.error('파일 목록 로드 실패:', error);
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

        return result;
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r.success).length;
      
      if (successCount === files.length) {
        setUploadSuccess(prev => ({ ...prev, [categoryKey]: true }));
        setTimeout(() => {
          setUploadSuccess(prev => ({ ...prev, [categoryKey]: false }));
        }, 3000);
        
        // 파일 목록 새로고침
        loadUploadedFiles();
      }

    } catch (error) {
      console.error('업로드 오류:', error);
    } finally {
      setUploading(prev => ({ ...prev, [categoryKey]: false }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [categoryKey]: 0 }));
      }, 2000);
    }
  }, [businessName, loadUploadedFiles]);

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

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 shadow-sm border border-purple-100">
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
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>업로드 중...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
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
                    <div key={file.id} className="bg-white rounded-lg border border-gray-200 p-2 shadow-sm">
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

      {/* 이미지 미리보기 모달 */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">{selectedFile.name}</h3>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ×
              </button>
            </div>
            
            <div className="p-4">
              <img
                src={selectedFile.thumbnailUrl}
                alt={selectedFile.name}
                className="max-w-full max-h-[60vh] mx-auto"
              />
              
              <div className="mt-4 text-sm text-gray-600 space-y-1">
                <p><strong>파일명:</strong> {selectedFile.name}</p>
                <p><strong>크기:</strong> {formatFileSize(selectedFile.size)}</p>
                <p><strong>카테고리:</strong> {categories.find(c => c.id === selectedFile.folderName)?.name || selectedFile.folderName}</p>
                <p><strong>업로드:</strong> {new Date(selectedFile.createdTime).toLocaleString('ko-KR')}</p>
              </div>
              
              <div className="mt-4 flex gap-2">
                <a
                  href={selectedFile.downloadUrl}
                  download={selectedFile.name}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  다운로드
                </a>
                
                <button
                  onClick={() => deleteFile(selectedFile)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
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