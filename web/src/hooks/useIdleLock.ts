import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { cryptoWorker } from '../crypto/worker-client';

export function useIdleLock(idleTimeoutMinutes = 5) {
  const { isLocked, setIsLocked, isOnboarded } = useAuthStore();
  const timerRef = useRef<any>(null);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isOnboarded || isLocked) return;

    timerRef.current = setTimeout(async () => {
      console.log('[IdleLock] User inactive for', idleTimeoutMinutes, 'minutes. Locking vault...');
      await cryptoWorker.lock();
      setIsLocked(true);
    }, idleTimeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    if (!isOnboarded) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    // Lock on window visibility change / tab hide
    const handleVisibility = async () => {
      if (document.hidden) {
        // Optional immediate lock on tab switch
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOnboarded, isLocked, idleTimeoutMinutes]);
}
