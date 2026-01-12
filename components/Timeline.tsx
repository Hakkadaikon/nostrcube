
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { nostrService } from '../services/nostr';
import { NoteCard } from './NoteCard';
import { Loader2 } from 'lucide-react';
import { InteractionMode } from '../App';

interface Props {
  filter: any;
  live?: boolean;
  isMoving?: boolean;
  interactionMode: InteractionMode;
}

const PAGE_SIZE = 50;

export const Timeline: React.FC<Props> = ({ filter, live = true, isMoving = false, interactionMode }) => {
  const [events, setEvents] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestTimestamp = useRef<number | undefined>(undefined);
  const observerTarget = useRef<HTMLDivElement>(null);
  const filterString = JSON.stringify(filter);

  const modeRef = useRef(interactionMode);
  useEffect(() => { modeRef.current = interactionMode; }, [interactionMode]);

  const mergeEvents = (prev: NDKEvent[], next: NDKEvent[]) => {
    const uniqueMap = new Map();
    [...prev, ...next].forEach(e => uniqueMap.set(e.id, e));
    const sorted = Array.from(uniqueMap.values()).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    
    if (sorted.length > 0) {
      oldestTimestamp.current = sorted[sorted.length - 1].created_at;
    }
    return sorted;
  };

  const loadEvents = useCallback(async (isInitial: boolean = false) => {
    if (loading || (!isInitial && !hasMore)) return;

    setLoading(true);
    try {
      let fetchedNetwork: NDKEvent[] = [];
      let fetchedCache: NDKEvent[] = [];

      if (isInitial) {
        // 1. まずIndexedDBから最新50件を即座にロード（UX向上）
        fetchedCache = await nostrService.getCachedEvents(filter, PAGE_SIZE);
        if (fetchedCache.length > 0) {
          setEvents(prev => mergeEvents(prev, fetchedCache));
        }

        // 2. リレーから最新50件をフェッチ（データの鮮度保証）
        const currentFilter = { ...filter, limit: PAGE_SIZE };
        const set = await nostrService.fetchNotes(currentFilter);
        fetchedNetwork = Array.from(set);
      } else {
        // 追加読み込み時: 過去のデータをIndexedDBから探す
        fetchedCache = await nostrService.getCachedEvents(filter, PAGE_SIZE, oldestTimestamp.current);
        
        if (fetchedCache.length < PAGE_SIZE) {
          // DBに十分なデータがない場合のみネットワークから取得
          const currentFilter = { 
            ...filter, 
            limit: PAGE_SIZE,
            until: oldestTimestamp.current 
          };
          const set = await nostrService.fetchNotes(currentFilter);
          fetchedNetwork = Array.from(set);
        }
      }

      const combinedNew = [...fetchedCache, ...fetchedNetwork];
      if (combinedNew.length < PAGE_SIZE && !isInitial) {
        setHasMore(false);
      }

      setEvents(prev => mergeEvents(prev, combinedNew));
    } catch (e) {
      console.error("Timeline Load Error", e);
    } finally {
      setLoading(false);
    }
  }, [filter, loading, hasMore]);

  useEffect(() => {
    setEvents([]);
    setHasMore(true);
    oldestTimestamp.current = undefined;
    loadEvents(true);
  }, [filterString]);

  useEffect(() => {
    if (!live) return;

    const sub = nostrService.subscribe({ ...filter, limit: 1 }, (event) => {
      setEvents(prev => {
        if (prev.some(e => e.id === event.id)) return prev;
        const updated = [event, ...prev].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        return updated.slice(0, 500); 
      });
    });

    return () => {
      sub.stop();
    };
  }, [filterString, live]);

  useEffect(() => {
    const scrollParent = observerTarget.current?.closest('.scroll-content');
    if (!scrollParent) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && events.length > 0 && modeRef.current === 'SCROLL') {
          loadEvents(false);
        }
      },
      { 
        root: scrollParent,
        threshold: 0.1, 
        rootMargin: '1200px'
      }
    );

    const target = observerTarget.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMore, loading, events.length, loadEvents]);

  return (
    <div className="flex flex-col divide-y divide-white/5 min-h-full">
      {events.map(event => (
        <NoteCard key={event.id} event={event} />
      ))}
      
      <div ref={observerTarget} className="py-24 flex flex-col items-center justify-center text-zinc-600 min-h-[200px]">
        {loading ? (
          <div className="flex items-center gap-4">
            <Loader2 className="animate-spin opacity-50 text-blue-500" size={20} />
            <span className="text-[10px] uppercase tracking-[0.4em] font-black italic">Synchronizing...</span>
          </div>
        ) : hasMore ? (
          <div className="h-4 w-full" /> 
        ) : (
          <div className="p-10 text-center">
            <p className="text-[10px] uppercase tracking-widest opacity-20 font-black">Memory Limit Reached</p>
          </div>
        )}
      </div>
    </div>
  );
};
