import React, { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { RoomList } from '../rooms/RoomList';
import { ChatTimeline } from '../chat/ChatTimeline';
import { ComposeBar } from '../chat/ComposeBar';

export const MobileLayout: React.FC = () => {
  const { activeRoomId, selectRoom } = useChatStore();
  const [activeTab, setActiveTab] = useState<'rooms' | 'requests' | 'search' | 'settings'>('rooms');

  // If a room is actively selected, show Full-Screen Chat View with Back Button
  if (activeRoomId) {
    return (
      <div className="w-screen h-screen flex flex-col bg-vault-surface dark:bg-vault-dark-bg">
        {/* Top Header */}
        <div className="px-3 py-2.5 bg-white/90 dark:bg-vault-dark-surface/90 border-b border-vault-border dark:border-vault-dark-border flex items-center gap-3">
          <button
            type="button"
            onClick={() => selectRoom('')}
            className="p-1.5 rounded-lg text-vault-terracotta"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-vault-indigo dark:text-vault-dark-text truncate">
              Encrypted Room
            </h3>
            <span className="text-[11px] text-vault-sage font-medium">end-to-end encrypted</span>
          </div>
        </div>

        {/* Chat Timeline & Compose */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatTimeline />
          <ComposeBar />
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-vault-surface dark:bg-vault-dark-bg">
      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'rooms' && <RoomList />}
        {activeTab === 'requests' && (
          <div className="p-8 text-center text-stone-400">
            <span className="text-3xl">📬</span>
            <h3 className="font-bold text-sm text-vault-indigo dark:text-vault-dark-text mt-2">
              Message Requests
            </h3>
            <p className="text-xs text-stone-500 mt-1">No pending requests from strangers.</p>
          </div>
        )}
        {activeTab === 'search' && (
          <div className="p-8 text-center text-stone-400">
            <span className="text-3xl">🔍</span>
            <h3 className="font-bold text-sm text-vault-indigo dark:text-vault-dark-text mt-2">
              Local Full-Text Search
            </h3>
            <p className="text-xs text-stone-500 mt-1">Search through your browser-encrypted messages.</p>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="p-8 text-center text-stone-400">
            <span className="text-3xl">⚙️</span>
            <h3 className="font-bold text-sm text-vault-indigo dark:text-vault-dark-text mt-2">
              Settings & Privacy
            </h3>
            <p className="text-xs text-stone-500 mt-1">Manage encryption keys, backup, and lock timer.</p>
          </div>
        )}
      </div>

      {/* Bottom Navigation Tab Bar */}
      <div className="h-16 border-t border-vault-border dark:border-vault-dark-border bg-white/95 dark:bg-vault-dark-surface/95 backdrop-blur-md flex items-center justify-around px-2">
        <button
          type="button"
          onClick={() => setActiveTab('rooms')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold ${
            activeTab === 'rooms' ? 'text-vault-terracotta' : 'text-stone-400'
          }`}
        >
          <span>🏡</span>
          <span>Rooms</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold ${
            activeTab === 'requests' ? 'text-vault-terracotta' : 'text-stone-400'
          }`}
        >
          <span>📬</span>
          <span>Requests</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold ${
            activeTab === 'search' ? 'text-vault-terracotta' : 'text-stone-400'
          }`}
        >
          <span>🔍</span>
          <span>Search</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold ${
            activeTab === 'settings' ? 'text-vault-terracotta' : 'text-stone-400'
          }`}
        >
          <span>⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};
