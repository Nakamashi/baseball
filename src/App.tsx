import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
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
import { QuickHitEditor, StartingSituation } from "./components/FieldSetup";
import { DynamicControls } from "./components/DynamicControls";
import {
  DynamicPlayProvider,
  defaultSettings,
  validateSettings,
} from "./dynamic/provider";
import { message as dynamicMessage } from "./dynamic/messages";
import { isPlayable, isFairAim } from "./dynamic/geometry";
import type { DynamicSettings, DynamicScenario } from "./dynamic/types";
import { predictTrajectory, isAirborneType } from "./dynamic/trajectory";
const categories = [...new Set(scenarios.map((s) => s.category))];
export default function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = ui(locale),
    text = playText(locale);
  const [viewMode, setViewMode] = useState<"encyclopedia" | "dynamic">(
    "encyclopedia",
  );
  const [settings, setSettings] = useState<DynamicSettings>(defaultSettings);
  const [generated, setGenerated] = useState<DynamicScenario>(() =>
    new DynamicPlayProvider().generate(defaultSettings()),
  );
  const [generationError, setGenerationError] = useState(""),
    [picking, setPicking] = useState(false);
  const [quickEditor, setQuickEditor] = useState(false);
  const [mobileFocus, setMobileFocus] = useState(false);
  const [generating, setGenerating] = useState(false);
  const generationInProgress = useRef(false);
  const [scriptedScenario, setScenario] = useState(scenarios[0]),
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
    trajectory: false,
  });
  const scenario = viewMode === "dynamic" ? generated : scriptedScenario;
  const pending =
    viewMode === "dynamic" &&
    JSON.stringify(settings) !== JSON.stringify(generated.dynamic.settings);
  const preview = useMemo(() => {
    if (
      !(isAirborneType(settings.ball.type)
        ? isFairAim(settings.ball.destination)
        : isPlayable(settings.ball.destination))
    )
      return undefined;
    try {
      return predictTrajectory(settings);
    } catch {
      return undefined;
    }
  }, [settings.ball, settings.field]);
  const playback = usePlayback(scenario);
  const displayedCount = viewMode === "dynamic" ? frameCount() : count;
  function frameCount() {
    return {
      balls: generated.initial.balls,
      strikes: generated.initial.strikes,
    };
  }
  const updateSettings: Dispatch<SetStateAction<DynamicSettings>> = (
    update,
  ) => {
    if (generationInProgress.current) return;
    playback.restart();
    setSettings(update);
    setGenerationError("");
  };
  async function generate() {
    if (generationInProgress.current) return;
    const error = validateSettings(settings);
    if (error) {
      setGenerationError(error);
      return;
    }
    generationInProgress.current = true;
    setGenerating(true);
    // Paint disabled/progress feedback before synchronous compilation begins.
    await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    try {
      setGenerated(new DynamicPlayProvider().generate(settings));
    } catch (error) {
      console.error("Dynamic play generation failed", error);
      setGenerationError(dynamicMessage("generationUnavailable"));
      return;
    } finally {
      generationInProgress.current = false;
      setGenerating(false);
    }
    setGenerationError("");
    setPicking(false);
    setQuickEditor(false);
    playback.restart();
    document
      .querySelector(".simulation")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function pick(point: { x: number; y: number }, edit = true) {
    if (generationInProgress.current) return;
    if (
      !(isAirborneType(settings.ball.type)
        ? isFairAim(point)
        : isPlayable(point))
    ) {
      setGenerationError(dynamicMessage("invalid"));
      return;
    }
    updateSettings((current) => ({
      ...current,
      ball: { ...current.ball, destination: { x: point.x, y: point.y } },
    }));
    setPicking(false);
    if (edit) { setQuickEditor(true); setMobileFocus(false); }
  }
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
  function closeQuickEditor() {
    setQuickEditor(false);
    document.querySelector<SVGElement>(".hit-destination")?.focus({ preventScroll: true });
  }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (quickEditor) closeQuickEditor();
      if (mobileFocus) clearPlayerFocus();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [quickEditor, mobileFocus]);
  function clearPlayerFocus() {
    if (selected) document.querySelector<SVGElement>(`[data-player="${selected}"]`)?.focus({ preventScroll: true });
    setSelected(null); setMobileFocus(false);
  }
  useEffect(() => {
    if (mobileFocus && window.matchMedia("(max-width: 600px), (max-width: 950px) and (max-height: 500px)").matches) {
      document.querySelector<HTMLElement>(".focus-panel")?.focus({ preventScroll: true });
    }
  }, [mobileFocus, selected]);
  const phaseIndex = scenario.phases.indexOf(frame.phase);
  const previousDisabled = pending || playback.time === 0,
    nextDisabled = pending || playback.time >= playback.total;
  return (
    <main className={viewMode === "dynamic" ? "dynamic-mode" : undefined}>
      <div className="utility">
        <nav className="app-modes" aria-label={t("mode")}>
          {(["encyclopedia", "dynamic"] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={viewMode === mode}
              onClick={() => {
                playback.restart();
                setViewMode(mode);
                setPicking(false);
                setQuickEditor(false); setMobileFocus(false);
              }}
            >
              {t(mode === "dynamic" ? "simulator" : "encyclopedia")}
            </button>
          ))}
        </nav>
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
          {viewMode === "dynamic" ? (
            <DynamicControls
              preview={preview}
              settings={settings}
              setSettings={updateSettings}
              locale={locale}
              onGenerate={generate}
              generating={generating}
              pending={pending}
              error={
                generationError
                  ? generationError.startsWith("@v2:")
                    ? text(generationError)
                    : generationError
                  : undefined
              }
              picking={picking}
              setPicking={setPicking}
            />
          ) : (
            <>
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
            </>
          )}{" "}
        </aside>
        <section className="simulation">
          <div className="field-heading">
            <h1>{text(scenario.title)}</h1>
            {viewMode === "dynamic" && (
              <button
                className="text-button setup-link"
                onClick={() => {
                  const advanced = document.querySelector<HTMLDetailsElement>(".advanced-settings");
                  if (advanced) advanced.open = true;
                  document.getElementById("dynamic-controls")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {t("configure")}
              </button>
            )}
            <span className="live-badge">
              {t(playback.mode === "step" ? "teaching" : "fullPlay")}
            </span>
          </div>
          {viewMode === "dynamic" && <>
            <StartingSituation settings={settings} setSettings={updateSettings} locale={locale} />
            <p className="field-first-hint">{t("fieldFirstHint")}</p>
          </>}
          {viewMode === "dynamic" && (
            <div className="game-context">
              <strong>{t("playbackSituation")}</strong>
              <span>
                {t(frame.state.half === "bottom" ? "bottom" : "top")}{" "}
                {frame.state.inning} · {t("fieldingTeam")}:{" "}
                {t(frame.state.fieldingTeam === "away" ? "away" : "home")}
              </span>
              <span>
                {t("away")} {frame.state.awayScore} : {frame.state.homeScore}{" "}
                {t("home")}
              </span>
            </div>
          )}
          {pending && (
            <p className="draft-notice" role="status">
              {t("draftChanged")}
            </p>
          )}
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
                {displayedCount.balls} – {displayedCount.strikes}
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
              onSelect={(id) => { setSelected(id); setMobileFocus(viewMode === "dynamic"); setQuickEditor(false); }}
              layers={layers}
              locale={locale}
              destination={
                viewMode === "dynamic" ? settings.ball.destination : undefined
              }
              onLocation={viewMode === "dynamic" ? pick : undefined}
              trajectory={viewMode === "dynamic" ? preview : undefined}
              interception={
                viewMode === "dynamic" &&
                !pending &&
                !generated.dynamic.ball.boundary
                  ? {
                      point: generated.dynamic.ball.touchPoint!,
                      time: generated.dynamic.ball.touchTime!,
                      start:
                        generated.startingPositions[
                          generated.dynamic.ball.fielder
                        ],
                    }
                  : undefined
              }
            />
          </div>
          {viewMode === "dynamic" && quickEditor && <QuickHitEditor settings={settings} setSettings={updateSettings}
            locale={locale} onClose={closeQuickEditor} preview={preview}
            error={generationError ? text(generationError) : validateSettings(settings) ? text(validateSettings(settings)!) : undefined} />}
          {viewMode === "dynamic" && layers.trajectory && <p className="field-hint">{t("previewLabel")}</p>}
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
              <button
                className="play-button"
                disabled={pending}
                onClick={playback.toggle}
              >
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
                disabled={pending}
                aria-label={t("timeline")}
                type="range"
                min="0"
                max={playback.total}
                step="any"
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
              {(Object.keys(layers) as (keyof Layers)[])
                .filter((key) => viewMode === "dynamic" || key !== "trajectory")
                .map((key) => (
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
            {viewMode === "dynamic" && (
              <div className="tactics-legend">
                {(
                  [
                    "assignmentField",
                    "assignmentCover",
                    "assignmentRelay",
                    "assignmentBackup",
                  ] as const
                ).map((key) => (
                  <span key={key} className={key}>
                    <i />
                    {t(key)}
                  </span>
                ))}
              </div>
            )}
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
          <section className={`focus-panel ${mobileFocus ? "mobile-focus-open" : ""}`} aria-label={t("focus")} tabIndex={-1}>
            <div className="label-row">
              <h2>{t("focus")}{mobileFocus && selected ? ` · ${selected}` : ""}</h2>
              {selected && (
                <button
                  className="text-button"
                  onClick={clearPlayerFocus}
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
                  onClick={() => { setSelected(id as PlayerId); setMobileFocus(viewMode === "dynamic"); setQuickEditor(false); }}
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
                <h4>{t("currentJob")}</h4>
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
          {viewMode === "dynamic" && (
            <details className="panel dynamic-events">
              <summary>{t("eventLog")}</summary>
              <div className="panel-content">
                {generated.dynamic.events
                  .filter((event) => event.time <= playback.time + 0.000001)
                  .map((event) => (
                    <p key={event.id}>
                      <time>{event.time.toFixed(1)}s</time>{" "}
                      {text(event.explanation)}
                    </p>
                  ))}
              </div>
            </details>
          )}
          <details className="panel responsibilities">
            <summary>{t("allRoles")}</summary>
            <div className="panel-content">
              {Object.entries(frame.phase.responsibilities).map(([id, r]) => (
                <button key={id} onClick={() => { setSelected(id as PlayerId); setMobileFocus(viewMode === "dynamic"); setQuickEditor(false); }}>
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
