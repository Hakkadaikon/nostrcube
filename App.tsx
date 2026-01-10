
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CubeFace } from './types';
import { nostrService } from './services/nostr';
import { CubeFaceWrapper } from './components/CubeFaceWrapper';
import { Timeline } from './components/Timeline';
import { Compose } from './components/Compose';
import { ProfileSettings } from './components/ProfileSettings';
import { Home, Globe, Bell, User, Search, MousePointer2, Rotate3d, HelpCircle } from 'lucide-react';

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
  
  const cubeRef = useRef<HTMLDivElement>(null);
  const rotationState = useState({ x: 0, y: 0 }); // 描画同期のためのステート
  const [currentRot, setCurrentRot] = rotationState;

  const rotation = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const isSnapping = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await nostrService.init();
      if (mounted) {
        setIsInitialized(true);
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'SPIN' || isSnapping.current || isComposeOpen || !isInitialized) return;
    if ((e.target as HTMLElement).closest('button, input, textarea, a, .scroll-content')) return;

    isDragging.current = true;
    setIsMoving(true);
    velocity.current = { x: 0, y: 0 };
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (!rafId.current) rafId.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      const vx = -dy * SENSITIVITY;
      const vy = dx * SENSITIVITY;
      velocity.current = { x: vx, y: vy };
      rotation.current.x += vx;
      rotation.current.y += vy;
      setCurrentRot({ x: rotation.current.x, y: rotation.current.y });
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      if (Math.sqrt(velocity.current.x ** 2 + velocity.current.y ** 2) <= SNAP_THRESHOLD) {
        setIsMoving(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const snapToFace = (face: CubeFace) => {
    if (!isInitialized || isSnapping.current) return;
    setActiveFace(face);
    isSnapping.current = true;
    setIsMoving(true);
    setMode('SCROLL');
    velocity.current = { x: 0, y: 0 };
    
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
    }, 850);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, a')) return;
    setMode(prev => prev === 'SPIN' ? 'SCROLL' : 'SPIN');
  };

  const navItems = [
    { face: CubeFace.FRONT, icon: Home, label: 'Home' },
    { face: CubeFace.BACK, icon: Globe, label: 'Global' },
    { face: CubeFace.LEFT, icon: Bell, label: 'Alert' },
    { face: CubeFace.TOP, icon: Search, label: 'Search' },
    { face: CubeFace.RIGHT, icon: User, label: 'Me' },
  ];

  const loggedIn = !!nostrService.currentUser;

  const homeFilter = useMemo(() => (
    loggedIn && nostrService.following.length > 0 
      ? { kinds: [1], authors: nostrService.following } 
      : { kinds: [1] }
  ), [loggedIn, authVersion]);

  const globalFilter = useMemo(() => ({ kinds: [1] }), []);
  const repostFilter = useMemo(() => ({ kinds: [6] }), []);

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
        <div className="w-12 h-12 border-2 border-blue-500/10 border-t-blue-500 rounded-full animate-spin mb-6" />
        <p className="text-blue-500 font-mono text-[10px] tracking-[0.5em] uppercase animate-pulse">Synchronizing Nostr Mesh...</p>
      </div>
    );
  }

  return (
    <div 
      className={`h-screen w-screen overflow-hidden flex flex-col bg-[#050505] select-none text-white font-sans ${mode === 'SPIN' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      onDoubleClick={handleDoubleClick}
    >
      {/* HUD: Operations Guide */}
      <div className="fixed top-6 left-6 z-[70] group">
        <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl cursor-help hover:bg-black/80 transition-all">
          <HelpCircle size={16} className="text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Operational Logic</span>
        </div>
        <div className="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-white/10 p-5 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-y-[-10px] group-hover:translate-y-0">
          <div className="space-y-4">
            <div className="pb-2 border-b border-white/5">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500">Toggle Command</span>
                <p className="text-xs text-zinc-100 mt-1 font-bold italic">Double-Click anywhere to switch mode</p>
            </div>
            <div className="flex items-start gap-3">
              <Rotate3d size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Spin Mode</span>
                <p className="text-[11px] text-zinc-500 leading-relaxed italic">Drag empty space to reorient the app cube.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MousePointer2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Scroll Mode</span>
                <p className="text-[11px] text-zinc-500 leading-relaxed italic">Standard interaction with active face content.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HUD: Status Indicators */}
      <div className="fixed top-6 right-6 z-[70] flex flex-col items-end gap-2 pointer-events-none">
        <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-2xl shadow-2xl">
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 font-black">Interface State</span>
            <span className={`text-sm font-black tracking-tighter uppercase italic flex items-center gap-2 ${mode === 'SPIN' ? 'text-blue-400' : 'text-emerald-400'}`}>
              {mode === 'SPIN' ? <Rotate3d size={16} /> : <MousePointer2 size={16} />}
              {mode} ACTIVE
            </span>
          </div>
          <div className={`w-1.5 h-10 rounded-full transition-all duration-500 ${mode === 'SPIN' ? 'bg-blue-500 shadow-[0_0_15px_#3b82f6]' : 'bg-emerald-500 shadow-[0_0_15px_#10b981]'}`} />
        </div>
      </div>

      {/* Main Cube Viewport */}
      <div 
        className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        style={{ perspective: '2000px', perspectiveOrigin: '50% 50%' }}
      >
        <div 
          ref={cubeRef}
          className="relative w-[85vw] h-[85vw] max-w-[700px] max-h-[700px]"
          style={{ 
            transformStyle: 'preserve-3d', 
            transition: isSnapping.current ? 'transform 0.85s cubic-bezier(0.19, 1, 0.22, 1)' : 'none',
            transform: `translateZ(-600px) rotateX(${currentRot.x}deg) rotateY(${currentRot.y}deg)` 
          }}
        >
          {/* FRONT */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(0deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.FRONT) }}>
            <CubeFaceWrapper title="Home" isScrollable={mode === 'SCROLL'} onActionClick={() => setIsComposeOpen(true)} className="bg-[#111]">
              <Timeline interactionMode={mode} isMoving={isMoving} filter={homeFilter} />
            </CubeFaceWrapper>
          </div>
          {/* BACK */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(180deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.BACK) }}>
            <CubeFaceWrapper title="Global" isScrollable={mode === 'SCROLL'} onActionClick={() => setIsComposeOpen(true)} className="bg-[#0a0a0a]">
              <Timeline interactionMode={mode} isMoving={isMoving} filter={globalFilter} />
            </CubeFaceWrapper>
          </div>
          {/* LEFT */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(-90deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.LEFT) }}>
            <CubeFaceWrapper title="Alerts" isScrollable={mode === 'SCROLL'} className="bg-[#0d0d0e]">
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-4">
                <Bell size={64} className="opacity-10" />
                <p className="font-mono text-[10px] tracking-widest uppercase opacity-40">Frequency Stable</p>
              </div>
            </CubeFaceWrapper>
          </div>
          {/* RIGHT */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(90deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.RIGHT) }}>
            <CubeFaceWrapper title="Identity" isScrollable={mode === 'SCROLL'} className="bg-[#121110]">
              <ProfileSettings key={`profile-${authVersion}`} />
            </CubeFaceWrapper>
          </div>
          {/* TOP */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateX(90deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.TOP) }}>
            <CubeFaceWrapper title="Search" isScrollable={mode === 'SCROLL'} className="bg-[#050506]">
                <div className="flex flex-col items-center justify-center h-full p-12">
                    <Search size={64} className="opacity-5 mb-8" />
                    <input type="text" placeholder="Scanning network..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-center font-mono outline-none focus:border-blue-500/40 transition-all text-xl" />
                </div>
            </CubeFaceWrapper>
          </div>
          {/* BOTTOM */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateX(-90deg) translateZ(${Z_DISTANCE}px)`, transformStyle: 'preserve-3d', ...getFaceStyle(CubeFace.BOTTOM) }}>
            <CubeFaceWrapper title="Reposts" isScrollable={mode === 'SCROLL'} className="bg-[#090909]">
              <Timeline interactionMode={mode} isMoving={isMoving} filter={repostFilter} />
            </CubeFaceWrapper>
          </div>
        </div>
      </div>

      {isComposeOpen && <Compose onClose={() => setIsComposeOpen(false)} />}

      {/* Navigation: Vertical Left Sidebar */}
      <nav className="fixed left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 p-3 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[3rem] z-50 shadow-[20px_0_50px_rgba(0,0,0,0.7)] transition-all duration-700 hover:bg-black/90">
        <div className="p-2 mb-2 flex justify-center">
            <div className={`w-1 h-8 rounded-full transition-all duration-500 ${mode === 'SCROLL' ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-blue-500 shadow-[0_0_15px_#3b82f6]'}`} />
        </div>
        {navItems.map((item, idx) => (
          <button
            key={idx}
            onClick={() => snapToFace(item.face as CubeFace)}
            className={`group relative flex flex-col items-center justify-center w-16 h-16 rounded-[2rem] transition-all duration-500 ${
              activeFace === item.face ? "bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.8)] scale-110" : "text-zinc-500 hover:bg-white/5"
            }`}
          >
            <item.icon size={24} className="group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[8px] font-black mt-1.5 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all absolute -right-16 bg-black/90 px-3 py-1.5 rounded-lg border border-white/10 pointer-events-none whitespace-nowrap shadow-xl">{item.label}</span>
            <div className={`absolute left-0 w-1 h-5 bg-white rounded-full transition-all duration-500 ${activeFace === item.face ? 'opacity-100' : 'opacity-0 scale-y-0'}`} />
          </button>
        ))}
      </nav>

      <style>{`
        .backface-hidden { 
          backface-visibility: hidden; 
          -webkit-backface-visibility: hidden; 
        }
      `}</style>
    </div>
  );
};

export default App;
