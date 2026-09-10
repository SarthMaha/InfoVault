import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { generateSecurePassword, evaluatePasswordStrength } from '../lib/crypto';

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [length, setLength] = useState(24);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);

  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const pass = generateSecurePassword({
      length,
      includeUppercase,
      includeLowercase,
      includeNumbers,
      includeSymbols,
    });
    setGeneratedPassword(pass);
  };

  useEffect(() => {
    if (isOpen) {
      handleGenerate();
    }
  }, [isOpen, length, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  if (!isOpen) return null;

  const evaluation = evaluatePasswordStrength(generatedPassword);

  const handleCopy = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Cryptographic Password Generator</h2>
              <p className="text-xs text-slate-400">High-entropy pseudorandom generation</p>
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Result Output Display */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="font-mono text-base sm:text-lg font-bold text-white break-all text-center tracking-wider selection:bg-cyan-500/30 selection:text-cyan-300">
              {generatedPassword}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-900 text-xs">
              <span className="text-slate-400 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {evaluation.entropyBits} bits of entropy ({evaluation.label})
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition"
                  title="Generate new password"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1.5 transition shadow-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Length Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
              <span>Password Length</span>
              <span className="font-mono text-cyan-400 font-bold text-sm">{length} chars</span>
            </div>
            <input
              type="range"
              min={8}
              max={64}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Character Options */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={includeUppercase}
                onChange={(e) => setIncludeUppercase(e.target.checked)}
                className="rounded text-cyan-500 focus:ring-0"
              />
              <span className="text-slate-300 font-medium">Uppercase (A-Z)</span>
            </label>

            <label className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={includeLowercase}
                onChange={(e) => setIncludeLowercase(e.target.checked)}
                className="rounded text-cyan-500 focus:ring-0"
              />
              <span className="text-slate-300 font-medium">Lowercase (a-z)</span>
            </label>

            <label className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={includeNumbers}
                onChange={(e) => setIncludeNumbers(e.target.checked)}
                className="rounded text-cyan-500 focus:ring-0"
              />
              <span className="text-slate-300 font-medium">Numbers (0-9)</span>
            </label>

            <label className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={includeSymbols}
                onChange={(e) => setIncludeSymbols(e.target.checked)}
                className="rounded text-cyan-500 focus:ring-0"
              />
              <span className="text-slate-300 font-medium">Symbols (!@#$)</span>
            </label>
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
