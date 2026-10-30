# Field Notes UX implementation

Implemented in the existing `work` checkout, 30 October 2026. No simulation-engine files, physics, defensive decisions, rules, or generated-result algorithms changed. The existing playback transport, timeline, speed, step navigation, reading panels and generation handler remain in place.

## Workflow

On a phone, enter Simulator, tap a legal field location, choose one of five hit types and three strengths in the bottom sheet, optionally toggle runners and outs beside the field, then press the single existing sticky Generate button. Done or Escape dismisses the sheet. The marker supports touch/mouse dragging, arrow keys (10 units), Shift+arrow (1 unit), and Enter/Space to reopen the editor. On very small phones, scroll within the sheet; Done stays visible. Short landscape screens place the field beside setup and playback.

On desktop, the same editor is anchored beside the marker, bounded by the field and viewport, with scrolling when necessary. Click another field point to reposition it; Done, Escape or a pointer click outside closes it. The existing sidebar Generate action remains the only generation control. Advanced Settings and Configure play expose the complete form.

Selecting a fielder preserves normal player selection and opens the existing responsibility panel as a nearby mobile drawer: Current job, Why and Next responsibility follow the existing playback phase. Clear/Escape returns focus to the player. This drawer applies only to Simulator; Encyclopedia retains its existing presentation.

## Shared settings and safeguards

| Quick control | Existing authoritative value |
| --- | --- |
| Field tap, marker drag and keyboard | `settings.ball.destination` |
| Five hit types / three strengths | `settings.ball.type` / `settings.ball.strength` |
| Base diamond | `settings.state.runners` (`R1`, `R2`, `R3`) |
| 0 / 1 / 2 outs | `settings.state.outs` |
| Generate | Existing `generate()`, validation and submission latch |

Every quick change uses the existing draft updater. The traditional form stays synchronized. Draft edits do not compile a new scenario; generated scoreboard values remain separate and are labeled as generated. Existing pending-playback protection and interception-overlay suppression remain intact. Trajectory overlays are labeled as draft previews.

Raw pointer coordinates are transformed through the SVG screen matrix, including letterboxing, scroll and resizing. Invalid taps/drags retain the last valid marker and use the existing error path. Hit-type changes never silently manufacture a legal quick-editor destination; an invalid distant bunt is explained and cannot generate. Ground/bunt aim and requested airborne landing remain distinct. Location help and launch-constraint notices explain the existing semantics.

The original mobile Generate bar retains ResizeObserver/visualViewport handling, safe-area padding, disabled loading text, spinner, contrast, error display and duplicate-submit prevention. The sheet uses its measured height and keyboard inset. On short screens the secondary comparison hint is hidden to keep the transport and action visible.

## Advanced Settings

All original controls remain: precision X/Y, traditional type/strength, runner checkboxes and outs, count, inning, batting half, fielding team, scores, strategy/recommendation, manual throw target, runner speed/aggression, arm profile, bunt anticipation, fence mode and height. Existing half/fielding-team coupling is preserved. The previous outdated scope note now accurately lists the already-supported ball types in both languages.

## Changed files

- `src/App.tsx`: compose field setup/editor, distinguish draft/generated context, manage editor and mobile focus dismissal.
- `src/components/FieldSetup.tsx` (new): shared-draft runner diamond and anchored/responsive quick editor.
- `src/components/BaseballField.tsx`: pointer capture, raw coordinate conversion, draggable/keyboard marker, player event isolation, marker touch target and accessible SVG group.
- `src/components/DynamicControls.tsx`: retain the complete form inside collapsed Advanced Settings; retain the original Generate bar.
- `src/styles.css`: popover/sheet, compact situation, safe-area/bar clearance, landscape layout and mobile focus drawer.
- `src/i18n/ui.ts`: complete English/Japanese labels, instructions and accessibility text.
- `scripts/field-ux-browser.mjs` (new), `package.json`: field UX browser suite and command.
- `scripts/dynamic-browser-smoke.mjs`, `scripts/mobile-generate-browser.mjs`: open the reorganized Advanced Settings and scope duplicated outs controls; retain the existing baseball assertions.
- `.github/workflows/defensive-v2.yml`: run the new suite and include its screenshots in the existing browser artifact.
- `FIELD_NOTES_UX_IMPLEMENTATION.md`: this report.

