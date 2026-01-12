
import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  title: string;
}

export const CubeFaceWrapper: React.FC<Props> = ({ children, className = "", title }) => {
  return (
    <div className={`w-full h-full flex flex-col bg-zinc-900 border border-zinc-800 relative overflow-hidden ${className}`}>
      <header className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <h2 className="text-xl font-bold tracking-tight text-zinc-100 uppercase italic">{title}</h2>
        <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto scroll-smooth">
        {children}
      </main>
    </div>
  );
};
