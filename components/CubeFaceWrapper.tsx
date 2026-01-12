
import React, { useRef } from 'react';
import { Plus } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  className?: string;
  title: string;
  isScrollable?: boolean;
  onActionClick?: () => void;
}

export const CubeFaceWrapper: React.FC<Props> = ({ 
  children, 
  className = "", 
  title, 
  isScrollable = true,
  onActionClick 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`w-full h-full flex flex-col border border-white/10 relative overflow-hidden transition-colors duration-500 ${className}`}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/60 backdrop-blur-3xl sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black tracking-tighter text-zinc-100 uppercase italic opacity-90">{title}</h2>
          <div className={`w-2 h-2 rounded-full transition-all duration-500 ${isScrollable ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-blue-500 shadow-[0_0_12px_#3b82f6]'}`}></div>
        </div>
        
        {onActionClick && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onActionClick();
            }}
            className="group relative flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] active:scale-90"
            title="Broadcast Note"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
            <div className="absolute inset-0 rounded-xl bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 origin-center"></div>
          </button>
        )}
      </header>
      <main 
        ref={scrollRef}
        className={`flex-1 overflow-x-hidden scroll-smooth bg-transparent scroll-content ${isScrollable ? 'overflow-y-auto pointer-events-auto' : 'overflow-y-hidden'}`}
      >
        {children}
      </main>
    </div>
  );
};
