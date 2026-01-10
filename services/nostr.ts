
import NDK, { NDKEvent, NDKUser, NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://nostr.wine',
  'wss://purplepag.es',
  'wss://relay.snort.social',
  'wss://relay.nostr.band'
];

const SESSION_KEY = 'nostrcube_session_pubkey';

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
  private notifyTimeout: any = null;

  constructor() {
    this.ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
    });
    this.relayList = DEFAULT_RELAYS.map(url => ({ url, enabled: true, status: 'connecting' }));
  }

  onAuthStateChange(callback: AuthListener) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    if (this.notifyTimeout) clearTimeout(this.notifyTimeout);
    this.notifyTimeout = setTimeout(() => {
      this.listeners.forEach(l => l());
      this.notifyTimeout = null;
    }, 100);
  }

  async init() {
    console.log("Initializing Nostr Service...");
    
    // タイムアウトを設けて、最悪リレーが繋がらなくてもUIは出す
    const connectPromise = this.ndk.connect(3000);
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 5000));

    try {
      await Promise.race([connectPromise, timeoutPromise]);
      this.updateRelayStatuses();

      const savedPubkey = localStorage.getItem(SESSION_KEY);
      if (savedPubkey) {
        const user = this.ndk.getUser({ pubkey: savedPubkey });
        this.currentUser = user;
        this.notify();
        
        user.fetchProfile().catch(() => {}).finally(() => this.notify());
        this.fetchUserRelays(user).catch(() => {}).finally(() => this.notify());
        this.fetchFollowing(user).catch(() => {}).finally(() => this.notify());
      }
    } catch (e) {
      console.error("Nostr Init Critical Error:", e);
    }
    return true; // 常に成功を返す
  }

  private updateRelayStatuses() {
    this.ndk.pool.relays.forEach(relay => {
      const found = this.relayList.find(r => r.url === relay.url);
      if (found) {
        found.status = relay.connectivity.status === 1 ? 'connected' : 'disconnected';
      }
    });
  }

  async fetchUserRelays(user: NDKUser) {
    try {
      const relayListEvent = await this.ndk.fetchEvent({
        kinds: [10002],
        authors: [user.pubkey],
      });

      if (relayListEvent) {
        const newRelays: RelayStatus[] = relayListEvent.tags
          .filter(tag => tag[0] === 'r')
          .map(tag => {
            const url = tag[1].endsWith('/') ? tag[1].slice(0, -1) : tag[1];
            const mode = tag[2];
            return {
              url,
              enabled: true,
              status: 'connecting',
              read: !mode || mode === 'read',
              write: !mode || mode === 'write'
            };
          });

        if (newRelays.length > 0) {
          this.relayList = newRelays;
          newRelays.forEach(r => {
            try { this.ndk.addExplicitRelayUrl(r.url); } catch (e) {}
          });
          await this.ndk.connect(1000);
        }
      }
    } catch (e) {}
  }

  async fetchFollowing(user: NDKUser) {
    try {
      const contactEvent = await this.ndk.fetchEvent({
        kinds: [3],
        authors: [user.pubkey],
      });
      if (contactEvent) {
        this.following = contactEvent.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
      }
    } catch (e) {}
  }

  async loginWithExtension() {
    if (!(window as any).nostr) {
      alert("NIP-07 extension not found.");
      return null;
    }
    try {
      this.signer = new NDKNip07Signer();
      this.ndk.signer = this.signer;
      const user = await this.signer.user();
      this.currentUser = user;
      localStorage.setItem(SESSION_KEY, user.pubkey);
      this.notify();

      user.fetchProfile().then(() => this.notify());
      this.fetchUserRelays(user).then(() => this.notify());
      this.fetchFollowing(user).then(() => this.notify());
      
      return user;
    } catch (e) {
      console.error("Login failed:", e);
      return null;
    }
  }

  logout() {
    this.currentUser = null;
    this.following = [];
    this.signer = null;
    this.ndk.signer = undefined;
    localStorage.removeItem(SESSION_KEY);
    this.notify();
  }

  async fetchNotes(filter: any): Promise<Set<NDKEvent>> {
    try {
      return await this.ndk.fetchEvents(filter);
    } catch (e) {
      return new Set();
    }
  }

  subscribe(filter: any, callback: (event: NDKEvent) => void) {
    const sub = this.ndk.subscribe(filter);
    sub.on('event', callback);
    return sub;
  }

  async toggleRelay(url: string) {
    const relay = this.relayList.find(r => r.url === url);
    if (relay) {
      relay.enabled = !relay.enabled;
      if (relay.enabled) {
        try {
          this.ndk.addExplicitRelayUrl(url);
          await this.ndk.connect(1000);
        } catch (e) {}
      }
      this.updateRelayStatuses();
    }
  }
}

export const nostrService = new NostrService();
