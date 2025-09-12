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
  const [systemType, setSystemTypeState] = useState('presurvey');
  const loadingRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // 모바일 최적화: 네트워크 상태 감지 + 모바일 디바이스 감지
  const [networkState, setNetworkState] = useState<{
    online: boolean;
    effectiveType: string;
    downlink: number;
    isMobile: boolean;
  }>({
    online: true,
    effectiveType: '4g',
    downlink: 10,
    isMobile: false
  });

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

  // 개선된 Realtime 구독 설정
  const setupRealtimeSubscription = useCallback(async () => {
    if (!businessName) {
      throw new Error('사업장명이 필요합니다');
    }

    // 기존 구독 해제
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    console.log(`🔥 [REALTIME] 구독 시작: ${businessName}`);

    try {
      // 사업장 ID 조회 (타임아웃 설정)
      const response = await Promise.race([
        fetch('/api/business-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessName })
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('API 타임아웃')), 5000)
        )
      ]);
      
      const result = await response.json();
      
      if (!result.success || !result.businessId) {
        throw new Error(`사업장 ID 조회 실패: ${result.message || 'Unknown error'}`);
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
          console.log('🔥 [REALTIME] 변경 감지:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            // 새 파일 추가 - 강화된 처리
            const newFile = payload.new as any;
            console.log(`➕ [REALTIME] INSERT 이벤트:`, {
              id: newFile.id,
              filename: newFile.original_filename,
              path: newFile.file_path,
              timestamp: new Date().toISOString()
            });
            
            try {
              // 파일 정보 검증
              if (!newFile.id || !newFile.file_path || !newFile.original_filename) {
                console.warn('⚠️ [REALTIME] 불완전한 파일 데이터:', newFile);
                return;
              }
              
              // 시설별 폴더 구조 파싱
              const pathParts = newFile.file_path.split('/');
              let folderName = '기본사진';
              
              if (pathParts.length > 2) {
                const folderType = pathParts[1];
                if (folderType === 'discharge') folderName = '배출시설';
                else if (folderType === 'prevention') folderName = '방지시설';
                else folderName = '기본사진';
              } else {
                if (newFile.file_path.includes('/discharge/')) folderName = '배출시설';
                else if (newFile.file_path.includes('/prevention/')) folderName = '방지시설';
              }

              const formattedFile: UploadedFile = {
                id: newFile.id,
                name: newFile.filename || newFile.original_filename,
                originalName: newFile.original_filename,
                mimeType: newFile.mime_type || 'image/webp',
                size: newFile.file_size || 0,
                createdTime: newFile.created_at,
                webViewLink: supabase.storage.from('facility-files').getPublicUrl(newFile.file_path).data.publicUrl,
                downloadUrl: supabase.storage.from('facility-files').getPublicUrl(newFile.file_path).data.publicUrl,
                thumbnailUrl: supabase.storage.from('facility-files').getPublicUrl(newFile.file_path).data.publicUrl,
                folderName,
                uploadStatus: newFile.upload_status || 'uploaded',
                facilityInfo: newFile.facility_info || '',
                filePath: newFile.file_path
              };

              // 중복 체크 및 추가
              setUploadedFiles(prev => {
                const existingIndex = prev.findIndex(f => f.id === formattedFile.id);
                if (existingIndex !== -1) {
                  console.log(`🔄 [REALTIME] 파일 업데이트: ${formattedFile.originalName}`);
                  // 기존 파일 업데이트
                  const updated = [...prev];
                  updated[existingIndex] = formattedFile;
                  return updated;
                } else {
                  console.log(`➕ [REALTIME] 새 파일 추가: ${formattedFile.originalName}`);
                  return [...prev, formattedFile];
                }
              });

              // 향상된 실시간 알림 (모바일 친화적)
              if (typeof window !== 'undefined') {
                // 기존 토스트 제거
                const existingToasts = document.querySelectorAll('.realtime-toast');
                existingToasts.forEach(toast => toast.remove());
                
                const toast = document.createElement('div');
                toast.className = 'realtime-toast fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-0';
                toast.innerHTML = `
                  <div class="flex items-center space-x-2">
                    <span>🎉</span>
                    <div>
                      <div class="font-medium">업로드 완료!</div>
                      <div class="text-sm opacity-90">${formattedFile.originalName}</div>
                    </div>
                  </div>
                `;
                document.body.appendChild(toast);
                
                // 애니메이션 효과
                setTimeout(() => {
                  toast.style.transform = 'translateX(100%)';
                  setTimeout(() => toast.remove(), 300);
                }, 3000);
                
                // 모바일에서 햅틱 피드백 (지원되는 경우)
                if (navigator.vibrate) {
                  navigator.vibrate([100, 50, 100]);
                }
              }
              
            } catch (error) {
              console.error('❌ [REALTIME] INSERT 처리 실패:', error, newFile);
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
        console.log(`🔥 [REALTIME] 구독 상태 변경: ${status}`, { businessId, timestamp: new Date().toISOString() });
        
        if (err) {
          console.error(`🔥 [REALTIME] 구독 에러:`, err);
        }
        
        // 향상된 구독 상태별 처리
        switch (status) {
          case 'SUBSCRIBED':
            console.log(`✅ [REALTIME] 실시간 구독 성공! 채널: files_${businessName.replace(/\s+/g, '_')}`);
            // 연결 성공 시 기본 토스트 (개발 모드에서만)
            if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
              const devToast = document.createElement('div');
              devToast.className = 'fixed bottom-4 left-4 bg-blue-600 text-white px-3 py-1 rounded text-sm z-50';
              devToast.textContent = '🔥 실시간 동기화 활성화됨';
              document.body.appendChild(devToast);
              setTimeout(() => devToast.remove(), 2000);
            }
            break;
            
          case 'CHANNEL_ERROR':
            console.error(`❌ [REALTIME] 채널 에러 - 폴링 모드로 전환됩니다`);
            throw new Error(`채널 연결 실패: ${businessName}`);
            
          case 'TIMED_OUT':
            console.warn(`⏰ [REALTIME] 구독 타임아웃 - 재시도가 필요할 수 있습니다`);
            throw new Error(`구독 타임아웃: ${businessName}`);
            
          case 'CLOSED':
            console.log(`🔒 [REALTIME] 연결 정상 종료: ${businessName}`);
            break;
            
          default:
            console.log(`🔄 [REALTIME] 알 수 없는 상태: ${status}`);
        }
      });

    channelRef.current = channel;
    
    } catch (error) {
      console.error(`🔥 [REALTIME] 구독 설정 실패:`, error);
    }
  }, [businessName]);

  // 사업장 정보 설정
  // Progressive Upload 즉시 동기화 이벤트 리스너
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleProgressiveUploadComplete = (event: CustomEvent) => {
      const { uploadedFiles, photoId } = event.detail;
      console.log(`🚀 [INSTANT-SYNC] Progressive Upload 완료 수신:`, { uploadedFiles: uploadedFiles?.length, photoId });
      
      if (uploadedFiles && uploadedFiles.length > 0) {
        addFiles(uploadedFiles);
        console.log(`✅ [INSTANT-SYNC] ${uploadedFiles.length}개 파일 즉시 FileContext에 추가`);
      }
    };
    
    window.addEventListener('progressiveUploadComplete', handleProgressiveUploadComplete as EventListener);
    
    return () => {
      window.removeEventListener('progressiveUploadComplete', handleProgressiveUploadComplete as EventListener);
    };
  }, [addFiles]);

  // 네트워크 상태 모니터링
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updateNetworkState = () => {
      const connection = (navigator as any).connection;
      const isMobile = /iPhone|iPad|iPod|Android|BlackBerry|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) ||
                       ('ontouchstart' in window) ||
                       (navigator.maxTouchPoints > 0);
      
      setNetworkState({
        online: navigator.onLine,
        effectiveType: connection?.effectiveType || '4g',
        downlink: connection?.downlink || 10,
        isMobile
      });
      
      console.log(`📱 [MOBILE-DETECT] 모바일 기기: ${isMobile ? 'YES' : 'NO'}, 네트워크: ${connection?.effectiveType || '4g'}`);
    };
    
    // 초기 상태 설정
    updateNetworkState();
    
    // 이벤트 리스너 설정
    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);
    
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkState);
    }
    
    return () => {
      window.removeEventListener('online', updateNetworkState);
      window.removeEventListener('offline', updateNetworkState);
      if (connection) {
        connection.removeEventListener('change', updateNetworkState);
      }
    };
  }, []);

  const setBusinessInfo = useCallback((name: string, type: string) => {
    setBusinessNameState(name);
    setSystemTypeState(type);
  }, []);

  // 사업장 변경 시 하이브리드 동기화 설정 (Realtime + 폴링 백업)
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | null = null;
    let realtimeConnected = false;
    
    if (businessName) {
      console.log('🚀 [HYBRID-SYNC] 실시간 + 폴링 하이브리드 동기화 시작');
      
      // Phase 1: 실시간 구독 시도
      const setupRealtime = async () => {
        try {
          await setupRealtimeSubscription();
          realtimeConnected = true;
          console.log('✅ [HYBRID-SYNC] 실시간 구독 성공');
          
          // 실시간 연결 성공 시 폴링 주기를 길게 (백업용, 네트워크 상태 고려)
          if (pollingInterval) clearInterval(pollingInterval);
          
          const getBackupPollingInterval = () => {
            if (!networkState.online) return 60000; // 오프라인: 1분
            
            // 모바일 초적극적 백업 폴링 (실시간 보완)
            if (networkState.isMobile) {
              console.log('📱 [MOBILE-PRIORITY] 모바일 감지 - 초적극적 백업 폴링 모드');
              switch (networkState.effectiveType) {
                case 'slow-2g': return 5000;  // 느린 2G: 5초
                case '2g': return 3000;       // 2G: 3초
                case '3g': return 2000;       // 3G: 2초
                case '4g': return 1500;       // 4G: 1.5초 (매우 적극적)
                default: return 1500;        // 기본: 1.5초
              }
            }
            
            // 데스크탑: 기존 로직 유지
            switch (networkState.effectiveType) {
              case 'slow-2g':
              case '2g': return 45000; // 느린 네트워크: 45초
              case '3g': return 35000; // 3G: 35초
              case '4g': return 30000; // 4G: 30초 (기본)
              default: return 30000;
            }
          };
          
          pollingInterval = setInterval(async () => {
            try {
              await refreshFiles();
              console.log(`🔄 [BACKUP-POLLING] 백업 폴링 실행 (${networkState.effectiveType})`);
            } catch (error) {
              console.error('🔄 [BACKUP-POLLING] 백업 폴링 실패:', error);
            }
          }, getBackupPollingInterval());
          
        } catch (error) {
          console.warn('⚠️ [HYBRID-SYNC] 실시간 구독 실패, 폴링 모드로 전환:', error);
          realtimeConnected = false;
          
          // 실시간 실패 시 적극적 폴링 (네트워크 상태 적응형)
          if (pollingInterval) clearInterval(pollingInterval);
          
          const getActivePollingInterval = () => {
            if (!networkState.online) return 10000; // 오프라인: 10초
            
            // 모바일 초적극적 폴링 (실시간 실패 시 - 더욱 적극적)
            if (networkState.isMobile) {
              console.log('📱 [MOBILE-CRITICAL] 모바일 감지 - 실시간 실패로 인한 극적극적 폴링 모드');
              switch (networkState.effectiveType) {
                case 'slow-2g': return 4000;  // 느린 2G: 4초
                case '2g': return 2500;       // 2G: 2.5초
                case '3g': return 1500;       // 3G: 1.5초
                case '4g': return 1000;       // 4G: 1초 (극적극적)
                default: return 1000;        // 기본: 1초
              }
            }
            
            // 데스크탑: 기존 로직
            switch (networkState.effectiveType) {
              case 'slow-2g': return 8000;  // 매우 느림: 8초
              case '2g': return 6000;       // 2G: 6초
              case '3g': return 4000;       // 3G: 4초
              case '4g': return 3000;       // 4G: 3초 (기본)
              default: return 3000;
            }
          };
          
          pollingInterval = setInterval(async () => {
            try {
              await refreshFiles();
              console.log(`🔄 [ACTIVE-POLLING] 적극적 폴링 실행 (${networkState.effectiveType})`);
            } catch (error) {
              console.error('🔄 [ACTIVE-POLLING] 폴링 실패:', error);
            }
          }, getActivePollingInterval());
        }
      };
      
      // Phase 2: 초기 데이터 로드 후 실시간 설정
      const initializeSync = async () => {
        // 즉시 초기 데이터 로드
        try {
          await refreshFiles();
          console.log('📊 [HYBRID-SYNC] 초기 데이터 로드 완료');
        } catch (error) {
          console.error('📊 [HYBRID-SYNC] 초기 데이터 로드 실패:', error);
        }
        
        // 그 다음 실시간 설정
        setTimeout(() => {
          setupRealtime();
        }, 500);
      };
      
      initializeSync();
      
      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          console.log('🔄 [HYBRID-SYNC] 폴링 정리 완료');
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