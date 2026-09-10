import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  FileDown,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import QRCode from 'qrcode';
import { generateTotpCode, generateBackupCodes, buildOtpAuthUri, verifyTotpCode } from '../lib/crypto';
import { vaultStorage } from '../lib/storage';
import { VaultUser } from '../types';

interface TwoFactorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: VaultUser;
  onUserUpdated: (user: VaultUser) => void;
}

export const TwoFactorSettingsModal: React.FC<TwoFactorSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [liveOtp, setLiveOtp] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [regenerating, setRegenerating] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !user.totpSecret) return;

    const uri = buildOtpAuthUri(user.email, user.totpSecret, 'SecureVault');
    QRCode.toDataURL(uri, { width: 200, margin: 1 })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate QR', err));
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen || !user.totpSecret) return;

    const updateOtp = async () => {
      const now = Date.now();
      const s = 30 - (Math.floor(now / 1000) % 30);
      setSecondsRemaining(s);
      const code = await generateTotpCode(user.totpSecret!, now);
      setLiveOtp(code);
    };

    updateOtp();
    const interval = setInterval(updateOtp, 1000);
    return () => clearInterval(interval);
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: 'secret' | 'codes') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!window.confirm('Regenerating will invalidate all existing emergency recovery codes. Proceed?')) {
      return;
    }

    setRegenerating(true);
    try {
      const newCodes = generateBackupCodes();
      const updatedUser: VaultUser = {
        ...user,
        backupCodes: newCodes,
      };
      await vaultStorage.saveUser(updatedUser);
      onUserUpdated(updatedUser);
    } finally {
      setRegenerating(false);
    }
  };

  const downloadBackupCodes = () => {
    const codes = user.backupCodes || [];
    const content = `SECUREVAULT EMERGENCY RECOVERY CODES\nEmail: ${user.email}\nDate: ${new Date().toISOString()}\n\nKeep these codes in a secure physical location:\n\n${codes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nEach code can only be used once for emergency vault decryption.`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securevault-emergency-codes-${user.email}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTestVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.totpSecret || testInput.trim().length !== 6) return;

    const isValid = await verifyTotpCode(user.totpSecret, testInput.trim());
    if (isValid) {
      setTestResult({ success: true, message: 'Valid token! Authenticator app is synchronized.' });
    } else {
      setTestResult({ success: false, message: 'Invalid or expired token. Check device clock.' });
    }
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Two-Factor Authentication (2FA)</h2>
              <p className="text-xs text-slate-400">RFC 6238 Time-Based One-Time Password (TOTP)</p>
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

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status Badge */}
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Two-Factor Authentication is currently active
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 uppercase">
              Enforced
            </span>
          </div>

          {/* QR Code and Secret */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center">
            <p className="text-xs text-slate-300 mb-3 text-center">
              Scan with Google Authenticator, Microsoft Authenticator, Authy, or 1Password:
            </p>

            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt="2FA QR Code"
                className="w-40 h-40 bg-white p-2 rounded-lg shadow mb-3"
              />
            ) : (
              <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-500">
                Loading QR Code...
              </div>
            )}

            <div className="w-full text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                Manual Entry Secret Key
              </span>
              <div className="flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-300 mt-1">
                <span className="truncate">{user.totpSecret}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(user.totpSecret || '', 'secret')}
                  className="text-slate-400 hover:text-white"
                  title="Copy secret"
                >
                  {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Live Simulator & Tester */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" /> Live Token
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Changes in {secondsRemaining}s</span>
            </div>
            <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div className="text-lg font-mono font-bold tracking-widest text-cyan-400">
                {liveOtp}
              </div>
              <button
                type="button"
                onClick={() => setTestInput(liveOtp)}
                className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                Copy to Test
              </button>
            </div>

            {/* Test Input Form */}
            <form onSubmit={handleTestVerify} className="mt-3 flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="Test 6-digit code"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value.replace(/\D/g, ''))}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono text-center tracking-widest"
              />
              <button
                type="submit"
                disabled={testInput.length !== 6}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium transition"
              >
                Test Code
              </button>
            </form>

            {testResult && (
              <div
                className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                  testResult.success
                    ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-800/60 text-rose-300'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Emergency Recovery Codes */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-medium text-white block">Emergency Recovery Backup Codes</span>
                <span className="text-[11px] text-slate-400">
                  {user.backupCodes?.length || 0} unused codes available
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadBackupCodes}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                >
                  <FileDown className="w-3 h-3" /> Save .txt
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy((user.backupCodes || []).join(', '), 'codes')}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  {copiedCodes ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-slate-300 text-center my-3">
              {user.backupCodes?.map((code, idx) => (
                <div key={idx} className="bg-slate-900 py-1.5 rounded border border-slate-800/80">
                  {code}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={regenerating}
                onClick={handleRegenerateBackupCodes}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
              >
                <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
                Regenerate New Recovery Codes
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
