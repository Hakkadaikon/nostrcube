
import React from 'react';
import { NDKUser } from '@nostr-dev-kit/ndk';
import { User, Server, CheckCircle2, ShieldAlert } from 'lucide-react';

interface Props {
  currentUser: NDKUser | null;
}

export const ProfileSettings: React.FC<Props> = ({ currentUser }) => {
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="p-6 bg-zinc-800/20 rounded-full mb-6 border border-zinc-800">
          <ShieldAlert size={48} className="text-zinc-600" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-200 mb-2">Guest Mode</h2>
        <p className="text-zinc-500 max-w-xs mx-auto">
          Please use the login button at the top of the screen to connect your Nostr identity.
        </p>
      </div>
    );
  }

  const profile = currentUser.profile;
  const avatar = profile?.image || `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUser.pubkey}`;

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <div className="space-y-6">
        <div className="bg-zinc-800/50 rounded-2xl p-6 border border-zinc-700 flex flex-col md:flex-row items-center gap-6 shadow-2xl">
          <img 
              src={avatar} 
              alt="Avatar" 
              className="w-24 h-24 rounded-full border-4 border-blue-500/20 object-cover bg-zinc-900"
          />
          <div className="text-center md:text-left flex-1 min-w-0">
              <h3 className="text-2xl font-bold text-zinc-100 flex items-center justify-center md:justify-start gap-2">
                  {profile?.displayName || profile?.name || "Nostr Voyager"}
                  <CheckCircle2 size={20} className="text-blue-400 flex-shrink-0" />
              </h3>
              <p className="text-zinc-400 font-mono text-xs break-all mt-1 bg-black/30 p-1 rounded inline-block">
                {currentUser.pubkey.slice(0, 16)}...{currentUser.pubkey.slice(-16)}
              </p>
              <p className="text-zinc-500 mt-2 line-clamp-3 italic">
                {profile?.about || "Exploring the protocol..."}
              </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="flex items-center gap-3 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50 transition-all text-left group">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform"><User size={24} /></div>
              <div>
                  <div className="font-bold">Edit Profile</div>
                  <div className="text-xs text-zinc-500">Update metadata on-chain</div>
              </div>
          </button>
          <button className="flex items-center gap-3 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50 transition-all text-left group">
              <div className="p-2 bg-green-500/10 rounded-lg text-green-400 group-hover:scale-110 transition-transform"><Server size={24} /></div>
              <div>
                  <div className="font-bold">Relay Pool</div>
                  <div className="text-xs text-zinc-500">Configure connected relays</div>
              </div>
          </button>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3 px-1">Active Session Info</h4>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-600">Protocol</span>
              <span className="text-blue-400">NIP-07 / NDK</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-600">NIP-05</span>
              <span className={profile?.nip05 ? "text-green-400" : "text-zinc-700"}>
                {profile?.nip05 || "Not verified"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
