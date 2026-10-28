import type { Dispatch, SetStateAction } from "react";
import type { DynamicSettings } from "../dynamic/types";
import { recommendStrategy } from "../dynamic/conventions";
import { ui, type Locale } from "../i18n";
interface Props {
  settings: DynamicSettings;
  setSettings: Dispatch<SetStateAction<DynamicSettings>>;
  locale: Locale;
  onGenerate: () => void;
  pending: boolean;
  error?: string;
  picking: boolean;
  setPicking: (value: boolean) => void;
}
export function DynamicControls({
  settings,
  setSettings,
  locale,
  onGenerate,
  pending,
  error,
  picking,
  setPicking,
}: Props) {
  const t = ui(locale),
    s = settings.state;
  const state = (patch: Partial<typeof s>) =>
    setSettings((current) => ({
      ...current,
      state: { ...current.state, ...patch },
    }));
  const ball = (patch: Partial<typeof settings.ball>) =>
    setSettings((current) => ({
      ...current,
      ball: { ...current.ball, ...patch },
      throwTarget:
        patch.type === "Ground ball" && current.throwTarget === "cutoff"
          ? "auto"
          : current.throwTarget,
    }));
  const recommendation = recommendStrategy(s);
  return (
    <div id="dynamic-controls">
      <details open className="panel">
        <summary>{t("dynamicSetup")}</summary>
        <div className="panel-content">
          <div className="label-row">
            <span>{t("outs")}</span>
            <div className="segmented">
              {[0, 1, 2].map((n) => (
                <button
                  key={n}
                  aria-label={`${n} ${t("outs")}`}
                  aria-pressed={s.outs === n}
                  className={s.outs === n ? "active" : ""}
                  onClick={() => state({ outs: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <fieldset className="dynamic-runners">
            <legend>{t("runnersOn")}</legend>
            {([1, 2, 3] as const).map((n) => (
              <label key={n}>
                <input
                  type="checkbox"
                  checked={s.runners[`R${n}`] === n}
                  onChange={(e) => {
                    const runners = { ...s.runners };
                    if (e.target.checked) runners[`R${n}`] = n;
                    else delete runners[`R${n}`];
                    state({ runners });
                  }}
                />
                {t(n === 1 ? "first" : n === 2 ? "second" : "third")}
              </label>
            ))}
          </fieldset>
          <details className="count-context">
            <summary>
              {t("count")} {s.balls} – {s.strikes}
            </summary>
            <div className="count-row">
              {(["balls", "strikes"] as const).map((key) => (
                <label key={key}>
                  {t(key)}
                  <select
                    aria-label={t(key)}
                    value={s[key]}
                    onChange={(e) => state({ [key]: +e.target.value })}
                  >
                    {Array.from({ length: key === "balls" ? 4 : 3 }, (_, n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>
          <div className="count-row">
            <label>
              {t("inning")}
              <input
                type="number"
                aria-label={t("inning")}
                min="1"
                max="30"
                value={s.inning}
                onChange={(e) => state({ inning: +e.target.value })}
              />
            </label>
            <label>
              {t("half")}
              <select
                aria-label={t("half")}
                value={s.half}
                onChange={(e) =>
                  state({
                    half: e.target.value as "top" | "bottom",
                    fieldingTeam: e.target.value === "top" ? "home" : "away",
                  })
                }
              >
                <option value="top">{t("top")}</option>
                <option value="bottom">{t("bottom")}</option>
              </select>
            </label>
          </div>
          <div className="count-row">
            {(["awayScore", "homeScore"] as const).map((key) => (
              <label key={key}>
                {t(key === "awayScore" ? "away" : "home")}
                <input
                  type="number"
                  aria-label={`${t(key === "awayScore" ? "away" : "home")} ${t("score")}`}
                  min="0"
                  max="99"
                  value={s[key]}
                  onChange={(e) => state({ [key]: +e.target.value })}
                />
              </label>
            ))}
          </div>
          <label className="select-label">
            {t("fieldingTeam")}
            <select
              aria-label={t("fieldingTeam")}
              value={s.fieldingTeam}
              onChange={(e) =>
                state({
                  fieldingTeam: e.target.value as "home" | "away",
                  half: e.target.value === "home" ? "top" : "bottom",
                })
              }
            >
              <option value="home">{t("home")}</option>
              <option value="away">{t("away")}</option>
            </select>
          </label>
          <label className="select-label">
            {t("strategy")}
            <select
              aria-label={t("strategy")}
              value={s.strategy}
              onChange={(e) =>
                state({ strategy: e.target.value as typeof s.strategy })
              }
            >
              {(["standard", "prevent", "conservative"] as const).map((v) => (
                <option value={v} key={v}>
                  {t(v === "conservative" ? "conservativeDefense" : v)}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">
            {t("recommendation")}:{" "}
            {t(
              recommendation === "conservative"
                ? "conservativeDefense"
                : recommendation,
            )}
          </p>
          {recommendation !== s.strategy && (
            <button
              className="text-button"
              onClick={() => state({ strategy: recommendation })}
            >
              {t("applyRecommendation")}
            </button>
          )}
        </div>
      </details>
      <details open className="panel">
        <summary>{t("hitLocation")}</summary>
        <div className="panel-content">
          <label className="select-label">
            {t("ballType")}
            <select
              aria-label={t("ballType")}
              value={settings.ball.type}
              onChange={(e) =>
                ball({ type: e.target.value as typeof settings.ball.type })
              }
            >
              <option value="Ground ball">{t("groundBall")}</option>
              <option value="Base hit">{t("baseHit")}</option>
              <option disabled>{t("flyLater")}</option>
              <option disabled>{t("lineLater")}</option>
              <option disabled>{t("buntLater")}</option>
            </select>
          </label>
          <label className="select-label">
            {t("strength")}
            <select
              aria-label={t("strength")}
              value={settings.ball.strength}
              onChange={(e) =>
                ball({
                  strength: e.target.value as typeof settings.ball.strength,
                })
              }
            >
              {(["soft", "normal", "hard"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <button
            className={picking ? "active pick-location" : "pick-location"}
            aria-pressed={picking}
            onClick={() => setPicking(!picking)}
          >
            {t(picking ? "picking" : "pickLocation")}
          </button>
          <p className="hint">{t("locationHint")}</p>
          <div className="count-row">
            {(["x", "y"] as const).map((key) => (
              <label key={key}>
                {key.toUpperCase()}
                <input
                  type="number"
                  aria-label={`${t("hitLocation")} ${key.toUpperCase()}`}
                  min="0"
                  max={key === "x" ? 1000 : 900}
                  value={Math.round(settings.ball.destination[key])}
                  onChange={(e) =>
                    ball({
                      destination: {
                        ...settings.ball.destination,
                        [key]: +e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </details>
      <details open className="panel">
        <summary>{t("runnersOn")}</summary>
        <div className="panel-content">
          <label className="select-label">
            {t("aggression")}
            <select
              aria-label={t("aggression")}
              value={settings.aggression}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  aggression: e.target.value as typeof settings.aggression,
                })
              }
            >
              {(["conservative", "normal", "aggressive"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="select-label">
            {t("runnerSpeed")}
            <select
              aria-label={t("runnerSpeed")}
              value={settings.runnerSpeed}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  runnerSpeed: e.target.value as typeof settings.runnerSpeed,
                })
              }
            >
              {(["slow", "average", "fast"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="select-label">
            {t("throwTarget")}
            <select
              aria-label={t("throwTarget")}
              value={settings.throwTarget}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  throwTarget: [1, 2, 3].includes(+e.target.value)
                    ? (+e.target.value as 1 | 2 | 3)
                    : (e.target.value as "auto" | "home" | "hold" | "cutoff"),
                })
              }
            >
              <option value="auto">{t("automatic")}</option>
              {([1, 2, 3, "home"] as const).map((b) => (
                <option key={b} value={b}>
                  {t(
                    b === 1
                      ? "first"
                      : b === 2
                        ? "second"
                        : b === 3
                          ? "third"
                          : "homePlate",
                  )}
                </option>
              ))}
              {settings.ball.type === "Base hit" && (
                <option value="cutoff">{t("cutoffOnly")}</option>
              )}
              <option value="hold">{t("holdBall")}</option>
            </select>
          </label>
        </div>
      </details>
      <div className="generate-box">
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        <button className="generate-button" onClick={onGenerate}>
          {t(pending ? "generate" : "regenerate")}
        </button>
        <p className="hint">{t("compareNote")}</p>
      </div>
      <p className="hint scope-note">{t("phase2Scope")}</p>
    </div>
  );
}
