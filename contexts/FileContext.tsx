'use client';

// 🚀 간소화된 FileContext - Zustand 기반 Single Source of Truth
import { createContext, useContext, ReactNode } from 'react';
import { UploadedFile } from '@/types';
import { usePhotoStore } from '@/hooks/usePhotoStore';

interface FileContextType {
  uploadedFiles: UploadedFile[];
  setUploadedFiles: (files: UploadedFile[]) => void;
  refreshFiles: () => Promise<void>;
  addFiles: (files: UploadedFile[]) => void;
  removeFile: (fileId: string) => void;
  loading: boolean;
  businessName: string;
  systemType: string;
  setBusinessInfo: (businessName: string, systemType: string) => void;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

interface FileProviderProps {
  children: ReactNode;
}

export function FileProvider({ children }: FileProviderProps) {
  // 🚀 Zustand 상태 사용 (Single Source of Truth)
  const {
    photos: uploadedFiles,
    loading,
    businessName,
    systemType,
    setPhotos: setUploadedFiles,
    addPhotos: rawAddFiles,
    removePhoto: rawRemoveFile,
    loadPhotos: rawRefreshFiles,
    setBusinessInfo: rawSetBusinessInfo,
  } = usePhotoStore();

  // Legacy 호환성을 위한 래퍼 함수들
  const addFiles = (files: UploadedFile[]) => {
    rawAddFiles(files);
    console.log(`📎 [FILE-CONTEXT] addFiles: ${files.length}개 추가`);
  };

  const removeFile = (fileId: string) => {
    rawRemoveFile(fileId);
    console.log(`🗑️ [FILE-CONTEXT] removeFile: ${fileId} 제거`);
  };

  const refreshFiles = async () => {
    console.log(`🔄 [FILE-CONTEXT] refreshFiles 호출`);
    await rawRefreshFiles();
  };

  const setBusinessInfo = (name: string, type: string) => {
    rawSetBusinessInfo(name, type);
    console.log(`🏢 [FILE-CONTEXT] setBusinessInfo: ${name}, ${type}`);
  };

  const value: FileContextType = {
    uploadedFiles,
    setUploadedFiles,
    refreshFiles,
    addFiles,
    removeFile,
    loading,
    businessName,
    systemType,
    setBusinessInfo,
  };

  return (
    <FileContext.Provider value={value}>
      {children}
    </FileContext.Provider>
  );
}

export function useFileContext() {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error('useFileContext must be used within a FileProvider');
  }
  return context;
}