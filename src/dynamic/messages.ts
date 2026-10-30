import type { Locale } from "../i18n/ui";
// Generated plays carry typed message references. Formatting belongs to the display
// boundary, so changing languages never changes paths, decisions or timestamps.
const english = {
  errorFlightPhase: "Follow the live overthrow",
  errorLiveWhy: "The released ball remains live. Keep backup and base coverage while reading the missed throw.",
  throwMissed: "The throw passes above {player}'s reachable glove height. There is no reception or out.",
  loosePursuitAction: "Pursue the loose throw and secure it under control.",
  loosePursuitWhy: "Your current position and momentum provide the earliest supported interception. Teammates retain base coverage and backup.",
  recoveryStarted: "{player} pursues the live ball from the current position and momentum.",
  recoveryTouched: "{player} reaches the loose ball; secure control is not yet complete.",
  recoveryGather: "{player} gathers the ball before any further throw or out attempt.",
  recoverySecured: "{player} secures the recovered ball and reads the remaining runners.",
  errorRunnerRead: "After observing the miss, all runners read recovery and return timing together. An error does not award an extra base.",
  errorRunnerGo: "The observed recovery and return timing allow an extra-base attempt under this aggression setting. Touch each base; a further out is still possible.",
  errorRunnerHold: "Read the live ball and hold the planned base when recovery and return timing make another base too risky.",
  errorScope: "One elevated overthrow on an eligible direct infield throw to second is modeled. Recovery and extra bases depend on actual timing; other errors and thrown-ball boundary awards remain unsupported.",
  noEligibleError: "No eligible throwing error occurred in this play.",
  errorRecoveryUnavailable: "The throwing-error recovery could not finish safely within the supported model. Adjust the situation or turn Include Error off; the previous play is preserved.",

  priorityCatchWhy: "Claim this reachable pop-up under the team's priority system. Teammates yield and cover the vacated bases or back up the catch.",
  baseContact: "{player} touches {base} while securely holding the ball.",
  challengeExpired: "The opportunity at {base} has ended before release. The defender reads the live play again.",
  gloveContact: "The throw reaches {player}'s glove. Secure control is still being established.",
  throwSecured: "{player} secures the throw and can now make a play.",
  wallCaromWhy:
    "The ball strikes the wall or training net and rebounds into play. A catch after wall contact is not an airborne out; runners and all nine defenders reassess the carom.",
  targetDoublePlay:
    "Take the available force at second, then reassess the pivot to first for a possible double play. The second out depends on the actual remaining time.",
  retouchCompleted:
    "Retouch the original base and hold. Returning to the bag does not itself mean attempting a tag-up advance.",
  phaseDecelerate: "Slow down after the third out",
  postPlayBrakingWhy:
    "The third out ends live play. Runners stop; moving defenders only finish braking. No coverage, pursuit or throwing opportunity is started.",
  buntScope:
    "Aim an ordinary fair bunt within 25 m of home. Runners use normal live-play reads; no dedicated squeeze, bunt pop-up or foul-bunt strike rule is modeled.",
  trainingFenceWhy:
    "Keep-in-play training mode uses a virtual high net. The displayed fence height is provisional, not a measurement of the home ground; this mode deliberately keeps boundary flights playable.",
  buntChargeWhy:
    "Read the bunt and charge under control. The nearest fielder takes the ball; middle infielders cover the vacated bases. With R2 present, third-base coverage takes priority.",
  buntChargeAction:
    "Charge the bunt under control, yield to the primary fielder, and be ready to cover or support.",
  buntRecoverThirdWhy:
    "Another fielder is handling the bunt. Cover third while the lead runner advances through second; do not wait for the runner to attempt the extra base.",
  readCatchableWhy:
    "A controllable catch remains plausible. Keep enough time to return; prepare to retouch before a tag-up.",
  readUncertainWhy:
    "Read the developing flight. Take a direction- and depth-dependent lead while keeping a safe return available.",
  readUncatchableWhy:
    "Successive flight observations leave no reachable airborne catch. Commit to the next legal bases before landing; this read did not assume the final outcome at contact.",
  generationUnavailable:
    "This situation could not be resolved under the current model. Adjust the ball aim or type and try again; the previous generated play is preserved.",
  boundaryTrackAction:
    "Track the ball toward the wall and prepare for a possible carom.",
  boundaryTrackWhy:
    "The projected ball is beyond a controllable interception. Follow it without claiming a catch; maintain coverage until the boundary event is resolved.",
  catchThirdResult:
    "The completed catch is the third out. Contact advances do not score runs on this caught ball; no further live play continues.",
  cutoffUnavailable:
    "This possession does not need an outfield cutoff. Hold the ball under the cutoff-only override rather than inventing a relay.",
  retouchAction: "Return to the original base and retouch before any advance.",
  airReadAction:
    "Take a controlled read of the line drive; be ready to return on a catch.",
  tagReadyAction:
    "Return to or stay at the original base, ready to tag up after first defensive touch.",
  brakingAction: "Brake smoothly and settle into the supporting position.",
  brakingWhy:
    "Your assignment has changed. Use the current momentum to stop safely before changing direction; movement during braking is deliberate.",
  phaseFlight: "Follow the moving ball",
  phaseGather: "Secure the ball",
  phaseCatch: "Complete the catch",
  phaseAward: "Advance on the boundary award",
  catchOut:
    "{runner} is out on the completed catch; the other runners must legally retouch before advancing.",
  infieldFlyWhy:
    "Infield fly: fewer than two outs, runners on first and second, and an infielder can make the fair fly catch with ordinary effort. BR is out; runners are not forced and advance at their own risk.",
  airReadWhy:
    "Read the airborne ball. Prepare to retouch on a catch; do not treat a possible catch as a ground hit. With two outs, run on contact.",
  tagUpWhy:
    "A runner may leave after the first defensive touch, but must first retouch the original base. Compare the return throw with the next-base running time; a catch removes the force.",
  appealOut:
    "{runner} is retired on a retouch appeal at {base}, before returning. This is not a force out.",
  appealWhy:
    "Return the ball to the original base before the runner retouches it. A retouch appeal is different from a force or a tag of an advancing runner.",
  movingBallWhy:
    "{fielder} pursues a reachable point on the moving trajectory. The ball continues past the aim point unless intercepted or slowed by the surface.",
  gatherWhy:
    "{fielder} has touched the ball and secures control before preparing a throw. Runners and supporting defenders continue on the same clock.",
  bounceWhy:
    "The ball contacts the surface, loses speed and continues bouncing or rolling.",
  passedWhy:
    "The ball has passed the infield interception area. Reassess outfield pursuit, cutoffs, base coverage and backups.",
  homeRunWhy:
    "The untouched ball clears the modeled fence in flight. Award home to the batter and preceding runners; no defensive throw can retire them on this award.",
  boundaryDoubleWhy:
    "The ball clears the fence after bouncing. Award two bases from the runners' original positions; this is not an overthrow or error.",
  trajectoryLimit:
    "The requested landing distance is outside this launch profile. The displayed landing point shows the attainable trajectory for the selected strength.",
  physicsNote:
    "Provisional junior-high timing profiles: contact-to-first 5.3 / 4.7 / 4.2 s. The modeled fence is {wallHeight} m high. Surface, bounce and throw parameters require local calibration. Optional errors cover eligible infield overthrows to second; full rundowns remain unsupported.",
  runnerFinishOut:
    "Finish sprinting through first, then clear the play after the out.",
  runnerFinishOutWhy:
    "The out is already recorded. Completing the sprint does not earn a base or restore your status; keep clear of the live defense.",
  runnerContactReadWhy:
    "Read the ground ball beyond the pitcher. The estimated retrieval and throw allow a scoring attempt; the defense can still change the play.",
  runnerFreezeWhy:
    "With fewer than two outs, read the ground ball before risking home. Freeze on a ball at P, C or 3B; a force or two-out contact changes that responsibility.",
  runnerContactWhy:
    "Aggressive contact play: break for home on this ground ball past the pitcher or to a middle/first baseman. This is a risk; a ready defense can retire you. Freeze on a ball at P, C or 3B unless forced or there are two outs.",
  runnerHoldWhy:
    "The next base does not have a sufficient timing window, or a preceding runner needs it. Take the available bases and read the defense rather than assume an extra base.",
  runnerOverrun:
    "Sprint through first, slow down beyond the bag, and look for the ball.",
  runnerOverrunWhy:
    "On an ordinary infield play, run through first and return promptly. After an observed overthrow, an extra-base attempt requires a controlled first-base turn or completion of this run-through and return.",
  runnerRound:
    "Round first, read the ball and coach, and prepare to continue or return.",
  runnerRoundWhy:
    "On an outfield hit, use a curved approach and a controlled turn. Rounding first is different from the protected straight run-through; return if no extra base is available.",
  runnerReturnFirst:
    "Return to first after reading the defense; no extra base is taken.",
  retrieve:
    "The ball has reached the fielding area. {fielder} retrieves and gathers it while runners read the available time.",
  targetHomeClose:
    "The ball can reach home before the runner, but tag timing is close. Challenge the scoring attempt; the result is uncertain.",
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
    "The adjacent outfielder supports the batted ball. Shade behind second on the outfield side for a possible next throw from the infield; keep the diamond clear for its receivers and backups.",
  thirdControlWhy:
    "An outfield hit can develop into an advance beyond second. Keep third covered before considering any optional relay backup.",
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
    "Read the outs and runners. The marker shows the ground-ball aim or requested airborne landing point; it does not stop the ball.",
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
  trailerAction: "Trail {from} on the relay line toward {base}.",
  cutoffIntercepted: "{player} cuts a reachable throw to reconsider the play.",
  trailerWhy: "Second has replacement coverage. Trail the primary relay with receiving room; a high or short-hop return can come through to you.",
  innerCutoffWhy: "Anticipate the play at home from the infield cutoff line. Stay ready to receive, hold or redirect while the middle infielder leads the deep relay.",
  relayNext:
    "Receive with your body directed toward the target. Relay only after finding the next receiver.",
  backupFieldAction: "Back up {player} behind the fielding point.",
  backupFieldWhy:
    "If the ball gets past the primary fielder, recover it before runners gain another base.",
  backupThrowAction: "Back up the throw toward {base}.",
  backupThrowWhy:
    "Stand beyond the receiving player on the throwing line. An inaccurate throw must not allow extra bases.",
  anticipatedBackupWhy:
    "The current return has no timely out at second. Anticipate the advancing runner at third and prepare behind that base for a possible overthrow.",
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
    "Return along the basepath to {base}; the developing defense has made the extra-base attempt unsafe.",
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
    "Timing uses {baseMetres} m basepaths, a schematic {cornerMetres} m corner / {centreMetres} m centre-field fence, and youth running and throwing assumptions. This is a teaching model, not an outcome prediction.",
  convention:
    "Deep returns use the ball-side middle infielder as primary relay, with an infield home cutoff and at most two intermediate receivers. A trailer leaves second only with replacement coverage. Reassess the target and all nine responsibilities at each reception.",
  alternative:
    "Change the throwing target, aggression, strength, or hit location and generate again to compare a different tactical response.",
  unsupported:
    "Choose Ground ball, Line drive, Fly ball, Pop-up or an ordinary fair Bunt. Errors, squeezes and full rundowns are not generated; authored encyclopedia plays remain available.",
  invalid:
    "Choose a fair-ball location inside the field and valid outs, runners, count and game context.",
  infieldHit:
    "For a base hit, choose an outfield location. Use Ground ball for an infield ball.",
};
export type DynamicMessageKey = keyof typeof english;
const japanese: Record<DynamicMessageKey, string> = {
  errorFlightPhase: "生きている悪送球を追う",
  errorLiveWhy: "送球後もボールは生きています。悪送球を読みながら、バックアップと塁のカバーを続けます。",
  throwMissed: "送球は{player}が捕れる高さを越えて通過します。捕球もアウトも成立しません。",
  loosePursuitAction: "悪送球のボールを追い、制御して確保します。",
  loosePursuitWhy: "現在の位置と勢いから、最も早く確実に到達できます。味方は塁のカバーとバックアップを続けます。",
  recoveryStarted: "{player}は現在の位置と勢いから、生きているボールを追います。",
  recoveryTouched: "{player}がボールに到達しました。まだ確実な保持は完了していません。",
  recoveryGather: "{player}は次の送球やアウトを狙う前に、ボールを確実に確保します。",
  recoverySecured: "{player}がボールを確保し、残る走者の動きを判断します。",
  errorRunnerRead: "悪送球を確認してから、全走者が回収と返球の時間を同時に読みます。エラーだけで次の塁が与えられるわけではありません。",
  errorRunnerGo: "確認した回収と返球の時間から、この積極性では次の塁を狙います。各塁を踏み、次の守備でアウトになる可能性にも備えます。",
  errorRunnerHold: "生きているボールを読み、回収と返球が速く次の塁が危険なときは、予定の塁にとどまります。",
  errorScope: "対象となる内野から二塁への直接送球で、1回の高い悪送球に対応します。回収と進塁は実際の時間で決まり、他のエラーや場外への悪送球による進塁権は対象外です。",
  noEligibleError: "このプレーでは対象となる送球エラーは発生しませんでした。",
  errorRecoveryUnavailable: "対応範囲内で悪送球後のプレーを安全に完了できませんでした。状況を変えるか「エラーを含める」をオフにしてください。前のプレーは保持されています。",

  priorityCatchWhy: "捕球可能なフライに対し、チームの優先順位に従って声をかけて捕球します。他の野手は譲り、空いた塁のカバーや捕球のバックアップに回ります。",
  baseContact: "{player}がボールを確実に保持した状態で{base}を踏みます。",
  challengeExpired: "送球前に{base}でアウトを取る機会がなくなりました。野手はプレーの状況を見直します。",
  gloveContact: "送球が{player}のグラブに届きました。まだ確実に保持する動作の途中です。",
  throwSecured: "{player}が送球を確実に保持しました。ここからアウトを取る動作や次の送球に移れます。",
  wallCaromWhy:
    "打球がフェンスまたは練習ネットに当たり、場内へ跳ね返りました。その後に捕ってもフライアウトにはなりません。走者と野手全員が跳ね返りに対応します。",
  targetDoublePlay:
    "まず二塁のフォースアウトを取り、残り時間を確認して一塁への併殺送球を判断します。第2のアウトは実際のタイミング次第です。",
  retouchCompleted:
    "元の塁を踏み直して待機します。帰塁しただけではタッチアップで進塁したことにはなりません。",
  phaseDecelerate: "第3アウト後に減速する",
  postPlayBrakingWhy:
    "第3アウトでプレーは終了です。走者は停止し、動いていた野手だけが減速を終えます。新しいカバー、追球、送球は始めません。",
  buntScope:
    "本塁から25m以内の通常のフェアバントに対応します。走者は通常のプレー状況を読んで判断します。専用のスクイズ戦術、バントフライ、ファウルバントのストライク判定は対象外です。",
  trainingFenceWhy:
    "場内に残す練習モードでは仮想の高いネットを使います。表示した高さは仮設定で、本拠地の実測値ではありません。境界に届く打球も意図的に場内へ戻します。",
  buntChargeWhy:
    "バントを読み、制御して前進します。最も近い野手が処理し、二遊間が空いた塁をカバーします。二塁走者がいれば三塁のカバーを優先します。",
  buntChargeAction:
    "バントに向かって制御して前進し、処理する野手に譲り、カバーやサポートに備えます。",
  buntRecoverThirdWhy:
    "別の野手がバントを処理します。先行走者が二塁へ進む間に三塁をカバーします。走者が三塁を狙い始めるまで待ちません。",
  readCatchableWhy:
    "捕球される可能性があります。帰塁できる距離を保ち、タッチアップの前に元の塁を踏み直します。",
  readUncertainWhy:
    "打球の飛び方を読みます。方向と深さに応じてリードし、捕球されても安全に戻れる距離を保ちます。",
  readUncatchableWhy:
    "打球を続けて観察した結果、空中での捕球は間に合わないと判断しました。落下を待たず次の塁へ進みます。打球直後から結果を知っていた判断ではありません。",
  generationUnavailable:
    "現在のモデルではこの状況を解決できませんでした。打球の狙いか種類を変えて再生成してください。前の生成済みプレーは保持されています。",
  boundaryTrackAction: "フェンスへ向かう打球を追い、跳ね返りに備えます。",
  boundaryTrackWhy:
    "予測された打球には捕球が間に合いません。捕れたとは扱わず追球し、境界の判定までカバーを維持します。",
  catchThirdResult:
    "捕球で第3アウトです。この捕られた打球で、打球と同時に走った走者の得点は認められず、プレーは終了します。",
  cutoffUnavailable:
    "この位置では外野からの中継は不要です。「カットまで」の指定では、不要な中継を作らずボールを保持します。",
  retouchAction: "元の塁へ戻って踏み直してから進塁します。",
  airReadAction:
    "ライナーを確認しながら慎重に離塁し、捕られたら戻れるようにします。",
  tagReadyAction:
    "元の塁へ戻って構え、野手が最初に触れた後のタッチアップに備えます。",
  brakingAction: "滑らかに減速し、次の支援位置で構えます。",
  brakingWhy:
    "役割が変わりました。今の勢いを考えて安全に減速してから方向を変えます。この間の動きは意図した減速です。",
  phaseFlight: "動く打球を追う",
  phaseGather: "ボールを確保",
  phaseCatch: "捕球を完了",
  phaseAward: "与えられた塁へ進む",
  catchOut:
    "捕球が完了し、{runner}はアウトです。他の走者は正しく元の塁を踏み直してから進塁します。",
  infieldFlyWhy:
    "インフィールドフライです。2アウト未満、一・二塁に走者がいて、内野手が普通の守備で捕れるフェアのフライです。BRはアウトとなり、走者のフォースはなくなります。進塁は走者の判断と危険負担で行います。",
  airReadWhy:
    "空中の打球を確認します。捕られたら踏み直せるよう準備し、ゴロと同じように決めつけて走りません。2アウトでは打球と同時に走ります。",
  tagUpWhy:
    "野手が最初に打球に触れた後、元の塁を踏み直してから離塁できます。次の塁への走塁時間と返球を比べます。捕球が成立するとフォースはなくなります。",
  appealOut:
    "{runner}は{base}へ戻る前に、踏み直しのアピールでアウトです。フォースアウトではありません。",
  appealWhy:
    "走者が踏み直す前に元の塁へ返球します。踏み直しのアピールはフォースや進塁する走者へのタッチとは異なります。",
  movingBallWhy:
    "{fielder}は動く打球に追いつける地点へ向かいます。打球は捕られるか地面で減速するまで、狙った地点を越えて進みます。",
  gatherWhy:
    "{fielder}は打球に触れ、送球の準備前に確実に保持します。走者と他の野手も同じ時間軸で動き続けます。",
  bounceWhy:
    "打球が地面に当たり、速度を落としながらバウンドまたは転がり続けます。",
  passedWhy:
    "打球が内野の捕球可能な区域を抜けました。外野の追球、中継、塁のカバーとバックアップを判断し直します。",
  homeRunWhy:
    "地面に触れずに打球が設定のフェンスを越えました。打者と前の走者に本塁までの進塁が与えられ、この進塁で送球によるアウトはありません。",
  boundaryDoubleWhy:
    "バウンドした打球がフェンスを越えました。元の位置から2個の塁が与えられます。悪送球やエラーではありません。",
  trajectoryLimit:
    "指定した落下距離はこの打球設定の範囲外です。表示の落下地点は、選んだ強さで到達できる軌道を示します。",
  physicsNote:
    "中学生向けの仮設定：打撃から一塁まで5.3／4.7／4.2秒。モデルのフェンス高は{wallHeight}mです。地面、バウンド、送球の数値は実測で調整が必要です。対象となる内野から二塁への悪送球を任意で加えられます。完全な挟殺は対象外です。",
  runnerFinishOut:
    "アウトでも一塁を全力で駆け抜け、その後はプレーを妨げない場所へ離れます。",
  runnerFinishOutWhy:
    "すでにアウトが記録されています。走り切っても塁を得たりアウトが取り消されたりはしません。続く守備を妨げないようにします。",
  runnerContactReadWhy:
    "投手を抜けるゴロを確認します。捕球と送球の見込み時間から本塁を狙えますが、守備の対応で状況は変わります。",
  runnerFreezeWhy:
    "2アウト未満ではゴロを確認してから本塁を狙います。P・C・3Bへの打球ではまず止まります。フォースや2アウトでは役割が変わります。",
  runnerContactWhy:
    "積極的なコンタクトプレーです。投手を抜けるゴロや二遊間・一塁手へのゴロで本塁へ走ります。危険もあり、準備のできた守備にはアウトにされます。P・C・3Bへの打球では、フォースや2アウトの場合を除き、まず止まって確認します。",
  runnerHoldWhy:
    "次の塁へ進む時間の余裕が足りないか、前の走者がその塁を必要としています。進める塁まで走り、さらに進めるとは決めつけず守備を確認します。",
  runnerOverrun:
    "一塁を全力で駆け抜け、ベースの先で減速してボールを確認します。",
  runnerOverrunWhy:
    "通常の内野プレーでは一塁を駆け抜け、速やかに戻ります。悪送球を確認して次の塁を狙う場合は、一塁で制御して方向を変えるか、駆け抜け後に帰塁してから進みます。",
  runnerRound: "一塁を回り、ボールとコーチを見て、進塁か帰塁を判断します。",
  runnerRoundWhy:
    "外野へのヒットでは曲線で一塁に入り、勢いを調整して回ります。駆け抜け時の保護とは異なり、進めないときは一塁へ戻ります。",
  runnerReturnFirst: "守備を確認して一塁へ戻ります。追加の進塁はしません。",
  retrieve:
    "ボールが捕球地点に達しました。{fielder}が追いついて確保する間、走者は進塁できる時間を判断します。",
  targetHomeClose:
    "ボールは走者より先に本塁へ届く見込みですが、タッチのタイミングは際どい状況です。生還を阻止するため、本塁を狙います。結果は確実ではありません。",
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
    "隣の外野手が打球を支えます。内野から二塁への次の送球に備え、二塁の外野側で支えます。塁間の内側は受け手やバックアップ役のために空けておきます。",
  thirdControlWhy:
    "外野への安打では二塁を回って進塁する可能性があります。任意の中継バックアップより先に、三塁のカバーを確保します。",
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
  ready:
    "アウト数と走者を確認します。マークはゴロの狙い、または空中の打球の希望落下地点です。打球を止める位置ではありません。",
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
  trailerAction: "{from}の後方で、{base}への中継線に入ります。",
  cutoffIntercepted: "{player}が捕球できる高さの送球をカットし、次のプレーを判断します。",
  trailerWhy: "二塁には代わりのカバー役がいます。主な中継役の後方に間隔を取り、高い送球やショートバウンドの送球が抜けたときに備えます。",
  innerCutoffWhy: "内野のカット位置で本塁のプレーに早く備えます。二遊間の選手が深い位置の中継を担当する間、捕球、保持、送球先の変更に備えます。",
  relayNext: "送球先に体を向けて捕球し、次の受け手を確認してから送ります。",
  backupFieldAction: "{player}の捕球地点の後ろをカバーします。",
  backupFieldWhy:
    "打球が捕球役の後ろへ抜けたとき、余分な進塁をされる前に処理します。",
  backupThrowAction: "{base}への送球をバックアップします。",
  backupThrowWhy:
    "受け手の後方で送球の延長線に入ります。悪送球による余分な進塁を防ぎます。",
  anticipatedBackupWhy:
    "現在の返球では二塁のアウトが間に合いません。三塁へ進む走者を読み、三塁への送球が抜けた場合に備えて塁の後方に入ります。",
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
    "守備の状況が変わり追加進塁が危険になったため、走路を戻って{base}へ帰ります。",
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
    "塁間{baseMetres}m、両翼{cornerMetres}m・中堅{centreMetres}mの模式図と、少年野球向けの走力・送球の仮定で時間を計算します。学習用のモデルであり、試合結果の予測ではありません。",
  convention:
    "深い打球では打球側の二遊間が主な中継役となり、内野の本塁カット役と連携します。途中の受け手は最大2人です。二塁の代わりのカバー役がいる場合だけ後方の中継役を置きます。捕球のたびに送球先と9人全員の役割を判断し直します。",
  alternative:
    "送球先、走者の積極性、打球の強さ、位置を変えて再生成し、別の守備対応を比べましょう。",
  unsupported:
    "動的シミュレーターではゴロ・ライナー・フライ・ポップフライ・通常のフェアバントを選べます。エラーは対象となる内野から二塁への高い悪送球のみ対応します。スクイズ、完全な挟殺は生成しません。プレー図鑑の例も利用できます。",
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
          : value === "Fly ball"
            ? "フライ"
            : value === "Line drive"
              ? "ライナー"
              : value === "Pop-up"
                ? "ポップフライ"
                : value === "Bunt"
                  ? "バント"
                  : "外野へのヒット"
        : String(value);
    return String(value);
  });
}
export const dynamicMessages = { english, japanese };
