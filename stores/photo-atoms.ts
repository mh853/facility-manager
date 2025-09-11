import { atom } from 'jotai'
import { FacilityPhoto } from '../utils/facility-photo-tracker'

// 삭제된 사진 ID들을 관리하는 기본 원자
export const deletedPhotoIdsAtom = atom<Set<string>>(new Set<string>())

// 사진 삭제 액션 원자 (write-only)
export const deletePhotoAtom = atom(
  null, // read function (null이면 write-only)
  (get, set, photoId: string) => {
    const currentDeleted = get(deletedPhotoIdsAtom)
    const newDeleted = new Set<string>(Array.from(currentDeleted))
    newDeleted.add(photoId)
    set(deletedPhotoIdsAtom, newDeleted)
    console.log(`🔧 [JOTAI-DELETE] ${photoId} 삭제 상태로 마킹`)
  }
)

// 🔧 사진 삭제 취소 액션 원자 (write-only) - 롤백용
export const undeletePhotoAtom = atom(
  null,
  (get, set, photoId: string) => {
    const currentDeleted = get(deletedPhotoIdsAtom)
    const newDeleted = new Set<string>(Array.from(currentDeleted))
    newDeleted.delete(photoId)
    set(deletedPhotoIdsAtom, newDeleted)
    console.log(`🔄 [JOTAI-UNDELETE] ${photoId} 삭제 상태 롤백`)
  }
)

// 모든 삭제 상태 초기화 액션 원자 (write-only)
export const clearDeletedPhotosAtom = atom(
  null,
  (get, set) => {
    const currentSize = get(deletedPhotoIdsAtom).size
    set(deletedPhotoIdsAtom, new Set())
    console.log(`🧹 [JOTAI-CLEAR] ${currentSize}개 삭제 상태 모두 초기화`)
  }
)

// 필터링된 사진 목록을 반환하는 파생 원자 (read-only)
export const createFilteredPhotosAtom = (photos: FacilityPhoto[]) => {
  return atom((get) => {
    const deletedIds = get(deletedPhotoIdsAtom)
    const filtered = photos.filter(photo => !deletedIds.has(photo.id))
    console.log(`📋 [JOTAI-FILTER] ${photos.length}장 → ${filtered.length}장 (${deletedIds.size}장 숨김)`)
    return filtered
  })
}

// 유틸리티 함수: 사진 목록이 동적일 때 사용
export const filterPhotosWithDeleted = (photos: FacilityPhoto[], deletedIds: Set<string>) => {
  const filtered = photos.filter(photo => !deletedIds.has(photo.id))
  console.log(`🔍 [FILTER-UTIL] ${photos.length}장 → ${filtered.length}장 필터링`)
  return filtered
}

// 삭제된 사진 개수를 반환하는 파생 원자 (read-only)
export const deletedPhotoCountAtom = atom(
  (get) => get(deletedPhotoIdsAtom).size
)

// 특정 사진이 삭제되었는지 확인하는 함수
export const createIsPhotoDeletedAtom = (photoId: string) => {
  return atom((get) => {
    const deletedIds = get(deletedPhotoIdsAtom)
    return deletedIds.has(photoId)
  })
}

// 🔧 디버깅용 원자 - 현재 삭제된 사진 ID 목록 반환
export const debugDeletedPhotosAtom = atom(
  (get) => {
    const deletedIds = get(deletedPhotoIdsAtom)
    return {
      count: deletedIds.size,
      ids: Array.from(deletedIds),
      timestamp: new Date().toISOString()
    }
  }
)