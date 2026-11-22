import React, { useState } from 'react';
import type { MessageRecord } from '../../types/db';
import { HouseTick } from '../common/HouseTick';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface MessageBubbleProps {
  message: MessageRecord & { decryptedContent: string };
  isOutgoing: boolean;
  onReply?: (message: MessageRecord) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOutgoing, onReply }) => {
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState<string[]>([]);

  const timeFormatted = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isVoiceNote = message.decryptedContent.startsWith('🎤 Voice Note');

  const addReaction = (emoji: string) => {
    if (!reactions.includes(emoji)) {
      setReactions([...reactions, emoji]);
    }
    setShowReactions(false);
  };

  return (
    <div
      onMouseEnter={() => setShowReactions(true)}
      onMouseLeave={() => setShowReactions(false)}
      className={`group relative flex items-end gap-1.5 my-1.5 max-w-[85%] md:max-w-[70%] transition-transform ${
        isOutgoing ? 'ml-auto justify-end' : 'mr-auto justify-start'
      }`}
    >
      {/* Floating Reaction Picker */}
      {showReactions && (
        <div
          className={`absolute -top-7 ${
            isOutgoing ? 'right-0' : 'left-0'
          } bg-white dark:bg-vault-dark-surface rounded-full shadow-lg border border-vault-border px-2 py-1 flex items-center gap-1.5 text-xs z-10`}
        >
          {['❤️', '👍', '🔥', '😂', '🙏'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => addReaction(emoji)}
              className="hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div
        className={`relative px-4 py-2.5 text-sm shadow-sm transition-all select-text ${
          isOutgoing
            ? 'bg-vault-terracotta text-white rounded-bubble-out'
            : 'bg-white dark:bg-vault-dark-surface2 text-vault-indigo dark:text-vault-dark-text rounded-bubble-in border border-stone-200/50 dark:border-vault-dark-border'
        }`}
      >
        {/* Sender Name in Group Chat */}
        {!isOutgoing && (
          <div className="text-[11px] font-bold text-vault-terracotta dark:text-vault-dark-amber mb-0.5">
            @{message.senderUsername}
          </div>
        )}

        {/* Message Content: Voice Note or Text */}
        {isVoiceNote ? (
          <VoiceNotePlayer
            audioUrl=""
            durationMs={4000}
            isOutgoing={isOutgoing}
          />
        ) : (
          <div className="leading-relaxed break-words whitespace-pre-wrap">
            {message.decryptedContent}
          </div>
        )}

        {/* Reaction Badges */}
        {reactions.length > 0 && (
          <div className="flex gap-1 mt-1 -mb-1">
            {reactions.map((r) => (
              <span
                key={r}
                className="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded-full text-[10px]"
              >
                {r}
              </span>
            ))}
          </div>
        )}

        {/* Footer: Time & HouseTick */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
            isOutgoing ? 'text-white/80' : 'text-stone-400 dark:text-vault-dark-muted'
          }`}
        >
          {message.isEdited && <span className="italic mr-0.5">edited</span>}
          <span>{timeFormatted}</span>
          {isOutgoing && <HouseTick status={message.status} className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
};
