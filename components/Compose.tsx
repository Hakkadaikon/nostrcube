
import React, { useState } from 'react';
import { NDKEvent, NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { nostrService } from '../services/nostr';
import { Send, Image as ImageIcon, Smile, MapPin, X, AlertCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const Compose: React.FC<Props> = ({ onClose }) => {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePost = async () => {
    if (!content.trim() || isSending) return;
    
    setIsSending(true);
    setError(null);
    
    try {
      // NDKインスタンスに署名者がセットされているか確認、なければ試みる
      if (!nostrService.ndk.signer) {
        nostrService.ndk.signer = new NDKNip07Signer();
      }

      const event = new NDKEvent(nostrService.ndk);
      event.kind = 1;
      event.content = content;
      event.created_at = Math.floor(Date.now() / 1000);
      
      // 署名と送信
      await event.publish();
      
      // 成功したらIndexedDBにキャッシュして高速反映を補助
      await nostrService.cacheEvent(event);
      
      setContent('');
      onClose();
    } catch (e: any) {
      console.error("Publish failed:", e);
      setError(e.message || "Broadcast interrupted. Check your NIP-07 provider.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-6">
          <header className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black italic tracking-tighter uppercase text-zinc-100">Broadcast Note</h3>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </header>

          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Input neural signal..."
            autoFocus
            disabled={isSending}
            className="w-full bg-zinc-800/30 border border-white/5 rounded-2xl p-4 text-lg text-zinc-100 placeholder-zinc-600 focus:ring-1 focus:ring-blue-500/50 outline-none resize-none h-40 mb-2 font-light transition-all"
          />

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs font-mono mb-4 animate-in slide-in-from-top-1">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/5 pt-6">
            <div className="flex gap-4 text-zinc-500">
              <button className="hover:text-blue-400 transition-colors"><ImageIcon size={20} /></button>
              <button className="hover:text-blue-400 transition-colors"><Smile size={20} /></button>
              <button className="hover:text-blue-400 transition-colors"><MapPin size={20} /></button>
            </div>
            
            <button
              onClick={handlePost}
              disabled={!content.trim() || isSending}
              className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold transition-all ${
                content.trim() && !isSending 
                  ? "bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-900/40 scale-105 active:scale-95" 
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
            >
              {isSending ? "Syncing..." : "Transmit"}
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
