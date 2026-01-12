
import NDK, { NDKEvent, NDKUser, NDKNip07Signer, NDKPrivateKeySigner, NostrEvent } from '@nostr-dev-kit/ndk';

const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://nostr.wine',
  'wss://purplepag.es',
  'wss://relay.snort.social',
  'wss://relay.nostr.band'
];

const SESSION_KEY = 'nostrcube_session_pubkey';
const FOLLOW_CACHE_KEY = 'nostrcube_follow_list';
const DB_NAME = 'nostrcube_cache';
const DB_VERSION = 1;
const STORE_NAME = 'events';

export interface RelayStatus {
  url: string;
  enabled: boolean;
  status: 'connecting' | 'connected' | 'disconnected';
  read?: boolean;
  write?: boolean;
}

type AuthListener = () => void;

class NostrService {
  public ndk: NDK;
  private signer: NDKNip07Signer | NDKPrivateKeySigner | null = null;
  public relayList: RelayStatus[] = [];
  public following: string[] = [];
  public currentUser: NDKUser | null = null;
  private listeners: AuthListener[] = [];
  private db: IDBDatabase | null = null;

  constructor() {
    this.ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
    });
    this.relayList = DEFAULT_RELAYS.map(url => ({ url, enabled: true, status: 'connecting' }));
    
    // 起動時にローカルストレージからフォローリストを即時復元
    const cachedFollows = localStorage.getItem(FOLLOW_CACHE_KEY);
    if (cachedFollows) {
      try { this.following = JSON.parse(cachedFollows); } catch (e) {}
    }
  }

  private async initDB(): Promise<IDBDatabase | null> {
    if (this.db) return this.db;
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('created_at', 'created_at', { unique: false });
            store.createIndex('kind', 'kind', { unique: false });
            store.createIndex('author', 'pubkey', { unique: false });
          }
        };
        request.onsuccess = (e: any) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        request.onerror = () => resolve(null); // エラー時はDBなしで進行
      } catch (e) {
        resolve(null);
      }
    });
  }

  public async cacheEvent(event: NDKEvent) {
    const db = await this.initDB();
    if (!db) return;
    try {
      const raw = event.rawEvent();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(raw);
    } catch (e) {}
  }

  public async getCachedEvents(filter: any, limit: number, until?: number): Promise<NDKEvent[]> {
    const db = await this.initDB();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('created_at');
        const events: NDKEvent[] = [];
        
        const upper = until ? until - 1 : Infinity;
        const range = IDBKeyRange.upperBound(upper);
        const request = index.openCursor(range, 'prev');

        request.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor && events.length < limit) {
            const raw = cursor.value as NostrEvent;
            let match = true;
            if (filter.kinds && !filter.kinds.includes(raw.kind)) match = false;
            if (filter.authors && !filter.authors.includes(raw.pubkey)) match = false;

            if (match) {
              events.push(new NDKEvent(this.ndk, raw));
            }
            cursor.continue();
          } else {
            resolve(events);
          }
        };
        request.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  onAuthStateChange(callback: AuthListener) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    setTimeout(() => {
      this.listeners.forEach(l => l());
    }, 0);
  }

  async init() {
    console.log("NostrService: Initializing system...");
    // DB初期化はバックグラウンドで行う
    this.initDB();
    
    // リレー接続
    this.ndk.connect(3000).catch(() => {});

    const savedPubkey = localStorage.getItem(SESSION_KEY);
    if (savedPubkey) {
      try {
        // NIP-07チェック (存在する場合のみ)
        if (typeof window !== 'undefined' && (window as any).nostr) {
          this.signer = new NDKNip07Signer();
          this.ndk.signer = this.signer;
        }
      } catch (e) {
        console.warn("Signer initialization bypassed.");
      }
      
      const user = this.ndk.getUser({ pubkey: savedPubkey });
      this.currentUser = user;
      
      // ユーザー情報の復旧は並列で行い、UIをブロックしない
      this.restoreUserData(user).catch(console.error);
    }
    
    return true;
  }

  private async restoreUserData(user: NDKUser) {
    try {
      await user.fetchProfile();
      this.notify();
      await this.fetchUserRelays(user);
      await this.fetchFollowing(user);
      this.notify();
    } catch (e) {
      console.error("User restoration background task error", e);
    }
  }

  async fetchUserRelays(user: NDKUser) {
    try {
      const relayListEvent = await this.ndk.fetchEvent({ kinds: [10002], authors: [user.pubkey] });
      if (relayListEvent) {
        const newRelays: RelayStatus[] = relayListEvent.tags
          .filter(tag => tag[0] === 'r')
          .map(tag => ({
            url: tag[1].endsWith('/') ? tag[1].slice(0, -1) : tag[1],
            enabled: true,
            status: 'connecting',
            read: !tag[2] || tag[2] === 'read',
            write: !tag[2] || tag[2] === 'write'
          }));

        if (newRelays.length > 0) {
          this.relayList = newRelays;
          newRelays.forEach(r => this.ndk.addExplicitRelayUrl(r.url));
          this.ndk.connect(1000).catch(() => {});
        }
      }
    } catch (e) {}
  }

  async fetchFollowing(user: NDKUser) {
    try {
      const contactEvent = await this.ndk.fetchEvent({
        kinds: [3],
        authors: [user.pubkey],
      }, { closeOnEose: true });

      if (contactEvent) {
        const followList = contactEvent.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
        this.following = followList;
        localStorage.setItem(FOLLOW_CACHE_KEY, JSON.stringify(followList));
        this.notify();
      }
    } catch (e) {}
  }

  async loginWithExtension() {
    if (typeof window === 'undefined' || !(window as any).nostr) return null;

    try {
      this.signer = new NDKNip07Signer();
      this.ndk.signer = this.signer;
      const user = await this.signer.user();
      this.currentUser = user;
      localStorage.setItem(SESSION_KEY, user.pubkey);
      await this.restoreUserData(user);
      this.notify();
      return user;
    } catch (e) {
      return null;
    }
  }

  logout() {
    this.currentUser = null;
    this.following = [];
    this.signer = null;
    this.ndk.signer = undefined;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(FOLLOW_CACHE_KEY);
    this.notify();
  }

  async fetchNotes(filter: any): Promise<Set<NDKEvent>> {
    try {
      const events = await this.ndk.fetchEvents(filter);
      events.forEach(ev => this.cacheEvent(ev));
      return events;
    } catch (e) {
      return new Set();
    }
  }

  subscribe(filter: any, callback: (event: NDKEvent) => void) {
    const sub = this.ndk.subscribe(filter);
    sub.on('event', (ev) => {
      this.cacheEvent(ev);
      callback(ev);
    });
    return sub;
  }

  async toggleRelay(url: string) {
    const relay = this.relayList.find(r => r.url === url);
    if (relay) {
      relay.enabled = !relay.enabled;
      if (relay.enabled) {
        this.ndk.addExplicitRelayUrl(url);
        this.ndk.connect(500).catch(() => {});
      }
      this.notify();
    }
  }
}

export const nostrService = new NostrService();
