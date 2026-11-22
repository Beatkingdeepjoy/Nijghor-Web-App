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

export const App: React.FC = () => {
  const { isOnboarded, initAuth } = useAuthStore();
  const { loadRooms } = useChatStore();
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
      disappearingEngine.stop();
    };
  }, [initAuth, loadRooms]);

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