## Verification

All listed commands completed locally with exit code 0. Chromium required the execution environment's approved sandbox escalation to start the local server/browser; a CI fallback was unnecessary.

| Exact command | Final result |
| --- | --- |
| `npm test` | 13 files, **364 passed, 0 failed**; includes both 576-case matrices, authored translations and physical/rules/coaching suites |
| `npm test -- src/tests/localization.test.ts` | **28 passed, 0 failed**, repeated after final wording changes |
| `npm run build` | TypeScript and Vite passed |
| `npm run test:browser` | Passed: 24 English/Japanese authored plays, reading/field synchronization, step auto-pause, full playback, language persistence and six layouts |
| `npm run test:dynamic:browser` | Passed: physics/rules scenarios, draft protection, generation, playback, EN/JA and six layouts |
| `npm run test:mobile:browser` | Passed: four phone sizes, one sticky action, long-form clearance, invalid states, loading contrast, repeat prevention, EN/JA, desktop and Encyclopedia |
| `npm run test:field:browser` | **196 assertions passed, 0 failed** across five layouts, both languages, tap/edit/generate, keyboard, mouse/native touch drag, scroll/rotation coordinates, invalid tap/drag/bunt, draft runners/outs, focus, advanced persistence and edge anchoring |
| `npm run test:pages` | **2 hosting paths passed**, `/` and `/baseball/` |
| `npm run audit:defense:v2 -- --strict` | **2,522/2,522 generated**, strict exit 0; **0 Critical, 0 High**, 2,139 Medium advisory scenarios and 383 unflagged; 60 deterministic replays |
| `git diff --check` | Passed |

The strict audit's advisory findings are not a claim that all baseball decisions are certified correct. The generated audit summary is in `.browser-tests/field-ux/test-results/defensive-v2-summary.json`; its generated timestamp was not committed over the repository's baseline summary.

Browser sizes: **320×568, 375×667, 390×844, 844×390, 1366×768** for the new suite. Existing suites additionally cover laptop, tablet and larger desktop sizes. Checks include horizontal overflow and transport/Generate clearance, usable labels and pressed states, keyboard dismissal and focus return, semantic nonmodal editor, and bilingual validation. SVG interactive children are exposed as a group. Marker, editor and outs touch targets are about 44 CSS pixels; base buttons use diamond-shaped hit regions to avoid overlapping targets.

Inspected screenshots include English/Japanese phone tap → sheet → generated play, editable runners, mobile player focus and desktop popover. See `.browser-tests/field-ux/` (screenshots and `test-results/` logs); representative files:

- `editor-390x844-en.png`, `editor-390x844-ja.png`
- `generated-390x844-ja.png`, `generated-844x390-ja.png`
- `runners-375x667.png`, `focus-390x844.png`
- `editor-1366x768-en.png`, `editor-320x568-en.png`

## Limits and review status

Chromium mobile viewport/touch emulation was tested, including native touch events through CDP. Physical iOS Safari/Android Chrome, their software keyboards, hardware gestures, real notches and assistive-technology sessions were not available. visualViewport/safe-area infrastructure is retained, but those physical-device behaviors still merit device testing. Japanese completeness was tested automatically and visually; no independent native-speaking coaching review was performed.

No new dependencies, backend, save/share features or explicit editing/playback modes were introduced. The implementation passed the local checks above before deployment was requested. The user subsequently authorized deployment to `main`; pushing this implementation triggers the existing Pages deployment and Defensive V2 regression workflows. Deployment status and workflow links are reported separately after the push.

The projectless chat export directory is on a different filesystem and is unavailable in this managed environment. The requested report is saved in the repository, and screenshots/logs are retained under `.browser-tests/field-ux/`.
