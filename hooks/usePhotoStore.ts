// hooks/usePhotoStore.ts
// 통합 사진 상태 관리 - Single Source of Truth

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { UploadedFile } from '@/types';

interface PhotoStoreState {
  // 상태
  photos: UploadedFile[];
  loading: boolean;
  businessName: string;
  systemType: string;
  lastUpdated: number;
  
  // Actions
  setPhotos: (photos: UploadedFile[]) => void;
  addPhotos: (photos: UploadedFile[]) => void;
  removePhoto: (photoId: string) => void;
  updatePhoto: (photoId: string, updates: Partial<UploadedFile>) => void;
  setBusinessInfo: (businessName: string, systemType: string) => void;
  setLoading: (loading: boolean) => void;
  loadPhotos: () => Promise<void>;
  refreshPhotos: () => Promise<void>;
  
  // Computed
  getPhotosByFacility: (facilityType: string, facilityNumber?: number, outletNumber?: number) => UploadedFile[];
  getPhotosByCategory: (category: string) => UploadedFile[];
  getPhotoStats: () => {
    total: number;
    byFacilityType: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

export const usePhotoStore = create<PhotoStoreState>()(
  subscribeWithSelector((set, get) => ({
    // 초기 상태
    photos: [],
    loading: false,
    businessName: '',
    systemType: 'presurvey',
    lastUpdated: 0,

    // Actions
    setPhotos: (photos) => set({ 
      photos, 
      lastUpdated: Date.now() 
    }),

    addPhotos: (newPhotos) => set(state => ({
      photos: [...state.photos, ...newPhotos],
      lastUpdated: Date.now()
    })),

    removePhoto: (photoId) => set(state => ({
      photos: state.photos.filter(photo => photo.id !== photoId),
      lastUpdated: Date.now()
    })),

    updatePhoto: (photoId, updates) => set(state => ({
      photos: state.photos.map(photo => 
        photo.id === photoId ? { ...photo, ...updates } : photo
      ),
      lastUpdated: Date.now()
    })),

    setBusinessInfo: (businessName, systemType) => set({ 
      businessName, 
      systemType,
      lastUpdated: Date.now()
    }),

    setLoading: (loading) => set({ loading }),

    loadPhotos: async () => {
      const { businessName, systemType } = get();
      if (!businessName || get().loading) return;

      set({ loading: true });
      
      try {
        console.log(`🔄 [PHOTO-STORE] 사진 로딩 시작: ${businessName}`);
        
        const response = await fetch(
          `/api/uploaded-files-supabase?businessName=${encodeURIComponent(businessName)}&systemType=${systemType}`
        );

        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.data?.files) {
          set({ 
            photos: data.data.files,
            lastUpdated: Date.now(),
            loading: false
          });
          console.log(`✅ [PHOTO-STORE] 사진 로딩 완료: ${data.data.files.length}개`);
        } else {
          console.warn('⚠️ [PHOTO-STORE] 빈 응답 또는 오류:', data);
          set({ photos: [], lastUpdated: Date.now(), loading: false });
        }

      } catch (error) {
        console.error('❌ [PHOTO-STORE] 사진 로딩 실패:', error);
        set({ loading: false });
      }
    },

    refreshPhotos: async () => {
      await get().loadPhotos();
    },

    // Computed functions
    getPhotosByFacility: (facilityType, facilityNumber, outletNumber) => {
      return get().photos.filter(photo => {
        // facilityInfo 기반 필터링 로직
        if (!photo.facilityInfo) return false;
        
        const info = photo.facilityInfo;
        const matchesFacilityType = info.includes(facilityType);
        
        if (facilityNumber !== undefined) {
          const matchesFacilityNumber = info.includes(`_${facilityNumber}_`);
          if (!matchesFacilityNumber) return false;
        }
        
        if (outletNumber !== undefined) {
          // outlet 번호 매칭 로직 (필요시 구현)
        }
        
        return matchesFacilityType;
      });
    },

    getPhotosByCategory: (category) => {
      return get().photos.filter(photo => 
        photo.folderName === category || 
        photo.facilityInfo?.includes(category)
      );
    },

    getPhotoStats: () => {
      const photos = get().photos;
      const stats = {
        total: photos.length,
        byFacilityType: {} as Record<string, number>,
        byCategory: {} as Record<string, number>
      };

      photos.forEach(photo => {
        // 시설 타입별 통계
        if (photo.facilityInfo) {
          const facilityType = photo.facilityInfo.includes('discharge') ? 'discharge' : 
                              photo.facilityInfo.includes('prevention') ? 'prevention' : 'basic';
          stats.byFacilityType[facilityType] = (stats.byFacilityType[facilityType] || 0) + 1;
        }

        // 카테고리별 통계
        const category = photo.folderName || 'unknown';
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      });

      return stats;
    }
  }))
);

// Progressive Upload와의 동기화를 위한 이벤트 리스너
if (typeof window !== 'undefined') {
  window.addEventListener('progressiveUploadComplete', (event: any) => {
    const { uploadedFiles } = event.detail;
    if (uploadedFiles && uploadedFiles.length > 0) {
      usePhotoStore.getState().addPhotos(uploadedFiles);
      console.log(`🔗 [PHOTO-STORE] Progressive Upload 동기화: ${uploadedFiles.length}개 추가`);
    }
  });
}

// 비즈니스 네임 변경 시 자동 로딩
usePhotoStore.subscribe(
  (state) => state.businessName,
  (businessName) => {
    if (businessName) {
      console.log(`🏢 [PHOTO-STORE] businessName 변경, 자동 로딩: ${businessName}`);
      usePhotoStore.getState().loadPhotos();
    }
  }
);