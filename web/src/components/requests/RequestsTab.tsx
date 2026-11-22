import React from 'react';

export const RequestsTab: React.FC = () => {
  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-full bg-vault-cream dark:bg-vault-dark-surface flex items-center justify-center text-3xl mb-3 shadow-inner">
        📬
      </div>
      <h3 className="font-bold text-base text-vault-indigo dark:text-vault-dark-text mb-1">
        Message Requests
      </h3>
      <p className="text-xs text-stone-500 max-w-xs leading-relaxed mb-4">
        When someone not in your contacts messages you for the first time, it appears here. You can safely preview, accept, or block without revealing read status.
      </p>
      <div className="p-3 rounded-xl bg-vault-sand/50 dark:bg-vault-dark-surface2 text-stone-500 text-[11px]">
        No pending stranger requests
      </div>
    </div>
  );
};
