import { useEffect, useMemo, useState } from "react";
import { scenarios } from "./scenarios";
import { sample } from "./simulation/timeline";
import { catalogueChoices, situationKey } from "./simulation/catalogue";
import { type PlayerId, type PlayScenario } from "./simulation/types";
import { usePlayback } from "./hooks/usePlayback";
import { BaseballField, type Layers } from "./components/BaseballField";
import {
  initialLocale,
  playText,
  situationText,
  ui,
  type Locale,
} from "./i18n";
const categories = [...new Set(scenarios.map((s) => s.category))];
export default function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = ui(locale),
    text = playText(locale);
  const [scenario, setScenario] = useState(scenarios[0]),
    [category, setCategory] = useState("all"),
    [situation, setSituation] = useState("all"),
    [query, setQuery] = useState("");
  const [count, setCount] = useState({ balls: 0, strikes: 0 }),
    [selected, setSelected] = useState<PlayerId | null>("SS");
  const [layers, setLayers] = useState<Layers>({
    labels: true,
    movement: true,
    throws: true,
    runners: true,
    annotations: true,
  });
  const playback = usePlayback(scenario);
  const frame = useMemo(
    () => sample(scenario, playback.time),
    [scenario, playback.time],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title =
      locale === "ja"
        ? "野球守備シミュレーター · Field Notes"
        : "Field Notes · Baseball coaching";
    try {
      localStorage.setItem("field-notes-language", locale);
    } catch {
      /* Storage can be unavailable in private browsers. */
    }
  }, [locale]);
  const choices = catalogueChoices(scenarios, category, situation);
  const byCategory =
    category === "all"
      ? scenarios
      : scenarios.filter((s) => s.category === category);
  const compatible = situation === "all" ? byCategory : choices.plays;
  const available = compatible.filter((s) =>
    `${s.id} ${text(s.title)} ${situationText(s.initial, locale)} ${s.title}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  function choose(s: PlayScenario) {
    setScenario(s);
    if (selected && !s.startingPositions[selected]) setSelected(null);
    playback.restart();
  }
  function changeCategory(next: string) {
    setCategory(next);
    setSituation("all");
    setQuery("");
    const pool =
      next === "all" ? scenarios : scenarios.filter((s) => s.category === next);
    if (!pool.includes(scenario)) choose(pool[0]);
  }
  function changeSituation(next: string) {
    setSituation(next);
    setQuery("");
    const pool =
      next === "all"
        ? byCategory
        : byCategory.filter((s) => situationKey(s) === next);
    if (!pool.includes(scenario)) choose(pool[0]);
  }
  const focus = selected ? frame.phase.responsibilities[selected] : null;
  const phaseIndex = scenario.phases.indexOf(frame.phase);
  const previousDisabled = playback.time === 0,
    nextDisabled = playback.time >= playback.total;
  return (
    <main>
      <div className="utility">
        <label>
          {t("language")}
          <select
            aria-label="Language / 言語"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </label>
      </div>
      <div className="workspace">
        <aside className="left-panel">
          <details open className="panel situation">
            <summary>{t("choosePlay")}</summary>
            <div className="panel-content">
              <label className="select-label">
                {t("category")}
                <select
                  aria-label={t("category")}
                  value={category}
                  onChange={(e) => changeCategory(e.target.value)}
                >
                  <option value="all">{t("all")}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {text(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-label">
                {t("situation")}
                <select
                  aria-label={t("situation")}
                  value={situation}
                  onChange={(e) => changeSituation(e.target.value)}
                >
                  <option value="all">{t("allSituations")}</option>
                  {choices.situations.map((s) => (
                    <option key={situationKey(s)} value={situationKey(s)}>
                      {situationText(s.initial, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="current-situation">
                {situationText(scenario.initial, locale)}
              </p>
              <details className="count-context">
                <summary>
                  {t("context")} {count.balls} – {count.strikes}
                </summary>
                <div className="count-row">
                  {(["balls", "strikes"] as const).map((key) => (
                    <label key={key}>
                      {t(key)}
                      <select
                        aria-label={t(key)}
                        value={count[key]}
                        onChange={(e) =>
                          setCount({ ...count, [key]: +e.target.value })
                        }
                      >
                        {Array.from(
                          { length: key === "balls" ? 4 : 3 },
                          (_, n) => (
                            <option key={n}>{n}</option>
                          ),
                        )}
                      </select>
                    </label>
                  ))}
                </div>
              </details>
            </div>
          </details>
          <details open className="panel library">
            <summary>
              <span>{t("library")}</span>
              <span className="number">{available.length}</span>
            </summary>
            <div className="panel-content">
              <input
                className="search"
                type="search"
                aria-label={t("search")}
                placeholder={t("searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="catalogue">
                {available.map((s) => (
                  <button
                    key={s.id}
                    data-scenario={s.id}
                    className={`scenario-card ${s.id === scenario.id ? "chosen" : ""}`}
                    onClick={() => choose(s)}
                  >
                    <span className="scenario-id">{s.id}</span>
                    <span>
                      <strong>{text(s.title)}</strong>
                      <small>{situationText(s.initial, locale)}</small>
                    </span>
                    {s.id === scenario.id && (
                      <span className="chosen-dot">●</span>
                    )}
                  </button>
                ))}
              </div>
              {!available.length && (
                <div role="status" className="empty">
                  <p>{t("noSearch")}</p>
                  <button onClick={() => setQuery("")}>
                    {t("clearSearch")}
                  </button>
                </div>
              )}
            </div>
          </details>
        </aside>
        <section className="simulation">
          <div className="field-heading">
            <h1>{text(scenario.title)}</h1>
            <span className="live-badge">
              {t(playback.mode === "step" ? "teaching" : "fullPlay")}
            </span>
          </div>
          <div className="scoreboard">
            <span>
              <small>{t("outs")}</small>
              <strong>
                {frame.state.outs}{" "}
                <span className="out-dots">
                  {[0, 1, 2].map((n) => (
                    <i
                      key={n}
                      className={n < frame.state.outs ? "filled" : ""}
                    />
                  ))}
                </span>
              </strong>
            </span>
            <span>
              <small>{t("count")}</small>
              <strong>
                {count.balls} – {count.strikes}
              </strong>
            </span>
            <span>
              <small>{t("runs")}</small>
              <strong>{frame.state.runs}</strong>
            </span>
            <span className="phase-count">
              <small>{t("phase")}</small>
              <strong>
                {phaseIndex + 1} <b>/ {scenario.phases.length}</b>
              </strong>
            </span>
          </div>
          <div className="field-stage">
            <BaseballField
              frame={frame}
              selected={selected}
              onSelect={setSelected}
              layers={layers}
              locale={locale}
            />
          </div>
          <p className="field-hint">{t("fieldHint")}</p>
          <div className="playback">
            <div className="transport">
              <button
                aria-label={t("restart")}
                title={t("restart")}
                onClick={playback.restart}
              >
                ↺
              </button>
              <button
                aria-label={t("previous")}
                disabled={previousDisabled}
                title={t("previous")}
                onClick={() => playback.step(-1)}
              >
                ‹
              </button>
              <button className="play-button" onClick={playback.toggle}>
                {t(playback.playing ? "pause" : "play")}
              </button>
              <button
                aria-label={t("next")}
                disabled={nextDisabled}
                title={t("next")}
                onClick={() => playback.step(1)}
              >
                ›
              </button>
              <label className="speed">
                {t("speed")}
                <select
                  aria-label={t("speed")}
                  value={playback.speed}
                  onChange={(e) => playback.setSpeed(+e.target.value)}
                >
                  {[0.5, 1, 2].map((n) => (
                    <option key={n} value={n}>
                      {n}×
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="timeline">
              <input
                aria-label={t("timeline")}
                type="range"
                min="0"
                max={playback.total}
                step="0.01"
                value={playback.time}
                onChange={(e) => playback.seek(+e.target.value)}
              />
              <span>
                {playback.time.toFixed(1)} / {playback.total.toFixed(1)}s
              </span>
            </div>
          </div>
          <details className="layers">
            <summary>{t("layers")}</summary>
            <div>
              {(Object.keys(layers) as (keyof Layers)[]).map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() =>
                      setLayers({ ...layers, [key]: !layers[key] })
                    }
                  />
                  {t(key)}
                </label>
              ))}
            </div>
          </details>
        </section>
        <aside className="right-panel">
          <section className="phase-panel">
            <div className="reading-heading">
              <h2>{t("readPlay")}</h2>
              <span className="phase-label">
                {t("step")} {phaseIndex + 1} / {scenario.phases.length}
              </span>
            </div>
            <nav className="reading-nav" aria-label={t("readPlay")}>
              <button
                aria-label={t("previous")}
                disabled={previousDisabled}
                onClick={() => playback.step(-1)}
              >
                ‹ {t("previous")}
              </button>
              <button
                aria-label={t("next")}
                disabled={nextDisabled}
                onClick={() => playback.step(1)}
              >
                {t("next")} ›
              </button>
            </nav>
            <h3 className="current-phase-title">{text(frame.phase.title)}</h3>
            <p className="phase-explanation">{text(frame.phase.explanation)}</p>
            <div className="reading-mode">
              <label>
                {t("mode")}
                <select
                  aria-label={t("mode")}
                  value={playback.mode}
                  onChange={(e) =>
                    playback.setMode(e.target.value as "step" | "full")
                  }
                >
                  <option value="step">{t("teaching")}</option>
                  <option value="full">{t("fullPlay")}</option>
                </select>
              </label>
              <p>{t(playback.mode === "step" ? "stepHint" : "fullHint")}</p>
            </div>
            <details className="objective">
              <summary>{t("decision")}</summary>
              <p>{text(scenario.objective)}</p>
              <p>
                {t("starting")}: {situationText(scenario.initial, locale)}
              </p>
            </details>
          </section>
          <section className="focus-panel">
            <div className="label-row">
              <h2>{t("focus")}</h2>
              {selected && (
                <button
                  className="text-button"
                  onClick={() => setSelected(null)}
                >
                  {t("clear")}
                </button>
              )}
            </div>
            <div className="position-picker">
              {Object.keys(scenario.startingPositions).map((id) => (
                <button
                  key={id}
                  aria-label={`${t("focusLabel")} ${id}`}
                  aria-pressed={selected === id}
                  className={selected === id ? "selected" : ""}
                  onClick={() => setSelected(id as PlayerId)}
                >
                  {id}
                </button>
              ))}
            </div>
            {focus && selected ? (
              <>
                <h3>
                  <span className="focus-number">{selected}</span>
                  {t("yourJob")}
                </h3>
                <p className="focus-action">{text(focus.action)}</p>
                <h4>{t("why")}</h4>
                <p>{text(focus.why)}</p>
                <h4>{t("nextJob")}</h4>
                <p>{text(focus.support)}</p>
              </>
            ) : (
              <p>{t("selectPlayer")}</p>
            )}
            <details className="position-key">
              <summary>{t("labels")}</summary>
              <p>{t("positionKey")}</p>
            </details>
          </section>
          <details className="panel responsibilities">
            <summary>{t("allRoles")}</summary>
            <div className="panel-content">
              {Object.entries(frame.phase.responsibilities).map(([id, r]) => (
                <button key={id} onClick={() => setSelected(id as PlayerId)}>
                  <strong>{id}</strong>
                  <span>{text(r.action)}</span>
                </button>
              ))}
            </div>
          </details>
          <details className="panel notes">
            <summary>{t("notebook")}</summary>
            <div className="panel-content">
              <h4>{t("outcome")}</h4>
              <p>{text(scenario.result)}</p>
              {scenario.notes.map((n, i) => (
                <p key={i}>{text(n)}</p>
              ))}
              <h4>{t("alternative")}</h4>
              {scenario.alternatives.map((n, i) => (
                <p key={i}>{text(n)}</p>
              ))}
              <p className="hint">{t("scoring")}</p>
            </div>
          </details>
        </aside>
      </div>
    </main>
  );
}
