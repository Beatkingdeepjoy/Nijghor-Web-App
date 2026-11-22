import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { RoomList } from '../rooms/RoomList';
import { ChatTimeline } from '../chat/ChatTimeline';
import { ComposeBar } from '../chat/ComposeBar';

export const DesktopLayout: React.FC = () => {
  const { user, toggleTheme, logout } = useAuthStore();

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-vault-surface dark:bg-vault-dark-bg">
      {/* Left Slim Rail (Telegram Web style) */}
      <div className="w-16 h-full flex flex-col items-center py-4 justify-between border-r border-vault-border dark:border-vault-dark-border bg-vault-cream/80 dark:bg-vault-dark-surface/90 backdrop-blur-md">
        <div className="flex flex-col items-center gap-5">
          {/* Logo / House Icon */}
          <div
            className="w-10 h-10 rounded-2xl bg-vault-terracotta text-white flex items-center justify-center font-bold text-lg shadow-vault-glow cursor-pointer"
            title="Nijghor"
          >
            🏡
          </div>

          {/* Rooms Button */}
          <button
            type="button"
            className="p-2.5 rounded-xl bg-vault-indigo text-white dark:bg-vault-dark-surface2 dark:text-vault-dark-amber shadow-sm"
            title="Rooms"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>

        {/* Bottom Actions: Theme Toggle, User, Lock */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-stone-500 hover:text-vault-terracotta hover:bg-stone-100 dark:hover:bg-vault-dark-surface2 transition-colors"
            title="Toggle Night Ghor Theme"
          >
            🌓
          </button>

          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-xl text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-vault-dark-surface2 transition-colors"
            title="Lock & Logout"
          >
            🔒
          </button>

          <div
            className="w-9 h-9 rounded-full bg-vault-sand dark:bg-vault-dark-surface2 border border-vault-border dark:border-vault-dark-border flex items-center justify-center text-xs font-bold text-vault-indigo dark:text-vault-dark-text"
            title={`Logged in as @${user?.username || 'user'}`}
          >
            {user?.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
          </div>
        </div>
      </div>

      {/* Middle: Room List */}
      <RoomList />

      {/* Right: Active Chat View */}
      <div className="flex-1 h-full flex flex-col bg-vault-surface/40 dark:bg-vault-dark-bg/60 relative">
        <ChatTimeline />
        <ComposeBar />
      </div>
    </div>
  );
};
