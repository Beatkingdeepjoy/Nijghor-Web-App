import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '../../stores/chatStore';
import { MessageBubble } from './MessageBubble';

export const ChatTimeline: React.FC = () => {
  const { messages, activeRoomId } = useChatStore();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    }
  }, [messages.length]);

  if (!activeRoomId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-400">
        <div className="w-16 h-16 rounded-full bg-vault-cream dark:bg-vault-dark-surface flex items-center justify-center text-3xl mb-3 shadow-inner">
          🏡
        </div>
        <h3 className="font-bold text-vault-indigo dark:text-vault-dark-text text-base mb-1">
          Select a Room
        </h3>
        <p className="text-xs text-stone-500 max-w-xs">
          All messages and keys stay strictly in your browser. Fully end-to-end encrypted with Signal Protocol.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto px-4 py-4 vault-grain space-y-1 relative"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const msg = messages[virtualRow.index];
          const isOutgoing = msg.senderId === 'me';

          return (
            <div
              key={msg.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MessageBubble message={msg} isOutgoing={isOutgoing} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
