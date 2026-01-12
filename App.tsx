
import React, { useState, useEffect } from 'react';
import { CubeFace } from './types';
import { nostrService } from './services/nostr';
import { CubeFaceWrapper } from './components/CubeFaceWrapper';
import { Timeline } from './components/Timeline';
import { Compose } from './components/Compose';
import { ProfileSettings } from './components/ProfileSettings';
import { NDKUser } from '@nostr-dev-kit/ndk';
import { 
  Home, Globe, Bell, User, PlusCircle, Repeat, 
  LogIn, LogOut, ShieldCheck, Zap
} from 'lucide-react';

const App: React.FC = () => {
  const [activeFace, setActiveFace] = useState<CubeFace>(CubeFace.FRONT);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<NDKUser | null>(null);

  useEffect(() => {
    const init = async () => {
      await nostrService.init();
      setIsInitialized(true);
    };
    init();
  }, []);

  const handleLogin = async () => {
    const user = await nostrService.loginWithExtension();
    if (user) {
      setCurrentUser(user);
    } else {
      alert("NIP-07 Extension not found or login cancelled.");
    }
  };

  const handleLogout = () => {
    nostrService.logout();
    setCurrentUser(null);
  };

  const getCubeRotation = () => {
    switch (activeFace) {
      case CubeFace.FRONT: return 'rotateX(0deg) rotateY(0deg)';
      case CubeFace.BACK: return 'rotateX(0deg) rotateY(180deg)';
      case CubeFace.LEFT: return 'rotateX(0deg) rotateY(90deg)';
      case CubeFace.RIGHT: return 'rotateX(0deg) rotateY(-90deg)';
      case CubeFace.TOP: return 'rotateX(-90deg) rotateY(0deg)';
      case CubeFace.BOTTOM: return 'rotateX(90deg) rotateY(0deg)';
      default: return '';
    }
  };

  const navItems = [
    { face: CubeFace.TOP, icon: PlusCircle, label: 'Compose' },
    { face: CubeFace.LEFT, icon: Bell, label: 'Alerts' },
    { face: CubeFace.FRONT, icon: Home, label: 'Home' },
    { face: CubeFace.BACK, icon: Globe, label: 'Global' },
    { face: CubeFace.BOTTOM, icon: Repeat, label: 'Reposts' },
    { face: CubeFace.RIGHT, icon: User, label: 'Profile' },
  ];

  if (!isInitialized) {
    return (
        <div className="h-screen w-screen bg-black flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-blue-500 font-mono tracking-widest uppercase animate-pulse">Initializing Relay Pool</div>
        </div>
    );
  }

  const profile = currentUser?.profile;
  const displayName = profile?.displayName || profile?.name || "Nostr User";
  const avatar = profile?.image || `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUser?.pubkey || 'default'}`;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-950">
      {/* --- EXTERNAL UI OVERLAY --- */}
      
      {/* Top Header Overlay */}
      <div className="fixed top-0 left-0 right-0 p-6 flex items-center justify-between z-50 pointer-events-none">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3 bg-zinc-900/60 backdrop-blur-xl p-3 px-5 rounded-2xl border border-zinc-800 shadow-2xl pointer-events-auto">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap size={20} className="text-white fill-current" />
          </div>
          <span className="font-black text-xl italic tracking-tighter text-zinc-100 hidden sm:block">CUBE_OS</span>
        </div>

        {/* User / Login Area */}
        <div className="flex items-center gap-4 pointer-events-auto">
          {currentUser ? (
            <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-xl p-2 pr-4 rounded-full border border-zinc-800 shadow-2xl group transition-all hover:border-zinc-600">
              <img 
                src={avatar} 
                alt={displayName} 
                className="w-10 h-10 rounded-full border border-blue-500/50 object-cover bg-zinc-950" 
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-100 truncate max-w-[120px]">{displayName}</span>
                <span className="text-[10px] text-zinc-500 font-mono leading-tight">ACTIVE_SESSION</span>
              </div>
              <button 
                onClick={handleLogout}
                className="ml-2 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-2xl shadow-xl shadow-blue-900/20 transition-all hover:scale-105 active:scale-95"
            >
              <LogIn size={20} />
              <span>Login with NIP-07</span>
            </button>
          )}
        </div>
      </div>

      {/* Network Status Badge (Top Right Utility) */}
      <div className="fixed top-24 right-6 hidden lg:flex items-center gap-3 bg-zinc-900/30 backdrop-blur p-2 rounded-full border border-zinc-800/50 pointer-events-none">
        <div className="flex gap-1 px-1">
            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
            <div className="w-1 h-1 rounded-full bg-green-500 delay-75"></div>
            <div className="w-1 h-1 rounded-full bg-green-500 delay-150"></div>
        </div>
        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">RELAYS_STABLE</span>
      </div>

      {/* --- 3D SCENE --- */}
      <div className="flex-1 relative perspective-[2000px] flex items-center justify-center p-4">
        
        {/* The Cube */}
        <div 
          className="relative w-full max-w-4xl h-full transition-transform duration-1000 ease-in-out"
          style={{ 
            transformStyle: 'preserve-3d', 
            transform: getCubeRotation()
          }}
        >
          {/* Front Face: Home Timeline */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(0deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Home Timeline">
              <Timeline filter={{ kinds: [1], limit: 40 }} />
            </CubeFaceWrapper>
          </div>

          {/* Back Face: Global Timeline */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(180deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Global Timeline">
              <Timeline filter={{ kinds: [1], limit: 50 }} />
            </CubeFaceWrapper>
          </div>

          {/* Left Face: Notifications */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(-90deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Notifications">
              <div className="p-12 text-center text-zinc-500">
                <Bell size={48} className="mx-auto mb-4 opacity-20" />
                <p>Real-time notifications will appear here as you interact with the network.</p>
              </div>
            </CubeFaceWrapper>
          </div>

          {/* Right Face: Profile & Settings */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(90deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Identity & Settings">
              <ProfileSettings currentUser={currentUser} />
            </CubeFaceWrapper>
          </div>

          {/* Top Face: Compose */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateX(90deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Create New Note">
              <Compose />
            </CubeFaceWrapper>
          </div>

          {/* Bottom Face: Reposts */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateX(-90deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Recent Reposts">
              <Timeline filter={{ kinds: [6], limit: 20 }} />
            </CubeFaceWrapper>
          </div>
        </div>
      </div>

      {/* Floating Navigation Bar */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 p-2 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl z-50">
        {navItems.map((item) => (
          <button
            key={item.face}
            onClick={() => setActiveFace(item.face)}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all ${
              activeFace === item.face 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" 
                : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            <item.icon size={22} />
            <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        .perspective-2000 { perspective: 2000px; }
        .backface-hidden { backface-visibility: hidden; }
      `}</style>
    </div>
  );
};

export default App;
