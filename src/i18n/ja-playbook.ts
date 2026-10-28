// Exact authored text -> Japanese. Missing entries fail the translation audit.
// Keep stable player IDs (P, SS, R1…) so students can connect text to the field.
export const jaPlaybook: Record<string, string> = {
  "Ground balls · basics": "ゴロの基本",
  "Ground balls · runners": "走者がいる場面のゴロ",
  "Fly balls & line drives": "フライ・ライナー",
  "Base hits": "ヒット",
  Bunts: "バント",
  Ready: "守備の準備",
  Contact: "打球への反応",
  "Field & decide": "捕球と判断",
  Throw: "送球",
  Receive: "送球を受ける",
  Outcome: "結果の確認",
  Catch: "フライを捕る",
  "Retouch & hold": "帰塁して待つ",
  "Tag & go": "タッチアップ",
  "Retrieve & align": "捕球と中継の準備",
  "Hold the ball": "ボールを保持する",
  "6-3 · Ground ball to SS": "6-3・遊撃手へのゴロ",
  "4-3 · Ground ball to 2B": "4-3・二塁手へのゴロ",
  "5-3 · Ground ball to 3B": "5-3・三塁手へのゴロ",
  "1-3 · Ground ball to P": "1-3・投手へのゴロ",
  "3-1 · Pitcher covers first": "3-1・投手が一塁をカバー",
  "6-4-3 · Turn two": "6-4-3・ダブルプレー",
  "4-6-3 · Reverse the pivot": "4-6-3・二塁手からの併殺",
  "5-4-3 · Relay arrives late": "5-4-3・一塁への送球が間に合わない例",
  "1-6-3 · Back to the middle": "1-6-3・投手からの併殺",
  "Check R2 · Take the sure out": "二塁走者を確認し、確実に一塁でアウト",
  "Two outs · Finish the inning": "2アウト・確実に攻守交代へ",
  "Bases loaded · Home to first": "満塁・本塁から一塁へ",
  "Routine fly · Centre field": "センターへの通常のフライ",
  "Fly to left · Return to first": "レフトフライ・一塁へ帰塁",
  "Deep fly · Tag and score": "深いフライ・タッチアップで生還",
  "Shallow fly · Hold at third": "浅いフライ・三塁で待つ",
  "Deep right · Tag to third": "深いライトフライ・三塁へタッチアップ",
  "Infield fly · No force to advance": "インフィールドフライ・進塁の義務なし",
  "Line drive · Return or be doubled off": "ライナー・帰塁が遅れると併殺",
  "Single to left · Keep it to one": "レフト前ヒット・一塁で止める",
  "Single to right · First to third": "ライト前ヒット・一塁から三塁へ",
  "Single to centre · Relay home": "センター前ヒット・本塁へ中継",
  "Sacrifice bunt · Third-base side": "送りバント・三塁側",
  "Sacrifice bunt · First-base side": "送りバント・一塁側",
  "Field cleanly and secure the available out at first.":
    "確実に捕球し、一塁で取れるアウトを取りましょう。",
  "If the ball is bobbled, reset your feet and choose the safest available play.":
    "捕球が乱れたら足を整え、最も確実なプレーを選びましょう。",
  "Read the outs and runners. Choose a player to follow their assignment.":
    "アウト数と走者を確認しましょう。選手を選ぶと、その役割を追えます。",
  "Read the contact; prepare to back up the next throw.":
    "打球を見て、次の送球のバックアップに備えます。",
  "Moving toward the likely play prevents extra bases on an overthrow.":
    "次のプレーに備えて動くと、悪送球による余分な進塁を防げます。",
  "Watch the ball and runners; communicate before changing assignments.":
    "ボールと走者を見て、役割を変える前に声をかけ合いましょう。",
  "Leave the catching stance and direct the defense.":
    "捕手の構えを解き、守備全体に指示を出します。",
  "The catcher sees the whole field and calls the base for the throw.":
    "捕手は全体を見渡せるので、送球する塁を伝えます。",
  "Cover first and show your glove.":
    "一塁をカバーし、グラブを送球の目標にします。",
  "Catch the ball with a foot on the base before BR arrives.":
    "BRが到達する前に、ベースに触れた状態で送球を捕ります。",
  "Read the ball and cover the middle of the diamond.":
    "打球を見て、内野の中央をカバーします。",
  "Be ready for a force, relay, or deflected ball.":
    "フォースプレー、中継、はじいた打球に備えます。",
  "Protect third and watch the lead runner.":
    "三塁を守り、先の塁にいる走者を確認します。",
  "An uncovered base can allow an unnecessary advance.":
    "塁を空けると、余分な進塁を許してしまいます。",
  "Field the ball with your body behind it; set your feet.":
    "体を打球の正面に入れて捕球し、足を整えます。",
  "A clean pickup makes the next throw easier.":
    "確実に捕球すると、次の送球がしやすくなります。",
  "Move in behind the left side of the infield.":
    "内野の左側の後ろへ寄ってカバーします。",
  "Back up a missed grounder or a throw toward third.":
    "抜けたゴロや三塁への送球をバックアップします。",
  "Move in line behind second base.": "二塁の後方の延長線上へ移動します。",
  "A ball past the middle infield should not become an extra base.":
    "二遊間を抜けたボールで余分に進塁されないようにします。",
  "Back up the throw toward first base.": "一塁への送球をバックアップします。",
  "Stop a wild throw before the batter can take another base.":
    "悪送球を止めて、打者走者の余分な進塁を防ぎます。",
  "Run hard through first on a ground ball.":
    "ゴロでは一塁を全力で駆け抜けます。",
  "Touch the base; look to the coach after crossing it.":
    "ベースを踏み、通過してからコーチを確認します。",
  "Field cleanly. Find the covering player and choose the safe throw.":
    "確実に捕球します。カバーする選手を見つけ、安全に送球します。",
  "You are out. The play continues for the other runners.":
    "あなたはアウトです。他の走者のプレーは続いています。",
  "Review the timing of the catch, force, or relay with your coach.":
    "捕球、フォースプレー、中継のタイミングをコーチと確認しましょう。",
  "Keep possession as the play finishes.":
    "プレーが終わるまでボールを確実に保持します。",
  "Read the ball and coordinate middle-infield coverage.":
    "打球を見て、二遊間のカバーを分担します。",
  "One middle infielder fields while the other protects the base.":
    "二遊間の一人が捕球し、もう一人が塁を守ります。",
  "The pitcher runs toward the first-base line, then turns up the line to receive the toss without crossing the runner’s path.":
    "投手は一塁線に向かい、走路を横切らずに線に沿って一塁へ進み、トスを受けます。",
  "Run toward the first-base line and cover first.":
    "一塁線に向かって走り、一塁をカバーします。",
  "1B has moved away from the base to field the ball.":
    "1Bが捕球のために一塁を離れているからです。",
  "Stay clear of BR and locate the bag before receiving the toss.":
    "BRの走路を避け、トスを受ける前にベースの位置を確認します。",
  "Get the lead force out first, then attempt the relay.":
    "まず先行走者をフォースアウトにしてから、併殺の送球を狙います。",
  "An attempted double play is not guaranteed. Secure the first out before rushing the relay.":
    "併殺は必ず成功するわけではありません。送球を急ぐ前に、一つ目のアウトを確実に取りましょう。",
  "On a slow ball or poor exchange, take one out. A relay should not be forced.":
    "遅い打球や持ち替えが乱れた場面では、一つのアウトを優先します。無理に併殺を狙いません。",
  "Move to first and present a target.": "一塁に入り、送球の目標を作ります。",
  "A clear target helps the infielder finish the routine out.":
    "目標がはっきりしていると、内野手が確実にアウトを取れます。",
  "Cover second and show your glove.": "二塁をカバーし、グラブを目標にします。",
  "Touch second with possession before making the relay.":
    "ボールを保持して二塁に触れてから、一塁へ送球します。",
  "Sprint to first; beat the relay.":
    "全力で一塁へ走り、中継の送球より早く到達しましょう。",
  "You can still reach safely even if R1 is forced out.":
    "R1がフォースアウトになっても、自分はセーフになれる可能性があります。",
  "Run directly to second.": "二塁へまっすぐ走ります。",
  "The batter becoming a runner forces you off first.":
    "打者が走者になったため、一塁を空けて進む義務があります。",
  "Relay to first. Compare the catch with the batter-runner arriving.":
    "一塁へ中継します。捕球と打者走者の到達のタイミングを比べましょう。",
  "The lead force is already secured; now try to retire BR.":
    "先行走者のフォースアウトを確保したので、次にBRのアウトを狙います。",
  "Turn and relay to first if the lane is clear.":
    "送球路が空いていれば、体を向けて一塁へ送球します。",
  "R1 is forced out at second. BR beats the relay to first; one out recorded.":
    "R1は二塁でフォースアウト。BRは送球より先に一塁へ到達し、アウトは一つです。",
  "R2 holds at second. BR is out at first.":
    "R2は二塁にとどまり、BRは一塁でアウトになります。",
  "If R2 breaks for third and an easy out is available, the defense may play on the lead runner. Do not chase them while losing the sure out.":
    "R2が三塁へ走り、容易にアウトにできるなら先行走者を狙えます。ただし追いかけて確実なアウトを失わないようにします。",
  "Check that R2 stays at second before throwing to first.":
    "一塁へ送球する前に、R2が二塁にとどまるか確認します。",
  "Hold at second on this ball in front of you.":
    "このように自分の前方へのゴロでは、二塁にとどまります。",
  "Running toward third risks an easy out. Read the shortstop before moving.":
    "三塁へ走ると簡単にアウトになる危険があります。遊撃手を見てから判断します。",
  "SS checks R2 at second, then takes the sure out at first.":
    "SSは二塁のR2を確認してから、一塁で確実にアウトを取ります。",
  "Force out at first ends the inning. No second throw is needed.":
    "一塁のフォースアウトで攻守交代です。追加の送球は必要ありません。",
  "Run to second because you are forced.":
    "進塁の義務があるので二塁へ走ります。",
  "The defense needs only one out to end the inning.":
    "守備はあと一つアウトを取れば攻守交代です。",
  "Use the force at home, then attempt first only if there is time.":
    "本塁のフォースアウトを取り、余裕があれば一塁への送球を狙います。",
  "Force out at home, then a 1-2-3 double play ends the inning. No run scores.":
    "本塁でフォースアウトを取り、1-2-3の併殺で攻守交代。得点は入りません。",
  "The bases are loaded, so the runner from third is forced. The catcher may touch home without tagging the runner.":
    "満塁なので三塁走者には進塁の義務があります。捕手は走者にタッチせず、本塁に触れるだけでアウトにできます。",
  "Cover home and show your glove.": "本塁をカバーし、グラブを目標にします。",
  "Touch home to retire the forced runner.":
    "ボールを持って本塁に触れ、走者をフォースアウトにします。",
  "Advance toward the next base on the ground ball.":
    "ゴロでは次の塁へ進みます。",
  "Every runner is forced because all bases were occupied.":
    "満塁だったので、すべての走者に進塁の義務があります。",
  "Throw to C at home for the force.":
    "本塁のCへ送球し、フォースアウトを取ります。",
  "Secure the catch first, then control the runners.":
    "まずフライを確実に捕り、その後で走者に対応します。",
  "Catch completed. BR is out; existing runners hold or return.":
    "捕球が成立してBRはアウト。ほかの走者は塁にとどまるか帰塁します。",
  "On a caught ball, retouch before advancing. Return promptly if you left early.":
    "フライが捕られたら、進塁前に元の塁を踏み直します。早く離れていたら速やかに帰塁しましょう。",
  "Avoid speculative throws when the runner has returned safely.":
    "走者が安全に帰塁したら、無理な送球は避けます。",
  "Hold near the mound and monitor the runners.":
    "マウンド付近で走者の動きを確認します。",
  "There is no immediate throw to back up. Be ready if the play changes.":
    "今すぐバックアップする送球はありません。状況の変化に備えます。",
  "Cover home and direct the cutoff.": "本塁を守り、カット役に指示を出します。",
  "Call whether the throw should come through or be cut.":
    "本塁まで通すか、途中でカットするかを声で伝えます。",
  "Protect first and watch the runner’s retouch.":
    "一塁を守り、走者がベースを踏み直すか確認します。",
  "You may be needed for a return throw or appeal.":
    "帰塁を狙う送球やアピールプレーに備えます。",
  "Move into the outfield relay lane.": "外野からの中継の送球路へ入ります。",
  "Give the outfielder a visible cutoff target and listen to the catcher.":
    "外野手にカットの目標を示し、捕手の指示を聞きます。",
  "Cover third and watch the runner.": "三塁をカバーし、走者を確認します。",
  "Receive a throw if a runner tries to advance.":
    "走者が進塁を狙ったら送球を受けます。",
  "Protect second or support the relay lane.":
    "二塁を守るか、中継の送球路を支えます。",
  "Keep track of runners and avoid leaving the middle uncovered.":
    "走者を見失わず、内野の中央を空けないようにします。",
  "Back up CF on the left.": "CFの左側でバックアップします。",
  "Stay clear of the called catch and stop a missed ball.":
    "捕球する選手を妨げず、捕り損ねたボールを止めます。",
  "Call the ball loudly; get behind it and make the catch.":
    "大きな声で捕球を宣言し、落下点の後ろに入って捕ります。",
  "A teammate who hears your call can back you up instead of colliding.":
    "声が届けば、味方は衝突を避けてバックアップに回れます。",
  "After the catch, set your feet toward the next base.":
    "捕球後は送球する塁に向けて足を整えます。",
  "Back up CF on the right.": "CFの右側でバックアップします。",
  "Keep a second line of defense behind the catch.":
    "捕球位置の後方にも守備を置きます。",
  "Run toward first while watching the fly.":
    "フライを確認しながら一塁へ走ります。",
  "The ball may drop. Continue running until the catch makes you out.":
    "落球の可能性があります。捕球でアウトになるまでは走り続けます。",
  "Catch secured. BR is out. Runners must retouch before attempting to advance.":
    "捕球が成立してBRはアウト。走者は進塁の前に元の塁を踏み直す必要があります。",
  "Runners return to their original bases. The defense keeps the ball under control.":
    "走者は元の塁へ戻り、守備はボールを確実に管理します。",
  "Back up LF from behind the catch.":
    "LFの捕球位置の後ろでバックアップします。",
  "Recover a ball that gets past the left fielder.":
    "左翼手の後ろに抜けたボールを処理します。",
  "Move toward right-centre and watch runners.":
    "右中間に寄り、走者の動きを見ます。",
  "Remain ready to back up a relay across the field.":
    "反対側への中継送球のバックアップに備えます。",
  "Read the fly and return to first when it is caught.":
    "フライを見て、捕球されたら一塁に戻ります。",
  "Do not advance without a legal retouch.":
    "元の塁を正しく踏み直さずに進塁してはいけません。",
  "CF catches the fly. R3 retouches after the catch and scores ahead of the throw.":
    "CFが捕球。R3は捕球後に三塁を踏み直してスタートし、送球より早く生還します。",
  "A runner may leave when the ball is first touched. This example waits until the catch is secured.":
    "走者は野手が最初にボールに触れた時点から離塁できます。この例では確実な捕球を待ちます。",
  "Depth, runner speed, arm strength and score affect the tag-up decision. Holding can be correct.":
    "打球の深さ、走力、肩の強さ、点差で判断は変わります。進塁せず待つことも正解です。",
  "Back up home behind the catcher.":
    "捕手の後ろで本塁への送球をバックアップします。",
  "A throw home could get past C if R3 tags.":
    "R3がタッチアップすると、本塁への送球がCの後ろへ抜ける可能性があります。",
  "Wait on third for the catch, then sprint home.":
    "三塁で捕球を待ってから、本塁へ全力で走ります。",
  "A deep fly gives time to score after tagging.":
    "深いフライならタッチアップ後に生還する時間ができます。",
  "Relay home. R3 scores before the ball arrives.":
    "本塁へ中継。ボールの到着より先にR3が生還します。",
  "You have scored. Stay clear of the continuing play.":
    "得点しました。続いているプレーを妨げない場所へ移動しましょう。",
  "On this shallow catch, the runner on third holds: the throw is short and the risk is high.":
    "この浅いフライでは三塁走者は待ちます。送球距離が短く、アウトになる危険が高いためです。",
  "Retouch third and hold on the shallow fly.":
    "浅いフライでは三塁を踏み直してとどまります。",
  "A short throw makes attempting home too risky.":
    "送球距離が短いため、本塁を狙うのは危険です。",
  "RF catches the fly. R2 tags legally and reaches third safely.":
    "RFが捕球。R2は正しくタッチアップして三塁へ進み、セーフになります。",
  "Back up third, behind 3B.": "3Bの後ろで三塁への送球をバックアップします。",
  "Stop an overthrow as R2 attempts to tag to third.":
    "R2が三塁へタッチアップする際の悪送球を止めます。",
  "Align as cutoff between RF and third.":
    "RFと三塁を結ぶ線上にカット役として入ります。",
  "This convention uses SS on throws to third, with 3B at the bag.":
    "この守備方法では、三塁への送球をSSが中継し、3Bがベースに入ります。",
  "Move toward the infield behind third.": "三塁後方の内野寄りへ移動します。",
  "Back up the possible throw to third.":
    "三塁への送球に備えてバックアップします。",
  "Back up RF behind the ball.": "RFの捕球位置の後方でバックアップします。",
  "Recover the ball if the catch is missed.":
    "捕り損ねた場合はボールを処理します。",
  "Wait at second; tag after the catch and run to third.":
    "二塁で待ち、捕球後にタッチアップして三塁へ走ります。",
  "The deep ball to RF makes third a plausible advance.":
    "ライトへの深い打球なので、三塁への進塁を狙える場面です。",
  "Relay to third; R2 reaches safely.":
    "三塁へ中継しますが、R2が先に到達してセーフになります。",
  "Recognize the infield fly: the batter is out, but runners are not forced.":
    "インフィールドフライでは打者はアウトですが、走者に進塁の義務はありません。",
  "BR is out on the declared infield fly. The ball is caught; R1 and R2 hold.":
    "インフィールドフライの宣告でBRはアウト。ボールも捕球され、R1とR2は塁にとどまります。",
  "With runners on first and second (or bases loaded) and fewer than two outs, an ordinary-effort fair infield fly can retire the batter when declared. A bunt or line drive never qualifies.":
    "無死または一死で走者が一・二塁か満塁のとき、内野手が普通の守備で捕れるフェアの飛球に宣告されることがあります。バントやライナーには適用されません。",
  "If the declared fly drops, BR remains out. Runners may advance at their own risk; a tag is needed because the force has been removed.":
    "宣告後に落球してもBRはアウトです。走者は自己の判断で進塁できますが、フォースの状態は消えているため守備は走者へのタッチが必要です。",
  "Yield to SS’s call and back up the pop-up.":
    "SSの声に従って捕球を任せ、後ろをカバーします。",
  "The batter is already out when the umpire declares infield fly.":
    "審判がインフィールドフライを宣告した時点で、打者はアウトです。",
  "Stay at first and watch the catch.": "一塁で待ち、捕球を確認します。",
  "The infield fly removes the force. Retouch if the ball is caught.":
    "インフィールドフライで進塁の義務はなくなります。捕球された場合は元の塁を踏み直します。",
  "Stay at second; do not run just because BR is out.":
    "二塁にとどまります。BRがアウトになったからといって走る必要はありません。",
  "You are no longer forced to third.":
    "三塁への進塁の義務はなくなっています。",
  "The umpire has declared infield fly. SS also catches it; both runners remain on their bases.":
    "審判がインフィールドフライを宣告。SSが捕球し、二人の走者は元の塁にとどまります。",
  "Catch the line drive and appeal at first before R1 returns.":
    "ライナーを捕り、R1が戻る前に一塁へ送球して帰塁の遅れをアピールします。",
  "SS catches the line drive, then appeals at first before R1 returns: double play.":
    "SSがライナーを捕り、R1が戻る前に一塁でアピールして併殺になります。",
  "If R1 retouches first before the appeal, there is no second out. This script illustrates a late return.":
    "R1がアピールより先に一塁を踏み直せば、二つ目のアウトにはなりません。この例では帰塁が遅れます。",
  "Move behind the first-base throw.": "一塁への送球の後ろへ移動します。",
  "The appeal can retire R1, but an overthrow still needs a backup.":
    "アピールでR1をアウトにできますが、悪送球への備えも必要です。",
  "Catch the line drive, then check R1.":
    "ライナーを捕り、R1の位置を確認します。",
  "An appeal throw to first can retire a runner who left early.":
    "早く離塁した走者は、一塁へのアピール送球でアウトにできることがあります。",
  "React to the catch and return immediately to first.":
    "捕球を見たらすぐに一塁へ戻ります。",
  "A caught line drive removes the force, but you must retouch.":
    "ライナーの捕球で進塁の義務はなくなりますが、元の塁を踏み直す必要があります。",
  "Appeal at first before R1 can retouch.":
    "R1が一塁を踏み直す前にアピールします。",
  "Retrieve quickly, align the cutoff, and prevent an extra base.":
    "素早く処理し、中継を整えて余分な進塁を防ぎます。",
  "BR reaches first safely. The ball returns to the infield.":
    "BRは一塁へ到達してセーフ。ボールは内野へ戻ります。",
  "Cutoff convention: 2B relays routine balls from LF to the middle; SS cuts RF-to-third throws; 1B cuts CF-to-home throws. Team systems vary.":
    "この例の中継分担：LFから内野中央へは2B、RFから三塁へはSS、CFから本塁へは1Bがカット役です。チームによって方法は異なります。",
  "A clean single is not an automatic attempt at second. Round first under control and read the coach.":
    "ヒットでも必ず二塁を狙うわけではありません。一塁を回ったら体勢を保ち、コーチを確認します。",
  "Back up the infield return.": "内野へ戻る送球をバックアップします。",
  "Stay deep enough to stop an overthrow.":
    "悪送球を止められるよう、十分に後方へ入ります。",
  "Move into the cutoff lane from LF toward second.":
    "LFから二塁へ向かう送球の中継位置に入ります。",
  "Shorten the outfielder’s throw and control BR.":
    "外野手の送球距離を短くし、BRの進塁を抑えます。",
  "Back up second on the left side.": "二塁の左側をバックアップします。",
  "Prevent an advance by the trailing runner.": "後ろの走者の進塁を防ぎます。",
  "Get behind the ball; field and throw to the cutoff.":
    "打球の後ろに入り、捕球してカット役へ送球します。",
  "A controlled throw gives the infield a chance to stop the lead runner.":
    "正確に送ることで、内野が先行走者を止められる可能性が生まれます。",
  "Touch first, round under control, then stay.":
    "一塁を踏んで無理なく回り、一塁にとどまります。",
  "The throw may go past you, but do not assume second is safe.":
    "送球が先の塁へ向かっても、二塁が安全とは限りません。",
  "The outfielder secures the hit. The cutoff lines up with the target base.":
    "外野手が打球を確保し、カット役が送球先の塁と一直線に並びます。",
  "The cutoff holds the ball. BR stays at first.":
    "カット役がボールを保持し、BRは一塁にとどまります。",
  "R1 reaches third ahead of the relay. BR stays at first.":
    "R1は中継の送球より先に三塁へ到達。BRは一塁にとどまります。",
  "R1 should stop at second if the ball is fielded quickly, the arm is strong, or the third-base coach holds them.":
    "処理が早い、外野手の肩が強い、または三塁コーチが止める場合は、R1は二塁で止まります。",
  "Back up third.": "三塁への送球をバックアップします。",
  "Cover second as the ball comes in.": "返球に合わせて二塁をカバーします。",
  "Stop BR from taking an extra base and protect the middle.":
    "BRの余分な進塁を防ぎ、内野の中央を守ります。",
  "Cut the RF throw toward third.": "RFから三塁への送球を中継します。",
  "Align with 3B so the relay is quick and accurate.":
    "3Bと一直線に並び、素早く正確に中継できるようにします。",
  "Touch second; take third on the coach’s signal.":
    "二塁を踏み、コーチの指示で三塁を狙います。",
  "This script assumes a sufficiently deep single to RF.":
    "この例は、十分に深いライト前ヒットを想定しています。",
  "Relay toward the lead runner; the runner arrives safely.":
    "先行走者の進塁先へ中継しますが、走者が先に到達してセーフです。",
  "R2 scores ahead of the relay. BR stays at first.":
    "R2は送球より先に生還し、BRは一塁にとどまります。",
  "Hold R2 at third if the coach judges the throw will beat the runner. A cutoff may hold the ball to keep BR at first.":
    "送球の方が早いとコーチが判断したら、R2を三塁で止めます。カット役はBRを一塁にとどめるため、送球せず保持することもあります。",
  "Back up home.": "本塁への送球をバックアップします。",
  "Align between CF and home.": "CFと本塁を結ぶ線上に入ります。",
  "Show both hands and relay only when the receiving fielder calls for it.":
    "両手で目標を示し、受ける野手の指示があった場合に中継します。",
  "Cut and hold if there is no play; keep trailing runners from advancing.":
    "アウトを狙えなければカットして保持し、後ろの走者の進塁を防ぎます。",
  "Cover second while 1B aligns as cutoff.":
    "1Bがカット役に入る間、二塁をカバーします。",
  "Touch third and run home on the coach’s signal.":
    "三塁を踏み、コーチの指示で本塁へ走ります。",
  "This script assumes a deep enough single and a runner who can beat the relay.":
    "この例は、十分に深いヒットと中継より早く生還できる走者を想定しています。",
  "Communicate bunt coverage and secure the out at first.":
    "バントの役割を声で確認し、一塁で確実にアウトを取ります。",
  "BR is out at first; R1 advances safely to second. A sacrifice bunt.":
    "BRは一塁でアウト、R1は二塁へ進んでセーフ。送りバントが成功します。",
  "This is a sacrifice with a routine chance at first. Do not force a risky throw to second.":
    "一塁で通常のアウトを取れる送りバントの場面です。無理に二塁へ送球しません。",
  "Cover second while 3B fields the bunt.":
    "3Bがバントを処理する間、二塁をカバーします。",
  "Be available if the lead runner makes a mistake.":
    "先行走者がミスをしたときに対応できるようにします。",
  "Advance to second after reading the bunt down.":
    "バントが地面に落ちたことを確認して二塁へ進みます。",
  "Do not leave early on a ball that could be caught.":
    "捕球される可能性のある打球では、早く飛び出さないようにします。",
  "The charging fielder calls the ball. The covering player presents a target at first.":
    "前進する野手が声を出して捕球し、一塁のカバー役が目標を作ります。",
  "Charge and field the bunt; throw to 2B at first.":
    "前進してバントを処理し、一塁に入る2Bへ送球します。",
  "Call the ball early so pitcher and catcher stop charging.":
    "早めに声を出し、投手と捕手が重なって前進しないようにします。",
  "Cover first while 1B charges.": "1Bが前進する間、一塁をカバーします。",
  "The charging first baseman cannot field and cover the bag at the same time.":
    "前進した一塁手は、打球処理と一塁のカバーを同時にはできません。",
  "Cover second; watch R1.": "二塁をカバーし、R1の動きを見ます。",
  "The second baseman has vacated the middle to cover first.":
    "二塁手が一塁のカバーに回り、二塁を離れているためです。",
};
