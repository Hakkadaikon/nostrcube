
import React, { useState, useEffect } from 'react';
import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Heart, Repeat, MessageSquare, ExternalLink } from 'lucide-react';

interface Props {
  event: NDKEvent;
}

export const NoteCard: React.FC<Props> = ({ event }) => {
  const [profile, setProfile] = useState<NDKUserProfile | null>(null);
  const [likes, setLikes] = useState(0);

  useEffect(() => {
    const fetchProfile = async () => {
      const user = event.author;
      await user.fetchProfile();
      setProfile(user.profile || null);
    };
    fetchProfile();
  }, [event.author]);

  const displayName = profile?.displayName || profile?.name || event.author.pubkey.slice(0, 8);
  const handle = profile?.name ? `@${profile.name}` : '';
  const avatar = profile?.image || `https://api.dicebear.com/7.x/identicon/svg?seed=${event.author.pubkey}`;

  // Simple Markdown-ish content parsing for images
  const renderContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.split(urlRegex).map((part, i) => {
      if (part.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
        return <img key={i} src={part} alt="nostr" className="mt-2 rounded-xl max-h-96 w-auto border border-zinc-800" />;
      }
      if (part.match(/^https?:\/\//)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{part}</a>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="p-4 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group">
      <div className="flex gap-3">
        <img src={avatar} alt={displayName} className="w-12 h-12 rounded-full bg-zinc-800 object-cover" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <span className="font-bold text-zinc-100 truncate">{displayName}</span>
            <span className="text-zinc-500 text-sm truncate">{handle}</span>
            <span className="text-zinc-600 text-xs ml-auto">
              {formatDistanceToNow(new Date(event.created_at! * 1000), { addSuffix: true, locale: ja })}
            </span>
          </div>
          <div className="text-zinc-300 whitespace-pre-wrap break-words leading-relaxed mb-3">
            {renderContent(event.content)}
          </div>
          <div className="flex items-center justify-between text-zinc-500 max-w-md">
            <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
              <MessageSquare size={18} />
              <span className="text-xs">0</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-green-400 transition-colors">
              <Repeat size={18} />
              <span className="text-xs">0</span>
            </button>
            <button 
                className="flex items-center gap-1.5 hover:text-pink-400 transition-colors"
                onClick={() => setLikes(l => l + 1)}
            >
              <Heart size={18} className={likes > 0 ? "fill-pink-400 text-pink-400" : ""} />
              <span className="text-xs">{likes}</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors">
              <ExternalLink size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
