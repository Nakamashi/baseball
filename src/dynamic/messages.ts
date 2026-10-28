import type { Locale } from "../i18n/ui";
// Generated plays carry typed message references. Formatting belongs to the display
// boundary, so changing languages never changes paths, decisions or timestamps.
const english = {
  recoverHomeAction:
    "Return toward the catching position, watch home, and direct the defense.",
  wallBackupAction:
    "Support {player} from inside the field near the fence; leave room to receive the ball.",
  wallBackupWhy:
    "The fence leaves no useful space behind the fielding point. Support from a safe nearby position instead of crowding the fielder or crossing the fence.",
  backupReceiverAction:
    "Back up {player} beyond the receiving point for the throw toward {base}.",
  homeGuardWhy:
    "Keep home protected and direct the defense. There is no higher-priority backup job requiring you to leave the plate.",
  releaseAction: "Complete the throw and watch the receiver and runners.",
  releaseWhy:
    "The ball is in flight. Stay available for the next supporting assignment; possession now depends on the receiver.",
  liveBaseWhy:
    "A live runner can reach or return to this base. Maintain coverage until that threat passes.",
  homeThreatWhy:
    "A runner can threaten home. Protect the plate and direct the defense rather than leave for a distant backup.",
  catcherBackupWhy:
    "Home has no immediate scoring threat. In this team's optional convention, move up the first-base foul side to support the routine throw; return if the scoring threat changes.",
  secondSupportWhy:
    "The adjacent outfielder supports the batted ball. You support a possible throw into second and adjust when the target or coverage changes.",
  trailWhy:
    "BR has passed first and no return to first needs coverage. Trail outside the running lane toward second; a receiving, cutoff, or live-base duty takes priority.",
  guardThirdWhy:
    "No immediate runner or throw requires third. Hold your ground, guard the third-base side, and communicate a developing threat.",
  completeWhy:
    "The play is complete or the third out has ended live action. Stop and prepare for the next situation.",
  supportBaseAction: "Move toward support behind a possible throw into {base}.",
  trailAction: "Trail {runner} toward second from outside the running lane.",
  trailNext:
    "Watch the runner and ball. Be ready to support a throw behind the runner; do not obstruct the basepath.",
  tag: "The receiver has the ball and prepares the tag as {runner} reaches {base}. Touching the base alone is not an out.",
  forceOut:
    "Force out: {runner} is retired at {base} with possession on the base.",
  tagOut: "Tag out: the receiver tags {runner} just before {base}.",
  targetTag:
    "A throw can beat an advancing runner. A tag is required; this is not a force play.",

  carry:
    "Carry the ball to {base} and touch the base with possession. No throw is needed.",
  title: "Dynamic play · {fielder} · {ball}",
  objective:
    "Secure the ball, protect the occupied bases, and choose a throw that can help the defense.",
  ready:
    "Read the outs and runners. The destination marker shows where this ball is headed.",
  contact:
    "{fielder} pursues the ball. Teammates establish base coverage, a throwing lane, and backups.",
  fielded:
    "{fielder} secures the ball. Runners reassess their next base; the defense reevaluates the throw.",
  prepare:
    "The defense prepares a throw toward {base}. Covering players show a target while backups align.",
  throw:
    "{from} throws to {to}. Watch the runners and the receiving fielder at the same time.",
  received:
    "{player} receives the ball. Coverage and runner decisions are updated at this event.",
  settle:
    "The defense holds the ball while runners finish their legal advances. No additional risky throw is forced.",
  outcome:
    "Illustrated result: {outs} outs recorded and {runs} runs scored. {safe} runners remain on base.",
  forceResult:
    "The third out was a force out or retired BR before first. Runs on this play do not count.",
  fieldAction: "Move to the interception point and field the ball.",
  fieldWhy:
    "Your estimated arrival time and the ball trajectory make you the primary fielder.",
  fieldNext:
    "After securing the ball, find the covering fielder and listen to the defense.",
  coverAction: "Cover {base} and show a target.",
  coverWhy:
    "This base needs a receiver. Your assignment takes priority over a distant backup.",
  coverNext:
    "Catch securely; touch the base for a force, or apply a tag when a force does not exist.",
  cutoffAction: "Align between {from} and {base} as the cutoff.",
  cutoffWhy:
    "A visible target on the throwing line keeps the return controlled. The cutoff can hold or redirect the ball.",
  relayAction: "Move into the relay lane from {from} toward {base}.",
  relayWhy:
    "This throw is long for a youth player. Receiving and throwing again divides the distance into manageable legs.",
  relayNext:
    "Receive with your body directed toward the target. Relay only after finding the next receiver.",
  backupFieldAction: "Back up {player} behind the fielding point.",
  backupFieldWhy:
    "If the ball gets past the primary fielder, recover it before runners gain another base.",
  backupThrowAction: "Back up the throw toward {base}.",
  backupThrowWhy:
    "Stand beyond the receiving player on the throwing line. An inaccurate throw must not allow extra bases.",
  backupNext:
    "Stay clear of the receiver and runner. Recover a missed ball and stop further advancement.",
  holdAction: "Hold a useful supporting position and watch the runners.",
  holdWhy:
    "Your base and backup teammates have the immediate play covered. Do not crowd the ball or abandon useful space.",
  holdNext:
    "Communicate a change of target and be ready to replace a teammate whose assignment changes.",
  ownerAction: "Hold possession and prepare the next defensive decision.",
  ownerWhy:
    "The ball is secure. A rushed throw without an available out can help the offense.",
  receiveAction: "Receive the throw at {base}.",
  runnerAdvance:
    "Advance along the basepath toward {base}; touch each base in order.",
  runnerWhy:
    "Your decision uses the ball retrieval time, throwing distance, running speed, and selected aggression.",
  runnerForce:
    "You are forced to the next base because the bases behind you are occupied by active runners.",
  runnerHold:
    "Stay at {base} and read the ball. Do not pass a preceding runner.",
  runnerRetreat:
    "Return along the basepath to {base}; the cutoff has made the extra-base attempt unsafe.",
  runnerOut: "You are out. Stay clear of the continuing play.",
  runnerScored:
    "You have reached home. The run still depends on the third-out rules.",
  runnerNext:
    "Watch the ball and the coach. A conservative decision can be right even when an extra base looks possible.",
  targetSure: "Take a feasible out. With two outs, one secure out is enough.",
  targetForce:
    "Use the available lead force out, then evaluate another throw if time remains.",
  targetHome: "A realistically timed play at home can prevent a run.",
  targetReturn:
    "Return the ball to the infield and protect against an extra base; do not force a hopeless throw.",
  targetHold: "Keep the ball secure rather than make an unnecessary throw.",
  targetOverride:
    "The coach has selected this alternative. Coverage, the throwing lane and runner choices are recalculated.",
  close:
    "Close play: the estimated arrivals are within about half a second. Actual execution could change the result.",
  model:
    "Timing uses a 27.43 m basepath, youth running and throwing assumptions, and deterministic estimates. This is a teaching model, not an outcome prediction.",
  convention:
    "Team convention: 1B cuts throws home; SS cuts throws to third; the ball-side middle infielder cuts to second. Cover live threats, align backups with the throw, and reassess after each event.",
  alternative:
    "Change the throwing target, aggression, strength, or hit location and generate again to compare a different tactical response.",
  unsupported:
    "This dynamic phase supports fair ground balls and outfield base hits. Fly balls, line drives, bunts and fielding errors remain later-phase features.",
  invalid:
    "Choose a fair-ball location inside the field and valid outs, runners, count and game context.",
  infieldHit:
    "For a base hit, choose an outfield location. Use Ground ball for an infield ball.",
};
export type DynamicMessageKey = keyof typeof english;
const japanese: Record<DynamicMessageKey, string> = {
  recoverHomeAction: "捕手の位置へ戻り、本塁を確認して味方に指示します。",
  wallBackupAction:
    "フェンス付近のグラウンド内から{player}を支え、捕球する空間を空けます。",
  wallBackupWhy:
    "捕球地点の後ろにはフェンスがあり、十分な空間がありません。捕球役に近づきすぎたりフェンスを越えたりせず、安全な近くの位置で支えます。",
  backupReceiverAction:
    "{base}へ向かう送球で、{player}の捕球地点の後方をバックアップします。",
  homeGuardWhy:
    "本塁を守り、味方に指示します。今は本塁を離れて優先すべきバックアップはありません。",
  releaseAction: "送球動作を終え、受け手と走者を確認します。",
  releaseWhy: "ボールは送球中です。捕球は受け手に任せ、次の役割に備えます。",
  liveBaseWhy:
    "走者がこの塁へ進む、または戻る可能性があります。その必要がなくなるまでカバーを続けます。",
  homeThreatWhy:
    "本塁を狙える走者がいます。遠くのバックアップへ離れず、本塁を守って味方に指示します。",
  catcherBackupWhy:
    "すぐに生還できる走者はいません。このチームの選択する分担では、一塁側のファウル地域を進んで送球を支えます。生還の危険が生じたら本塁へ戻ります。",
  secondSupportWhy:
    "隣の外野手が打球を支えます。あなたは二塁への送球を支え、送球先やカバーの変化に合わせて動きます。",
  trailWhy:
    "BRは一塁を通過し、一塁への帰塁を守る必要もありません。走路の外を二塁方向へ追います。捕球・中継・必要な塁のカバーを優先します。",
  guardThirdWhy:
    "今は三塁への走者や送球に対応する必要がありません。その場で三塁側を守り、新しい危険を声で伝えます。",
  completeWhy:
    "プレーが終わったか、第3アウトで動きが止まりました。次の状況に備えます。",
  supportBaseAction:
    "{base}への送球に備え、受け手の後方を支える位置へ動きます。",
  trailAction: "走路の外を通り、{runner}を二塁方向へ追って支えます。",
  trailNext:
    "走者とボールを見ます。走者の後ろへの送球を支える準備をし、走路を妨げません。",
  tag: "受け手はボールを保持し、{runner}が{base}へ来るのに合わせてタッチを準備します。ベースに触れるだけではアウトになりません。",
  forceOut:
    "フォースアウト：{base}でボールを保持してベースに触れ、{runner}をアウトにしました。",
  tagOut: "タッチアウト：受け手が{base}の手前で{runner}にタッチしました。",
  targetTag:
    "進塁する走者より早く送球が届く見込みです。フォースではないため、走者へのタッチが必要です。",

  carry: "ボールを持って{base}へ進み、ベースに触れます。送球は必要ありません。",
  title: "動的プレー・{fielder}・{ball}",
  objective:
    "打球を確実に処理し、必要な塁を守り、守備に役立つ送球を選びましょう。",
  ready: "アウト数と走者を確認します。目標マークが打球の向かう位置を示します。",
  contact:
    "{fielder}が打球を追います。味方は塁のカバー、中継、バックアップの位置に入ります。",
  fielded:
    "{fielder}がボールを確保しました。走者は進塁を、守備は送球先を改めて判断します。",
  prepare:
    "{base}への送球を準備します。カバー役が目標を示し、バックアップ役が送球の延長線に入ります。",
  throw: "{from}が{to}へ送球します。走者と受け手の両方の動きを確認しましょう。",
  received:
    "{player}が送球を受けました。この時点でカバーと走者の判断を更新します。",
  settle:
    "守備はボールを保持し、走者は認められた進塁を終えます。無理な追加送球はしません。",
  outcome:
    "この例の結果：アウトは{outs}個、得点は{runs}点。{safe}人の走者が塁に残ります。",
  forceResult:
    "第3アウトがフォースアウト、または打者走者の一塁到達前のアウトなので、このプレーの得点は認められません。",
  fieldAction: "捕球できる地点へ移動して打球を処理します。",
  fieldWhy: "打球の経路と到達時間から、あなたが主な捕球役になります。",
  fieldNext: "ボールを確保したらカバー役を見つけ、味方の指示を聞きます。",
  coverAction: "{base}をカバーし、送球の目標を示します。",
  coverWhy:
    "この塁には受け手が必要です。遠くのバックアップより、この役割を優先します。",
  coverNext:
    "確実に捕球します。フォースなら塁に触れ、フォースでなければ走者にタッチします。",
  cutoffAction: "{from}から{base}への線上にカット役として入ります。",
  cutoffWhy:
    "送球路に目標を作り、返球を安定させます。カット役は保持や送球先の変更もできます。",
  relayAction: "{from}から{base}への中継位置に入ります。",
  relayWhy: "少年野球では長い送球になるため、中継して距離を分けます。",
  relayNext: "送球先に体を向けて捕球し、次の受け手を確認してから送ります。",
  backupFieldAction: "{player}の捕球地点の後ろをカバーします。",
  backupFieldWhy:
    "打球が捕球役の後ろへ抜けたとき、余分な進塁をされる前に処理します。",
  backupThrowAction: "{base}への送球をバックアップします。",
  backupThrowWhy:
    "受け手の後方で送球の延長線に入ります。悪送球による余分な進塁を防ぎます。",
  backupNext: "受け手や走者の進路を避け、抜けたボールを止めます。",
  holdAction: "有効な守備位置を保ち、走者を確認します。",
  holdWhy:
    "塁のカバーとバックアップは味方が担当しています。打球に集まりすぎず、必要な場所を守ります。",
  holdNext:
    "送球先の変化を声で伝え、味方の役割が変わったら代わりに対応します。",
  ownerAction: "ボールを保持し、次の守備の判断に備えます。",
  ownerWhy:
    "ボールは確保できています。アウトを狙えない場面で急いで投げると、攻撃側を助けてしまいます。",
  receiveAction: "{base}で送球を受けます。",
  runnerAdvance: "塁を順番に踏み、走路に沿って{base}へ進みます。",
  runnerWhy:
    "打球の処理時間、送球距離、走力、積極性を使って進塁を判断しています。",
  runnerForce:
    "後ろの塁が有効な走者で埋まっているため、次の塁へ進む義務があります。",
  runnerHold:
    "{base}にとどまり、打球を確認します。前の走者を追い越してはいけません。",
  runnerRetreat:
    "中継で追加進塁が危険になったため、走路を戻って{base}へ帰ります。",
  runnerOut: "あなたはアウトです。続いているプレーを妨げないようにしましょう。",
  runnerScored:
    "本塁に到達しました。得点が認められるかは第3アウトの規則にもよります。",
  runnerNext:
    "ボールとコーチを見ましょう。進めそうに見えても、慎重な判断が正解の場合があります。",
  targetSure:
    "確実に取れるアウトを狙います。2アウトならあと一つで攻守交代です。",
  targetForce:
    "先行走者のフォースアウトを狙い、時間が残れば次の送球を判断します。",
  targetHome: "間に合う見込みの本塁のプレーで、失点を防ぎます。",
  targetReturn:
    "内野へ返球し、余分な進塁を防ぎます。間に合わない送球は無理に狙いません。",
  targetHold: "不要な送球をせず、ボールを確実に保持します。",
  targetOverride:
    "コーチが選んだ別の判断です。カバー、中継位置、走者の進塁も計算し直しています。",
  close:
    "際どいプレーです。到達時間の差は約0.5秒以内で、実際の結果は技術や動作で変わります。",
  model:
    "塁間27.43mと少年野球向けの走力・送球の仮定で時間を計算します。学習用のモデルであり、試合結果の予測ではありません。",
  convention:
    "このチームの分担：本塁へは1B、三塁へはSS、二塁へは打球側の二遊間がカット役です。必要な塁を守り、送球に合わせてバックアップし、状況の変化ごとに判断し直します。",
  alternative:
    "送球先、走者の積極性、打球の強さ、位置を変えて再生成し、別の守備対応を比べましょう。",
  unsupported:
    "この段階ではフェアのゴロと外野へのヒットに対応します。フライ、ライナー、バント、守備のミスは今後の段階で追加します。",
  invalid:
    "グラウンド内のフェアの位置と、正しいアウト数・走者・カウント・試合状況を選んでください。",
  infieldHit:
    "ヒットでは外野の位置を選んでください。内野への打球は「ゴロ」を使います。",
};
export function message(
  key: DynamicMessageKey,
  variables: Record<string, string | number> = {},
): string {
  return `@v2:${key}:${JSON.stringify(variables)}`;
}
export function formatDynamic(
  source: string,
  locale: Locale,
): string | undefined {
  if (!source.startsWith("@v2:")) return undefined;
  const split = source.indexOf(":", 4),
    key = source.slice(4, split) as DynamicMessageKey;
  const template = (locale === "ja" ? japanese : english)[key];
  if (!template) throw new Error(`Unknown dynamic message ${key}`);
  const vars = JSON.parse(source.slice(split + 1)) as Record<
    string,
    string | number
  >;
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`Missing ${name} in ${key}`);
    if (name === "base")
      return locale === "ja"
        ? ({
            "1": "一塁",
            "2": "二塁",
            "3": "三塁",
            home: "本塁",
            hold: "保持",
          }[value] ?? String(value))
        : ({
            "1": "first",
            "2": "second",
            "3": "third",
            home: "home",
            hold: "hold",
          }[value] ?? String(value));
    if (name === "ball")
      return locale === "ja"
        ? value === "Ground ball"
          ? "ゴロ"
          : "外野へのヒット"
        : String(value);
    return String(value);
  });
}
export const dynamicMessages = { english, japanese };
