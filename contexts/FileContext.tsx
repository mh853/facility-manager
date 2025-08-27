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

  // 파일 추가 (모바일 호환성 강화)
  const addFiles = useCallback((newFiles: UploadedFile[]) => {
    if (!newFiles || newFiles.length === 0) {
      console.warn(`➕ [FileContext] 추가할 파일이 없습니다`);
      return;
    }

    console.log(`➕ [FileContext] 파일 추가 시작: ${newFiles.length}개`, newFiles);
    
    setUploadedFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const uniqueNewFiles = newFiles.filter(f => f.id && !existingIds.has(f.id));
      
      if (uniqueNewFiles.length > 0) {
        console.log(`➕ [FileContext] 고유 파일 추가: ${uniqueNewFiles.length}개`);
        const updated = [...prev, ...uniqueNewFiles];
        console.log(`➕ [FileContext] 업데이트된 총 파일 수: ${updated.length}개`);
        
        // 모바일에서 상태 업데이트를 강제하기 위한 트릭
        if (typeof window !== 'undefined') {
          // DOM 강제 업데이트 트리거
          window.dispatchEvent(new CustomEvent('fileListUpdated', { 
            detail: { files: updated, newCount: uniqueNewFiles.length } 
          }));
        }
        
        return updated;
      } else {
        console.log(`➕ [FileContext] 모든 파일이 이미 존재함`);
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
  const setupRealtimeSubscription = useCallback(async () => {
    if (!businessName) return;

    // 기존 구독 해제
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    console.log(`🔥 [REALTIME] 구독 시작: ${businessName}`);

    try {
      // 사업장 ID 조회 (Admin 클라이언트 사용)
      const response = await fetch('/api/business-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName })
      });
      
      const result = await response.json();
      
      if (!result.success || !result.businessId) {
        console.warn(`🔥 [REALTIME] 사업장 ID 조회 실패: ${businessName}`);
        return;
      }

      const businessId = result.businessId;
      console.log(`🔥 [REALTIME] 사업장 ID 확인: ${businessId}`);

      // 새 채널 생성 및 구독 (더 간단한 채널명 사용)
      const channel = supabase
        .channel(`files_${businessName.replace(/\s+/g, '_')}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'uploaded_files',
            filter: `business_id=eq.${businessId}`
          },
        (payload) => {
          console.log('🔥 [REALTIME] 변경 감지:', payload);
          
          if (payload.eventType === 'INSERT') {
            // 새 파일 추가
            const newFile = payload.new as any;
            console.log(`➕ [REALTIME] INSERT 이벤트:`, newFile);
            
            // businessId는 이미 필터링되어 있으므로 조건 체크 불필요
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
                console.log(`➕ [REALTIME] 중복 파일 무시: ${formattedFile.originalName}`);
                return prev;
              }
              console.log(`➕ [REALTIME] 새 파일 추가: ${formattedFile.originalName}`);
              return [...prev, formattedFile];
            });

            // 토스트 알림
            if (typeof window !== 'undefined') {
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
            console.log(`🗑️ [REALTIME] DELETE 이벤트 수신:`, deletedFile);
            
            setUploadedFiles(prev => {
              const beforeCount = prev.length;
              const filtered = prev.filter(f => f.id !== deletedFile.id);
              const afterCount = filtered.length;
              
              if (beforeCount !== afterCount) {
                console.log(`🗑️ [REALTIME] 파일 삭제 적용: ${deletedFile.id}, 삭제전:${beforeCount}, 삭제후:${afterCount}`);
                
                // 토스트 알림
                const toast = document.createElement('div');
                toast.className = 'fixed top-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
                toast.textContent = `🗑️ 파일이 삭제되었습니다: ${deletedFile.original_filename || deletedFile.filename}`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
              } else {
                console.warn(`🗑️ [REALTIME] 삭제할 파일을 찾지 못함: ${deletedFile.id}`);
              }
              
              return filtered;
            });
          }
          else if (payload.eventType === 'UPDATE') {
            // 파일 업데이트
            const updatedFile = payload.new as any;
            console.log(`✏️ [REALTIME] UPDATE 이벤트 수신:`, updatedFile);
            
            setUploadedFiles(prev => {
              return prev.map(file => {
                if (file.id === updatedFile.id) {
                  return {
                    ...file,
                    uploadStatus: updatedFile.upload_status,
                    facilityInfo: updatedFile.facility_info
                  };
                }
                return file;
              });
            });
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`🔥 [REALTIME] 구독 상태: ${status}`);
        if (err) {
          console.error(`🔥 [REALTIME] 구독 에러:`, err);
        }
        
        // 구독 상태별 로그
        switch (status) {
          case 'SUBSCRIBED':
            console.log(`✅ [REALTIME] 성공적으로 구독됨: uploaded_files_${businessId}`);
            break;
          case 'CHANNEL_ERROR':
            console.error(`❌ [REALTIME] 채널 에러: uploaded_files_${businessId}`);
            break;
          case 'TIMED_OUT':
            console.warn(`⏰ [REALTIME] 구독 타임아웃: uploaded_files_${businessId}`);
            break;
          case 'CLOSED':
            console.log(`🔒 [REALTIME] 연결 종료: uploaded_files_${businessId}`);
            break;
        }
      });

    channelRef.current = channel;
    
    } catch (error) {
      console.error(`🔥 [REALTIME] 구독 설정 실패:`, error);
    }
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