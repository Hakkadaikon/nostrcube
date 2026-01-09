
import React, { useState, useEffect } from 'react';
import { nostrService, RelayStatus } from '../services/nostr';
import { User, Key, Server, LogOut, CheckCircle2, Wifi, WifiOff, RefreshCcw, ArrowLeft, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';

export const ProfileSettings: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(nostrService.currentUser);
  const [view, setView] = useState<'main' | 'relays'>('main');
  const [relays, setRelays] = useState<RelayStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    setRelays([...nostrService.relayList]);
  }, [view]);

  const handleNip07 = async () => {
    setIsLoggingIn(true);
    try {
      const user = await nostrService.loginWithExtension();
      if (user) {
        setCurrentUser(user);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    nostrService.logout();
    setCurrentUser(null);
  };

  const handleToggleRelay = async (url: string) => {
    await nostrService.toggleRelay(url);
    setRelays([...nostrService.relayList]);
  };

  const syncRelays = async () => {
    if (!currentUser) return;
    setRefreshing(true);
    try {
      await nostrService.fetchUserRelays(currentUser);
      setRelays([...nostrService.relayList]);
    } finally {
      setRefreshing(false);
    }
  };

  if (view === 'relays') {
    return (
      <div className="p-6 max-w-3xl mx-auto w-full space-y-6">
        <header className="flex items-center gap-4 mb-8">
            <button 
                onClick={() => setView('main')}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
            >
                <ArrowLeft size={24} />
            </button>
            <div>
                <h3 className="text-xl font-bold text-zinc-100">Relay Management</h3>
                <p className="text-sm text-zinc-500">Configured via NIP-65 or defaults</p>
            </div>
            <button 
                onClick={syncRelays}
                disabled={refreshing}
                className="ml-auto p-2 bg-blue-600/10 text-blue-400 rounded-lg hover:bg-blue-600/20 transition-all disabled:opacity-50"
                title="Sync from kind:10002"
            >
                <RefreshCcw size={20} className={refreshing ? "animate-spin" : ""} />
            </button>
        </header>

        <div className="space-y-3">
          {relays.map((relay) => (
            <div key={relay.url} className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50 hover:border-zinc-600 transition-all">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${relay.enabled ? 'text-green-400 bg-green-400/10' : 'text-zinc-600 bg-zinc-800'}`}>
                  {relay.status === 'connected' ? <Wifi size={18} /> : <WifiOff size={18} />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-200 truncate max-w-[150px] md:max-w-md">{relay.url}</div>
                  <div className="flex gap-2 mt-0.5">
                    <span className={`text-[9px] uppercase font-black px-1.5 rounded border ${relay.status === 'connected' ? 'text-green-500 border-green-500/30' : 'text-zinc-600 border-zinc-700'}`}>
                      {relay.status}
                    </span>
                    {relay.read && <span className="text-[9px] text-blue-400 font-bold uppercase">Read</span>}
                    {relay.write && <span className="text-[9px] text-purple-400 font-bold uppercase">Write</span>}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleToggleRelay(relay.url)}
                className={`transition-colors ${relay.enabled ? 'text-blue-500' : 'text-zinc-600'}`}
              >
                {relay.enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>
          ))}
          {relays.length === 0 && (
            <div className="text-center py-12 text-zinc-600">No relays found. Sync to fetch your list.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      {currentUser ? (
        <div className="space-y-6">
          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-zinc-700 flex items-center gap-6">
            <img 
                src={currentUser.profile?.image || `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUser.pubkey}`} 
                alt="Avatar" 
                className="w-24 h-24 rounded-full border-4 border-blue-500/20 object-cover bg-zinc-900"
            />
            <div className="min-w-0 flex-1">
                <h3 className="text-2xl font-bold text-zinc-100 flex items-center gap-2 truncate">
                    {currentUser.profile?.displayName || currentUser.profile?.name || "Nostr Voyager"}
                    <CheckCircle2 size={20} className="text-blue-400 shrink-0" />
                </h3>
                <p className="text-zinc-400 font-mono text-xs break-all mt-1 opacity-60">{currentUser.pubkey}</p>
                <p className="text-zinc-500 mt-2 line-clamp-2 text-sm italic">{currentUser.profile?.about || "Searching for vibes in the decentralized void..."}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="flex items-center gap-3 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700 hover:border-zinc-500 transition-all text-left">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><User size={24} /></div>
                <div>
                    <div className="font-bold">Edit Profile</div>
                    <div className="text-xs text-zinc-500">Update metadata on-chain</div>
                </div>
            </button>
            <button 
                onClick={() => setView('relays')}
                className="flex items-center gap-3 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700 hover:border-zinc-500 transition-all text-left"
            >
                <div className="p-2 bg-green-500/10 rounded-lg text-green-400"><Server size={24} /></div>
                <div>
                    <div className="font-bold">Relay Pool</div>
                    <div className="text-xs text-zinc-500">Manage connections & NIP-65</div>
                </div>
            </button>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all font-bold"
          >
            <LogOut size={20} /> Logout
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-600">Enter the Cube</h2>
                <p className="text-zinc-500">Choose your authentication method to access Nostr</p>
            </div>

            <div className="w-full space-y-4">
                <button 
                    onClick={handleNip07}
                    disabled={isLoggingIn}
                    className="w-full p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-900/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
                >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="animate-spin" size={24} />
                        Waiting for Extension...
                      </>
                    ) : (
                      <>
                        <Key size={24} /> Use Browser Extension (NIP-07)
                      </>
                    )}
                </button>
            </div>
            
            <p className="text-center text-xs text-zinc-600 max-w-xs leading-relaxed">
                By logging in, you are interacting with a decentralized protocol. Your relay list will be automatically fetched from kind:10002.
            </p>
        </div>
      )}
    </div>
  );
};
