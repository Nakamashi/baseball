# Project requirements for future changes

- Keep English and Japanese support complete. This app is used by Japanese students.
- Put new UI text in `src/i18n/ui.ts`; `ja` must implement every English message key. Translate labels, accessibility text, instructions, and empty states.
- When changing scenario text, notes, alternatives, phases, or player responsibilities, update `src/i18n/ja-playbook.ts` or the translated templates in `src/i18n/index.ts` in the same change. Do not add silent English fallbacks. Read `docs/TRANSLATIONS.md`.
- Keep stable player IDs and numeric scoring notation in both languages. Localize their explanations.
- Run `npm test` and `npm run build`. Localization tests enumerate every authored phase and every player's responsibilities; missing Japanese text must fail the change.
- For UI changes, run `npm run test:browser` with the dev server running and installed Chromium. Keep the field and transport controls visible together at common laptop and phone sizes, and preserve synchronized reading-panel navigation and step-by-step auto-pausing.
- Use the existing checkout. Cloud tasks are isolated; do not create worktrees unless explicitly requested.
