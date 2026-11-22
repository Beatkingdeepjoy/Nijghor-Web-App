import React from 'react';

export const RoomSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-room relative overflow-hidden bg-white/40 dark:bg-vault-dark-surface/40 mb-2 skeleton-shimmer">
      <div className="w-12 h-12 rounded-full bg-stone-200 dark:bg-vault-dark-border flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-2">
          <div className="w-28 h-4 rounded bg-stone-200 dark:bg-vault-dark-border" />
          <div className="w-10 h-3 rounded bg-stone-200 dark:bg-vault-dark-border" />
        </div>
        <div className="w-44 h-3 rounded bg-stone-200 dark:bg-vault-dark-border" />
      </div>
    </div>
  );
};

export const ChatSkeleton: React.FC = () => {
  return (
    <div className="flex-1 p-6 space-y-4 overflow-hidden">
      <div className="flex justify-start">
        <div className="w-64 h-14 rounded-bubble-in bg-stone-200/70 dark:bg-vault-dark-surface2 relative overflow-hidden skeleton-shimmer" />
      </div>
      <div className="flex justify-end">
        <div className="w-72 h-20 rounded-bubble-out bg-vault-terracotta/20 dark:bg-vault-terracotta/30 relative overflow-hidden skeleton-shimmer" />
      </div>
      <div className="flex justify-start">
        <div className="w-48 h-12 rounded-bubble-in bg-stone-200/70 dark:bg-vault-dark-surface2 relative overflow-hidden skeleton-shimmer" />
      </div>
    </div>
  );
};
