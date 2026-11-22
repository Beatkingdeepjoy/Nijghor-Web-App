import React from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chatStore';

export const ConnectionPill: React.FC = () => {
  const { t } = useTranslation();
  const status = useChatStore((s) => s.connectionStatus);

  if (status === 'CONNECTED') return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300">
      <div
        className={`px-3.5 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-md flex items-center gap-2 border ${
          status === 'CONNECTING' || status === 'AUTHENTICATING'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            status === 'CONNECTING' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
          }`}
        />
        <span>
          {status === 'CONNECTING' || status === 'AUTHENTICATING'
            ? t('connection.connecting')
            : t('connection.offline')}
        </span>
      </div>
    </div>
  );
};
