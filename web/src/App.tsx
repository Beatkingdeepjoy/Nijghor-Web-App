import React, { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import { useChatStore } from './stores/chatStore';
import { DesktopLayout } from './components/layout/DesktopLayout';
import { MobileLayout } from './components/layout/MobileLayout';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { ConnectionPill } from './components/common/ConnectionPill';
import { KeyboardShortcutsModal } from './components/shortcuts/KeyboardShortcutsModal';
import { LockScreen } from './components/lock/LockScreen';
import { BackupModal } from './components/backup/BackupModal';
import { useIdleLock } from './hooks/useIdleLock';
import { disappearingEngine } from './services/disappearing';
import { registerServiceWorker } from './services/pwa';
import { dbService } from './db';
import { apiFetch } from './services/api';

export const App: React.FC = () => {
  const { isOnboarded, initAuth } = useAuthStore();
  const { loadRooms, selectRoom, rooms } = useChatStore();
  const [isMobile, setIsMobile] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showBackup, setShowBackup] = useState(false);

  // Auto-lock vault on 5-minute inactivity
  useIdleLock(5);

  useEffect(() => {
    initAuth();
    loadRooms();
    disappearingEngine.start();
    registerServiceWorker();

    // Check for Deep Link (e.g. /#/@username)
    const handleDeepLink = async () => {
      const hash = window.location.hash;
      if (hash && (hash.startsWith('#/@') || hash.startsWith('#@'))) {
        const username = hash.replace(/^#\/?@?/, '').toLowerCase().trim();
        if (username) {
          try {
            const res = await apiFetch(`/api/users/lookup?username=${encodeURIComponent(username)}`);
            const data = await res.json();
            if (data.found) {
              const existingRooms = await dbService.getAllRooms();
              const foundRoom = existingRooms.find((r) => r.name === `@${username}`);

              if (foundRoom) {
                await selectRoom(foundRoom.id);
              } else {
                const newRoomId = crypto.randomUUID();
                await dbService.saveRoom({
                  id: newRoomId,
                  type: 'direct',
                  name: `@${username}`,
                  participantIds: [data.user_id],
                  unreadCount: 0,
                  lastMessageTimestamp: Date.now(),
                  isPinned: false,
                  isArchived: false,
                  disappearingTimerSeconds: 0,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                });
                await loadRooms();
                await selectRoom(newRoomId);
              }
            }
          } catch (e) {
            console.warn('[DeepLink] Failed to resolve user link:', e);
          }
        }
      }
    };

    handleDeepLink();
    window.addEventListener('hashchange', handleDeepLink);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        setShowShortcuts((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setShowBackup(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('hashchange', handleDeepLink);
      disappearingEngine.stop();
    };
  }, [initAuth, loadRooms, selectRoom]);

  return (
    <div className="w-screen h-screen overflow-hidden font-sans select-none">
      {/* Floating Network Connection Pill */}
      <ConnectionPill />

      {/* Lock Screen ("Lock the Door") */}
      <LockScreen />

      {/* 3-Screen Onboarding Modal (if first visit) */}
      {!isOnboarded && <OnboardingModal />}

      {/* Layout View: Desktop (3 Columns) vs Mobile (Bottom Nav) */}
      {isMobile ? <MobileLayout /> : <DesktopLayout />}

      {/* Shortcuts Helper Modal */}
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Backup Modal */}
      <BackupModal isOpen={showBackup} onClose={() => setShowBackup(false)} />
    </div>
  );
};

export default App;
