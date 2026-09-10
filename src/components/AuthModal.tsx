import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  QrCode,
  Smartphone,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  FileDown
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  deriveAuthHash,
  deriveMasterKey,
  generateSaltHex,
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  generateBackupCodes,
  buildOtpAuthUri,
  evaluatePasswordStrength
} from '../lib/crypto';
import { vaultStorage } from '../lib/storage';
import { VaultUser } from '../types';

interface AuthModalProps {
  onAuthenticated: (user: VaultUser, masterKey: CryptoKey) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA Setup state during registration
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [pendingUser, setPendingUser] = useState<VaultUser | null>(null);
  const [pendingMasterKey, setPendingMasterKey] = useState<CryptoKey | null>(null);
  const [totpSecret, setTotpSecret] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [liveSimulatedOtp, setLiveSimulatedOtp] = useState('');
  const [simulatedSecondsLeft, setSimulatedSecondsLeft] = useState(30);

  // 2FA Verification state during login
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [loginTotpCode, setLoginTotpCode] = useState('');
  const [isUsingBackupCode, setIsUsingBackupCode] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState('');
  const [loginUser, setLoginUser] = useState<VaultUser | null>(null);
  const [loginDerivedKey, setLoginDerivedKey] = useState<CryptoKey | null>(null);

  const passwordEvaluation = evaluatePasswordStrength(password);

  // Update simulated OTP for easy testing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const secretToUse = isSettingUp2FA ? totpSecret : loginUser?.totpSecret;

    if (secretToUse) {
      const updateCode = async () => {
        const now = Date.now();
        const seconds = 30 - (Math.floor(now / 1000) % 30);
        setSimulatedSecondsLeft(seconds);
        const code = await generateTotpCode(secretToUse, now);
        setLiveSimulatedOtp(code);
      };

      updateCode();
      interval = setInterval(updateCode, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSettingUp2FA, totpSecret, isVerifying2FA, loginUser]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please provide an email and a master password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Master passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Master password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      // Check if user already exists
      const existing = await vaultStorage.getUserByEmail(cleanEmail);
      if (existing) {
        setError('An encrypted vault already exists for this email. Please sign in instead.');
        setLoading(false);
        return;
      }

      // Generate salt and derive authentication hash and master encryption key
      const saltHex = generateSaltHex(16);
      const authHash = await deriveAuthHash(password, saltHex);
      const masterKey = await deriveMasterKey(password, saltHex);

      // Generate 2FA Secret and Emergency Backup Codes
      const secret = generateTotpSecret();
      const codes = generateBackupCodes();
      const otpUri = buildOtpAuthUri(cleanEmail, secret, 'SecureVault');
      const qrData = await QRCode.toDataURL(otpUri, { width: 220, margin: 1 });

      const newUser: VaultUser = {
        id: crypto.randomUUID(),
        email: cleanEmail,
        authHash,
        saltHex,
        twoFactorEnabled: true,
        totpSecret: secret,
        backupCodes: codes,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      };

      setPendingUser(newUser);
      setPendingMasterKey(masterKey);
      setTotpSecret(secret);
      setBackupCodes(codes);
      setQrCodeDataUrl(qrData);
      setIsSettingUp2FA(true);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize encrypted vault.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm2FASetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pendingUser || !pendingMasterKey) return;

    if (!verificationCode || verificationCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code from your authenticator.');
      return;
    }

    setLoading(true);
    try {
      const isValid = await verifyTotpCode(totpSecret, verificationCode.trim());
      if (!isValid) {
        setError('Invalid 6-digit code. Check your authenticator app time or try the simulated code.');
        setLoading(false);
        return;
      }

      // Save user to IndexedDB
      await vaultStorage.saveUser(pendingUser);
      onAuthenticated(pendingUser, pendingMasterKey);
    } catch (err: any) {
      setError(err.message || 'Failed to verify two-factor code.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter your email and master password.');
      return;
    }

