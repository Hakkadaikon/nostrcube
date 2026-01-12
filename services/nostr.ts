
import NDK, { NDKEvent, NDKUser, NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://nostr.wine',
  'wss://purplepag.es',
  'wss://relay.snort.social'
];

// Helper to convert Uint8Array to hex string without using Buffer
const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

class NostrService {
  public ndk: NDK;
  private signer: NDKNip07Signer | NDKPrivateKeySigner | null = null;

  constructor() {
    this.ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
    });
  }

  async init() {
    await this.ndk.connect();
  }

  async loginWithExtension() {
    try {
      this.signer = new NDKNip07Signer();
      this.ndk.signer = this.signer;
      const user = await this.signer.user();
      await user.fetchProfile();
      return user;
    } catch (e) {
      console.error("Extension login failed", e);
      return null;
    }
  }

  async loginWithSecret(nsec: string) {
    try {
      this.signer = new NDKPrivateKeySigner(nsec);
      this.ndk.signer = this.signer;
      const user = await this.signer.user();
      await user.fetchProfile();
      return user;
    } catch (e) {
      console.error("Secret login failed", e);
      return null;
    }
  }

  logout() {
    this.signer = null;
    this.ndk.signer = undefined;
  }

  generateNewKey() {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    return { 
        secret: bytesToHex(sk), 
        public: pk 
    };
  }

  async fetchNotes(filter: any): Promise<Set<NDKEvent>> {
    return await this.ndk.fetchEvents(filter);
  }

  subscribe(filter: any, callback: (event: NDKEvent) => void) {
    const sub = this.ndk.subscribe(filter);
    sub.on('event', callback);
    return sub;
  }
}

export const nostrService = new NostrService();
