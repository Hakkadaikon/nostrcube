
import React, { useState, useEffect, useCallback } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { nostrService } from '../services/nostr';
import { NoteCard } from './NoteCard';
import { Loader2 } from 'lucide-react';

interface Props {
  filter: any;
  live?: boolean;
}

export const Timeline: React.FC<Props> = ({ filter, live = true }) => {
  const [events, setEvents] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub: any;
    
    const loadInitial = async () => {
      setLoading(true);
      try {
        const fetched = await nostrService.fetchNotes(filter);
        // Fix: Explicitly cast Array.from result to NDKEvent[] to access 'created_at' property
        const eventsArray = Array.from(fetched) as NDKEvent[];
        setEvents(eventsArray.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)));
      } catch (e) {
        console.error("Failed to load timeline", e);
      } finally {
        setLoading(false);
      }
    };

    loadInitial();

    if (live) {
      sub = nostrService.subscribe(filter, (event) => {
        setEvents(prev => {
          if (prev.find(e => e.id === event.id)) return prev;
          const newList = [event, ...prev].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
          return newList.slice(0, 100); // Keep buffer reasonable
        });
      });
    }

    return () => {
      if (sub) sub.stop();
    };
  }, [JSON.stringify(filter), live]);

  if (loading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p>Connecting to Relays...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {events.map(event => (
        <NoteCard key={event.id} event={event} />
      ))}
      {events.length === 0 && !loading && (
        <div className="p-8 text-center text-zinc-500 italic">
          No notes found in the void.
        </div>
      )}
    </div>
  );
};
