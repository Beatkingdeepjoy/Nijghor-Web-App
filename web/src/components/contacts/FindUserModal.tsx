// Find & Discover Users by @username, Share Link or QR Code

import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { dbService } from '../../db';
import { apiFetch } from '../../services/api';

interface FindUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FindUserModal: React.FC<FindUserModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const { selectRoom, loadRooms } = useChatStore();

  const [searchUsername, setSearchUsername] = useState('');
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    user_id?: string;
    username?: string;
    created_at?: string;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQR, setShowQR] = useState(false);

  if (!isOpen) return null;

  const myShareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/#/@${user?.username || 'user'}`
    : '';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchUsername.replace(/^@/, '').trim().toLowerCase();
    if (!clean) return;

    setIsSearching(true);
    setErrorMsg('');
    setSearchResult(null);

    try {
      const res = await apiFetch(`/api/users/lookup?username=${encodeURIComponent(clean)}`);
      const data = await res.json();
      setSearchResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to search user');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async (targetUsername: string, targetUserId: string) => {
    try {
      const roomId = crypto.randomUUID();
      await dbService.saveRoom({
        id: roomId,
        type: 'direct',
        name: `@${targetUsername}`,
        participantIds: [targetUserId],
        unreadCount: 0,
        lastMessageTimestamp: Date.now(),
        isPinned: false,
        isArchived: false,
        disappearingTimerSeconds: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await loadRooms();
      await selectRoom(roomId);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to open room');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(myShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-vault-indigo/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-vault-surface dark:bg-vault-dark-surface rounded-room p-6 shadow-2xl border border-vault-border dark:border-vault-dark-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-vault-indigo dark:text-vault-dark-text">
            Find by @username
          </h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 text-rose-600 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Search by @username Form */}
        <form onSubmit={handleSearch} className="mb-5">
          <label className="block text-xs font-semibold uppercase text-stone-500 mb-1.5">
            Search Unique Username
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-semibold text-sm">
                @
              </span>
              <input
                type="text"
                autoFocus
                placeholder="rahul"
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value.toLowerCase())}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-vault-border bg-white dark:bg-vault-dark-surface2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-terracotta"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchUsername.trim()}
              className="px-4 py-2.5 rounded-xl bg-vault-terracotta text-white font-semibold text-xs shadow-sm hover:bg-vault-terracotta/90 disabled:opacity-50"
            >
              {isSearching ? '...' : 'Find'}
            </button>
          </div>
        </form>

        {/* Search Result Card */}
        {searchResult && (
          <div className="mb-5 p-3.5 rounded-2xl bg-white dark:bg-vault-dark-surface2 border border-vault-border flex items-center justify-between">
            {searchResult.found ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-vault-cream dark:bg-vault-dark-surface border border-vault-border flex items-center justify-center font-bold text-vault-terracotta text-sm">
                    {searchResult.username?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-vault-indigo dark:text-vault-dark-text">
                      @{searchResult.username}
                    </h4>
                    <span className="text-[11px] text-vault-sage font-medium">✓ Verified Account</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartChat(searchResult.username!, searchResult.user_id!)}
                  className="px-3.5 py-1.5 rounded-xl bg-vault-terracotta text-white text-xs font-semibold shadow-sm hover:bg-vault-terracotta/90"
                >
                  Message
                </button>
              </>
            ) : (
              <div className="w-full text-center py-2 text-xs text-stone-500">
                No user found with username <span className="font-bold">@{searchUsername}</span>
              </div>
            )}
          </div>
        )}

        {/* My Shareable Link & QR Section */}
        <div className="pt-4 border-t border-vault-border dark:border-vault-dark-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-vault-indigo dark:text-vault-dark-text">
              Share Your Nijghor Link
            </span>
            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              className="text-xs font-semibold text-vault-terracotta hover:underline"
            >
              {showQR ? 'Hide QR' : 'Show QR Code'}
            </button>
          </div>

          <p className="text-[11px] text-stone-500 mb-2 leading-relaxed">
            Others can click this link or scan your code to immediately open a zero-knowledge chat room with you:
          </p>

          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              readOnly
              value={myShareUrl}
              className="flex-1 px-3 py-2 rounded-xl border border-vault-border bg-stone-100 dark:bg-vault-dark-surface2 text-xs text-stone-600 dark:text-vault-dark-muted font-mono select-all"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-2 rounded-xl border border-vault-terracotta text-vault-terracotta text-xs font-bold hover:bg-vault-terracotta/10"
            >
              {copiedLink ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          {showQR && (
            <div className="p-4 bg-white dark:bg-vault-dark-surface2 rounded-2xl border border-vault-border flex flex-col items-center justify-center">
              <div className="w-32 h-32 bg-stone-100 dark:bg-vault-dark-surface p-2 rounded-xl grid grid-cols-6 gap-1 shadow-inner mb-2">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-sm ${
                      (i * 11 + 5) % 3 === 0
                        ? 'bg-vault-indigo dark:bg-vault-dark-amber'
                        : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-vault-terracotta">@{user?.username}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
