import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chatStore';
import { RoomItem } from './RoomItem';
import { NewRoomModal } from './NewRoomModal';
import { SearchModal } from '../search/SearchModal';
import { FindUserModal } from '../contacts/FindUserModal';

export const RoomList: React.FC = () => {
  const { t } = useTranslation();
  const { rooms, activeRoomId, selectRoom } = useChatStore();
  const [activeFolder, setActiveFolder] = useState<'all' | 'personal' | 'groups' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showFindUser, setShowFindUser] = useState(false);

  const filteredRooms = rooms.filter((r) => {
    if (activeFolder === 'groups' && r.type !== 'group') return false;
    if (activeFolder === 'personal' && r.type !== 'direct') return false;
    if (activeFolder === 'unread' && r.unreadCount === 0) return false;
    if (searchQuery.trim()) {
      return (r.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="w-80 h-full flex flex-col border-r border-vault-border dark:border-vault-dark-border bg-white/70 dark:bg-vault-dark-surface/70 backdrop-blur-md">
      {/* Header & Search */}
      <div className="p-3.5 space-y-3 border-b border-vault-border dark:border-vault-dark-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-vault-indigo dark:text-vault-dark-text tracking-tight">
            {t('rooms.title')}
          </h2>
          <div className="flex items-center gap-1">
            {/* Find Users by @username */}
            <button
              type="button"
              onClick={() => setShowFindUser(true)}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-vault-dark-surface2 text-vault-terracotta"
              title="Find users by @username"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-vault-dark-surface2 text-stone-500"
              title="Search local messages"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowNewRoom(true)}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-vault-dark-surface2 text-vault-terracotta"
              title="Create new encrypted room"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t('rooms.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-vault-border dark:border-vault-dark-border bg-vault-surface dark:bg-vault-dark-surface2 text-xs focus:outline-none focus:ring-1 focus:ring-vault-terracotta"
          />
        </div>

        {/* Telegram-style Folder Tabs */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar pt-1">
          {(['all', 'personal', 'groups', 'unread'] as const).map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => setActiveFolder(folder)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeFolder === folder
                  ? 'bg-vault-indigo text-white dark:bg-vault-dark-surface2 dark:text-vault-dark-amber shadow-sm'
                  : 'text-stone-500 hover:text-vault-indigo dark:text-vault-dark-muted'
              }`}
            >
              {t(`rooms.${folder}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Room Items */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredRooms.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="text-3xl mb-2">🌿</div>
            <p className="text-xs font-medium text-stone-500 mb-1">{t('rooms.noRooms')}</p>
            <p className="text-[11px] text-stone-400 max-w-[190px] mx-auto leading-relaxed mb-3">
              {t('rooms.noRoomsDesc')}
            </p>
            <button
              type="button"
              onClick={() => setShowFindUser(true)}
              className="px-3.5 py-1.5 rounded-xl bg-vault-terracotta/10 text-vault-terracotta text-xs font-bold hover:bg-vault-terracotta/20"
            >
              Find by @username
            </button>
          </div>
        ) : (
          filteredRooms.map((room) => (
            <RoomItem
              key={room.id}
              room={room}
              isActive={room.id === activeRoomId}
              onClick={() => selectRoom(room.id)}
            />
          ))
        )}
      </div>

      <FindUserModal isOpen={showFindUser} onClose={() => setShowFindUser(false)} />
      <NewRoomModal isOpen={showNewRoom} onClose={() => setShowNewRoom(false)} />
      <SearchModal isOpen={showSearchModal} onClose={() => setShowSearchModal(false)} />
    </div>
  );
};
