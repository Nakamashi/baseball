import { jaPlaybook } from "./ja-playbook";
import { ui, type Locale } from "./ui";
import type { GameState } from "../simulation/types";
export { ui };
export type { Locale } from "./ui";
const directions: Record<string, string> = {
  shortstop: "遊撃手",
  "second-base side": "二塁側",
  "third-base side": "三塁側",
  pitcher: "投手",
  "first-base side": "一塁側",
  "centre field": "センター",
  "left field": "レフト",
  "right field": "ライト",
  "middle infield": "内野中央",
};
export function japanese(source: string): string {
  const text = source.trim();
  if (jaPlaybook[text]) return jaPlaybook[text];
  const prefixes: Record<string, string> = {
    "Read the outs and occupied bases. On contact: ":
      "アウト数と走者を確認します。打球が来たら：",
    "Secure the ball. ": "ボールを確保します。",
    "Present a target and receive the throw. ": "目標を示して送球を受けます。",
  };
  for (const [prefix, translation] of Object.entries(prefixes))
    if (text.startsWith(prefix))
      return translation + japanese(text.slice(prefix.length));
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^([\d-]+) putout: BR is out at first\.$/)))
    return `${m[1]}のプレーで、BRは一塁でアウトになります。`;
  if ((m = text.match(/^([\d-]+) double play completed: R1 and BR are out\.$/)))
    return `${m[1]}の併殺が成立。R1とBRがアウトです。`;
  if (
    (m = text.match(
      /^The ball is hit toward (.+)\. Fielders move together into fielding, coverage, and backup positions\.$/,
    )) &&
    directions[m[1]]
  )
    return `${directions[m[1]]}方向への打球です。野手が同時に動き、捕球、塁のカバー、バックアップを分担します。`;
  if ((m = text.match(/^Throw to (1B|2B|P) at first\.( One out ends the inning\.)?$/)))
    return `一塁の${m[1]}へ送球します。${m[2] ? "このアウトで攻守交代です。" : ""}`;
  if ((m = text.match(/^Throw to (2B|SS) covering second for the force\.$/)))
    return `二塁に入る${m[1]}へ送球し、フォースアウトを取ります。`;
  if (
    (m = text.match(
      /^(R2|R3) leaves only after the catch\. The defense aligns the cutoff\.$/,
    ))
  )
    return `${m[1]}は捕球を確認してからスタートします。守備は中継位置を整えます。`;
  if ((m = text.match(/^Throw through (2B|SS), the cutoff\.$/)))
    return `カット役の${m[1]}を通して送球します。`;
  if ((m = text.match(/^Throw to (1B|2B|SS) in the cutoff lane\.$/)))
    return `中継位置に入った${m[1]}へ送球します。`;
  throw new Error(`Missing Japanese translation: ${text}`);
}
export const playText = (locale: Locale) => (source: string) =>
  locale === "ja" ? japanese(source) : source;
export function situationText(state: GameState, locale: Locale) {
  const t = ui(locale);
  const runners = Object.entries(state.runners);
  if (locale === "ja")
    return `${state.outs}アウト・${!runners.length ? t("emptyBases") : runners.length === 3 ? t("loaded") : runners.map(([id, b]) => `${b}塁（${id}）`).join("・")}`;
  return `${state.outs} out${state.outs === 1 ? "" : "s"} · ${runners.length ? runners.map(([id, b]) => `${id} on ${b}`).join(", ") : t("emptyBases")}`;
}
export function initialLocale(): Locale {
  try {
    return localStorage.getItem("field-notes-language") === "ja" ? "ja" : "en";
  } catch {
    return "en";
  }
}
