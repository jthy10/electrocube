# ELECTROCUBE

**Charge. Chain. Bank. Break.**

Electrocube is a fast, neon-soaked 3D score-attack game that runs entirely in the browser. Pilot an energized cube through a procedural sci-fi arena, collect charge shards, preserve a combo, bank completed circuits at the central reactor, and survive increasingly aggressive hunter drones for 90 seconds.

Play solo, challenge an instant simulated rival at three difficulty levels, or open a six-character room and race one player over a direct WebRTC data link. No account, API key, database, or game server is required.

## The objective

Every run is a short risk/reward loop:

1. **Collect shards.** Follow the bright beacon through the requested circuit colors. Off-color shards still score and charge the core; rare ringed shards restore shields or reset dash.
2. **Keep the chain alive.** Consecutive pickups raise the multiplier up to `x5`; taking damage or letting the timer expire breaks it.
3. **Complete the circuit.** Collect the current shard target, then return to the glowing reactor in the arena center.
4. **Bank the circuit.** Banking locks in a wave-scaled bonus, restores a shield, adds charge, raises the wave, and increases the next target.
5. **Survive and improvise.** Hunter drones, the rotating laser, the void wall, and faster waves cost score and shields. Volt gates provide speed, charge, and bonus signal.
6. **Spend Overdrive.** At 100% charge, fire a pulse to erase nearby hunters and score the takedowns.

The run ends after 90 seconds. In a duel, the higher score wins; both players can see live rival score, chain, charge, shields, and arena position.

## Controls

| Action | Keyboard / gamepad | Touch |
| --- | --- | --- |
| Move | `WASD` or arrow keys | On-screen directional pad |
| Phase dash | `Shift` or gamepad A | **Dash** button |
| Overdrive pulse | `Space` or gamepad B/X at 100% charge | **Pulse** button |
| Pause / resume | `Esc`, `P`, or the HUD pause button | HUD pause button |
| Menus | Mouse, touch, or keyboard navigation | Touch |

Dash has a short cooldown. The pulse consumes the full charge meter, so timing it around a dense hunter pack matters.

## Features

- Real-time 3D arena built with React Three Fiber and Three.js
- Procedural geometry, animated circuit shaders, particles, cube trails, shockwaves, lighting, bloom, and vignette
- A complete 90-second solo score-attack loop with escalating waves
- Instant deterministic Bot Clash rivals with easy, normal, and hard signal profiles
- Casual head-to-head duels through human-friendly room codes and shareable `?room=CODE` invite links
- Live rival snapshots, synchronized start signals, pulse-jam events, heartbeat monitoring, and rematch flow
- Callsigns plus five emissive player palettes
- Persistent sound and reduced-effects preferences
- Synthesized adaptive soundtrack and effects generated with the Web Audio API
- Responsive HUD and dedicated touch controls
- Seeded fictional legends plus a browser-local run leaderboard
- Persistent XP, levels, six rank tiers, achievements, cumulative stats, and unlockable trail cosmetics
- No required backend, environment variables, cookies, analytics SDK, or user account

## Run locally

### Requirements

- Node.js 22.12 or newer (Node 24 is recommended)
- npm 10 or newer
- A modern browser with WebGL 2; WebRTC is additionally required for duels

```bash
git clone https://github.com/jthy10/electrocube.git
cd electrocube
npm ci
npm run dev
```

Vite serves the app at `http://localhost:5173` by default and also exposes it on the local network. The first click or tap unlocks browser audio.

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run lint` | Run ESLint across the project |
| `npm run build` | Type-check and create the production bundle in `dist/` |
| `npm run preview` | Serve the production bundle at `http://localhost:4173` |
| `npm run check` | Run lint and a production build |

There are no `.env` values to configure for the current implementation.

## Private WebRTC duels

Choose **Create duel** to reserve a six-character code. The other player can enter that code or open the copied invite URL. A room accepts one rival, and the host launches the synchronized run after the direct link is ready.

The current multiplayer mode is intentionally lightweight:

