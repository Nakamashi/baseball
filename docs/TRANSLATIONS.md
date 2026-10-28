# Maintaining English and Japanese

The language selector affects the interface, field annotations, catalogue, situation summaries, phase narration, player action/reason/support text, outcomes, alternatives, and accessibility labels. Standard position and runner IDs remain the same in both languages so the text matches the field. A collapsible player-label key explains them in the selected language. The selector changes presentation only; it does not reset playback time or player selection. Browser local storage remembers the preference when available.

## Interface text

`src/i18n/ui.ts` declares the English message keys and a complete Japanese `Record<MessageKey, string>`. Add a key and both translations together. Use `ui(locale)` in rendered components, including aria labels and placeholders. TypeScript rejects missing Japanese UI keys.

## Authored coaching text

The canonical scripts use English text independently of the renderer. `playText(locale)` translates the text at the display boundary, leaving simulation data and player identities stable. Add exact English-to-Japanese entries to `src/i18n/ja-playbook.ts`. The reusable wrappers and narrowly matched variable sentences in `src/i18n/index.ts` compose translations for phase-specific instructions and throw destinations.

Update dictionary keys when editing the corresponding English sentence. New variable templates need a Japanese implementation and tests that cover the variables. Avoid broad matching that could accidentally translate a new sentence with different meaning. Unknown Japanese coaching text throws a descriptive error rather than silently showing English. The automated coverage audit is therefore a required gate before publication.

Keep sentences suitable for junior-high players. Preserve rule distinctions: a force out is フォースアウト; a tag is タッチ; returning to the original base after a caught ball is 帰塁/踏み直し; tagging up to advance is タッチアップ. Do not translate an appeal as an automatic force out. When teaching a conditional choice, translate the condition as well as the action.

## Required verification

- `npm test`: checks every UI key and all 24 scenarios' category, title, objective, result, notes, alternatives, phase labels/narration, and every defender/runner's action, reason, and supporting responsibility. New untranslated play content fails with the missing sentences.
- `npm run build`: verifies the typed UI dictionary.
- `npm run test:browser`: with a running dev server, checks English and Japanese rendering, all play phases, language persistence, timeline preservation when switching languages, and layout at six screen sizes.
- `npm run test:pages`: after a build, verifies loading from plain static hosting at `/` and `/baseball/`.

The Pages workflow runs `npm test` before building and deploying, so missing translations prevent a release. Automated coverage establishes completeness, not linguistic or tactical review; Japanese-speaking coaches can refine translations centrally without changing the engine.
