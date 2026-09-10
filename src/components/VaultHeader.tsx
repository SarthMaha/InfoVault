import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Search,
  Upload,
  Plus,
  KeyRound,
  Activity,
  LogOut,
  ChevronDown,
  Clock,
  Download,
  Settings,
  X
} from 'lucide-react';
import { VaultUser } from '../types';

interface VaultHeaderProps {
  user: VaultUser;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenUpload: () => void;
  onOpenAddInfo: () => void;
  onOpenGenerator: () => void;
  onOpenSecurity: () => void;
  onOpen2FASettings: () => void;
  onLockVault: () => void;
  onExportBackup: () => void;
  autoLockSecondsRemaining: number;
}

export const VaultHeader: React.FC<VaultHeaderProps> = ({
  user,
  searchQuery,
  onSearchChange,
  onOpenUpload,
  onOpenAddInfo,
  onOpenGenerator,
  onOpenSecurity,
  onOpen2FASettings,
  onLockVault,
  onExportBackup,
  autoLockSecondsRemaining,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Format auto-lock time mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-6">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">SecureVault</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
                  AES-256
                </span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-mono">
                  2FA Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Zero-Knowledge Encrypted Document & Info Safe</p>
            </div>
          </div>

          {/* Center: Search Field */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search encrypted documents, IDs, credentials, notes..."
                className="w-full bg-slate-900/90 border border-slate-700/70 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Actions and User Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Action: Upload Document */}
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs sm:text-sm font-medium transition shadow-md shadow-cyan-950/40"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Document</span>
              <span className="sm:hidden">Upload</span>
            </button>

            {/* Quick Action: Add Info */}
            <button
              type="button"
              onClick={onOpenAddInfo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-medium border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Add Info</span>
              <span className="sm:hidden">Add</span>
            </button>

            {/* Password Generator tool button */}
            <button
              type="button"
              onClick={onOpenGenerator}
              title="Cryptographic Password Generator"
              className="hidden lg:inline-flex items-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-slate-700 transition"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            {/* Security Audit button */}
            <button
              type="button"
              onClick={onOpenSecurity}
              title="Vault Security Health & Backup"
              className="hidden lg:inline-flex items-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-slate-700 transition"
            >
              <Activity className="w-4 h-4" />
            </button>

            {/* Auto-Lock Indicator & Lock Button */}
            <button
              type="button"
              onClick={onLockVault}
              title={`Auto-lock in ${formatTime(autoLockSecondsRemaining)}. Click to lock immediately.`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-400 hover:text-amber-400 hover:border-amber-900/50 transition"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">{formatTime(autoLockSecondsRemaining)}</span>
              <Lock className="w-3.5 h-3.5 ml-0.5" />
            </button>

            {/* User Account Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow">
                  {user.email.slice(0, 2)}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 text-xs text-slate-300">
                    <div className="px-3 py-2 border-b border-slate-800">
                      <p className="text-[11px] text-slate-500 font-medium">Logged in as</p>
                      <p className="font-semibold text-white truncate">{user.email}</p>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        2-Factor Verification Enabled
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpen2FASettings();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center gap-2"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                        2FA & Recovery Codes
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenSecurity();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center gap-2"
                      >
                        <Activity className="w-3.5 h-3.5 text-slate-400" />
                        Security Health & Audit
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenGenerator();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center gap-2"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                        Password Generator
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onExportBackup();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-cyan-400"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export Encrypted Backup (.vault)
                      </button>
                    </div>

                    <div className="pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onLockVault();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 text-rose-400 flex items-center gap-2"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Lock Vault Now
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
