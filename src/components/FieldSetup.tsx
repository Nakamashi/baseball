import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { DynamicSettings } from "../dynamic/types";
import { ui, type Locale } from "../i18n";
import { isAirborneType, type BallTrajectory } from "../dynamic/trajectory";

interface Props {
  settings: DynamicSettings;
  setSettings: Dispatch<SetStateAction<DynamicSettings>>;
  locale: Locale;
}
export function StartingSituation({ settings, setSettings, locale }: Props) {
  const t = ui(locale), s = settings.state;
  return <div className="starting-situation" role="group" aria-label={t("startingSituation")}>
    <strong>{t("startingSituation")}</strong>
    <div className="base-diamond" role="group" aria-label={t("runnersOn")}>
      {([2, 3, 1] as const).map(base => <button key={base} className={`base-toggle base-${base}`}
        aria-label={t(base === 1 ? "first" : base === 2 ? "second" : "third")}
        aria-pressed={s.runners[`R${base}`] === base}
        onClick={() => setSettings(c => {
          const runners = { ...c.state.runners };
          if (runners[`R${base}`]) delete runners[`R${base}`]; else runners[`R${base}`] = base;
          return { ...c, state: { ...c.state, runners } };
        })}><span>{base}</span></button>)}
    </div>
    <div className="starting-outs"><span>{t("outs")}</span><div className="segmented">
      {[0, 1, 2].map(outs => <button key={outs} aria-label={`${outs} ${t("outs")}`} aria-pressed={s.outs === outs}
        className={s.outs === outs ? "active" : ""}
        onClick={() => setSettings(c => ({ ...c, state: { ...c.state, outs } }))}>{outs}</button>)}
    </div></div>
  </div>;
}

export function QuickHitEditor({ settings, setSettings, locale, onClose, preview, error }: Props & {
  onClose: () => void; preview?: BallTrajectory; error?: string;
}) {
  const t = ui(locale);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const update = () => {
      const marker = document.querySelector<SVGGraphicsElement>(".hit-destination"), box = panel.current;
      if (!marker || !box) return;
      const matrix = marker.getScreenCTM();
      if (!matrix) return;
      const stage = marker.closest(".field-stage")!.getBoundingClientRect();
      const mobile = window.matchMedia("(max-width: 600px), (max-width: 950px) and (max-height: 500px)").matches;
      box.style.maxHeight = mobile ? "" : `${Math.max(120, Math.min(innerHeight - 16, stage.height))}px`;
      const w = box.offsetWidth, h = box.offsetHeight;
      const topEdge = Math.max(8, stage.top), bottomEdge = Math.min(innerHeight - 8, stage.bottom);
      const leftEdge = Math.max(8, stage.left), rightEdge = Math.min(innerWidth - 8, stage.right);
      const right = matrix.e + 26;
      const left = right + w <= rightEdge ? right : matrix.e - w - 26;
      setPosition({
        left: Math.max(leftEdge, Math.min(rightEdge - w, left)),
        top: Math.max(topEdge, Math.min(bottomEdge - h, matrix.f - h / 2)),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    if (panel.current) observer.observe(panel.current);
    const field = document.querySelector(".field"); if (field) observer.observe(field);
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      observer.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [settings.ball.destination]);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!target.closest(".quick-hit-editor, .field, .generate-box")) onClose();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [onClose]);
  const ball = (patch: Partial<DynamicSettings["ball"]>) => setSettings(c => ({
    ...c, ball: { ...c.ball, ...patch },
    throwTarget: patch.type === "Ground ball" && c.throwTarget === "cutoff" ? "auto" : c.throwTarget,
  }));
  return <div ref={panel} className="quick-hit-editor" role="dialog" aria-modal="false" aria-labelledby="quick-hit-title"
    tabIndex={-1} style={{ left: position.left, top: position.top }}>
    <div className="label-row"><strong id="quick-hit-title">{t("quickHit")}</strong><button onClick={onClose}>{t("done")}</button></div>
    <p className="quick-location">{t(isAirborneType(settings.ball.type) ? "requestedLanding" : "aimDirection")}
      {" "}({Math.round(settings.ball.destination.x)}, {Math.round(settings.ball.destination.y)})</p>
    <div role="group" aria-label={t("ballType")} className="quick-types">
      {([ ["Ground ball", "groundBall"], ["Line drive", "lineDrive"], ["Fly ball", "flyBall"], ["Pop-up", "popUp"], ["Bunt", "bunt"] ] as const)
        .map(([type, key]) => <button key={type} aria-pressed={settings.ball.type === type} onClick={() => ball({ type })}>{t(key)}</button>)}
    </div>
    <div role="group" aria-label={t("strength")} className="quick-strength">
      {(["soft", "normal", "hard"] as const).map(strength => <button key={strength} aria-pressed={settings.ball.strength === strength}
        onClick={() => ball({ strength })}>{t(strength)}</button>)}
    </div>
    {preview?.launch.adjusted && <p className="hint">{t("landingConstrained")}</p>}
    {error && <p className="quick-error" role="status">{error}</p>}
    <details className="quick-help"><summary>{t("locationHelp")}</summary>
    <p className="hint">{t(isAirborneType(settings.ball.type) ? "airLandingHint" : settings.ball.type === "Bunt" ? "buntAimHint" : "groundAimHint")}</p>
    <p className="hint">{t("moveHitHint")}</p>
    </details>
  </div>;
}
