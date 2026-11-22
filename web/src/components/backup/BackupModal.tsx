import React, { useState } from 'react';
import { exportEncryptedBackup, importEncryptedBackup } from '../../services/backup';
import { useChatStore } from '../../stores/chatStore';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [passphrase, setPassphrase] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { loadRooms } = useChatStore();

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 6) return;

    setIsProcessing(true);
    setStatusMsg('');
    try {
      const blob = await exportEncryptedBackup(passphrase);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nijghor_backup_${Date.now()}.nijghor`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg('Backup downloaded securely. Keep your passphrase safe!');
    } catch (err: any) {
      setStatusMsg(`Export failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || passphrase.length < 6) return;

    setIsProcessing(true);
    setStatusMsg('');
    try {
      const { restoredRooms, restoredMessages } = await importEncryptedBackup(selectedFile, passphrase);
      await loadRooms();
      setStatusMsg(`Successfully restored ${restoredRooms} rooms and ${restoredMessages} messages.`);
    } catch (err: any) {
      setStatusMsg(`Import error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-vault-indigo/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-vault-surface dark:bg-vault-dark-surface rounded-room p-6 shadow-2xl border border-vault-border dark:border-vault-dark-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-vault-indigo dark:text-vault-dark-text">
            Encrypted Backup & Restore
          </h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => {
              setTab('export');
              setStatusMsg('');
            }}
            className={`py-2 rounded-xl text-xs font-semibold border ${
              tab === 'export'
                ? 'border-vault-terracotta bg-vault-terracotta/10 text-vault-terracotta'
                : 'border-vault-border text-stone-500'
            }`}
          >
            Export Backup (.nijghor)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('import');
              setStatusMsg('');
            }}
            className={`py-2 rounded-xl text-xs font-semibold border ${
              tab === 'import'
                ? 'border-vault-terracotta bg-vault-terracotta/10 text-vault-terracotta'
                : 'border-vault-border text-stone-500'
            }`}
          >
            Import Backup (.nijghor)
          </button>
        </div>

        {statusMsg && (
          <div className="mb-4 p-3 rounded-lg bg-vault-cream dark:bg-vault-dark-surface2 text-xs text-stone-600 dark:text-vault-dark-muted border border-vault-border">
            {statusMsg}
          </div>
        )}

        {tab === 'export' ? (
          <form onSubmit={handleExport} className="space-y-4">
            <p className="text-xs text-stone-500 leading-relaxed">
              Your chat history exists only inside your browser. Export an encrypted container protected with a password to back up your messages.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase text-stone-500 mb-1">
                Encryption Passphrase (min 6 chars)
              </label>
              <input
                type="password"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter strong passphrase"
                className="w-full px-3.5 py-2.5 rounded-xl border border-vault-border bg-white dark:bg-vault-dark-surface2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-terracotta"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing || passphrase.length < 6}
              className="w-full py-3 rounded-xl bg-vault-terracotta text-white font-semibold text-sm shadow-vault-glow hover:bg-vault-terracotta/90 disabled:opacity-50 transition-all"
            >
              {isProcessing ? 'Encrypting Database...' : 'Download .nijghor Backup'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleImport} className="space-y-4">
            <p className="text-xs text-stone-500 leading-relaxed">
              Select your previously exported <code className="font-mono bg-stone-200 dark:bg-vault-dark-surface2 px-1 rounded">.nijghor</code> file to restore chat rooms.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase text-stone-500 mb-1">
                Select .nijghor File
              </label>
              <input
                type="file"
                accept=".nijghor"
                required
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-vault-cream file:text-vault-terracotta hover:file:bg-vault-sand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-stone-500 mb-1">
                Backup Passphrase
              </label>
              <input
                type="password"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase used when exporting"
                className="w-full px-3.5 py-2.5 rounded-xl border border-vault-border bg-white dark:bg-vault-dark-surface2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-terracotta"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing || !selectedFile || passphrase.length < 6}
              className="w-full py-3 rounded-xl bg-vault-terracotta text-white font-semibold text-sm shadow-vault-glow hover:bg-vault-terracotta/90 disabled:opacity-50 transition-all"
            >
              {isProcessing ? 'Decrypting & Restoring...' : 'Restore Chat History'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
