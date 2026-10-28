# Field Notes — Baseball Coaching Lab

A browser-based defensive play simulator for coaches and new players. Select one of 24 authored plays, follow any of the nine defenders or individual runners, and inspect every stage of the play. This is an instructional diagram, not a game or a prediction engine.

## Run

Use Node.js 24 LTS (the environment was validated with 24.19.0) and npm.

```sh
npm install
npm run dev
```

The terminal reports the development server address. No accounts, keys, database, external fonts, or remote assets are required. After dependency installation, the app works without Internet access when served locally. It is not a service-worker offline/PWA installation.

```sh
npm test          # deterministic simulation and catalogue tests
npm run build    # TypeScript check and static production bundle in dist/
npm run preview  # serve the built bundle
```

Use `npm ci` rather than `npm install` for a repeatable lockfile installation.

## Coaching workflow

- Browse the library or search by title, situation, or scoring notation. Selecting a play populates the initial situation controls.
- Changing outs, runners, ball type, or direction filters for **exactly compatible** authored plays. An incompatible current play is clearly marked and playback is disabled until you choose a match or clear filters. The field remains labeled with the previously selected play; it never silently simulates the new situation.
- Balls and strikes are informational context and do not alter the script.
- Click open grass to map to a nearby authored region for the chosen ball type (95 SVG units). The application does not generate arbitrary plays; unsupported regions produce an explanation.
- Click a player, use the position buttons, or keyboard-focus an SVG player and press Enter/Space. The focus panel explains their current job, why it matters, and their next responsibility. Runner identities remain BR, R1, R2, and R3 for the entire play.
- Play/Pause runs the full play; phase arrows and phase buttons support step-by-step teaching. The slider seeks in either direction. Restart restores the initial alignment. Playback speeds are 0.5×, 1× and 2×.
- Layer controls toggle labels, fielder paths, ball paths, runner paths and annotations. A focused player's current path stays visible to support teaching even when general paths are off.
- Gold circles are runners. Dark circles are defenders. The cream marker is the ball; a halo indicates possession. A red × means out and a green/gold ✓ means scored. Ghosted out/scored runners stay visible for review, rather than disappearing.

On phones, the field and playback controls appear first. Situation, library and explanation sections follow. Sections can collapse; the field preserves its proportions.

## Play catalogue

| # | Situation and illustrated outcome |
|---|---|
| 01–04 | Bases empty: SS, 2B, 3B and P ground balls, throws to first |
| 05 | 1B fields away from first; P covers for a 3-1 putout |
| 06–07 | R1, no outs: completed 6-4-3 and 4-6-3 double plays |
| 08 | R1, no outs: 5-4-3 attempt; R1 out, BR beats the relay |
| 09 | R1, no outs: completed 1-6-3 double play |
| 10 | R2, no outs: SS checks R2 and takes the out at first |
| 11 | R1, two outs: SS takes the third out at first |
| 12 | Loaded, one out: P–C–1B double play ends the inning |
| 13 | Bases empty: routine fly to CF |
| 14 | R1, one out: fly to LF; R1 returns to first |
| 15 | R3, one out: deep fly to CF; legal tag-up and run |
| 16 | R3, no outs: shallow fly to LF; runner holds |
| 17 | R2, no outs: deep fly to RF; legal tag-up to third |
| 18 | R1/R2, one out: declared infield fly, caught; runners hold |
| 19 | R1, no outs: line drive caught by SS; late return, appeal at first |
| 20 | Bases empty: single to LF; BR stops at first |
| 21 | R1, no outs: deep single to RF; illustrative first-to-third advance |
| 22 | R2, one out: single to CF; illustrative advance home |
| 23 | R1, no outs: sacrifice bunt to 3B, throw to 1B |
| 24 | R1, no outs: sacrifice bunt to 1B; 2B covers first |

Outcomes are scripted examples, not guarantees. Read each play's alternatives before teaching a conditional advance. For tag-ups this library waits for a completed catch; the rule permits leaving on first touch. The caught infield-fly example explains the different obligations if the ball drops. Appeal at first on the line drive requires retouch before the appeal, not a force or a tag of the runner.

Cutoff convention: 2B handles LF-to-middle returns, SS cuts RF-to-third throws, and 1B cuts CF-to-home throws, with SS protecting second. Other coaching systems are valid. Paths are schematic and times are teaching time, not measured sprint/throw speeds. No collision avoidance, physical ball flight, runner-speed calculation, or dynamic outcomes are modeled. Before using a local team's terminology or cutoff system, review and adapt the authored assignments with its coach.

## Project structure and extension

- `src/simulation/`: React-independent types, field geometry, interpolation, pure timeline sampler, provider contract and validation.
- `src/scenarios/author.ts`: phase authoring helpers; each phase stores movement paths, ball action, game state and player teaching snapshots.
- `src/scenarios/index.ts`: the 24 authored plays and tactical coverage choices.
- `src/hooks/usePlayback.ts`: requestAnimationFrame clock; it supplies time to the pure sampler.
- `src/components/BaseballField.tsx`: generic SVG renderer, unaware of scenario IDs.
- `src/App.tsx`: catalogue, situation controls, playback and teaching panels.
- `src/tests/`: engine and scenario integrity tests.

See [scenario authoring and architecture](docs/SCENARIOS.md). For Version 2, inject another implementation of `PlayProvider` that returns the same `PlayScenario` schema. The sampler, SVG renderer and playback hook can remain unchanged. The current provider intentionally does not generate plays. Teaching text lives in scenario data/helpers and UI strings; it can be extracted into English/Japanese message catalogues without changing interpolation or timeline execution.

## Browser smoke checks

An optional Playwright Core script uses an already installed Chromium; it does not download a browser. With the dev server running:

```sh
npm run test:browser
# If needed:
CHROMIUM_PATH=/path/to/chromium APP_URL=http://127.0.0.1:5173 npm run test:browser
```

It verifies playback pause/restart, scrubbing, player selection, compatibility gating, all 24 final phases, and desktop/390px phone layouts. Screenshots are written under `/tmp`. On restricted cloud machines, starting a server and Chromium may require the platform's command approval. Unit tests do not require a browser.

## GitHub Pages

Vite uses `base: './'` and all assets are bundled locally. To deploy, enable GitHub Pages with **GitHub Actions** as source, push this project, then manually run the **Deploy to GitHub Pages** workflow from the default branch. The workflow installs from the lockfile, runs tests, builds, and uploads `dist/`. Nothing has been published by creating this project. For other static hosts, serve the contents of `dist/`.

## Current scope

All 24 requested situations are implemented. English only; no dynamic provider, tactical randomization, custom free-form plays, persistence, physics engine or online services. Ball-height arcs and literal running speeds are not modeled. Game-state base occupancy records the last established base during transit, and updates at authored resolution events; the SVG positions show actual in-transit locations. When the third out occurs, inning occupancy is cleared while markers remain for teaching. Automated checks establish structural consistency and expected scripted behavior; they are not a substitute for a coach's tactical review.
