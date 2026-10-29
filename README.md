# Field Notes — Baseball Coaching Lab

A bilingual browser-based defensive play simulator for coaches and new players. **Play encyclopedia** keeps all 24 authored plays. **Dynamic simulator** generates ground balls, line drives, fly balls, high pop-ups and ordinary fair bunts from continuous field coordinates, the game situation, and coaching settings. Follow any of the nine defenders or individual runners and inspect every stage of the play. This is an instructional diagram, not a game or a prediction engine.

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

- Choose a category, then optionally a starting situation. Only situations with authored plays are offered. Changing a filter selects a compatible play if needed, so you never reach an unsupported base/out combination. Search matches English or the selected language, as well as scenario numbers.
- Choose a play from the matching library; its initial situation appears beneath the selectors. The count is available in a collapsible section.
- Use the English/日本語 selector to change all interface and coaching text. The language choice is remembered in this browser and switching languages preserves the current player, time, and play.
- Click a player, use the position buttons, or keyboard-focus an SVG player and press Enter/Space. The focus panel explains their current job, why it matters, and their next responsibility. Runner identities remain BR, R1, R2, and R3 for the entire play.
- Playback defaults to **Full play** for continuous animation. Select **Step by step** to animate to the next phase and pause for reading. Previous/next buttons beside the explanation and under the field move the same timeline and pause playback. The slider seeks in either direction. Restart restores the initial alignment. Playback speeds are 0.5×, 1× and 2×.
- Layer controls toggle labels, fielder paths, ball paths, runner paths and annotations. A focused player's current path stays visible to support teaching even when general paths are off.
- Gold circles are runners. Dark circles are defenders. The cream marker is the ball; a halo indicates possession. A red × means out and a green/gold ✓ means scored. Ghosted out/scored runners stay visible for review, rather than disappearing.

The field and playback controls fit in the viewport at the tested laptop, tablet and phone sizes. On desktop, the sidebars scroll independently. On phones, the field comes first, then the reading/player panels and the catalogue. Sections can collapse; the field preserves its proportions.

## Dynamic simulator

Switch modes using the compact buttons at the top. The encyclopedia remains available with its guided, supported-situation selection.

1. Set outs and any combination of runners. Count, inning/half, home/away scores and fielding team are supported; half and fielding team remain consistent automatically.
2. Choose a physical ball type, strength, runner aggression, runner speed and defensive strategy. Ordinary fair bunts are limited to 25 m and exclude squeezes. The recommended strategy can be applied or overridden.
3. Click fair territory or enter X/Y coordinates. Ground clicks aim a direction/depth; airborne clicks request the first untouched landing. The preview discloses launch constraints. Fielders intercept the moving ball; a click does not stop it. The projected-path layer shows the unobstructed continuation, height and interception.
4. Click **Generate play**. Draft edits pause and disable playback until generated, so the displayed play never silently changes to an unrelated input.
5. Use the same field, focus panel, reading arrows, step-by-step pauses and timeline as the encyclopedia. Optional path colors identify fielding, coverage, cutoff/relay and backup duties. The event log follows the current timeline position.
6. Change one input or the throwing target and generate again. Coach overrides include first, second, third, home, hold, and an outfield cutoff-and-hold. Coverage, throwing lanes, backups and runner choices are recalculated. An ill-advised throw can let trailing runners advance.

All generated coaching text is available in English and Japanese. The field and playback controls retain the compact viewport layout; the settings and teaching sidebars scroll independently on desktop. On phones, **Configure play** jumps to settings and generation returns to the field.

The simulator uses deterministic timing, not guaranteed outcomes. The field/throwing settings expose arm profiles, anticipated-bunt positioning and a provisional fence height. Default keep-in-play mode is a training net; standard mode applies the configured boundary height. No measured height is claimed for the home ground. Close plays are labeled. The simulator supports direct throws, cutoff returns, long relays, feasible ground-ball double-play attempts, force versus tag resolution, and third-out scoring rules. Cutoff conventions and youth timing assumptions are editable in code. See [dynamic engine architecture and limits](docs/DYNAMIC.md).

## Play catalogue

| #     | Situation and illustrated outcome                                   |
| ----- | ------------------------------------------------------------------- |
| 01–04 | Bases empty: SS, 2B, 3B and P ground balls, throws to first         |
| 05    | 1B fields away from first; P covers for a 3-1 putout                |
| 06–07 | R1, no outs: completed 6-4-3 and 4-6-3 double plays                 |
| 08    | R1, no outs: 5-4-3 attempt; R1 out, BR beats the relay              |
| 09    | R1, no outs: completed 1-6-3 double play                            |
| 10    | R2, no outs: SS checks R2 and takes the out at first                |
| 11    | R1, two outs: SS takes the third out at first                       |
| 12    | Loaded, one out: P–C–1B double play ends the inning                 |
| 13    | Bases empty: routine fly to CF                                      |
| 14    | R1, one out: fly to LF; R1 returns to first                         |
| 15    | R3, one out: deep fly to CF; legal tag-up and run                   |
| 16    | R3, no outs: shallow fly to LF; runner holds                        |
| 17    | R2, no outs: deep fly to RF; legal tag-up to third                  |
| 18    | R1/R2, one out: declared infield fly, caught; runners hold          |
| 19    | R1, no outs: line drive caught by SS; late return, appeal at first  |
| 20    | Bases empty: single to LF; BR stops at first                        |
| 21    | R1, no outs: deep single to RF; illustrative first-to-third advance |
| 22    | R2, one out: single to CF; illustrative advance home                |
| 23    | R1, no outs: sacrifice bunt to 3B, throw to 1B                      |
| 24    | R1, no outs: sacrifice bunt to 1B; 2B covers first                  |

