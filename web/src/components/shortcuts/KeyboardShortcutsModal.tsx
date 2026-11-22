import React from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl / Cmd + K', action: 'Quick Room Switcher' },
    { key: 'Ctrl / Cmd + F', action: 'Search within active Room' },
    { key: 'Alt + Up / Down', action: 'Navigate between Rooms' },
    { key: 'Enter', action: 'Send message' },
    { key: 'Shift + Enter', action: 'New line in compose bar' },
    { key: 'Esc', action: 'Close panel or cancel reply' },
    { key: '?', action: 'Show this keyboard shortcuts cheat-sheet' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-vault-indigo/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-vault-surface dark:bg-vault-dark-surface rounded-room p-6 shadow-2xl border border-vault-border dark:border-vault-dark-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-vault-indigo dark:text-vault-dark-text">
            Keyboard Shortcuts
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2.5">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-xs">
              <span className="text-stone-600 dark:text-vault-dark-muted">{s.action}</span>
              <kbd className="px-2 py-1 rounded bg-stone-200 dark:bg-vault-dark-surface2 font-mono font-semibold text-vault-indigo dark:text-vault-dark-text text-[11px] shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
