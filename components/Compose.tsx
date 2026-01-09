
import React, { useState } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { nostrService } from '../services/nostr';
import { Send, Image as ImageIcon, Smile, MapPin } from 'lucide-react';

export const Compose: React.FC = () => {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handlePost = async () => {
    if (!content.trim() || isSending) return;
    
    setIsSending(true);
    try {
      const event = new NDKEvent(nostrService.ndk);
      event.kind = 1;
      event.content = content;
      await event.publish();
      setContent('');
      alert("Note Published to Nostr!");
    } catch (e) {
      console.error(e);
      alert("Publish failed. Is your signer connected?");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto w-full">
      <div className="bg-zinc-800/50 rounded-2xl border border-zinc-700 p-4 shadow-xl">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening in the decentralverse?"
          className="w-full bg-transparent border-none text-xl text-zinc-100 placeholder-zinc-500 focus:ring-0 resize-none h-48 mb-4 font-light"
        />
        <div className="flex items-center justify-between border-t border-zinc-700 pt-4">
          <div className="flex gap-4 text-zinc-400">
            <button className="hover:text-blue-400 transition-colors"><ImageIcon size={22} /></button>
            <button className="hover:text-blue-400 transition-colors"><Smile size={22} /></button>
            <button className="hover:text-blue-400 transition-colors"><MapPin size={22} /></button>
          </div>
          <button
            onClick={handlePost}
            disabled={!content.trim() || isSending}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all ${
              content.trim() && !isSending 
                ? "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20" 
                : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {isSending ? "Publishing..." : "Publish"}
            <Send size={18} />
          </button>
        </div>
      </div>

      <div className="mt-8 bg-zinc-800/20 p-4 rounded-xl border border-zinc-800 text-sm text-zinc-500 italic">
        Tip: You can use Markdown and direct image URLs. Images will automatically render.
      </div>
    </div>
  );
};