Outcomes are scripted examples, not guarantees. Read each play's alternatives before teaching a conditional advance. For tag-ups this library waits for a completed catch; the rule permits leaving on first touch. The caught infield-fly example explains the different obligations if the ball drops. Appeal at first on the line drive requires retouch before the appeal, not a force or a tag of the runner.

Cutoff convention: 2B handles LF-to-middle returns, SS cuts RF-to-third throws, and 1B cuts CF-to-home throws, with SS protecting second. Other coaching systems are valid. Paths are schematic and times are teaching time, not measured sprint/throw speeds. No collision avoidance, physical ball flight, runner-speed calculation, or dynamic outcomes are modeled. Before using a local team's terminology or cutoff system, review and adapt the authored assignments with its coach.

## Project structure and extension

- `src/simulation/`: React-independent types, field geometry, interpolation, pure timeline sampler, provider contract and validation.
- `src/scenarios/author.ts`: phase authoring helpers; each phase stores movement paths, ball action, game state and player teaching snapshots.
- `src/scenarios/index.ts`: the 24 authored plays and tactical coverage choices.
- `src/hooks/usePlayback.ts`: requestAnimationFrame clock; it supplies time to the pure sampler.
- `src/components/BaseballField.tsx`: generic SVG renderer, unaware of scenario IDs.
- `src/App.tsx`: guided catalogue, situation controls, playback and teaching panels.
- `src/i18n/`: typed English/Japanese UI messages, Japanese coaching catalogue and translated sentence templates.
- `src/dynamic/`: generated play provider, movement/interception, defensive assignments, baserunning, throwing, events, bilingual message templates and timeline compilation.
- `src/tests/`: scripted and generated engine, translation and scenario integrity tests.

See [scenario authoring and architecture](docs/SCENARIOS.md). `ScriptedPlayProvider` and `DynamicPlayProvider` share the `PlayProvider` boundary and produce the same `PlayScenario` format. The sampler, SVG renderer and playback hook are shared; generated phases additionally carry structured assignments and event metadata. Teaching translations are applied at the display boundary without changing interpolation, play identities, or timeline execution. See [translation maintenance](docs/TRANSLATIONS.md).

## Browser smoke checks

An optional Playwright Core script uses an already installed Chromium; it does not download a browser. With the dev server running:

```sh
npm run test:browser
npm run test:dynamic:browser
# If needed:
CHROMIUM_PATH=/path/to/chromium APP_URL=http://127.0.0.1:5173 npm run test:browser
```

It verifies guided catalogue choices, synchronized explanation/field navigation, automatic pauses, continuous playback, scrubbing, player selection, all 24 plays in both languages, saved language preference, and viewport fit at six laptop/tablet/phone sizes. Screenshots are written under `/tmp`. On restricted cloud machines, starting a server and Chromium may require the platform's command approval. Unit tests do not require a browser.

## GitHub Pages

Run `npm run test:pages` after a build to verify that a plain static server can load the app both at a custom-domain root and under `/baseball/`. This check uses the same installed Chromium as the browser smoke test.

Vite uses `base: './'` and all assets are bundled locally. To deploy, enable GitHub Pages with **GitHub Actions** as source, push this project, then push to `main` (or manually run **Deploy to GitHub Pages**). The workflow runs automatically for every push to `main`. The workflow installs from the lockfile, runs tests, builds, and uploads `dist/`. The root `CNAME` is copied into the deployment artifact to preserve the custom domain. **Do not use “Deploy from a branch” with `main / (root)`: that publishes the development entry point instead of the compiled application and produces a blank screen.** After switching the Pages source to GitHub Actions, run the workflow once if the last push has already finished. For other static hosts, serve the contents of `dist/`.

## Current scope

All 24 scripted situations remain available in English and Japanese. Dynamic play supports continuous ground/air trajectories, interception, progressive airborne reads, legal tag-ups/retouches, conditional infield fly, ordinary fair bunts, coordinated base/backup/cutoff roles, complete double-play evaluation, target redirection and renewed opportunities after runner events. Surface and athletic parameters remain provisional. See [tactical corrections and evidence](docs/TACTICAL_CORRECTIONS.md).

Errors, bobbles, overthrows, squeezes/bunt pop-ups/foul-bunt strike rules, full rundowns, detailed body mechanics, custom individual defensive-position editing, quizzes, printouts and saved comparisons are not generated. The application models one ball in play, not a full match. Pending runs respect third-out rules. At the third out, runners and live decisions stop; defenders can finish a separate braking phase without starting a new tactical assignment.

No backend, external APIs, runtime network assets or accounts are required. Only the language preference is stored locally. GitHub Pages deployment and the existing custom domain configuration remain unchanged.
