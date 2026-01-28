/**
 * Modal Hide Control Utility
 *
 * Manages localStorage-based "Hide for Today" functionality for auto-popup modals.
 * Only applies to modals opened automatically on page load, not manual button clicks.
 */

export const MODAL_HIDE_STORAGE_KEY = 'subsidy_modal_hide_until';

export interface ModalHideData {
  timestamp: number;
  hideUntil: string; // YYYY-MM-DD format
}

/**
 * Set modal to hide for the rest of today
 * Stores current date in localStorage
 */
export function setModalHideForToday(): void {
  const today = new Date();
  const hideUntil = today.toISOString().split('T')[0]; // YYYY-MM-DD

  const data: ModalHideData = {
    timestamp: Date.now(),
    hideUntil,
  };

  localStorage.setItem(MODAL_HIDE_STORAGE_KEY, JSON.stringify(data));
  console.log('[Modal] 오늘 하루 그만보기 설정:', hideUntil);
}

/**
 * Check if modal should be hidden today
 * Returns true if hide preference is active for current date
 * Automatically clears expired preferences
 */
export function shouldHideModal(): boolean {
  try {
    const stored = localStorage.getItem(MODAL_HIDE_STORAGE_KEY);
    if (!stored) return false;

    const data: ModalHideData = JSON.parse(stored);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const shouldHide = data.hideUntil === today;

    // Auto-cleanup: Remove if date has passed
    if (!shouldHide) {
      localStorage.removeItem(MODAL_HIDE_STORAGE_KEY);
      console.log('[Modal] 이전 날짜 숨김 설정 제거');
    }

    return shouldHide;
  } catch (error) {
    console.error('[Modal] 숨김 확인 오류:', error);
    return false;
  }
}

/**
 * Manually clear the hide preference
 * Useful for testing or resetting state
 */
export function clearModalHide(): void {
  localStorage.removeItem(MODAL_HIDE_STORAGE_KEY);
  console.log('[Modal] 숨김 설정 제거됨');
}
