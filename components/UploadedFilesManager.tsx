// components/UploadedFilesManager.tsx - 완전한 파일 관리
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Download, Eye, RefreshCw, FolderOpen, Image, X, ZoomIn, AlertTriangle } from 'lucide-react';
import { useFileContext } from '@/contexts/FileContext';

interface UploadedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  downloadUrl: string;
  thumbnailUrl: string;
  publicUrl?: string;
  directUrl?: string;
  folderName: string;
}

interface UploadedFilesManagerProps {
  businessName: string;
  systemType: 'presurvey' | 'completion';
  onFileDeleted?: () => void;
}

// 폴더명을 한글로 매핑
const getFolderDisplayName = (folderName: string) => {
  const folderMap: { [key: string]: string } = {
    '기본사진': '기본사진',
    '배출시설': '배출시설',
    '방지시설': '방지시설',
    'root': '기본사진'
  };
  return folderMap[folderName] || folderName;
};

// 폴더별 색상 테마
const getFolderTheme = (folderName: string) => {
  const themes: { [key: string]: { bg: string; text: string; border: string } } = {
    '기본사진': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
    '배출시설': { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
    '방지시설': { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  };
  return themes[getFolderDisplayName(folderName)] || themes['기본사진'];
};

function UploadedFilesManager({ 
  businessName, 
  systemType,
  onFileDeleted 
}: UploadedFilesManagerProps) {
  const { uploadedFiles, refreshFiles, removeFile, setBusinessInfo, loading } = useFileContext();
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [deleteStates, setDeleteStates] = useState<{ [key: string]: boolean }>({});
  
  // FileContext에 사업장 정보 설정
  useEffect(() => {
    if (businessName && systemType) {
      setBusinessInfo(businessName, systemType);
      refreshFiles();
    }
  }, [businessName, systemType, setBusinessInfo, refreshFiles]);

  // uploadedFiles를 files로 사용
  const files = uploadedFiles;

  // refreshFiles를 loadFiles의 alias로 사용
  const loadFiles = refreshFiles;

  // 파일 삭제
  const deleteFile = useCallback(async (file: UploadedFile) => {
    if (!confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) return;

    try {
      setDeleteStates(prev => ({ ...prev, [file.id]: true }));

      console.log('🗑️ [CLIENT] 파일 삭제 요청:', { 
        fileId: file.id, 
        fileName: file.name,
        mimeType: file.mimeType,
        size: file.size 
      });

      const response = await fetch('/api/uploaded-files-supabase', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId: file.id, 
          fileName: file.name 
        })
      });

      const result = await response.json();
      console.log('🗑️ [CLIENT] 서버 응답:', result);

      if (result.success) {
        removeFile(file.id);
        onFileDeleted?.();
        
        // 성공 토스트
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
        toast.textContent = `"${file.name}" 파일이 삭제되었습니다.`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      } else {
        console.error('🗑️ [CLIENT] 삭제 실패:', result);
        throw new Error(result.message || '파일 삭제 실패');
      }
    } catch (error) {
      console.error('🗑️ [CLIENT] 파일 삭제 오류:', error);
      
      // 오류 토스트
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
      toast.textContent = error instanceof Error ? error.message : '파일 삭제 중 오류가 발생했습니다.';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setDeleteStates(prev => ({ ...prev, [file.id]: false }));
    }
  }, [removeFile, onFileDeleted]);

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 폴더별 파일 그룹화 및 파일명 기준 오름차순 정렬
  const filesByFolder = files.reduce((acc, file) => {
    const folderName = getFolderDisplayName(file.folderName);
    if (!acc[folderName]) acc[folderName] = [];
    acc[folderName].push(file);
    return acc;
  }, {} as { [key: string]: UploadedFile[] });

  // 각 폴더 내 파일들을 파일명 기준으로 오름차순 정렬
  Object.keys(filesByFolder).forEach(folderName => {
    filesByFolder[folderName].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR', { numeric: true }));
  });

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
            <h3 className="text-lg md:text-xl font-bold text-gray-900">
              업로드된 파일 관리
            </h3>
          </div>
          <button
            onClick={() => loadFiles(true)} // 강제 새로고침
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-red-800 font-medium">오류 발생</p>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">파일 목록을 불러오는 중...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Image className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>업로드된 파일이 없습니다.</p>
            <p className="text-sm mt-2">파일을 업로드하면 여기에 표시됩니다.</p>
            <button 
              onClick={() => loadFiles(true)}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-800">📁 총 {files.length}개의 파일이 업로드되었습니다</p>
            </div>
            
            {Object.entries(filesByFolder)
              .sort(([a], [b]) => a.localeCompare(b, 'ko-KR'))
              .map(([folderName, folderFiles]) => {
              const theme = getFolderTheme(folderName);
              
              return (
                <div key={folderName} className={`${theme.bg} p-4 rounded-lg border ${theme.border}`}>
                  <h4 className={`${theme.text} font-bold mb-3 flex items-center gap-2`}>
                    <FolderOpen className="w-5 h-5" />
                    {folderName} ({folderFiles.length}개)
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {folderFiles.map((file) => (
                      <div key={file.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                        {/* 이미지 미리보기 */}
                        <div 
                          className="relative aspect-square mb-3 bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
                          onClick={() => setSelectedFile(file)}
                        >
                          <img
                            src={file.thumbnailUrl}
                            alt={file.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="50" text-anchor="middle" dy="0.3em" font-family="Arial" font-size="12" fill="%236b7280">이미지 없음</text></svg>`;
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>

                        {/* 파일 정보 */}
                        <div className="space-y-2">
                          <h5 className="font-medium text-gray-900 text-sm truncate" title={file.name}>
                            {file.name}
                          </h5>
                          <div className="text-xs text-gray-500 space-y-1">
                            <p>크기: {formatFileSize(file.size)}</p>
                            <p>업로드: {new Date(file.createdTime).toLocaleDateString('ko-KR')}</p>
                          </div>
                          
                          {/* 액션 버튼 */}
                          <div className="flex gap-1">
                            <button
                              onClick={() => setSelectedFile(file)}
                              className="flex-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs hover:bg-blue-200 transition-colors flex items-center justify-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              보기
                            </button>
                            
                            <a
                              href={file.downloadUrl}
                              download={file.name}
                              className="flex-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs hover:bg-green-200 transition-colors flex items-center justify-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              다운로드
                            </a>
                            
                            <button
                              onClick={() => deleteFile(file)}
                              disabled={deleteStates[file.id]}
                              className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs hover:bg-red-200 transition-colors disabled:bg-red-300 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                              {deleteStates[file.id] ? (
                                <div className="w-3 h-3 border border-red-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
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
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <img
                src={selectedFile.directUrl || selectedFile.thumbnailUrl}
                alt={selectedFile.name}
                className="max-w-full max-h-[60vh] mx-auto"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = selectedFile.thumbnailUrl;
                }}
              />
              
              <div className="mt-4 text-sm text-gray-600 space-y-1">
                <p><strong>파일명:</strong> {selectedFile.name}</p>
                <p><strong>크기:</strong> {formatFileSize(selectedFile.size)}</p>
                <p><strong>폴더:</strong> {getFolderDisplayName(selectedFile.folderName)}</p>
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
                  disabled={deleteStates[selectedFile.id]}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleteStates[selectedFile.id] ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      삭제 중...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 글로벌 스타일 */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

export default UploadedFilesManager;
