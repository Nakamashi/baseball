import { describe, it, expect } from "vitest";
import { scenarios } from "../scenarios";
import { japanese, situationText } from "../i18n";
import { en, ja } from "../i18n/ui";
import { jaPlaybook } from "../i18n/ja-playbook";
describe("maintained Japanese localization", () => {
  it("translates every UI key", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
    for (const value of Object.values(ja))
      expect(value).toMatch(/[ぁ-んァ-ヶ一-龯]/);
  });
  it.each(scenarios)(
    "$id translates all authored coaching content without fallback",
    (s) => {
      const strings = [
        s.category,
        s.title,
        s.objective,
        s.result,
        ...s.notes,
        ...s.alternatives,
      ];
      for (const p of s.phases) {
        strings.push(p.title, p.explanation);
        for (const r of Object.values(p.responsibilities))
          strings.push(r.action, r.why, r.support);
      }
      const missing: string[] = [];
      for (const value of strings) {
        try {
          expect(japanese(value)).toMatch(/[ぁ-んァ-ヶ一-龯]/);
        } catch {
          missing.push(value);
        }
      }
      expect([...new Set(missing)]).toEqual([]);
      expect(situationText(s.initial, "ja")).toContain("アウト");
    },
  );
  it("flags new unlocalized teaching text", () =>
    expect(() => japanese("A new sentence without a translation.")).toThrow(
      "Missing Japanese translation",
    ));
  it("rejects changed throw conditions rather than applying an unrelated translation", () => expect(() => japanese("Throw to 1B at first. A new conditional outcome.")).toThrow("Missing Japanese translation"));
  it("contains no empty translations", () => {
    expect(Object.values(jaPlaybook).every((v) => v.length > 0)).toBe(true);
  });
});
