import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { cryptoWorker } from '../../crypto/worker-client';

export const LockScreen: React.FC = () => {
  const { isLocked, setIsLocked, user } = useAuthStore();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isLocked) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    try {
      // Re-initialize master key in worker
      await cryptoWorker.initMasterKey(user?.username || 'user');
      setIsLocked(false);
      setPin('');
      setErrorMsg('');
    } catch {
      setErrorMsg('Incorrect PIN or unlock error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-vault-indigo text-white backdrop-blur-xl">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* House Lock Icon */}
        <div className="w-20 h-20 rounded-3xl bg-vault-terracotta/20 border border-vault-terracotta/40 flex items-center justify-center text-4xl mb-4 shadow-vault-glow">
          🔒
        </div>

        <h2 className="text-2xl font-bold tracking-tight mb-1">Lock the Door</h2>
        <p className="text-xs text-vault-cream/70 max-w-xs mb-6 leading-relaxed">
          Your browser vault is locked. Chat history and cryptographic ratchet keys are sealed in memory.
        </p>

        {errorMsg && (
          <div className="w-full mb-4 p-2.5 rounded-xl bg-rose-500/20 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleUnlock} className="w-full space-y-3">
          <input
            type="password"
            autoFocus
            required
            maxLength={12}
            placeholder="Enter unlock PIN or password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-center text-base focus:outline-none focus:ring-2 focus:ring-vault-terracotta placeholder-white/40"
          />

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-vault-terracotta hover:bg-vault-terracotta/90 text-white font-semibold text-sm shadow-vault-glow transition-all"
          >
            Unlock Rooms
          </button>
        </form>
      </div>
    </div>
  );
};
