
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CubeFace } from './types';
import { nostrService } from './services/nostr';
import { CubeFaceWrapper } from './components/CubeFaceWrapper';
import { Timeline } from './components/Timeline';
import { Compose } from './components/Compose';
import { ProfileSettings } from './components/ProfileSettings';
import { Home, Globe, Bell, User, Search, MousePointer2, Rotate3d, ChevronRight } from 'lucide-react';

const FRICTION = 0.96;
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
        // タイムアウト付きで初期化、失敗してもUIは出す
        const initPromise = nostrService.init();
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
        await Promise.race([initPromise, timeoutPromise]);
      } catch (e) {
        console.error("Nostr initialization failed but proceeding to UI", e);
      } finally {
        if (mounted) setIsInitialized(true);
      }
    };
    init();

    const unsubscribe = nostrService.onAuthStateChange(() => {
      if (mounted) setAuthVersion(v => v + 1);
    });

    return () => {
      mounted = false;
      unsubscribe();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

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
      rotation.current.x += velocity.current.x;
      rotation.current.y += velocity.current.y;
      velocity.current.x *= FRICTION;
      velocity.current.y *= FRICTION;
      setCurrentRot({ x: rotation.current.x, y: rotation.current.y });
      rafId.current = requestAnimationFrame(animate);
    } else {
      performAutoSnap();
      rafId.current = null;
    }
  };

  const startDragging = (x: number, y: number) => {
    isDragging.current = true;
    setIsMoving(true);
    velocity.current = { x: 0, y: 0 };
    lastPos.current = { x, y };
    if (!rafId.current) rafId.current = requestAnimationFrame(animate);
  };

  const moveDragging = (x: number, y: number) => {
    if (!isDragging.current) return;
    const dx = x - lastPos.current.x;
    const dy = y - lastPos.current.y;
    rotation.current.x += -dy * SENSITIVITY;
    rotation.current.y += dx * SENSITIVITY;
    velocity.current = { x: -dy * SENSITIVITY, y: dx * SENSITIVITY };
    setCurrentRot({ x: rotation.current.x, y: rotation.current.y });
    lastPos.current = { x, y };
  };

  const stopDragging = () => {
    isDragging.current = false;
    if (Math.sqrt(velocity.current.x ** 2 + velocity.current.y ** 2) <= SNAP_THRESHOLD) {
      setIsMoving(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'SPIN' || isSnapping.current || isComposeOpen || !isInitialized) return;
    if ((e.target as HTMLElement).closest('button, input, textarea, a, .scroll-content')) return;
    startDragging(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (mode !== 'SPIN' || isSnapping.current || isComposeOpen || !isInitialized) return;
    if ((e.target as HTMLElement).closest('button, input, textarea, a, .scroll-content')) return;
    const touch = e.touches[0];
    startDragging(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => moveDragging(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging.current) e.preventDefault();
      const touch = e.touches[0];
      moveDragging(touch.clientX, touch.clientY);
    };
    const handleMouseUp = () => stopDragging();
    const handleTouchEnd = () => stopDragging();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

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
      setIsNavVisible(false); // 移動完了時にメニューを閉じる
    }, 850);
  };

  const loggedIn = !!nostrService.currentUser;

  const homeFilter = useMemo(() => {
    if (loggedIn && nostrService.currentUser) {
      const authors = [nostrService.currentUser.pubkey, ...nostrService.following];
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
      opacity: (mode === 'SPIN' && !isActive) ? 0.3 : 1,
      transition: 'opacity 0.5s ease-in-out'
    };
  };

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="w-16 h-16 relative">
            <div className="absolute inset-0 border-2 border-blue-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin"></div>
        </div>
        <div className="mt-8 text-center">
            <p className="text-blue-500 font-mono text-[11px] tracking-[0.6em] uppercase animate-pulse">Syncing Neural Net...</p>
            <p className="text-zinc-600 text-[9px] mt-2 uppercase tracking-widest">Decrypting Relay Streams</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`h-screen w-screen overflow-hidden flex flex-col bg-[#050505] select-none text-white font-sans ${mode === 'SPIN' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      onDoubleClick={() => setMode(prev => prev === 'SPIN' ? 'SCROLL' : 'SPIN')}
    >
      {/* 画面右上のステータス表示 */}
      <div className="fixed top-6 right-6 z-[70] flex flex-col items-end gap-2 pointer-events-none">
        <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-2xl shadow-2xl">
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 font-black">System Mode</span>
            <span className={`text-sm font-black tracking-tighter uppercase italic flex items-center gap-2 ${mode === 'SPIN' ? 'text-blue-400' : 'text-emerald-400'}`}>
              {mode === 'SPIN' ? <Rotate3d size={16} /> : <MousePointer2 size={16} />}
              {mode}
            </span>
          </div>
          <div className={`w-1.5 h-10 rounded-full transition-all duration-500 ${mode === 'SPIN' ? 'bg-blue-500 shadow-[0_0_15px_#3b82f6]' : 'bg-emerald-500 shadow-[0_0_15px_#10b981]'}`} />
        </div>
      </div>

      <div 
        className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ perspective: '2000px', perspectiveOrigin: '50% 50%' }}
      >
        <div 
          className="relative w-[85vw] h-[85vw] max-w-[700px] max-h-[700px]"
          style={{ 
            transformStyle: 'preserve-3d', 
            transition: isSnapping.current ? 'transform 0.85s cubic-bezier(0.19, 1, 0.22, 1)' : 'none',
            transform: `translateZ(-600px) rotateX(${currentRot.x || 0}deg) rotateY(${currentRot.y || 0}deg)` 
          }}
        >
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(0deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.FRONT) }}>
            <CubeFaceWrapper title="Home" isScrollable={mode === 'SCROLL'} onActionClick={() => setIsComposeOpen(true)} className="bg-[#111]">
              <Timeline interactionMode={mode} isMoving={isMoving} filter={homeFilter} />
            </CubeFaceWrapper>
          </div>
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(180deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.BACK) }}>
            <CubeFaceWrapper title="Global" isScrollable={mode === 'SCROLL'} onActionClick={() => setIsComposeOpen(true)} className="bg-[#0a0a0a]">
              <Timeline interactionMode={mode} isMoving={isMoving} filter={globalFilter} />
            </CubeFaceWrapper>
          </div>
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(-90deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.LEFT) }}>
            <CubeFaceWrapper title="Alerts" isScrollable={mode === 'SCROLL'} className="bg-[#0d0d0e]">
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-4">
                <Bell size={64} className="opacity-10" />
                <p className="font-mono text-[10px] tracking-widest uppercase opacity-40">Zero Interference</p>
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
                    <Search size={64} className="opacity-5 mb-8" />
                    <input type="text" placeholder="Scanning Archive..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-center font-mono outline-none focus:border-blue-500/40 transition-all text-xl" />
                </div>
            </CubeFaceWrapper>
          </div>
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateX(-90deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.BOTTOM) }}>
            <CubeFaceWrapper title="Reposts" isScrollable={mode === 'SCROLL'} className="bg-[#090909]">
              <Timeline interactionMode={mode} isMoving={isMoving} filter={repostFilter} />
            </CubeFaceWrapper>
          </div>
        </div>
      </div>

      {isComposeOpen && <Compose onClose={() => setIsComposeOpen(false)} />}

      {/* インテリジェント・サイドメニュー */}
      <div 
        className="fixed left-0 top-0 h-full w-12 z-[100] group hidden md:block"
        onMouseEnter={() => setIsNavVisible(true)}
      />
      
      {/* モバイル用トリップ（左端をタップして表示） */}
      <div 
        className="fixed left-0 top-0 h-full w-4 z-[100] md:hidden active:bg-blue-500/10 transition-colors"
        onClick={() => setIsNavVisible(prev => !prev)}
      />

      <nav 
        onMouseLeave={() => setIsNavVisible(false)}
        className={`fixed left-0 top-1/2 -translate-y-1/2 flex flex-col gap-4 p-4 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-r-[3rem] z-[110] shadow-[20px_0_100px_rgba(0,0,0,0.9)] transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] ${
          isNavVisible ? 'translate-x-0' : '-translate-x-[90%] opacity-0 md:opacity-100'
        }`}
      >
        <div className="absolute top-1/2 -right-4 -translate-y-1/2 md:hidden">
            <button 
                onClick={() => setIsNavVisible(prev => !prev)}
                className="w-10 h-20 bg-blue-600/20 backdrop-blur-xl border border-white/10 rounded-r-2xl flex items-center justify-center text-blue-400"
            >
                <ChevronRight size={24} className={`transition-transform duration-500 ${isNavVisible ? 'rotate-180' : 'rotate-0'}`} />
            </button>
        </div>

        <div className="p-2 mb-2 flex justify-center">
            <div className={`w-1 h-8 rounded-full transition-all duration-500 ${mode === 'SCROLL' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-blue-500 shadow-[0_0_10px_#3b82f6]'}`} />
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
            className={`group relative flex flex-col items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-[2rem] transition-all duration-500 ${
              activeFace === item.face ? "bg-blue-600 text-white shadow-[0_0_40px_rgba(37,99,235,0.9)] scale-110" : "text-zinc-500 hover:bg-white/5"
            }`}
          >
            <item.icon size={24} className="group-hover:scale-110 transition-transform" />
            <span className="text-[8px] font-black mt-1.5 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 absolute left-full ml-4 bg-black/95 px-4 py-2 rounded-xl border border-white/10 pointer-events-none whitespace-nowrap shadow-2xl z-[120]">
                {item.label}
            </span>
          </button>
        ))}
      </nav>

      <style>{`
        .backface-hidden { 
          backface-visibility: hidden; 
          -webkit-backface-visibility: hidden; 
        }
        @media (max-width: 768px) {
          .backface-hidden {
             /* モバイルでの描画負荷軽減 */
             backface-visibility: visible;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
