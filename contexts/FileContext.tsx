'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { UploadedFile } from '@/types';

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

  // 파일 목록 새로고침 (스마트 머지 방식)
  const refreshFiles = useCallback(async () => {
    if (!businessName || loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    
    try {
      const response = await fetch(`/api/uploaded-files-supabase?businessName=${encodeURIComponent(businessName)}&systemType=${systemType}&refresh=true`);
      const result = await response.json();
      
      if (result.success) {
        const newFiles = result.data.files || [];
        
        // 스마트 머지: 기존 파일과 새 파일을 합쳐서 중복 제거
        setUploadedFiles(prevFiles => {
          const existingIds = new Set(prevFiles.map(f => f.id));
          const serverFiles = newFiles.filter((f: any) => f.id && !existingIds.has(f.id));
          
          // 최근 3분 이내 업로드된 파일은 유지 (깜빡임 방지)
          const now = new Date().getTime();
          const recentFiles = prevFiles.filter(f => {
            const fileTime = new Date(f.createdTime).getTime();
            const isTimeRecent = now - fileTime < 3 * 60 * 1000; // 3분 이내
            const hasUploadFlag = f.justUploaded || (f.uploadedAt && now - f.uploadedAt < 5000); // 업로드 플래그 또는 5초 이내
            return isTimeRecent || hasUploadFlag;
          });
          
          // 오래된 파일은 서버에서 가져온 것으로 교체
          const olderServerFiles = newFiles.filter((serverFile: any) => {
            const serverFileTime = new Date(serverFile.createdTime).getTime();
            return now - serverFileTime >= 3 * 60 * 1000; // 3분 이상 된 파일
          });
          
          const mergedFiles = [...recentFiles, ...serverFiles, ...olderServerFiles];
          
          console.log(`🔄 [FileContext] 스마트 새로고침 완료:`, {
            기존파일: prevFiles.length,
            서버파일: newFiles.length,
            최근파일유지: recentFiles.length,
            새로운파일: serverFiles.length,
            오래된파일: olderServerFiles.length,
            최종파일: mergedFiles.length
          });
          
          return mergedFiles;
        });
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

  // 파일 추가 (모바일 호환성 강화 + 업로드 직후 안정성 보장)
  const addFiles = useCallback((newFiles: UploadedFile[]) => {
    if (!newFiles || newFiles.length === 0) {
      console.warn(`➕ [FileContext] 추가할 파일이 없습니다`);
      return;
    }

    console.log(`➕ [FileContext] 파일 추가 시작: ${newFiles.length}개`, {
      files: newFiles.map(f => ({
        id: f.id,
        name: f.originalName,
        facilityInfo: f.facilityInfo,
        folderName: f.folderName,
        createdTime: f.createdTime
      }))
    });
    
    setUploadedFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const uniqueNewFiles = newFiles.filter(f => f.id && !existingIds.has(f.id));
      
      if (uniqueNewFiles.length > 0) {
        console.log(`➕ [FileContext] 고유 파일 추가: ${uniqueNewFiles.length}개`);
        
        // 새로 추가되는 파일들에 업로드 직후 마커 추가 (깜빡임 방지)
        const markedNewFiles = uniqueNewFiles.map(file => ({
          ...file,
          justUploaded: true, // 업로드 직후임을 표시하는 플래그
          uploadedAt: Date.now() // 추가 시점 기록
        }));
        
        const updated = [...prev, ...markedNewFiles];
        console.log(`➕ [FileContext] 업데이트된 총 파일 수: ${updated.length}개`);
        
        // 5초 후 justUploaded 플래그 제거
        setTimeout(() => {
          setUploadedFiles(current => 
            current.map(f => ({
              ...f,
              justUploaded: undefined,
              uploadedAt: undefined
            }))
          );
        }, 5000);
        
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
            // 시설별 폴더 구조에 맞는 파일 정보 변환
            const pathParts = newFile.file_path.split('/');
            let folderName = '기본사진';
            let facilitySpecificPath = '';
            
            // 새로운 시설별 구조 인식
            if (pathParts.length > 2) {
              const folderType = pathParts[1]; // discharge, prevention, basic
              const facilityFolder = pathParts[2]; // outlet_1_prev_facility1 등
              
              if (folderType === 'discharge') folderName = '배출시설';
              else if (folderType === 'prevention') folderName = '방지시설';
              else folderName = '기본사진';
              
              facilitySpecificPath = `${folderType}/${facilityFolder}`;
            } else {
              // 기존 구조 호환
              if (newFile.file_path.includes('/discharge/')) folderName = '배출시설';
              else if (newFile.file_path.includes('/prevention/')) folderName = '방지시설';
              else folderName = '기본사진';
            }

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
              folderName,
              uploadStatus: newFile.upload_status,
              facilityInfo: newFile.facility_info,
              filePath: newFile.file_path // 시설별 경로 추가
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
                if (typeof window !== 'undefined') {
                  const toast = document.createElement('div');
                  toast.className = 'fixed top-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
                  toast.textContent = `🗑️ 파일이 삭제되었습니다: ${deletedFile.original_filename || deletedFile.filename}`;
                  document.body.appendChild(toast);
                  setTimeout(() => toast.remove(), 3000);
                }
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

  // 사업장 변경 시 Realtime 구독 재설정 (에러 대비 fallback 추가)
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | null = null;
    
    if (businessName) {
      console.log('🔄 [POLLING] WebSocket 대신 폴링 모드로 직접 시작');
      
      // WebSocket 연결 문제로 인해 바로 폴링 모드 시작
      pollingInterval = setInterval(async () => {
        try {
          await refreshFiles();
          console.log('🔄 [POLLING] 정기 파일 목록 업데이트');
        } catch (error) {
          console.error('🔄 [POLLING] 폴링 실패:', error);
        }
      }, 5000); // 5초마다 폴링 (깜빡임 방지)
      
      // 초기 로드
      setTimeout(() => {
        refreshFiles();
      }, 100);
      
      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          console.log('🔄 [POLLING] 폴링 정리 완료');
        }
      };
    }
    
    return () => {
      if (channelRef.current) {
        console.log('🔥 [REALTIME] 구독 해제');
        channelRef.current.unsubscribe();
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [businessName, setupRealtimeSubscription, refreshFiles]);

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