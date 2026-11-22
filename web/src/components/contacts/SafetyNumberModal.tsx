import React, { useState } from 'react';

interface SafetyNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactUsername: string;
  safetyNumber?: string;
}

export const SafetyNumberModal: React.FC<SafetyNumberModalProps> = ({
  isOpen,
  onClose,
  contactUsername,
  safetyNumber = '28471 93821 04928 17402 85930 19482 74019 28471 93820 18472 94018 27491',
}) => {
  const [isVerified, setIsVerified] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-vault-indigo/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-vault-surface dark:bg-vault-dark-surface rounded-room p-6 shadow-2xl border border-vault-border dark:border-vault-dark-border text-center">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-vault-indigo dark:text-vault-dark-text">
            Verify Safety Number
          </h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        <p className="text-xs text-stone-500 mb-4 leading-relaxed">
          Compare this 60-digit number with <span className="font-semibold text-vault-terracotta">@{contactUsername}</span> to verify end-to-end encryption and ensure no man-in-the-middle.
        </p>

        {/* Visual QR Code Matrix Representation */}
        <div className="w-36 h-36 mx-auto mb-4 bg-white dark:bg-vault-dark-surface2 p-3 rounded-2xl border border-vault-border flex flex-col justify-between items-center shadow-inner">
          <div className="grid grid-cols-6 gap-1 w-full h-full p-1">
            {Array.from({ length: 36 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-sm ${
                  (i * 7 + 3) % 2 === 0
                    ? 'bg-vault-indigo dark:bg-vault-dark-amber'
                    : 'bg-transparent'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 60-Digit Fingerprint formatted into 12 blocks of 5 digits */}
        <div className="p-3 rounded-xl bg-vault-cream dark:bg-vault-dark-surface2 font-mono text-xs text-vault-indigo dark:text-vault-dark-text tracking-wider leading-relaxed mb-4 border border-vault-border">
          {safetyNumber}
        </div>

        {/* Mark as Verified Toggle */}
        <button
          type="button"
          onClick={() => setIsVerified(!isVerified)}
          className={`w-full py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
            isVerified
              ? 'bg-vault-sage text-white shadow-sm'
              : 'border border-vault-border text-stone-600 dark:text-vault-dark-muted hover:border-vault-sage'
          }`}
        >
          <span>{isVerified ? '✓ Verified Contact' : 'Mark as Verified'}</span>
        </button>
      </div>
    </div>
  );
};
