# Project requirements for future changes

- Keep English and Japanese support complete. This app is used by Japanese students.
- Put new UI text in `src/i18n/ui.ts`; `ja` must implement every English message key. Translate labels, accessibility text, instructions, and empty states.
- Dynamic simulator messages live in `src/dynamic/messages.ts`; keep the typed English/Japanese templates and their variables in sync. Generated messages use references formatted only at the display boundary.
- When changing scenario text, notes, alternatives, phases, or player responsibilities, update `src/i18n/ja-playbook.ts` or the translated templates in `src/i18n/index.ts` in the same change. Do not add silent English fallbacks. Read `docs/TRANSLATIONS.md`.
- Keep stable player IDs and numeric scoring notation in both languages. Localize their explanations.
- Run `npm test` and `npm run build`. Localization tests enumerate every authored phase and every player's responsibilities; missing Japanese text must fail the change.
- Preserve both modes: the guided Version 1 encyclopedia and the Phase 2A dynamic simulator. Dynamic mode generates ground balls, line drives, fly balls, pop-ups and ordinary fair bunts. Preserve catch, tag-up, retouch, infield-fly and boundary-award rules. Squeezes, bunt pop-ups/foul-bunt strike rules, errors and full rundowns remain unsupported.
- For simulator UI changes, also run `npm run test:dynamic:browser`.
- For UI changes, run `npm run test:browser` with the dev server running and installed Chromium. Keep the field and transport controls visible together at common laptop and phone sizes, and preserve synchronized reading-panel navigation and step-by-step auto-pausing.
- Use the existing checkout. Cloud tasks are isolated; do not create worktrees unless explicitly requested.

- Defensive convention changes must update `docs/DEFENSIVE_AUDIT.md` and the all-nine tactical tests. Preserve the distinction between deliberate holding and a missing job; use `npm run audit:defense` to inspect routes, alternatives, priorities and late/unfulfilled coverage. Do not claim a modeled backup is ready when its receiving deadline says otherwise.

- Dynamic field distances use the home ground: 27.43 m basepaths, 90 m corners, 120 m center. Keep `toWorld`/`fromWorld`, physical interpolation, throw timing and runner route lengths consistent. Read `docs/BASERUNNING.md` before changing those assumptions; do not force extra bases or plate outcomes to preserve old screen-coordinate examples. Preserve run-through versus rounding legality and Japanese runner instructions.

- Read `docs/PHYSICS.md` before changing dynamic motion, calibration or input semantics. Contact-to-first profiles are provisional 5.3 / 4.7 / 4.2 s targets, not published youth averages. Keep timing prediction, compiled samples and actual event crossings consistent; preserve velocity at reassignment and do not turn numerical samples into teaching phases.
- Ground aims do not stop the ball. Airborne aims request first landing and must disclose launch constraints. A projected boundary continuation does not award bases after an earlier interception. First defensive touch, secure catch, tag-up permission and retouch appeals are distinct events.
- Keep both 576-case matrices and the focused physical/rules tests. Compare ball arrival at common locations, not total untouched trajectory duration (harder balls can travel farther and therefore remain moving longer). Preserve authored-play geometry and Japanese content.

- Read `docs/TACTICAL_CORRECTIONS.md` for current tactical behavior and offline-source provenance. Keep the dedicated coaching-correctness suite; large matrices alone do not establish good baseball decisions.
- Use `throwing.ts` for both predicted and compiled flight/preparation. Preserve complete double-play forecasts, pending retouch time, live runner-event reevaluation, receiver reservations, optional-through-cutoff versus actual-relay readiness and cancellation of obsolete support.
- The 8 m default is provisional and the default keep-in-play mode is a training net, not a claim about actual fence height. Standard mode must preserve real boundary awards; an earlier interception cancels a hypothetical award. Bunt anticipation is a pre-pitch setting independent of the eventual contact type.
