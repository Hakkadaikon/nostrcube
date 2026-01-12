
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CubeFace } from './types';
import { nostrService } from './services/nostr';
import { CubeFaceWrapper } from './components/CubeFaceWrapper';
import { Timeline } from './components/Timeline';
import { Compose } from './components/Compose';
import { ProfileSettings } from './components/ProfileSettings';
import { Home, Globe, Bell, User, Search, MousePointer2, Rotate3d, ChevronRight, Key, LogOut, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';

const FRICTION = 0.95;
const SENSITIVITY = 0.4;
const SNAP_THRESHOLD = 0.15;
const Z_DISTANCE = 400; 

export type InteractionMode = 'SPIN' | 'SCROLL';

const App: React.FC = () => {
  const [activeFace, setActiveFace] = useState<CubeFace>(CubeFace.FRONT);
  const [isInitialized, setIsInitialized] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('SCROLL');
  const [isNavVisible, setIsNavVisible] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [currentRot, setCurrentRot] = useState({ x: 0, y: 0 });
  const rotation = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const isSnapping = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const timeout = new Promise(resolve => setTimeout(resolve, 3500));
        await Promise.race([nostrService.init(), timeout]);
      } catch (e) {
        console.warn("Init timeout/error, continuing to render...");
      } finally {
        if (mounted) setIsInitialized(true);
      }
    };
    init();

    const unsubscribe = nostrService.onAuthStateChange(() => {
      if (mounted) {
        setAuthVersion(v => v + 1);
        setLoginError(null);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      if (!(window as any).nostr) {
        throw new Error("NIP-07 extension (Alby, Nos2x, etc.) not found.");
      }
      const user = await nostrService.loginWithExtension();
      if (!user) {
        throw new Error("Authentication failed or cancelled.");
      }
    } catch (e: any) {
      console.error("Login error:", e);
      setLoginError(e.message);
      setTimeout(() => setLoginError(null), 5000);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    nostrService.logout();
  };

  const updateActiveFaceFromRotation = (x: number, y: number) => {
    const nx = Math.round(x / 90) * 90;
    const ny = Math.round(y / 90) * 90;
    const modX = ((nx % 360) + 360) % 360;

    if (modX === 90 || modX === 270) {
      setActiveFace(modX === 90 ? CubeFace.BOTTOM : CubeFace.TOP);
      return;
    }
    const modY = ((ny % 360) + 360) % 360;
    if (modY === 0) setActiveFace(CubeFace.FRONT);
    else if (modY === 90) setActiveFace(CubeFace.LEFT);
    else if (modY === 180) setActiveFace(CubeFace.BACK);
    else if (modY === 270) setActiveFace(CubeFace.RIGHT);
  };

  const performAutoSnap = () => {
    if (isSnapping.current) return;
    isSnapping.current = true;
    setIsMoving(true);
    
    const targetX = Math.round(rotation.current.x / 90) * 90;
    const targetY = Math.round(rotation.current.y / 90) * 90;
    const isVertical = Math.abs(targetX % 180) === 90;
    const finalY = isVertical ? Math.round(targetY / 360) * 360 : targetY;

    rotation.current = { x: targetX, y: finalY };
    setCurrentRot({ x: targetX, y: finalY });
    updateActiveFaceFromRotation(targetX, finalY);

    setTimeout(() => {
      isSnapping.current = false;
      setIsMoving(false);
    }, 850);
  };

  const animate = () => {
    if (isDragging.current) {
      rafId.current = requestAnimationFrame(animate);
      return;
    }
    if (isSnapping.current) {
      rafId.current = null;
      return;
    }

    const speed = Math.sqrt(velocity.current.x ** 2 + velocity.current.y ** 2);
    if (speed > SNAP_THRESHOLD) {
      rotation.current.x += (velocity.current.x || 0);
      rotation.current.y += (velocity.current.y || 0);
      velocity.current.x *= FRICTION;
      velocity.current.y *= FRICTION;
      setCurrentRot({ x: rotation.current.x, y: rotation.current.y });
      rafId.current = requestAnimationFrame(animate);
    } else {
      performAutoSnap();
      rafId.current = null;
    }
  };

  const startDrag = (x: number, y: number) => {
    isDragging.current = true;
    setIsMoving(true);
    velocity.current = { x: 0, y: 0 };
    lastPos.current = { x, y };
    if (!rafId.current) rafId.current = requestAnimationFrame(animate);
  };

  const moveDrag = (x: number, y: number) => {
    if (!isDragging.current) return;
    const dx = x - lastPos.current.x;
    const dy = y - lastPos.current.y;
    rotation.current.x += -dy * SENSITIVITY;
    rotation.current.y += dx * SENSITIVITY;
    velocity.current = { x: -dy * SENSITIVITY, y: dx * SENSITIVITY };
    setCurrentRot({ x: rotation.current.x, y: rotation.current.y });
    lastPos.current = { x, y };
  };

  const stopDrag = () => {
    isDragging.current = false;
    if (Math.sqrt(velocity.current.x ** 2 + velocity.current.y ** 2) <= SNAP_THRESHOLD) {
      setIsMoving(false);
    }
  };

  const snapToFace = (face: CubeFace) => {
    if (!isInitialized || isSnapping.current) return;
    setActiveFace(face);
    isSnapping.current = true;
    setIsMoving(true);
    setMode('SCROLL');
    
    let tx = Math.round(rotation.current.x / 360) * 360;
    let ty = Math.round(rotation.current.y / 360) * 360;

    switch (face) {
      case CubeFace.FRONT: break;
      case CubeFace.BACK: ty += 180; break;
      case CubeFace.LEFT: ty += 90; break;
      case CubeFace.RIGHT: ty -= 90; break;
      case CubeFace.TOP: tx -= 90; break;
      case CubeFace.BOTTOM: tx += 90; break;
    }
    
    rotation.current = { x: tx, y: ty };
    setCurrentRot({ x: tx, y: ty });
    
    setTimeout(() => { 
      isSnapping.current = false; 
      setIsMoving(false);
      setIsNavVisible(false);
    }, 850);
  };

  const currentUser = nostrService.currentUser;
  const loggedIn = !!currentUser;
  
  const homeFilter = useMemo(() => {
    if (loggedIn && currentUser) {
      const authors = [currentUser.pubkey, ...nostrService.following];
      return { kinds: [1], authors };
    }
    return { kinds: [1], limit: 50 };
  }, [loggedIn, authVersion, nostrService.following.length]);

  const globalFilter = useMemo(() => ({ kinds: [1], limit: 50 }), []);
  const repostFilter = useMemo(() => ({ kinds: [6], limit: 50 }), []);

  const getFaceStyle = (face: CubeFace) => {
    const isActive = activeFace === face;
    return {
      pointerEvents: (mode === 'SCROLL' && isActive) ? 'auto' as const : (mode === 'SPIN' ? 'auto' as const : 'none' as const),
      zIndex: isActive ? 10 : 1,
      opacity: (mode === 'SPIN' && !isActive) ? 0.2 : 1,
      transition: 'opacity 0.6s ease-in-out'
    };
  };

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="w-20 h-20 relative">
            <div className="absolute inset-0 border-4 border-blue-500/5 rounded-full"></div>
            <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-4 border-r-4 border-emerald-500 rounded-full animate-spin-slow"></div>
        </div>
        <div className="mt-12 text-center">
            <p className="text-blue-500 font-mono text-[10px] tracking-[0.8em] uppercase animate-pulse">Initializing Cube Interface</p>
            <p className="text-zinc-600 text-[9px] mt-3 uppercase tracking-widest opacity-50">Establishing Relay Connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`h-screen w-screen overflow-hidden flex flex-col bg-[#050505] select-none text-white font-sans ${mode === 'SPIN' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      onDoubleClick={() => setMode(prev => prev === 'SPIN' ? 'SCROLL' : 'SPIN')}
    >
      {/* 🚀 TOP-LEFT AUTH UNIT */}
      <div className="fixed top-6 left-6 z-[150] pointer-events-auto flex flex-col items-start gap-2">
        {!loggedIn ? (
          <div className="flex flex-col gap-2">
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="group relative flex items-center gap-4 bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Key size={20} className="group-hover:rotate-12 transition-transform" />
              )}
              <span className="font-black text-sm uppercase tracking-widest italic">Connect Nostr</span>
            </button>
            {loginError && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-[10px] font-bold uppercase tracking-tighter animate-in slide-in-from-left-4">
                <AlertTriangle size={14} />
                {loginError}
              </div>
            )}
          </div>
        ) : (
          <div className="group/profile relative flex items-center gap-4 bg-black/60 backdrop-blur-3xl border border-white/10 p-2 pr-6 rounded-3xl shadow-2xl hover:border-blue-500/30 transition-all">
            <div className="relative">
              <img 
                src={currentUser.profile?.image || `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUser.pubkey}`} 
                alt="Avatar" 
                className="w-12 h-12 rounded-2xl object-cover bg-zinc-900 border border-white/10 shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-black rounded-full" />
            </div>
            <div className="flex flex-col min-w-[120px] max-w-[200px]">
              <span className="font-black text-sm text-zinc-100 truncate flex items-center gap-1 leading-none mb-1">
                {currentUser.profile?.displayName || currentUser.profile?.name || "Voyager"}
                <ShieldCheck size={14} className="text-blue-400 shrink-0" />
              </span>
              <span className="text-[10px] text-blue-400/70 font-mono truncate leading-none">
                {currentUser.profile?.nip05 || `@${currentUser.pubkey.slice(0, 8)}`}
              </span>
            </div>
            
            {/* Logout Trigger */}
            <button 
              onClick={handleLogout}
              className="ml-2 p-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
              title="Disconnect"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>

      {/* 画面右上のモードステータス */}
      <div className="fixed top-6 right-6 z-[70] flex flex-col items-end gap-2 pointer-events-none">
        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-3xl border border-white/10 px-6 py-4 rounded-3xl shadow-2xl">
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-[0.4em] text-zinc-500 font-bold mb-1">Navigation</span>
            <span className={`text-base font-black tracking-tighter uppercase italic flex items-center gap-2 ${mode === 'SPIN' ? 'text-blue-400' : 'text-emerald-400'}`}>
              {mode === 'SPIN' ? <Rotate3d size={18} /> : <MousePointer2 size={18} />}
              {mode}
            </span>
          </div>
          <div className={`w-1 h-12 rounded-full transition-all duration-700 ${mode === 'SPIN' ? 'bg-blue-500 shadow-[0_0_20px_#3b82f6]' : 'bg-emerald-500 shadow-[0_0_20px_#10b981]'}`} />
        </div>
      </div>

      {/* 3D Cube Container */}
      <div 
        className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden"
        onMouseDown={(e) => {
            if (mode !== 'SPIN' || isComposeOpen) return;
            if ((e.target as HTMLElement).closest('button, input, textarea, a, .scroll-content, .fixed')) return;
            startDrag(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
        onMouseUp={() => stopDrag()}
        onMouseLeave={() => stopDrag()}
        onTouchStart={(e) => {
            if (mode !== 'SPIN' || isComposeOpen) return;
            if ((e.target as HTMLElement).closest('button, input, textarea, a, .scroll-content, .fixed')) return;
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchMove={(e) => {
            if (isDragging.current) e.preventDefault();
            moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchEnd={() => stopDrag()}
        style={{ perspective: '2000px', perspectiveOrigin: '50% 50%' }}
      >
        <div 
          className="relative w-[80vw] h-[80vw] max-w-[650px] max-h-[650px]"
          style={{ 
            transformStyle: 'preserve-3d', 
            transition: isSnapping.current ? 'transform 0.85s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            transform: `translateZ(-500px) rotateX(${currentRot.x || 0}deg) rotateY(${currentRot.y || 0}deg)` 
          }}
        >
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(0deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.FRONT) }}>
            <CubeFaceWrapper title="Home" isScrollable={mode === 'SCROLL'} onActionClick={() => setIsComposeOpen(true)} className="bg-[#0f0f10]">
              <Timeline interactionMode={mode} isMoving={isMoving} filter={homeFilter} />
            </CubeFaceWrapper>
          </div>
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(180deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.BACK) }}>
            <CubeFaceWrapper title="Global" isScrollable={mode === 'SCROLL'} onActionClick={() => setIsComposeOpen(true)} className="bg-[#080809]">
              <Timeline interactionMode={mode} isMoving={isMoving} filter={globalFilter} />
            </CubeFaceWrapper>
          </div>
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(-90deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.LEFT) }}>
            <CubeFaceWrapper title="Alerts" isScrollable={mode === 'SCROLL'} className="bg-[#0d0d0e]">
              <div className="flex flex-col items-center justify-center h-full text-zinc-700 space-y-6">
                <Bell size={80} className="opacity-5" />
                <p className="font-mono text-[10px] tracking-[0.5em] uppercase opacity-20">No Disturbances</p>
              </div>
            </CubeFaceWrapper>
          </div>
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(90deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.RIGHT) }}>
            <CubeFaceWrapper title="Identity" isScrollable={mode === 'SCROLL'} className="bg-[#121110]">
              <ProfileSettings key={`profile-${authVersion}`} />
            </CubeFaceWrapper>
          </div>
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateX(90deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.TOP) }}>
            <CubeFaceWrapper title="Search" isScrollable={mode === 'SCROLL'} className="bg-[#050506]">
                <div className="flex flex-col items-center justify-center h-full p-12">
                    <Search size={80} className="opacity-5 mb-10" />
                    <input type="text" placeholder="Scanning Memory Grid..." className="w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center font-mono outline-none focus:border-blue-500/50 transition-all text-2xl shadow-inner" />
                </div>
            </CubeFaceWrapper>
          </div>
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateX(-90deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.BOTTOM) }}>
            <CubeFaceWrapper title="Reposts" isScrollable={mode === 'SCROLL'} className="bg-[#09090a]">
              <Timeline interactionMode={mode} isMoving={isMoving} filter={repostFilter} />
            </CubeFaceWrapper>
          </div>
        </div>
      </div>

      {isComposeOpen && <Compose onClose={() => setIsComposeOpen(false)} />}

      {/* 左側サイドメニュー (インテリジェント・サイドバー) */}
      <div 
        className="fixed left-0 top-0 h-full w-8 z-[100] group hidden md:block"
        onMouseEnter={() => setIsNavVisible(true)}
      />
      
      {/* スマホ用トリガー (左端をタップ) */}
      <div 
        className="fixed left-0 top-0 h-full w-6 z-[100] md:hidden active:bg-blue-500/10 transition-colors"
        onClick={() => setIsNavVisible(prev => !prev)}
      >
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-0.5 h-32 bg-blue-500/30 rounded-full blur-sm animate-pulse" />
      </div>

      <nav 
        onMouseLeave={() => setIsNavVisible(false)}
        className={`fixed left-0 top-0 h-full flex flex-col gap-6 p-6 bg-black/80 backdrop-blur-3xl border-r border-white/10 z-[110] shadow-[30px_0_100px_rgba(0,0,0,0.9)] transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] ${
          isNavVisible ? 'translate-x-0' : '-translate-x-full opacity-0 md:opacity-100 md:-translate-x-[90%]'
        }`}
      >
        <div className="md:hidden self-end p-2 text-zinc-500">
          <ChevronRight className="rotate-180" size={24} />
        </div>

        <div className="flex flex-col items-center gap-1 mb-4 mt-20 md:mt-40">
            <div className={`w-1 h-12 rounded-full transition-all duration-700 ${mode === 'SCROLL' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
        </div>
        
        {[
          { face: CubeFace.FRONT, icon: Home, label: 'Home' },
          { face: CubeFace.BACK, icon: Globe, label: 'Global' },
          { face: CubeFace.LEFT, icon: Bell, label: 'Alert' },
          { face: CubeFace.TOP, icon: Search, label: 'Search' },
          { face: CubeFace.RIGHT, icon: User, label: 'Me' },
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={() => snapToFace(item.face)}
            className={`group relative flex flex-col items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-[2.5rem] transition-all duration-500 ${
              activeFace === item.face ? "bg-blue-600 text-white shadow-[0_0_50px_rgba(37,99,235,0.8)] scale-110" : "text-zinc-500 hover:bg-white/5"
            }`}
          >
            <item.icon size={28} className="group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-black mt-2 uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 absolute left-full ml-6 bg-black/95 px-5 py-3 rounded-2xl border border-white/10 pointer-events-none whitespace-nowrap shadow-2xl z-[120]">
                {item.label}
            </span>
          </button>
        ))}
        
        <div className="mt-auto flex flex-col items-center pb-6">
            <p className="text-[8px] text-zinc-600 font-mono tracking-widest uppercase [writing-mode:vertical-rl] opacity-40">Nostrcube v3.1</p>
        </div>
      </nav>

      <style>{`
        .backface-hidden { 
          backface-visibility: hidden; 
          -webkit-backface-visibility: hidden; 
        }
        @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
            animation: spin-slow 8s linear infinite;
        }
        @media (max-width: 768px) {
          .backface-hidden {
             backface-visibility: visible;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
