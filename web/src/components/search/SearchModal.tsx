import React, { useState } from 'react';
import { searchLocalMessages, type SearchResult } from '../../services/search';
import { useChatStore } from '../../stores/chatStore';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { selectRoom } = useChatStore();

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const found = await searchLocalMessages(query);
      setResults(found);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-vault-indigo/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-vault-surface dark:bg-vault-dark-surface rounded-room p-6 shadow-2xl border border-vault-border dark:border-vault-dark-border flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-vault-indigo dark:text-vault-dark-text">
            Search Local Encrypted Messages
          </h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSearch} className="mb-4">
          <input
            type="text"
            autoFocus
            placeholder="Search keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-vault-border dark:border-vault-dark-border bg-white dark:bg-vault-dark-surface2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-terracotta"
          />
        </form>

        <div className="flex-1 overflow-y-auto space-y-2">
          {isSearching && (
            <div className="py-8 text-center text-xs text-stone-500 animate-pulse">
              Searching local browser database...
            </div>
          )}

          {!isSearching && results.length === 0 && query && (
            <div className="py-8 text-center text-xs text-stone-400">
              No matching messages found.
            </div>
          )}

          {results.map((res) => (
            <div
              key={res.message.id}
              onClick={() => {
                selectRoom(res.message.roomId);
                onClose();
              }}
              className="p-3 rounded-xl bg-white dark:bg-vault-dark-surface2 border border-stone-200/50 dark:border-vault-dark-border hover:border-vault-terracotta cursor-pointer transition-all"
            >
              <div className="flex justify-between items-center text-[10px] text-stone-400 mb-1">
                <span className="font-bold text-vault-terracotta">@{res.message.senderUsername}</span>
                <span>{new Date(res.message.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-vault-indigo dark:text-vault-dark-text leading-relaxed">
                {res.decryptedText}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
