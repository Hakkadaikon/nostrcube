# 🧊 Nostrcube: The Decentralized 3D Interface

**Nostrcube** is a next-generation web client designed to unlock the full potential of the decentralized SNS protocol "Nostr." It breaks the traditional concept of flat timelines, offering an intuitive hexahedral (six-sided) interface utilizing CSS 3D space.

---

## 🚀 Concept: "Navigate the Void"

In 2026, social networking has evolved from a simple stream of information into a "digital space" for the user. Nostrcube invites you into the cockpit of a cube floating in the deep abyss (The Void). Each face symbolizes a different aspect of the Nostr protocol, allowing you to instantly switch contexts by rotating the cube.

---

## 🌟 Key Features

### 1. 🧊 3D Cube Navigation
- **FRONT:** Home timeline, filtered by the users you follow.
- **BACK:** The Global stream, a public pulse of the entire network.
- **TOP:** An immersive editor dedicated to creating new notes (Compose).
- **BOTTOM:** Recent Reposts circulating through the network.
- **LEFT:** Real-time Notifications to keep you connected with interactions.
- **RIGHT:** Identity Management and relay configuration based on NIP-65.

### 2. 🔐 Advanced Nostr Authentication (NIP-07)
- **NIP-07 Compliant:** Secure login using browser extensions like Alby or Nos2x.
- **Dynamic Fetching:** Upon login, the app automatically retrieves your `kind:3` (Contact List) and `kind:10002` (Relay List) to provide an instantly personalized experience.

### 3. 📡 Intelligent Relay Management
- **NIP-65 Support:** Respects on-chain relay settings, accurately reflecting Read/Write modes.
- **Dynamic Toggles:** Real-time control of relay connections directly from the UI. Connection status is visualized with neon indicators on the `Wifi` icons.

### 4. 🎨 Cyber-Minimalist Design
- **Glassmorphism:** A deep UI utilizing heavy background blur and transparency.
- **Dynamic Glow:** Glyphs and borders pulse with light in sync with connection states and notifications.
- **Fluid Animation:** Smooth cube rotation animations based on physical easing.

---

## 🛠 Tech Stack

- **Framework:** React 19 (Strict Mode)
- **3D Engine:** CSS 3D Transforms & Perspective
- **Nostr SDK:** @nostr-dev-kit/ndk (High-level event handling)
- **Styling:** Tailwind CSS (Modern Grid, Arbitrary variants)
- **Icons:** Lucide React (Clean, minimal vector paths)
- **Date Handling:** date-fns (Localized relative timestamps)

---

## 📖 How to Use

1. **Initialization:** When the app starts, it automatically connects to a pool of default relays.
2. **Login:** Rotate to the Right face (Identity & Settings) and click "Use Browser Extension" to approve.
3. **Relay Sync:** After logging in, use the "Refresh" button in the relay management screen to sync your own `kind:10002` settings.
4. **Posting:** Enter your note on the Top face (Compose) and click the Publish button to broadcast to all connected Write relays.

---

## ⚡ Developer Information

### Directory Structure
- `/services`: `nostr.ts` (Core logic for NDK instance and Nostr communication)
- `/components`: UI Components (NoteCard, Timeline, CubeFaceWrapper, etc.)
- `/types`: Shared interface definitions across the project

### Customization
By adjusting the `getCubeRotation` function in `App.tsx`, you can change the rotation speed, easing, and initial perspective of the interface.

---

## 🛡 License
Nostrcube is provided as open-source, based on the spirit of a free and open decentralized web.

> "Your keys, your content. Your cube, your perspective."