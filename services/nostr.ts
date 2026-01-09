
import NDK, { NDKEvent, NDKUser, NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://nostr.wine',
  'wss://purplepag.es',
  'wss://relay.snort.social',
  'wss://relay.nostr.band'
];

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export interface RelayStatus {
  url: string;
  enabled: boolean;
  status: 'connecting' | 'connected' | 'disconnected';
  read?: boolean;
  write?: boolean;
}

class NostrService {
  public ndk: NDK;
  private signer: NDKNip07Signer | NDKPrivateKeySigner | null = null;
  public relayList: RelayStatus[] = [];
  public following: string[] = []; // フォロー中の公開鍵リスト
  public currentUser: NDKUser | null = null;

  constructor() {
    this.ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
    });
    this.relayList = DEFAULT_RELAYS.map(url => ({ url, enabled: true, status: 'connecting' }));
  }

  async init() {
    console.log("Initializing Nostr Service...");
    await this.ndk.connect(2000);
    this.updateRelayStatuses();
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
    console.log(`Fetching relay list (kind 10002) for ${user.pubkey}...`);
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
          try {
            this.ndk.addExplicitRelayUrl(r.url);
          } catch (e) {
            console.warn(`Could not add relay ${r.url}`, e);
          }
        });
        await this.ndk.connect(3000);
      }
    }
  }

  // kind:3 (Contact List) を取得してフォローリストを更新
  async fetchFollowing(user: NDKUser) {
    console.log(`Fetching following list (kind 3) for ${user.pubkey}...`);
    const contactEvent = await this.ndk.fetchEvent({
      kinds: [3],
      authors: [user.pubkey],
    });

    if (contactEvent) {
      const pTags = contactEvent.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
      this.following = pTags;
      console.log(`Following ${pTags.length} users.`);
    } else {
      this.following = [];
      console.warn("No kind 3 event found.");
    }
  }

  async loginWithExtension() {
    if (!(window as any).nostr) {
      alert("Nostr extension (NIP-07) not found. Please install Alby or Nos2x.");
      return null;
    }

    try {
      this.signer = new NDKNip07Signer();
      this.ndk.signer = this.signer;
      const user = await this.signer.user();
      this.currentUser = user;
      
      await user.fetchProfile();
      await this.fetchUserRelays(user);
      await this.fetchFollowing(user); // フォローリスト取得を追加
      
      return user;
    } catch (e) {
      console.error("Extension login failed:", e);
      return null;
    }
  }

  logout() {
    this.currentUser = null;
    this.following = [];
    this.signer = null;
    this.ndk.signer = undefined;
  }

  async fetchNotes(filter: any): Promise<Set<NDKEvent>> {
    return await this.ndk.fetchEvents(filter);
  }

  subscribe(filter: any, callback: (event: NDKEvent) => void) {
    const sub = this.ndk.subscribe(filter);
    sub.on('event', callback);
    return sub;
  }

  // Added toggleRelay method to fix the error in ProfileSettings.tsx
  async toggleRelay(url: string) {
    const relay = this.relayList.find(r => r.url === url);
    if (relay) {
      relay.enabled = !relay.enabled;
      if (relay.enabled) {
        try {
          this.ndk.addExplicitRelayUrl(url);
          await this.ndk.connect(2000);
        } catch (e) {
          console.warn(`Failed to connect to relay ${url}`, e);
        }
      }
      // Even when disabled, NDK pool manages its own lifecycle.
      // We update the local status to reflect the user's choice in UI.
      this.updateRelayStatuses();
    }
  }

  generateNewKey() {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    return { secret: bytesToHex(sk), public: pk };
  }
}

export const nostrService = new NostrService();
