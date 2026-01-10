
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

const PAGE_SIZE = 30;

export const Timeline: React.FC<Props> = ({ filter, live = true, isMoving = false, interactionMode }) => {
  const [events, setEvents] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestTimestamp = useRef<number | undefined>(undefined);
  const observerTarget = useRef<HTMLDivElement>(null);
  const filterString = JSON.stringify(filter);

  // モードを参照するためのRef。副作用内での最新値取得に使用。
  const modeRef = useRef(interactionMode);
  useEffect(() => { modeRef.current = interactionMode; }, [interactionMode]);

  const loadEvents = useCallback(async (isInitial: boolean = false) => {
    if (loading || (!isInitial && !hasMore)) return;

    setLoading(true);
    try {
      const currentFilter = { 
        ...filter, 
        limit: PAGE_SIZE,
        until: isInitial ? undefined : oldestTimestamp.current 
      };

      const fetched = await nostrService.fetchNotes(currentFilter);
      const newEvents = Array.from(fetched) as NDKEvent[];
      
      if (newEvents.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setEvents(prev => {
        const combined = isInitial ? newEvents : [...prev, ...newEvents];
        const uniqueMap = new Map();
        combined.forEach(e => uniqueMap.set(e.id, e));
        const sorted = Array.from(uniqueMap.values()).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        
        if (sorted.length > 0) {
          oldestTimestamp.current = sorted[sorted.length - 1].created_at;
        }
        return sorted;
      });
    } catch (e) {
      console.error("Timeline Load Error", e);
    } finally {
      setLoading(false);
    }
  }, [filter, loading, hasMore]);

  // フィルタ変更時の完全リセット
  useEffect(() => {
    setEvents([]);
    setHasMore(true);
    oldestTimestamp.current = undefined;
    loadEvents(true);
  }, [filterString]);

  // WebSocket持続購読: どのモードでも裏で最新情報をキャッチし続ける
  useEffect(() => {
    if (!live) return;

    const sub = nostrService.subscribe({ ...filter, limit: 1 }, (event) => {
      setEvents(prev => {
        if (prev.some(e => e.id === event.id)) return prev;
        const updated = [event, ...prev].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        return updated.slice(0, 400); // メモリ管理のため
      });
    });

    return () => {
      sub.stop();
    };
  }, [filterString, live]);

  // 無限スクロール
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
        rootMargin: '1000px'
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
            <span className="text-[10px] uppercase tracking-[0.4em] font-black italic">Receiving Signal...</span>
          </div>
        ) : hasMore ? (
          <div className="h-4 w-full" /> 
        ) : (
          <div className="p-10 text-center">
            <p className="text-[10px] uppercase tracking-widest opacity-20 font-black">Temporal Void End</p>
          </div>
        )}
      </div>
    </div>
  );
};
