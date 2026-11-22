import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chatStore';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { encryptAndUploadFile } from '../../services/media';

export const ComposeBar: React.FC = () => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendMessageOptimistic, setTyping, activeRoomId } = useChatStore();
  const {
    isRecording,
    durationMs,
    waveform,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  const handleSend = async () => {
    if (!text.trim() || !activeRoomId) return;
    const msg = text;
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    await sendMessageOptimistic(msg);
    if (activeRoomId) {
      setTyping(activeRoomId, false, 'me');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (activeRoomId) {
      setTyping(activeRoomId, e.target.value.length > 0, 'me');
    }
  };

  // Handle Voice Note Release
  const handleVoiceRelease = async () => {
    const recording = await stopRecording();
    if (recording && recording.durationMs > 1000) {
      // Voice message recorded - upload encrypted and send
      const token = localStorage.getItem('nijghor_access_token') || '';
      try {
        const mediaResult = await encryptAndUploadFile(
          recording.blob,
          'voice_note.webm',
          token
        );
        await sendMessageOptimistic(`🎤 Voice Note (${Math.round(recording.durationMs / 1000)}s)`);
      } catch (err) {
        console.error('[Voice] Failed to send voice note:', err);
      }
    }
  };

  // Handle File Selection & Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem('nijghor_access_token') || '';
    try {
      const mediaResult = await encryptAndUploadFile(file, file.name, token);
      await sendMessageOptimistic(`📎 ${file.name}`);
    } catch (err) {
      console.error('[Media] File upload error:', err);
    }
  };

  // Handle Clipboard Paste (Images)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const token = localStorage.getItem('nijghor_access_token') || '';
          const res = await encryptAndUploadFile(blob, 'pasted_image.png', token);
          await sendMessageOptimistic('📷 Image');
        }
      }
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
          const token = localStorage.getItem('nijghor_access_token') || '';
          await encryptAndUploadFile(file, file.name, token);
          await sendMessageOptimistic(`📎 ${file.name}`);
        }
      }}
      className={`p-3 bg-white/90 dark:bg-vault-dark-surface/90 border-t border-vault-border dark:border-vault-dark-border backdrop-blur-md relative ${
        isDragging ? 'border-dashed border-vault-terracotta bg-vault-cream/50' : ''
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Voice Recording Active State */}
      {isRecording ? (
        <div className="flex items-center justify-between px-4 py-2 bg-vault-cream dark:bg-vault-dark-surface2 rounded-2xl border border-vault-terracotta/40">
          <div className="flex items-center gap-2 text-vault-terracotta font-semibold text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-vault-terracotta animate-ping" />
            <span>Recording... {Math.round(durationMs / 1000)}s</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1 text-xs text-stone-500 hover:text-rose-500 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVoiceRelease}
              className="px-4 py-1.5 rounded-xl bg-vault-terracotta text-white text-xs font-semibold shadow-sm"
            >
              Send Voice
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-vault-dark-surface2 text-stone-500 transition-colors"
            title="Attach image or file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Textarea Input */}
          <div className="flex-1 min-h-[44px] max-h-[140px] bg-vault-surface dark:bg-vault-dark-surface2 rounded-2xl border border-vault-border dark:border-vault-dark-border px-3.5 py-2 flex items-center">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={t('chat.typeMessage')}
              className="w-full bg-transparent resize-none focus:outline-none text-sm text-vault-indigo dark:text-vault-dark-text placeholder-stone-400 max-h-[120px]"
            />
          </div>

          {/* Dynamic Send / Mic Button */}
          {text.trim().length > 0 ? (
            <button
              type="button"
              onClick={handleSend}
              className="p-3 rounded-full bg-vault-terracotta hover:bg-vault-terracotta/90 text-white shadow-vault-glow transition-all active:scale-95"
              title="Send"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="p-3 rounded-full bg-stone-100 dark:bg-vault-dark-surface2 text-stone-600 dark:text-vault-dark-text hover:text-vault-terracotta transition-colors active:scale-95"
              title="Record voice note"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
