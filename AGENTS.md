# Project requirements for future changes

- Keep English and Japanese support complete. This app is used by Japanese students.
- Put new UI text in `src/i18n/ui.ts`; `ja` must implement every English message key. Translate labels, accessibility text, instructions, and empty states.
- Dynamic simulator messages live in `src/dynamic/messages.ts`; keep the typed English/Japanese templates and their variables in sync. Generated messages use references formatted only at the display boundary.
- When changing scenario text, notes, alternatives, phases, or player responsibilities, update `src/i18n/ja-playbook.ts` or the translated templates in `src/i18n/index.ts` in the same change. Do not add silent English fallbacks. Read `docs/TRANSLATIONS.md`.
- Keep stable player IDs and numeric scoring notation in both languages. Localize their explanations.
- Run `npm test` and `npm run build`. Localization tests enumerate every authored phase and every player's responsibilities; missing Japanese text must fail the change.
- Preserve both modes: the guided Version 1 encyclopedia and the Phase 2A dynamic simulator. Do not claim fly balls, line drives, bunts or errors are generated until those rules are implemented and tested.
- For simulator UI changes, also run `npm run test:dynamic:browser`.
- For UI changes, run `npm run test:browser` with the dev server running and installed Chromium. Keep the field and transport controls visible together at common laptop and phone sizes, and preserve synchronized reading-panel navigation and step-by-step auto-pausing.
- Use the existing checkout. Cloud tasks are isolated; do not create worktrees unless explicitly requested.

- Defensive convention changes must update `docs/DEFENSIVE_AUDIT.md` and the all-nine tactical tests. Preserve the distinction between deliberate holding and a missing job; use `npm run audit:defense` to inspect routes, alternatives, priorities and late/unfulfilled coverage. Do not claim a modeled backup is ready when its receiving deadline says otherwise.
