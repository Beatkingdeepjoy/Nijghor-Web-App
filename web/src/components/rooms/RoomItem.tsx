import React from 'react';
import type { RoomRecord } from '../../types/db';

interface RoomItemProps {
  room: RoomRecord;
  isActive: boolean;
  onClick: () => void;
}

export const RoomItem: React.FC<RoomItemProps> = ({ room, isActive, onClick }) => {
  const initials = (room.name || 'Room').slice(0, 2).toUpperCase();

  const timeFormatted = room.lastMessageTimestamp
    ? new Date(room.lastMessageTimestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-room cursor-pointer transition-all select-none mb-1 ${
        isActive
          ? 'bg-vault-terracotta text-white shadow-vault-glow'
          : 'hover:bg-stone-100 dark:hover:bg-vault-dark-surface2 text-vault-indigo dark:text-vault-dark-text'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
          isActive
            ? 'bg-white/20 text-white'
            : 'bg-vault-cream text-vault-terracotta dark:bg-vault-dark-surface2 dark:text-vault-dark-amber border border-vault-border dark:border-vault-dark-border'
        }`}
      >
        {initials}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="font-semibold text-sm truncate">{room.name || 'Encrypted Room'}</span>
          <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-stone-400'}`}>
            {timeFormatted}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span
            className={`text-xs truncate max-w-[180px] ${
              isActive ? 'text-white/80' : 'text-stone-500 dark:text-vault-dark-muted'
            }`}
          >
            {room.lastMessagePreview || 'Encrypted conversation'}
          </span>

          {room.unreadCount > 0 && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white text-vault-terracotta' : 'bg-vault-terracotta text-white'
              }`}
            >
              {room.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
