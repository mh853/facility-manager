'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UploadedFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdTime: string;
  webViewLink: string;
  downloadUrl: string;
  thumbnailUrl: string;
  folderName: string;
  uploadStatus: string;
  facilityInfo?: string;
}

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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessNameState] = useState('');
  const [systemType, setSystemTypeState] = useState('completion');
  const loadingRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 파일 목록 새로고침
  const refreshFiles = useCallback(async () => {
    if (!businessName || loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    
    try {
      const response = await fetch(`/api/uploaded-files-supabase?businessName=${encodeURIComponent(businessName)}&systemType=${systemType}&refresh=true`);
      const result = await response.json();
      
      if (result.success) {
        setUploadedFiles(result.data.files || []);
        console.log(`🔄 [FileContext] 파일 목록 새로고침 완료: ${result.data.files?.length || 0}개 파일`);
      } else {
        console.warn('🔄 [FileContext] 파일 목록 새로고침 실패:', result.message);
      }
    } catch (error) {
      console.error('🔄 [FileContext] 파일 목록 로드 실패:', error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [businessName, systemType]);

  // 파일 추가
  const addFiles = useCallback((newFiles: UploadedFile[]) => {
    setUploadedFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const uniqueNewFiles = newFiles.filter(f => !existingIds.has(f.id));
      
      if (uniqueNewFiles.length > 0) {
        console.log(`➕ [FileContext] 새 파일 추가: ${uniqueNewFiles.length}개`);
        return [...prev, ...uniqueNewFiles];
      }
      
      return prev;
    });
  }, []);

  // 파일 삭제
  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      console.log(`🗑️ [FileContext] 파일 삭제: ${fileId}`);
      return updated;
    });
  }, []);

  // Realtime 구독 설정
  const setupRealtimeSubscription = useCallback(() => {
    if (!businessName) return;

    // 기존 구독 해제
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    console.log(`🔥 [REALTIME] 구독 시작: ${businessName}`);

    // 새 채널 생성 및 구독
    const channel = supabase
      .channel('uploaded_files_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'uploaded_files'
        },
        (payload) => {
          console.log('🔥 [REALTIME] 변경 감지:', payload);
          
          if (payload.eventType === 'INSERT') {
            // 새 파일 추가
            const newFile = payload.new as any;
            if (newFile.business_id) {
              // 파일을 UploadedFile 형식으로 변환
              const formattedFile: UploadedFile = {
                id: newFile.id,
                name: newFile.filename,
                originalName: newFile.original_filename,
                mimeType: newFile.mime_type,
                size: newFile.file_size,
                createdTime: newFile.created_at,
                webViewLink: supabase.storage.from('facility-files').getPublicUrl(newFile.file_path).data.publicUrl,
                downloadUrl: supabase.storage.from('facility-files').getPublicUrl(newFile.file_path).data.publicUrl,
                thumbnailUrl: supabase.storage.from('facility-files').getPublicUrl(newFile.file_path).data.publicUrl,
                folderName: newFile.file_path.includes('/discharge/') ? '배출시설' : 
                           newFile.file_path.includes('/prevention/') ? '방지시설' : '기본사진',
                uploadStatus: newFile.upload_status,
                facilityInfo: newFile.facility_info
              };

              setUploadedFiles(prev => {
                // 중복 방지
                if (prev.some(f => f.id === formattedFile.id)) {
                  return prev;
                }
                console.log(`➕ [REALTIME] 새 파일 추가: ${formattedFile.originalName}`);
                return [...prev, formattedFile];
              });

              // 토스트 알림
              const toast = document.createElement('div');
              toast.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
              toast.textContent = `📁 새 파일이 업로드되었습니다: ${formattedFile.originalName}`;
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 3000);
            }
          } 
          else if (payload.eventType === 'DELETE') {
            // 파일 삭제
            const deletedFile = payload.old as any;
            setUploadedFiles(prev => {
              const filtered = prev.filter(f => f.id !== deletedFile.id);
              if (filtered.length !== prev.length) {
                console.log(`🗑️ [REALTIME] 파일 삭제: ${deletedFile.id}`);
                
                // 토스트 알림
                const toast = document.createElement('div');
                toast.className = 'fixed top-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
                toast.textContent = `🗑️ 파일이 삭제되었습니다`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
              }
              return filtered;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log(`🔥 [REALTIME] 구독 상태: ${status}`);
      });

    channelRef.current = channel;
  }, [businessName]);

  // 사업장 정보 설정
  const setBusinessInfo = useCallback((name: string, type: string) => {
    setBusinessNameState(name);
    setSystemTypeState(type);
  }, []);

  // 사업장 변경 시 Realtime 구독 재설정
  useEffect(() => {
    if (businessName) {
      setupRealtimeSubscription();
    }
    
    return () => {
      if (channelRef.current) {
        console.log('🔥 [REALTIME] 구독 해제');
        channelRef.current.unsubscribe();
      }
    };
  }, [businessName, setupRealtimeSubscription]);

  return (
    <FileContext.Provider
      value={{
        uploadedFiles,
        setUploadedFiles,
        refreshFiles,
        addFiles,
        removeFile,
        loading,
        businessName,
        systemType,
        setBusinessInfo
      }}
    >
      {children}
    </FileContext.Provider>
  );
}

export const useFileContext = () => {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error('useFileContext must be used within a FileProvider');
  }
  return context;
};