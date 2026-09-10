import React, { useState } from 'react';
import {
  FileText,
  File,
  Lock,
  Star,
  Download,
  Copy,
  Check,
  Trash2,
  Eye,
  Key,
  CreditCard,
  UserCheck,
  ExternalLink,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { StoredVaultItem, VaultItemData, VaultItemType } from '../types';

interface ItemCardProps {
  item: StoredVaultItem;
  decryptedData?: VaultItemData;
  onView: (item: StoredVaultItem) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  onDownloadDocument?: (item: StoredVaultItem, decryptedData?: VaultItemData) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  decryptedData,
  onView,
  onToggleFavorite,
  onDelete,
  onDownloadDocument,
}) => {
  const [copied, setCopied] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const { metadata } = item;

  const getTypeIcon = (type: VaultItemType) => {
    switch (type) {
      case 'document':
        return FileText;
      case 'identity':
        return UserCheck;
      case 'financial':
        return CreditCard;
      case 'login':
        return Key;
      case 'note':
        return File;
      default:
        return Lock;
    }
  };

  const getTypeTheme = (type: VaultItemType) => {
    switch (type) {
      case 'document':
        return {
          bg: 'bg-cyan-950/60',
          border: 'border-cyan-800/50',
          text: 'text-cyan-400',
          badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
        };
      case 'identity':
        return {
          bg: 'bg-indigo-950/60',
          border: 'border-indigo-800/50',
          text: 'text-indigo-400',
          badge: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60',
        };
      case 'financial':
        return {
          bg: 'bg-emerald-950/60',
          border: 'border-emerald-800/50',
          text: 'text-emerald-400',
          badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
        };
      case 'login':
        return {
          bg: 'bg-amber-950/60',
          border: 'border-amber-800/50',
          text: 'text-amber-400',
          badge: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
        };
      case 'note':
        return {
          bg: 'bg-purple-950/60',
          border: 'border-purple-800/50',
          text: 'text-purple-400',
          badge: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
        };
    }
  };

  const Icon = getTypeIcon(metadata.type);
  const theme = getTypeTheme(metadata.type);

  const handleQuickCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = '';
    if (decryptedData) {
      if (metadata.type === 'login') {
        textToCopy = decryptedData.password || decryptedData.username || '';
      } else if (metadata.type === 'identity') {
        textToCopy = decryptedData.idNumber || '';
      } else if (metadata.type === 'financial') {
        textToCopy = decryptedData.cardNumber || decryptedData.accountNumber || '';
      } else if (metadata.type === 'note') {
        textToCopy = decryptedData.notes || '';
      }
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      // If not yet decrypted in cache, open view to decrypt
      onView(item);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div
      onClick={() => onView(item)}
      className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition shadow-lg hover:shadow-xl cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Top bar: Type icon, Category, Favorite */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl border ${theme.bg} ${theme.border} ${theme.text}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md border font-mono ${theme.badge}`}>
                {metadata.type}
              </span>
              <p className="text-xs text-slate-400 mt-0.5">{metadata.category}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(metadata.id, metadata.favorite);
            }}
            className={`p-1.5 rounded-lg transition ${
              metadata.favorite
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-slate-600 hover:text-slate-400'
            }`}
            title={metadata.favorite ? 'Unstar' : 'Star as favorite'}
          >
            <Star className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-white text-base tracking-tight truncate group-hover:text-cyan-300 transition">
          {metadata.title}
        </h3>

        {/* Content Snippet / Metadata details */}
        <div className="mt-2 text-xs text-slate-400">
          {metadata.type === 'document' && metadata.fileMeta && (
            <div className="flex items-center gap-2 font-mono text-[11px] text-cyan-300">
              <span className="truncate max-w-[180px]">{metadata.fileMeta.originalName}</span>
              <span>•</span>
              <span>{formatFileSize(metadata.fileMeta.sizeBytes)}</span>
            </div>
          )}

          {metadata.type === 'login' && decryptedData?.username && (
            <div className="font-mono text-slate-300 truncate">
              {decryptedData.username}
            </div>
          )}

          {metadata.type === 'identity' && decryptedData?.idNumber && (
            <div className="font-mono text-slate-300 truncate">
              {decryptedData.idType?.toUpperCase()}: {decryptedData.idNumber.slice(0, 4)}••••{decryptedData.idNumber.slice(-2)}
            </div>
          )}

          {metadata.type === 'financial' && decryptedData && (
            <div className="font-mono text-slate-300 truncate">
              {decryptedData.bankName && <span>{decryptedData.bankName} </span>}
              {decryptedData.cardNumber
                ? `•••• ${decryptedData.cardNumber.slice(-4)}`
                : decryptedData.accountNumber
                ? `Acct: •••• ${decryptedData.accountNumber.slice(-4)}`
                : ''}
            </div>
          )}

          {metadata.type === 'note' && decryptedData?.notes && (
            <p className="line-clamp-2 text-slate-400 text-xs mt-1">
              {decryptedData.notes}
            </p>
          )}

          {!decryptedData && metadata.type !== 'document' && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
              <Lock className="w-3 h-3" /> Encrypted Payload
            </div>
          )}
        </div>

        {/* Tags */}
        {metadata.tags && metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {metadata.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 border border-slate-800"
              >
                #{tag}
              </span>
            ))}
            {metadata.tags.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-950 text-slate-500 border border-slate-800">
                +{metadata.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-mono">
          {new Date(metadata.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>

        <div className="flex items-center gap-1">
          {/* Quick Copy button */}
          {metadata.type !== 'document' && (
            <button
              type="button"
              onClick={handleQuickCopy}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
              title="Copy secret value"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          )}

          {/* Download button for documents */}
          {metadata.type === 'document' && onDownloadDocument && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownloadDocument(item, decryptedData);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
              title="Download Decrypted File"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* View Decrypted */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView(item);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Inspect Decrypted Data"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Delete Action with inline confirm */}
          {!showConfirmDelete ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirmDelete(true);
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
              title="Delete Item"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-rose-950/80 px-2 py-0.5 rounded-lg border border-rose-800">
              <span className="text-[10px] text-rose-300 font-medium">Delete?</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(metadata.id);
                }}
                className="text-[10px] font-bold text-rose-200 hover:underline"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmDelete(false);
                }}
                className="text-[10px] text-slate-400 hover:text-white ml-1"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
