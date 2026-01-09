
import React, { useState, useEffect } from 'react';
import { CubeFace } from './types';
import { nostrService } from './services/nostr';
import { CubeFaceWrapper } from './components/CubeFaceWrapper';
import { Timeline } from './components/Timeline';
import { Compose } from './components/Compose';
import { ProfileSettings } from './components/ProfileSettings';
import { Home, Globe, Bell, User, PlusCircle, Repeat } from 'lucide-react';

const App: React.FC = () => {
  const [activeFace, setActiveFace] = useState<CubeFace>(CubeFace.FRONT);
  const [isInitialized, setIsInitialized] = useState(false);
  const [userStatus, setUserStatus] = useState<{ loggedIn: boolean, followingCount: number }>({
    loggedIn: false,
    followingCount: 0
  });

  useEffect(() => {
    const init = async () => {
      await nostrService.init();
      setIsInitialized(true);
    };
    init();
  }, []);

  // ProfileSettingsからのログイン状態の変更を検知するための簡易的なポーリング/チェック
  // 本来はEventBusやContextが望ましいですが、最小限の変更に留めます
  useEffect(() => {
    const interval = setInterval(() => {
      const loggedIn = !!nostrService.currentUser;
      const count = nostrService.following.length;
      if (loggedIn !== userStatus.loggedIn || count !== userStatus.followingCount) {
        setUserStatus({ loggedIn, followingCount: count });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [userStatus]);

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

  // Home Timeline用のフィルタを構築
  const getHomeFilter = () => {
    if (nostrService.currentUser && nostrService.following.length > 0) {
      return { kinds: [1], authors: nostrService.following, limit: 40 };
    }
    // 未ログインまたはフォロー0の場合は自分の投稿か、あるいは何も表示しない
    if (nostrService.currentUser) {
      return { kinds: [1], authors: [nostrService.currentUser.pubkey], limit: 40 };
    }
    return { kinds: [1], limit: 20 }; // ゲスト用
  };

  if (!isInitialized) {
    return (
        <div className="h-screen w-screen bg-black flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-blue-500 font-mono tracking-widest uppercase animate-pulse">Initializing Relay Pool</div>
        </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#050505]">
      {/* 3D Scene Container */}
      <div className="flex-1 relative perspective-[2000px] flex items-center justify-center p-4">
        
        {/* The Cube */}
        <div 
          className="relative w-full max-w-4xl h-full transition-transform duration-1000 cubic-bezier(0.4, 0, 0.2, 1)"
          style={{ 
            transformStyle: 'preserve-3d', 
            transform: getCubeRotation()
          }}
        >
          {/* Front Face: Home Timeline (Filtered by Following) */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(0deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title={userStatus.loggedIn ? `Following (${userStatus.followingCount})` : "Home Timeline"} className="bg-[#121212]">
              <Timeline filter={getHomeFilter()} key={`home-${userStatus.loggedIn}-${userStatus.followingCount}`} />
            </CubeFaceWrapper>
          </div>

          {/* Back Face: Global Timeline */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(180deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Global Timeline" className="bg-[#0f0f0f]">
              <Timeline filter={{ kinds: [1], limit: 50 }} />
            </CubeFaceWrapper>
          </div>

          {/* Left Face: Notifications */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(-90deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Notifications" className="bg-[#0c0d10]">
              <div className="p-12 text-center text-zinc-500">
                <Bell size={48} className="mx-auto mb-4 opacity-20" />
                <p>Real-time notifications will appear here as you interact with the network.</p>
              </div>
            </CubeFaceWrapper>
          </div>

          {/* Right Face: Profile & Settings */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(90deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Identity & Settings" className="bg-[#11100f]">
              <ProfileSettings />
            </CubeFaceWrapper>
          </div>

          {/* Top Face: Compose */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateX(90deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Create New Note" className="bg-[#0a0a0c]">
              <Compose />
            </CubeFaceWrapper>
          </div>

          {/* Bottom Face: Reposts */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateX(-90deg) translateZ(50vh)' }}>
            <CubeFaceWrapper title="Recent Reposts" className="bg-[#080808]">
              <Timeline filter={{ kinds: [6], limit: 20 }} />
            </CubeFaceWrapper>
          </div>
        </div>
      </div>

      {/* Floating Navigation Bar */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 p-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50">
        {navItems.map((item) => (
          <button
            key={item.face}
            onClick={() => setActiveFace(item.face)}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${
              activeFace === item.face 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-110 -translate-y-1" 
                : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
            }`}
          >
            <item.icon size={22} />
            <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* UI Overlay Decor */}
      <div className="fixed top-6 right-6 flex items-center gap-3 bg-white/5 backdrop-blur-md p-2 px-4 rounded-full border border-white/10 pointer-events-none">
        <div className="flex gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${userStatus.loggedIn ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 opacity-50'}`}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/40"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/40"></div>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 font-medium uppercase tracking-widest">
            {userStatus.loggedIn ? 'AUTH_SESSION_ACTIVE' : 'GUEST_MODE'}
        </span>
      </div>

      <style>{`
        .perspective-2000 { perspective: 2000px; }
        .backface-hidden { backface-visibility: hidden; }
        .cubic-bezier-custom { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>
    </div>
  );
};

export default App;