- PeerJS uses its public signaling service to introduce the browsers. Once negotiated, gameplay messages use a WebRTC data channel and are transport-encrypted between peers.
- The app sends only duel data: callsign, selected color, live position/rotation, score, combo, charge, shields, start/finish events, pulse events, rematch/leave messages, and heartbeat timing. It never requests a camera or microphone.
- A room code is a convenient locator, **not authentication or a security boundary**. Share it only with the intended rival.
- WebRTC can expose connection metadata, including network addresses, to the signaling infrastructure and the connected peer. Do not treat a duel as anonymous.
- Strict NATs, managed networks, VPNs, content blockers, or firewalls may prevent the direct link. This app does not configure a dedicated TURN relay.
- Rooms are ephemeral. Refreshing or closing the host tab destroys the room, and there is no durable reconnect, spectator mode, public matchmaking, or match history service.
- Each browser simulates and reports its own run. There is no authoritative server, identity verification, anti-cheat validation, Elo system, or globally ranked competitive queue.
- A Vercel deployment serves the static client but does not replace PeerJS signaling or add a multiplayer server.

These constraints make duels best suited to quick games with someone you know.

## Leaderboard and saved data

The leaderboard is local, not global. It combines six built-in fictional rivals with up to 40 completed runs saved under `electrocube-leaderboard-v1` in browser `localStorage`. The results screen shows the leading entries, and storage events keep other tabs on the same origin in sync.

The callsign, cube color, sound setting, and reduced-effects setting are saved separately under `electrocube-profile-v1`. XP, achievements, stats, ranks, and trail unlocks use `electrocube-progression-v1`.

Nothing is uploaded by the leaderboard code. Scores do not sync between browsers, devices, domains, or private browsing sessions, and clearing site data resets saved runs and preferences.

## Architecture

| Area | Implementation |
| --- | --- |
| App shell | React 19 + TypeScript + Vite; `App.tsx` coordinates phases, audio, networking, persistence, and overlays |
| Rendering | React Three Fiber, Drei, Three.js, and postprocessing; `GameScene.tsx` runs the frame simulation while `Arena.tsx` builds the procedural environment |
| State | Zustand store for game phases and HUD state, with selective profile persistence |
| Multiplayer | A typed PeerJS wrapper with room normalization, protocol validation, single-rival admission, timeouts, and heartbeat/latency tracking |
| Leaderboard | Defensive `localStorage` parsing, seeded legends, local score recording, and cross-tab subscriptions |
| Progression | Persistent XP, rank tiers, achievements, run statistics, and selectable trail unlocks |
| Bot rivals | Seeded deterministic action timelines with bounded score pressure and three difficulty profiles |
| Audio | Lazy Web Audio oscillators, filtered noise, envelopes, panning, and a generated adaptive music loop |
| Input | Keyboard state plus pointer-safe virtual controls for touch devices |
| UI | Semantic React overlays with Lucide icons, accessible labels, status regions, dialogs, and reduced-effects support |

The game uses a client-only architecture. A production build is a static SPA and does not need serverless functions.

## Deploy to Vercel

### From the dashboard

1. Import `jthy10/electrocube` into Vercel.
2. Keep the detected framework preset as **Vite**.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Deploy without environment variables.

The committed `vercel.json` identifies the Vite framework. Room invites use a query string on the root page, so they load directly without custom server routing.

### From the CLI

```bash
npm ci
npm run check
npx vercel
npx vercel --prod
```

Vercel supplies HTTPS, which is the correct production context for WebRTC and clipboard-based invite sharing.

## Assets and licensing

Electrocube does not bundle stock imagery, commercial fonts, downloaded textures, third-party 3D models, samples, or recorded music. Arena geometry, materials, GLSL effects, particles, and audio are produced at runtime from project code, so there are no external media-asset attribution or licensing requirements.

Lucide icons and the JavaScript packages listed in `package.json` are open-source dependencies and remain subject to their own upstream licenses. This asset note does not replace those dependency licenses or define a license for the Electrocube source code itself.
