'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image, CheckCircle, AlertCircle, Eye, Trash2 } from 'lucide-react';

interface FileUploadProps {
  uploadId: string;
  label: string;
  icon: string;
  fileType: string;
  facilityInfo: string;
  businessName: string;
  systemType?: 'completion' | 'presurvey';
  onUploadComplete?: (files: any[]) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  url: string;
  downloadUrl: string;
  thumbnailUrl: string;
  size: number;
  mimeType: string;
}

function FileUpload({
  uploadId,
  label,
  icon,
  fileType,
  facilityInfo,
  businessName,
  systemType = 'completion',
  onUploadComplete
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<{
    type: 'idle' | 'success' | 'error' | 'uploading';
    message: string;
  }>({ type: 'idle', message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    
    if (files.length > 10) {
      setStatus({
        type: 'error',
        message: '최대 10개 파일까지만 선택 가능합니다.'
      });
      return;
    }

    // 파일 검증 (더 자세한 로깅 추가)
    const invalidFiles = files.filter(file => {
      console.log('📱 [FILE-CHECK] 파일 검증:', {
        name: file.name,
        size: file.size,
        type: file.type,
        sizeInMB: (file.size / (1024 * 1024)).toFixed(2),
        isImage: file.type.startsWith('image/'),
        isValidSize: file.size <= 100 * 1024 * 1024 // 100MB로 증가
      });
      
      // 파일 크기를 100MB로 증가하고, MIME 타입 검사 완화
      const isTooLarge = file.size > 100 * 1024 * 1024;
      const isInvalidType = !file.type.startsWith('image/') && 
                           !file.type.includes('heic') && 
                           !file.type.includes('heif') &&
                           file.type !== 'image/jpeg' &&
                           file.type !== 'image/jpg' &&
                           file.type !== 'image/png' &&
                           file.type !== 'image/webp';
      
      if (isTooLarge) console.warn('📱 [FILE-CHECK] 파일 크기 초과:', file.name);
      if (isInvalidType) console.warn('📱 [FILE-CHECK] 지원하지 않는 파일 형식:', file.name, file.type);
      
      return isTooLarge || isInvalidType;
    });

    if (invalidFiles.length > 0) {
      const details = invalidFiles.map(f => `${f.name} (${f.type}, ${(f.size / (1024 * 1024)).toFixed(1)}MB)`).join(', ');
      setStatus({
        type: 'error',
        message: `일부 파일이 요구사항에 맞지 않습니다. (100MB 이하, 이미지 파일만 가능)\n문제 파일: ${details}`
      });
      return;
    }

    setSelectedFiles(files);
    setStatus({
      type: 'idle',
      message: `${files.length}개 파일이 선택되었습니다.`
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setStatus({
        type: 'error',
        message: '업로드할 파일을 선택해주세요.'
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setStatus({
      type: 'uploading',
      message: '파일을 업로드하는 중입니다...'
    });

    try {
      const formData = new FormData();
      formData.append('businessName', businessName);
      formData.append('fileType', fileType);
      formData.append('facilityInfo', facilityInfo);
      formData.append('type', systemType);

      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // 업로드 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (result.success) {
        setUploadedFiles(prev => [...prev, ...result.files]);
        setSelectedFiles([]);
        setStatus({
          type: 'success',
          message: `✅ ${result.totalUploaded}개 파일이 성공적으로 업로드되었습니다.`
        });
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        onUploadComplete?.(result.files);
      } else {
        throw new Error(result.message || '업로드 실패');
      }
    } catch (error) {
      console.error('업로드 실패:', error);
      setStatus({
        type: 'error',
        message: `❌ 업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const previewImage = (file: File | UploadedFile) => {
    let imageUrl: string;
    
    if (file instanceof File) {
      imageUrl = URL.createObjectURL(file);
    } else {
      imageUrl = file.thumbnailUrl || file.downloadUrl;
    }
    
    window.open(imageUrl, '_blank');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = () => {
    switch (status.type) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'uploading': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status.type) {
      case 'success': return <CheckCircle className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'uploading': return <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default: return <Image className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <label className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          {label}
        </label>
        <div className="text-sm text-gray-500">
          최대 10개, 100MB 이하
        </div>
      </div>

      {/* 시설 정보 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="text-sm font-medium text-blue-800">📋 {facilityInfo}</div>
      </div>

      {/* 파일 선택 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        capture="environment"
        onChange={handleFileSelect}
        className="w-full p-3 border-2 border-gray-300 rounded-lg mb-4 bg-white cursor-pointer hover:border-blue-400 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        disabled={uploading}
      />

      {/* 선택된 파일 목록 */}
      {selectedFiles.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">선택된 파일 ({selectedFiles.length}개)</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Image className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 truncate">{file.name}</span>
                  <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => previewImage(file)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="미리보기"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeSelectedFile(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="제거"
                    disabled={uploading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 업로드 진행률 */}
      {uploading && uploadProgress > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>업로드 진행률</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 업로드 버튼 */}
      <button
        onClick={handleUpload}
        disabled={selectedFiles.length === 0 || uploading}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 px-4 rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed hover:from-blue-700 hover:to-blue-600 transition-all flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            업로드 중... ({uploadProgress}%)
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            📤 업로드
          </>
        )}
      </button>

      {/* 상태 메시지 */}
      {status.message && (
        <div className={`mt-4 p-3 rounded-lg border flex items-center gap-2 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">{status.message}</span>
        </div>
      )}

      {/* 업로드된 파일 목록 */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            업로드 완료 ({uploadedFiles.length}개)
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded border border-green-200">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800 truncate">{file.name}</span>
                  <span className="text-xs text-green-600">({formatFileSize(file.size)})</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => previewImage(file)}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="미리보기"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={file.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="다운로드"
                  >
                    <Upload className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FileUpload;