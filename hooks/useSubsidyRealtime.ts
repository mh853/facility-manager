/**
 * Supabase Realtime Hook for Subsidy Announcements
 *
 * Real-time subscription to subsidy_announcements table changes
 * Handles INSERT/UPDATE/DELETE events with automatic reconnection
 */

import { useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface SubsidyAnnouncement {
  id: string;
  title: string;
  region: string;
  agency: string;
  relevance_score: number;
  application_period_start: string | null;
  application_period_end: string | null;
  announcement_date: string;
  url: string;
  created_at: string;
}

export interface UseSubsidyRealtimeOptions {
  enabled?: boolean;
  onInsert?: (announcement: SubsidyAnnouncement) => void;
  onUpdate?: (announcement: SubsidyAnnouncement) => void;
  onDelete?: (id: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Supabase Realtime subscription hook for subsidy announcements
 *
 * @example
 * ```typescript
 * useSubsidyRealtime({
 *   enabled: !authLoading && user !== null,
 *   onInsert: (announcement) => {
 *     setAllAnnouncements(prev => [announcement, ...prev]);
 *     setNewAnnouncementCount(prev => prev + 1);
 *   },
 *   onUpdate: (announcement) => {
 *     setAllAnnouncements(prev =>
 *       prev.map(a => a.id === announcement.id ? announcement : a)
 *     );
 *   },
 *   onDelete: (id) => {
 *     setAllAnnouncements(prev => prev.filter(a => a.id !== id));
 *   }
 * });
 * ```
 */
export function useSubsidyRealtime(options: UseSubsidyRealtimeOptions = {}) {
  const {
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
    onError
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) {
      console.log('[Realtime] 비활성화 상태 - 구독하지 않음');
      return;
    }

    console.log('[Realtime] Supabase Realtime 구독 시작...');

    // Create Supabase client
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Create channel and subscribe to changes
    const channel = supabase
      .channel('subsidy_announcements_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'subsidy_announcements'
        },
        (payload) => {
          console.log('[Realtime] 신규 공고 감지:', payload.new);
          if (onInsert) {
            onInsert(payload.new as SubsidyAnnouncement);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subsidy_announcements'
        },
        (payload) => {
          console.log('[Realtime] 공고 업데이트 감지:', payload.new);
          if (onUpdate) {
            onUpdate(payload.new as SubsidyAnnouncement);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'subsidy_announcements'
        },
        (payload) => {
          console.log('[Realtime] 공고 삭제 감지:', payload.old.id);
          if (onDelete) {
            onDelete(payload.old.id);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('[Realtime] 구독 오류:', err);
          if (onError) {
            onError(new Error(`Realtime subscription error: ${err.message}`));
          }
          return;
        }

        console.log('[Realtime] 구독 상태:', status);

        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] 실시간 업데이트 활성화됨');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [Realtime] 채널 오류 발생');
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ [Realtime] 연결 타임아웃');
        } else if (status === 'CLOSED') {
          console.log('🔌 [Realtime] 연결 종료됨');
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log('[Realtime] 구독 해제 중...');
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [enabled, onInsert, onUpdate, onDelete, onError]);

  return {
    channel: channelRef.current
  };
}
