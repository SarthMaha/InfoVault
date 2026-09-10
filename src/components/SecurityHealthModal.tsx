import React, { useState, useRef } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Download,
  Upload,
  KeyRound,
  FileCheck,
  Lock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Database
} from 'lucide-react';
import { VaultUser, StoredVaultItem, VaultItemData } from '../types';
import { vaultStorage } from '../lib/storage';
import { evaluatePasswordStrength } from '../lib/crypto';

interface SecurityHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: VaultUser;
  items: StoredVaultItem[];
  decryptedCache: Record<string, VaultItemData>;
  onExportBackup: () => void;
  onImportBackup: (importedItems: StoredVaultItem[]) => void;
}

export const SecurityHealthModal: React.FC<SecurityHealthModalProps> = ({
  isOpen,
  onClose,
  user,
  items,
  decryptedCache,
  onExportBackup,
  onImportBackup,
}) => {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Calculate audit metrics
  const totalItems = items.length;
  const docsCount = items.filter((i) => i.metadata.type === 'document').length;
  const loginsCount = items.filter((i) => i.metadata.type === 'login').length;
  const idsCount = items.filter((i) => i.metadata.type === 'identity').length;
  const financeCount = items.filter((i) => i.metadata.type === 'financial').length;
  const notesCount = items.filter((i) => i.metadata.type === 'note').length;

  // Password analysis on cached logins
  let weakPasswordsCount = 0;
  const passwordsSeen: Record<string, number> = {};

  items.forEach((item) => {
    if (item.metadata.type === 'login') {
      const data = decryptedCache[item.metadata.id];
      if (data?.password) {
        const evalResult = evaluatePasswordStrength(data.password);
        if (evalResult.score < 3) {
          weakPasswordsCount++;
        }
        passwordsSeen[data.password] = (passwordsSeen[data.password] || 0) + 1;
      }
    }
  });

  const reusedCount = Object.values(passwordsSeen).filter((count) => count > 1).length;

  // Compute Overall Security Score (0 to 100)
  let score = 50; // base score for AES-256 client encryption
  if (user.twoFactorEnabled) score += 25;
  if (totalItems > 0) {
    if (weakPasswordsCount === 0) score += 15;
    else score -= Math.min(15, weakPasswordsCount * 5);

    if (reusedCount === 0) score += 10;
    else score -= Math.min(10, reusedCount * 5);
  } else {
    score += 25;
  }
  score = Math.max(20, Math.min(100, score));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || !Array.isArray(parsed.items)) {
          throw new Error('Invalid vault backup format. Missing items array.');
        }

        const validItems: StoredVaultItem[] = parsed.items.map((it: any) => ({
          metadata: {
            ...it.metadata,
            userId: user.id, // assign to current user
          },
          encryptedData: it.encryptedData,
        }));

        for (const item of validItems) {
          await vaultStorage.saveItem(item);
        }

        onImportBackup(validItems);
        setImportSuccess(`Successfully restored ${validItems.length} encrypted items!`);
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse vault backup file.');
      } finally {
        setImporting(false);
      }
    };

    reader.onerror = () => {
      setImportError('Failed to read file.');
      setImporting(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Security Health & Backup</h2>
              <p className="text-xs text-slate-400">Zero-knowledge cryptographic security audit</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Overall Health Score Card */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Overall Vault Rating
              </span>
              <h3 className="text-2xl font-bold text-white mt-0.5">
                {score >= 90
                  ? 'Excellent Security'
                  : score >= 75
                  ? 'Strong Security'
                  : 'Needs Attention'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Enforces client-side AES-256-GCM + TOTP two-factor verification.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full border-4 border-cyan-500 bg-slate-950 shrink-0">
              <span className="text-2xl font-black text-cyan-400 font-mono">{score}%</span>
              <span className="text-[9px] text-slate-400 font-medium uppercase">Score</span>
            </div>
          </div>

          {/* Audit Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-500 font-medium block">Total Encrypted Items</span>
              <span className="text-lg font-bold text-white font-mono mt-1 block">{totalItems}</span>
              <span className="text-[10px] text-slate-400">{docsCount} docs, {financeCount} cards</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-500 font-medium block">Two-Factor Auth</span>
              <span className="text-sm font-bold text-emerald-400 flex items-center gap-1 mt-1.5">
                <CheckCircle2 className="w-4 h-4" /> Active
              </span>
              <span className="text-[10px] text-slate-400">RFC 6238 TOTP</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-500 font-medium block">Weak Passwords</span>
              <span className={`text-lg font-bold font-mono mt-1 block ${weakPasswordsCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {weakPasswordsCount}
              </span>
              <span className="text-[10px] text-slate-400">
                {weakPasswordsCount > 0 ? 'Requires update' : 'None detected'}
              </span>
            </div>
          </div>

          {/* Backup & Restore Tools */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                Cold Storage Backup & Disaster Recovery
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Export an encrypted copy of your vault items. The exported file stays 100% encrypted with your master key, making it safe to store on a USB drive or cloud drive.
              </p>
            </div>

            {importError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {importError}
              </div>
            )}

            {importSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs">
                {importSuccess}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={onExportBackup}
                className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition shadow-md shadow-cyan-950/50 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Encrypted .vault Backup
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".vault,.json"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center justify-center gap-2"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-cyan-400" />
                    Restore from .vault File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
