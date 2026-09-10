import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Upload,
  Plus,
  Search,
  Filter,
  Star,
  FileText,
  Key,
  CreditCard,
  UserCheck,
  File,
  RefreshCw,
  FolderOpen,
  Sparkles,
  Download,
  AlertCircle,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { VaultUser, StoredVaultItem, VaultItemData, VaultItemType } from './types';
import { vaultStorage } from './lib/storage';
import { decryptData } from './lib/crypto';
import { seedSampleVaultData } from './lib/seed';
import { AuthModal } from './components/AuthModal';
import { VaultHeader } from './components/VaultHeader';
import { ItemCard } from './components/ItemCard';
import { UploadModal } from './components/UploadModal';
import { AddInfoModal } from './components/AddInfoModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { TwoFactorSettingsModal } from './components/TwoFactorSettingsModal';
import { SecurityHealthModal } from './components/SecurityHealthModal';
import { PasswordGeneratorModal } from './components/PasswordGeneratorModal';

const AUTO_LOCK_SECONDS = 900; // 15 minutes auto-lock timeout

export default function App() {
  // Authentication & Cryptographic session state
  const [currentUser, setCurrentUser] = useState<VaultUser | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);

  // Vault data state
  const [items, setItems] = useState<StoredVaultItem[]>([]);
  const [decryptedCache, setDecryptedCache] = useState<Record<string, VaultItemData>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'document' | 'identity' | 'financial' | 'login' | 'note' | 'favorite'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'alpha'>('newest');

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [addInfoModalOpen, setAddInfoModalOpen] = useState(false);
  const [addInfoType, setAddInfoType] = useState<VaultItemType>('login');
  const [detailItem, setDetailItem] = useState<StoredVaultItem | null>(null);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);

  // Inactivity Auto-Lock timer
  const [secondsUntilLock, setSecondsUntilLock] = useState<number>(AUTO_LOCK_SECONDS);
  const lastActivityRef = useRef<number>(Date.now());

  // Reset inactivity timer on user interaction
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsUntilLock(AUTO_LOCK_SECONDS);
  }, []);

  useEffect(() => {
    if (!currentUser || !masterKey) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, recordActivity));

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, AUTO_LOCK_SECONDS - elapsed);
      setSecondsUntilLock(remaining);

      if (remaining <= 0) {
        handleLockVault();
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      clearInterval(interval);
    };
  }, [currentUser, masterKey, recordActivity]);

  // Load items from IndexedDB when user is authenticated
  const loadVaultItems = useCallback(async (user: VaultUser, key: CryptoKey) => {
    setLoadingItems(true);
    try {
      const stored = await vaultStorage.getItemsByUserId(user.id);
      setItems(stored);

      // Decrypt items in background for instant search and card preview
      const cache: Record<string, VaultItemData> = {};
      for (const item of stored) {
        try {
          const dec = await decryptData<VaultItemData>(key, item.encryptedData);
          cache[item.metadata.id] = dec;
        } catch (e) {
          console.warn('Could not pre-decrypt item', item.metadata.id, e);
        }
      }
      setDecryptedCache(cache);
    } catch (err) {
      console.error('Failed to load items', err);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const handleAuthenticated = (user: VaultUser, key: CryptoKey) => {
    setCurrentUser(user);
    setMasterKey(key);
    recordActivity();
    loadVaultItems(user, key);
  };

  const handleLockVault = () => {
    // Purge cryptographic keys and decrypted items from memory
    setMasterKey(null);
    setDecryptedCache({});
    setDetailItem(null);
    setUploadModalOpen(false);
    setAddInfoModalOpen(false);
  };

  const handleToggleFavorite = async (id: string, current: boolean) => {
    const updated = items.map((item) => {
      if (item.metadata.id === id) {
        return {
          ...item,
          metadata: {
            ...item.metadata,
            favorite: !current,
            updatedAt: Date.now(),
          },
        };
      }
      return item;
    });

    setItems(updated);
    const target = updated.find((i) => i.metadata.id === id);
    if (target) {
      await vaultStorage.saveItem(target);
    }
  };

  const handleDeleteItem = async (id: string) => {
    await vaultStorage.deleteItem(id);
    setItems((prev) => prev.filter((i) => i.metadata.id !== id));
    setDecryptedCache((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (detailItem?.metadata.id === id) {
      setDetailItem(null);
    }
  };

  const handleItemAdded = (item: StoredVaultItem, decData: VaultItemData) => {
    setItems((prev) => [item, ...prev]);
    setDecryptedCache((prev) => ({
      ...prev,
      [item.metadata.id]: decData,
    }));
  };

  const handleCacheDecrypted = (id: string, data: VaultItemData) => {
    setDecryptedCache((prev) => ({
      ...prev,
      [id]: data,
    }));
  };

  const handleSeedSamples = async () => {
    if (!currentUser || !masterKey) return;
    setLoadingItems(true);
    try {
      const { stored, decryptedMap } = await seedSampleVaultData(currentUser.id, masterKey);
      setItems((prev) => [...stored, ...prev]);
      setDecryptedCache((prev) => ({ ...prev, ...decryptedMap }));
    } catch (err) {
      console.error('Failed to seed sample vault', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleExportBackup = () => {
    if (!currentUser) return;
    const backup = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        email: currentUser.email,
        saltHex: currentUser.saltHex,
        authHash: currentUser.authHash,
      },
      items,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securevault-backup-${currentUser.email}-${new Date().toISOString().slice(0, 10)}.vault`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (importedItems: StoredVaultItem[]) => {
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.metadata.id));
      const fresh = importedItems.filter((i) => !existingIds.has(i.metadata.id));
      return [...fresh, ...prev];
    });
    if (currentUser && masterKey) {
      loadVaultItems(currentUser, masterKey);
    }
  };

  const handleDownloadDocument = (item: StoredVaultItem, cached?: VaultItemData) => {
    const dataToUse = cached || decryptedCache[item.metadata.id];
    if (dataToUse?.fileDataUrl && item.metadata.fileMeta) {
      const a = document.createElement('a');
      a.href = dataToUse.fileDataUrl;
      a.download = item.metadata.fileMeta.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      setDetailItem(item);
    }
  };

  // Filter and Search Logic
  const filteredItems = items.filter((item) => {
    // Filter tab check
    if (selectedFilter === 'favorite' && !item.metadata.favorite) return false;
    if (selectedFilter !== 'all' && selectedFilter !== 'favorite' && item.metadata.type !== selectedFilter) {
      return false;
    }

    // Search query check
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const metaMatch =
        item.metadata.title.toLowerCase().includes(q) ||
        item.metadata.category.toLowerCase().includes(q) ||
        item.metadata.tags.some((t) => t.toLowerCase().includes(q)) ||
        (item.metadata.fileMeta?.originalName.toLowerCase().includes(q) ?? false);

      if (metaMatch) return true;

      // Check decrypted fields if available in cache
      const dec = decryptedCache[item.metadata.id];
      if (dec) {
        if (dec.username?.toLowerCase().includes(q)) return true;
        if (dec.fullName?.toLowerCase().includes(q)) return true;
        if (dec.bankName?.toLowerCase().includes(q)) return true;
        if (dec.notes?.toLowerCase().includes(q)) return true;
        if (dec.url?.toLowerCase().includes(q)) return true;
      }

      return false;
    }

    return true;
  });

  // Sort logic
  filteredItems.sort((a, b) => {
    if (sortBy === 'newest') return b.metadata.createdAt - a.metadata.createdAt;
    if (sortBy === 'oldest') return a.metadata.createdAt - b.metadata.createdAt;
    if (sortBy === 'alpha') return a.metadata.title.localeCompare(b.metadata.title);
    return 0;
  });

  // Category counts
  const counts = {
    all: items.length,
    document: items.filter((i) => i.metadata.type === 'document').length,
    identity: items.filter((i) => i.metadata.type === 'identity').length,
    financial: items.filter((i) => i.metadata.type === 'financial').length,
    login: items.filter((i) => i.metadata.type === 'login').length,
    note: items.filter((i) => i.metadata.type === 'note').length,
    favorite: items.filter((i) => i.metadata.favorite).length,
  };

  // If user is not authenticated or vault is locked, render the AuthModal
  if (!currentUser || !masterKey) {
    return <AuthModal onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Header */}
      <VaultHeader
        user={currentUser}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenUpload={() => setUploadModalOpen(true)}
        onOpenAddInfo={() => {
          setAddInfoType('login');
          setAddInfoModalOpen(true);
        }}
        onOpenGenerator={() => setGeneratorModalOpen(true)}
        onOpenSecurity={() => setSecurityModalOpen(true)}
        onOpen2FASettings={() => setTwoFactorModalOpen(true)}
        onLockVault={handleLockVault}
        onExportBackup={handleExportBackup}
        autoLockSecondsRemaining={secondsUntilLock}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Filters & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Items', icon: FolderOpen, count: counts.all },
              { id: 'document', label: 'Documents & Files', icon: FileText, count: counts.document },
              { id: 'identity', label: 'Government IDs', icon: UserCheck, count: counts.identity },
              { id: 'financial', label: 'Cards & Banking', icon: CreditCard, count: counts.financial },
              { id: 'login', label: 'Logins & Keys', icon: Key, count: counts.login },
              { id: 'note', label: 'Secure Notes', icon: File, count: counts.note },
              { id: 'favorite', label: 'Favorites', icon: Star, count: counts.favorite },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedFilter(tab.id as any)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                    isActive
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60 shadow-sm'
                      : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-cyan-900/80 text-cyan-200' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <span className="text-xs text-slate-500 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500 transition"
            >
              <option value="newest">Recently Added</option>
              <option value="oldest">Oldest First</option>
              <option value="alpha">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loadingItems && items.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
            <p className="text-sm font-medium">Decrypting Vault Storage...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          /* Empty State */
          <div className="py-16 px-4 max-w-lg mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-800/40 mx-auto flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-950/40">
              <ShieldCheck className="w-8 h-8" />
            </div>

            {searchQuery ? (
              <>
                <h3 className="text-lg font-bold text-white mb-1">No matches found</h3>
                <p className="text-xs text-slate-400 mb-4">
                  No encrypted items matched "{searchQuery}". Try a different keyword or tag.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition"
                >
                  Clear Search Filter
                </button>
              </>
            ) : items.length === 0 ? (
              <>
                <h3 className="text-xl font-bold text-white mb-1.5">Your Vault is Ready & Empty</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Start storing your essential documents, passports, financial cards, credentials, and confidential notes protected by zero-knowledge AES-256 encryption.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(true)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs sm:text-sm transition shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Document (PDF/ID)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAddInfoType('login');
                      setAddInfoModalOpen(true);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs sm:text-sm transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4 text-cyan-400" />
                    Store Credentials or ID
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-900">
                  <button
                    type="button"
                    onClick={handleSeedSamples}
                    className="text-xs text-slate-400 hover:text-cyan-400 transition flex items-center gap-1.5 mx-auto font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Load Sample Encrypted Documents & Records for Testing
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-1">No items in this category</h3>
                <p className="text-xs text-slate-400 mb-4">
                  You haven't stored any items under '{selectedFilter}'.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedFilter('all')}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition"
                >
                  Show All Items ({items.length})
                </button>
              </>
            )}
          </div>
        ) : (
          /* Item Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.metadata.id}
                item={item}
                decryptedData={decryptedCache[item.metadata.id]}
                onView={(it) => setDetailItem(it)}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDeleteItem}
                onDownloadDocument={handleDownloadDocument}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Action Bar for Mobile */}
      <div className="sm:hidden sticky bottom-4 z-20 mx-4 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-2 rounded-2xl shadow-xl flex items-center justify-around">
        <button
          type="button"
          onClick={() => setUploadModalOpen(true)}
          className="flex-1 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow"
        >
          <Upload className="w-4 h-4" /> Upload
        </button>
        <div className="w-2" />
        <button
          type="button"
          onClick={() => {
            setAddInfoType('login');
            setAddInfoModalOpen(true);
          }}
          className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-700"
        >
          <Plus className="w-4 h-4 text-cyan-400" /> Add Info
        </button>
      </div>

      {/* Modals */}
      {uploadModalOpen && (
        <UploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          userId={currentUser.id}
          masterKey={masterKey}
          onItemAdded={handleItemAdded}
        />
      )}

      {addInfoModalOpen && (
        <AddInfoModal
          isOpen={addInfoModalOpen}
          onClose={() => setAddInfoModalOpen(false)}
          userId={currentUser.id}
          masterKey={masterKey}
          initialType={addInfoType}
          onItemAdded={handleItemAdded}
        />
      )}

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          decryptedData={decryptedCache[detailItem.metadata.id]}
          masterKey={masterKey}
          onClose={() => setDetailItem(null)}
          onDelete={handleDeleteItem}
          onCacheDecrypted={handleCacheDecrypted}
        />
      )}

      {twoFactorModalOpen && (
        <TwoFactorSettingsModal
          isOpen={twoFactorModalOpen}
          onClose={() => setTwoFactorModalOpen(false)}
          user={currentUser}
          onUserUpdated={(u) => setCurrentUser(u)}
        />
      )}

      {securityModalOpen && (
        <SecurityHealthModal
          isOpen={securityModalOpen}
          onClose={() => setSecurityModalOpen(false)}
          user={currentUser}
          items={items}
          decryptedCache={decryptedCache}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
        />
      )}

      {generatorModalOpen && (
        <PasswordGeneratorModal
          isOpen={generatorModalOpen}
          onClose={() => setGeneratorModalOpen(false)}
        />
      )}
    </div>
  );
}