    setLoading(true);
    try {
      const user = await vaultStorage.getUserByEmail(cleanEmail);
      if (!user) {
        setError('No vault found for this email. Check spelling or create a new vault.');
        setLoading(false);
        return;
      }

      // Validate Auth Hash
      const derivedAuth = await deriveAuthHash(password, user.saltHex);
      if (derivedAuth !== user.authHash) {
        setError('Invalid master password. Zero-knowledge encryption cannot decrypt with an incorrect key.');
        setLoading(false);
        return;
      }

      // Derive Master Decryption Key
      const masterKey = await deriveMasterKey(password, user.saltHex);

      if (user.twoFactorEnabled && user.totpSecret) {
        // Prompt for 2FA
        setLoginUser(user);
        setLoginDerivedKey(masterKey);
        setIsVerifying2FA(true);
        setLoading(false);
      } else {
        // Direct unlock
        user.lastLoginAt = Date.now();
        await vaultStorage.saveUser(user);
        onAuthenticated(user, masterKey);
      }
    } catch (err: any) {
      setError(err.message || 'Error unlocking vault.');
      setLoading(false);
    }
  };

  const handleVerifyLogin2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginUser || !loginDerivedKey) return;

    setLoading(true);
    try {
      if (isUsingBackupCode) {
        const cleanBackup = backupCodeInput.trim().toUpperCase();
        if (!loginUser.backupCodes || !loginUser.backupCodes.includes(cleanBackup)) {
          setError('Invalid recovery code. Please check and try again.');
          setLoading(false);
          return;
        }

        // Consume the backup code
        loginUser.backupCodes = loginUser.backupCodes.filter(c => c !== cleanBackup);
        loginUser.lastLoginAt = Date.now();
        await vaultStorage.saveUser(loginUser);
        onAuthenticated(loginUser, loginDerivedKey);
        return;
      }

      if (!loginTotpCode || loginTotpCode.trim().length !== 6) {
        setError('Please enter the 6-digit code from your authenticator app.');
        setLoading(false);
        return;
      }

      const isValid = await verifyTotpCode(loginUser.totpSecret!, loginTotpCode.trim());
      if (!isValid) {
        setError('Incorrect or expired 6-digit verification code. Please try again.');
        setLoading(false);
        return;
      }

      loginUser.lastLoginAt = Date.now();
      await vaultStorage.saveUser(loginUser);
      onAuthenticated(loginUser, loginDerivedKey);
    } catch (err: any) {
      setError(err.message || 'Two-factor verification error.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'secret' | 'codes') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const downloadBackupCodes = () => {
    const content = `SECUREVAULT EMERGENCY RECOVERY CODES\nEmail: ${pendingUser?.email}\nGenerated: ${new Date().toISOString()}\n\nKeep these one-time recovery codes in a secure, confidential place:\n\n${backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nEach code can be used once if you lose access to your authenticator app.`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securevault-recovery-codes-${pendingUser?.email}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="auth-screen" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-950/70 border border-cyan-500/30 shadow-lg shadow-cyan-950/50 mb-3">
            <ShieldCheck className="w-7 h-7 text-cyan-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Secure Document & Info Vault
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Zero-Knowledge AES-256 Client Encryption & 2FA Security
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ================= REGISTER 2FA SETUP STEP ================= */}
          {isSettingUp2FA ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  Step 2 of 2
                </span>
                <h2 className="text-lg font-semibold text-white">Configure Two-Factor Verification</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Scan this QR code using Google Authenticator, Microsoft Authenticator, or any standard TOTP app.
              </p>

              {/* QR Code Container */}
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex flex-col items-center justify-center mb-4">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="2FA TOTP QR Code"
                    className="w-44 h-44 rounded-lg bg-white p-2 shadow"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-slate-500 text-xs">
                    Generating QR Code...
                  </div>
                )}

                <div className="mt-3 w-full text-center">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
                    Manual Secret Key
                  </div>
                  <div className="flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-300">
                    <span className="truncate max-w-[220px]">{totpSecret}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(totpSecret, 'secret')}
                      className="text-slate-400 hover:text-white transition p-1"
                      title="Copy Secret"
                    >
                      {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Simulator for effortless verification */}
              <div className="mb-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    Current Authenticator Code:
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Refreshes in {simulatedSecondsLeft}s
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-base font-bold tracking-widest text-cyan-400">
                    {liveSimulatedOtp || '------'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setVerificationCode(liveSimulatedOtp)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/50 transition"
                  >
                    Quick Fill
                  </button>
                </div>
              </div>

              {/* Emergency Recovery Codes preview */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-300">Emergency Recovery Codes</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadBackupCodes}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <FileDown className="w-3 h-3" /> Save .txt
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(backupCodes.join(', '), 'codes')}
                      className="text-[11px] text-slate-400 hover:text-slate-300 flex items-center gap-1"
                    >
                      {copiedCodes ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 text-center">
                  {backupCodes.map((code, idx) => (
                    <div key={idx} className="bg-slate-900/80 py-1 rounded border border-slate-800/80">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification Form */}
              <form onSubmit={handleConfirm2FASetup} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Enter 6-digit Code to Confirm Pairing:
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-xl tracking-[0.3em] font-mono text-white focus:outline-none focus:border-cyan-500 transition"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 text-white font-medium text-sm transition shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Verify & Unlock Vault
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsSettingUp2FA(false)}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-300 pt-1"
                >
                  ← Back to master password setup
                </button>
              </form>
            </div>
          ) : isVerifying2FA ? (
            /* ================= LOGIN 2FA VERIFICATION STEP ================= */
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  Step 2
                </span>
                <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                {isUsingBackupCode
                  ? 'Enter one of your 8-character emergency recovery backup codes.'
                  : 'Enter the 6-digit verification code from your authenticator app.'}
              </p>

              {!isUsingBackupCode ? (
                <>
                  {/* Interactive Quick Helper */}
                  <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                        Authenticator App Code:
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Expires in {simulatedSecondsLeft}s
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-base font-bold tracking-widest text-cyan-400">
                        {liveSimulatedOtp || '------'}
                      </div>
                      <button
                        type="button"
                        onClick={() => setLoginTotpCode(liveSimulatedOtp)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/50 transition"
                      >
                        Quick Fill
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleVerifyLogin2FA} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        6-Digit Security Token
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={loginTotpCode}
                        onChange={(e) => setLoginTotpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-xl tracking-[0.3em] font-mono text-white focus:outline-none focus:border-cyan-500 transition"
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || loginTotpCode.length !== 6}
                      className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 text-white font-medium text-sm transition shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          Verify & Decrypt Vault
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between pt-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUsingBackupCode(true);
                          setError(null);
                        }}
                        className="text-cyan-400 hover:text-cyan-300 underline"
                      >
                        Lost phone? Use backup code
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsVerifying2FA(false);
                          setLoginUser(null);
                          setLoginDerivedKey(null);
                        }}
                        className="text-slate-400 hover:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                /* Emergency backup code view */
                <form onSubmit={handleVerifyLogin2FA} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Emergency Recovery Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9F4-2B8"
                      value={backupCodeInput}
                      onChange={(e) => setBackupCodeInput(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-lg font-mono text-white tracking-widest focus:outline-none focus:border-cyan-500 transition"
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !backupCodeInput.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-sm transition"
                  >
                    {loading ? 'Verifying Code...' : 'Unlock with Backup Code'}
                  </button>

                  <div className="flex items-center justify-between pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUsingBackupCode(false);
                        setError(null);
                      }}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      ← Back to 6-digit Authenticator
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* ================= PRIMARY LOGIN / REGISTER FORM ================= */
            <div>
              {/* Navigation Switch Tabs */}
              <div className="flex p-1 bg-slate-950 rounded-xl mb-6 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                    !isRegister
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Unlock Vault
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                    isRegister
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create New Vault
                </button>
              </div>

              <form onSubmit={isRegister ? handleRegisterSubmit : handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Master Password
                    </label>
                    {isRegister && password && (
                      <span
                        className={`text-[11px] font-medium ${
                          passwordEvaluation.score >= 3
                            ? 'text-emerald-400'
                            : passwordEvaluation.score === 2
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {passwordEvaluation.label}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Master password used to derive encryption keys"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter for Registration */}
                  {isRegister && password && (
                    <div className="mt-2 space-y-1">
                      <div className="grid grid-cols-4 gap-1.5 h-1.5">
                        {[0, 1, 2, 3].map((step) => (
                          <div
                            key={step}
                            className={`rounded-full transition-colors ${
                              passwordEvaluation.score > step
                                ? passwordEvaluation.score >= 3
                                  ? 'bg-emerald-500'
                                  : passwordEvaluation.score === 2
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                                : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="text-[11px] text-slate-400 pt-0.5">
                        {passwordEvaluation.feedback[0]}
                      </div>
                    </div>
                  )}
                </div>

                {isRegister && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Confirm Master Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Re-enter your master password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition font-mono"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 mt-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-sm transition shadow-lg shadow-cyan-950/60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isRegister ? (
                    <>
                      Continue to 2FA Setup
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Authenticate & Proceed
                    </>
                  )}
                </button>
              </form>

              {/* Zero-knowledge notice */}
              <div className="mt-5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Zero-Knowledge Guarantee
                </div>
                Your master password never leaves your browser. Files and data are encrypted via AES-GCM-256 with 100,000 PBKDF2 rounds before saving.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
