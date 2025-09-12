// utils/optimistic-updates.ts - UI 낙관적 업데이트 시스템
'use client';

type OptimisticAction<T> = {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
  optimisticData: T;
  originalData?: T;
  rollbackFn?: () => void;
};

export class OptimisticUpdateManager<T> {
  private pendingActions = new Map<string, OptimisticAction<T>>();
  private listeners = new Set<(data: T[]) => void>();

  constructor(private baseData: T[] = []) {}

  // 리스너 등록
  subscribe(callback: (data: T[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // 모든 리스너에게 알림
  private notify(): void {
    const optimisticData = this.getOptimisticData();
    this.listeners.forEach(callback => callback(optimisticData));
  }

  // 낙관적 생성
  optimisticCreate(
    tempId: string, 
    newItem: T, 
    actualCreateFn: () => Promise<T>
  ): Promise<T> {
    const action: OptimisticAction<T> = {
      id: tempId,
      type: 'create',
      timestamp: Date.now(),
      optimisticData: newItem
    };

    this.pendingActions.set(tempId, action);
    this.notify();

    return actualCreateFn()
      .then((actualItem) => {
        this.commitAction(tempId, actualItem);
        return actualItem;
      })
      .catch((error) => {
        this.rollbackAction(tempId);
        throw error;
      });
  }

  // 낙관적 업데이트
  optimisticUpdate(
    itemId: string,
    updates: Partial<T>,
    actualUpdateFn: () => Promise<T>,
    getItemFn: (id: string) => T | undefined
  ): Promise<T> {
    const originalItem = getItemFn(itemId);
    if (!originalItem) {
      throw new Error(`Item with id ${itemId} not found`);
    }

    const optimisticItem = { ...originalItem, ...updates };
    const action: OptimisticAction<T> = {
      id: itemId,
      type: 'update',
      timestamp: Date.now(),
      optimisticData: optimisticItem,
      originalData: originalItem
    };

    this.pendingActions.set(itemId, action);
    this.notify();

    return actualUpdateFn()
      .then((actualItem) => {
        this.commitAction(itemId, actualItem);
        return actualItem;
      })
      .catch((error) => {
        this.rollbackAction(itemId);
        throw error;
      });
  }

  // 낙관적 삭제
  optimisticDelete(
    itemId: string,
    actualDeleteFn: () => Promise<void>,
    getItemFn: (id: string) => T | undefined
  ): Promise<void> {
    const originalItem = getItemFn(itemId);
    if (!originalItem) {
      throw new Error(`Item with id ${itemId} not found`);
    }

    const action: OptimisticAction<T> = {
      id: itemId,
      type: 'delete',
      timestamp: Date.now(),
      optimisticData: originalItem, // 삭제될 아이템 저장
      originalData: originalItem
    };

    this.pendingActions.set(itemId, action);
    this.notify();

    return actualDeleteFn()
      .then(() => {
        this.commitAction(itemId);
      })
      .catch((error) => {
        this.rollbackAction(itemId);
        throw error;
      });
  }

  // 액션 성공시 커밋
  private commitAction(actionId: string, actualData?: T): void {
    const action = this.pendingActions.get(actionId);
    if (!action) return;

    this.pendingActions.delete(actionId);

    // 실제 데이터로 baseData 업데이트
    switch (action.type) {
      case 'create':
        if (actualData) {
          this.baseData.push(actualData);
        }
        break;
      case 'update':
        if (actualData) {
          const index = this.baseData.findIndex(item => 
            this.getItemId(item) === this.getItemId(actualData)
          );
          if (index !== -1) {
            this.baseData[index] = actualData;
          }
        }
        break;
      case 'delete':
        const deleteIndex = this.baseData.findIndex(item => 
          this.getItemId(item) === actionId
        );
        if (deleteIndex !== -1) {
          this.baseData.splice(deleteIndex, 1);
        }
        break;
    }

    this.notify();
    console.log(`✅ [OPTIMISTIC] ${action.type} 커밋 완료: ${actionId}`);
  }

  // 액션 실패시 롤백
  private rollbackAction(actionId: string): void {
    const action = this.pendingActions.get(actionId);
    if (!action) return;

    this.pendingActions.delete(actionId);
    this.notify();
    
    console.log(`🔄 [OPTIMISTIC] ${action.type} 롤백 완료: ${actionId}`);
  }

  // 현재 낙관적 데이터 반환
  getOptimisticData(): T[] {
    let result = [...this.baseData];

    // 펜딩 액션들을 적용
    for (const action of this.pendingActions.values()) {
      switch (action.type) {
        case 'create':
          result.push(action.optimisticData);
          break;
        case 'update':
          const updateIndex = result.findIndex(item => 
            this.getItemId(item) === action.id
          );
          if (updateIndex !== -1) {
            result[updateIndex] = action.optimisticData;
          }
          break;
        case 'delete':
          result = result.filter(item => 
            this.getItemId(item) !== action.id
          );
          break;
      }
    }

    return result;
  }

  // 아이템 ID 추출 (하위 클래스에서 오버라이드)
  protected getItemId(item: T): string {
    return (item as any).id || String(item);
  }

  // 펜딩 액션들 상태 확인
  getPendingActions(): OptimisticAction<T>[] {
    return Array.from(this.pendingActions.values())
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  // 특정 액션이 펜딩 중인지 확인
  isPending(itemId: string): boolean {
    return this.pendingActions.has(itemId);
  }

  // 모든 펜딩 액션 취소
  cancelAllPending(): void {
    this.pendingActions.clear();
    this.notify();
    console.log('🚫 [OPTIMISTIC] 모든 펜딩 액션 취소');
  }

  // 기본 데이터 업데이트
  updateBaseData(newData: T[]): void {
    this.baseData = [...newData];
    this.notify();
  }

  // 타임아웃된 액션들 정리 (5분 이상 펜딩)
  cleanupExpiredActions(): void {
    const now = Date.now();
    const expiredActions: string[] = [];

    for (const [id, action] of this.pendingActions.entries()) {
      if (now - action.timestamp > 5 * 60 * 1000) { // 5분
        expiredActions.push(id);
      }
    }

    expiredActions.forEach(id => {
      this.rollbackAction(id);
      console.warn(`⏰ [OPTIMISTIC] 만료된 액션 정리: ${id}`);
    });
  }
}

// React 훅으로 래핑
import { useState, useEffect, useCallback } from 'react';

export function useOptimisticUpdates<T>(initialData: T[] = []): {
  data: T[];
  createOptimistic: (tempId: string, item: T, createFn: () => Promise<T>) => Promise<T>;
  updateOptimistic: (id: string, updates: Partial<T>, updateFn: () => Promise<T>) => Promise<T>;
  deleteOptimistic: (id: string, deleteFn: () => Promise<void>) => Promise<void>;
  isPending: (id: string) => boolean;
  getPendingCount: () => number;
  updateData: (newData: T[]) => void;
} {
  const [manager] = useState(() => new OptimisticUpdateManager<T>(initialData));
  const [data, setData] = useState<T[]>(initialData);

  useEffect(() => {
    const unsubscribe = manager.subscribe(setData);
    return unsubscribe;
  }, [manager]);

  // 주기적으로 만료된 액션 정리
  useEffect(() => {
    const interval = setInterval(() => {
      manager.cleanupExpiredActions();
    }, 60000); // 1분마다

    return () => clearInterval(interval);
  }, [manager]);

  const createOptimistic = useCallback(
    (tempId: string, item: T, createFn: () => Promise<T>) => {
      return manager.optimisticCreate(tempId, item, createFn);
    },
    [manager]
  );

  const updateOptimistic = useCallback(
    (id: string, updates: Partial<T>, updateFn: () => Promise<T>) => {
      return manager.optimisticUpdate(
        id, 
        updates, 
        updateFn,
        (itemId) => data.find(item => (item as any).id === itemId || String(item) === itemId)
      );
    },
    [manager, data]
  );

  const deleteOptimistic = useCallback(
    (id: string, deleteFn: () => Promise<void>) => {
      return manager.optimisticDelete(
        id, 
        deleteFn,
        (itemId) => data.find(item => (item as any).id === itemId || String(item) === itemId)
      );
    },
    [manager, data]
  );

  const isPending = useCallback(
    (id: string) => manager.isPending(id),
    [manager]
  );

  const getPendingCount = useCallback(
    () => manager.getPendingActions().length,
    [manager]
  );

  const updateData = useCallback(
    (newData: T[]) => manager.updateBaseData(newData),
    [manager]
  );

  return {
    data,
    createOptimistic,
    updateOptimistic,
    deleteOptimistic,
    isPending,
    getPendingCount,
    updateData
  };
}

export default OptimisticUpdateManager;