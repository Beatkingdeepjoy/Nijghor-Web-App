import React, { useState } from 'react';
import { dbService } from '../../db';
import { useChatStore } from '../../stores/chatStore';
import { apiFetch } from '../../services/api';

interface NewRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewRoomModal: React.FC<NewRoomModalProps> = ({ isOpen, onClose }) => {
  const [roomType, setRoomType] = useState<'direct' | 'group'>('direct');
  const [targetUsername, setTargetUsername] = useState('');
  const [groupName, setGroupName] = useState('');
  const [disappearingTimer, setDisappearingTimer] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { loadRooms, selectRoom } = useChatStore();

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const roomId = crypto.randomUUID();

      if (roomType === 'direct') {
        const clean = targetUsername.replace(/^@/, '').toLowerCase().trim();
        if (!clean) throw new Error('Enter a valid username');

        // Verify recipient prekeys on server
        const res = await apiFetch(`/api/keys/${encodeURIComponent(clean)}`);

        if (!res.ok) {
          throw new Error(`User @${clean} not found or has not registered public keys.`);
        }

        const recipientBundle = await res.json();

        // Create Direct Room in Dexie
        await dbService.saveRoom({
          id: roomId,
          type: 'direct',
          name: `@${clean}`,
          participantIds: [recipientBundle.user_id],
          unreadCount: 0,
          lastMessageTimestamp: Date.now(),
          isPinned: false,
          isArchived: false,
          disappearingTimerSeconds: disappearingTimer,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        if (!groupName.trim()) throw new Error('Enter a group name');

        // Create Group Room in Dexie (up to 256 members)
        await dbService.saveRoom({
          id: roomId,
          type: 'group',
          name: groupName.trim(),
          participantIds: [],
          unreadCount: 0,
          lastMessageTimestamp: Date.now(),
          isPinned: false,
          isArchived: false,
          disappearingTimerSeconds: disappearingTimer,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      await loadRooms();
      await selectRoom(roomId);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-vault-indigo/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-vault-surface dark:bg-vault-dark-surface rounded-room p-6 shadow-2xl border border-vault-border dark:border-vault-dark-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-vault-indigo dark:text-vault-dark-text">
            Start Encrypted Room
          </h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Room Type Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRoomType('direct')}
              className={`py-2 rounded-xl text-xs font-semibold border ${
                roomType === 'direct'
                  ? 'border-vault-terracotta bg-vault-terracotta/10 text-vault-terracotta'
                  : 'border-vault-border text-stone-500'
              }`}
            >
              👤 Direct Message
            </button>
            <button
              type="button"
              onClick={() => setRoomType('group')}
              className={`py-2 rounded-xl text-xs font-semibold border ${
                roomType === 'group'
                  ? 'border-vault-terracotta bg-vault-terracotta/10 text-vault-terracotta'
                  : 'border-vault-border text-stone-500'
              }`}
            >
              👥 Group (up to 256)
            </button>
          </div>

          {roomType === 'direct' ? (
            <div>
              <label className="block text-xs font-semibold uppercase text-stone-500 mb-1">
                Contact Username
              </label>
              <input
                type="text"
                required
                placeholder="@rahul"
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-vault-border bg-white dark:bg-vault-dark-surface2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-terracotta"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase text-stone-500 mb-1">
                Group Title
              </label>
              <input
                type="text"
                required
                placeholder="Core Team"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-vault-border bg-white dark:bg-vault-dark-surface2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-terracotta"
              />
            </div>
          )}

          {/* Disappearing Timer */}
          <div>
            <label className="block text-xs font-semibold uppercase text-stone-500 mb-1">
              Disappearing Messages Timer
            </label>
            <select
              value={disappearingTimer}
              onChange={(e) => setDisappearingTimer(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-vault-border bg-white dark:bg-vault-dark-surface2 text-xs focus:outline-none"
            >
              <option value={0}>Off (Permanent in local storage)</option>
              <option value={30}>30 seconds</option>
              <option value={300}>5 minutes</option>
              <option value={3600}>1 hour</option>
              <option value={86400}>24 hours</option>
              <option value={604800}>7 days</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-vault-terracotta text-white font-semibold text-sm shadow-vault-glow hover:bg-vault-terracotta/90 disabled:opacity-50 transition-all"
          >
            {isLoading ? 'Creating Room...' : 'Open Encrypted Room'}
          </button>
        </form>
      </div>
    </div>
  );
};
