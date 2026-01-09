
import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';

export enum CubeFace {
  FRONT = 'FRONT',   // Home Timeline
  BACK = 'BACK',     // Global Timeline
  LEFT = 'LEFT',     // Notifications
  RIGHT = 'RIGHT',   // Profile & Settings
  TOP = 'TOP',       // Compose
  BOTTOM = 'BOTTOM'  // Reposts
}

export interface NostrNote {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  kind: number;
  tags: string[][];
  user?: NDKUserProfile;
  event: NDKEvent;
}

export interface UserState {
  pubkey: string | null;
  profile: NDKUserProfile | null;
  following: string[];
}
