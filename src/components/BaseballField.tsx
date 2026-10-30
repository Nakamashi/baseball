import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Snapshot, PlayerId, Point } from "../simulation/types";
import { physicalPolyline } from "../dynamic/geometry";
import { bases } from "../simulation/geometry";
import { ui, playText, type Locale } from "../i18n";
import type { BallTrajectory } from "../dynamic/trajectory";
export interface Layers {
  labels: boolean;
  movement: boolean;
  throws: boolean;
  runners: boolean;
  annotations: boolean;
  trajectory?: boolean;
}
interface Props {
  frame: Snapshot;
  selected: PlayerId | null;
  onSelect: (id: PlayerId) => void;
  layers: Layers;
  locale: Locale;
  destination?: Point;
  onLocation?: (p: Point, edit?: boolean) => void;

  trajectory?: BallTrajectory;
  interception?: { point: Point; time: number; start: Point };
}
export function BaseballField({
  frame,
  selected,
  onSelect,
  layers,
  locale,
  destination,
  onLocation,
  trajectory,
  interception,
}: Props) {
  const fieldRef = useRef<SVGSVGElement>(null);
  const [touchRadius, setTouchRadius] = useState(24);
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const update = () => {
      const matrix = field.getScreenCTM();
      if (matrix) setTouchRadius(22 / Math.hypot(matrix.a, matrix.b));
    };
    const observer = new ResizeObserver(update); observer.observe(field); update();
    return () => observer.disconnect();
  }, []);
  const dragging = useRef(false);
  const moved = useRef(false);
  const pointerPicked = useRef(false);
  const pointerPoint = (e: ReactPointerEvent<SVGGElement>) => {
    const svg = e.currentTarget.ownerSVGElement!;
    const point = svg.createSVGPoint();
    point.x = e.clientX; point.y = e.clientY;
    const matrix = svg.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : undefined;
  };
  const t = ui(locale),
    text = playText(locale);
  const flightSamples =
    frame.phase.ball.kind === "travel" ? frame.phase.ball.samples : undefined;
  const path = (points: Point[]) =>
    (frame.phase.assignments ? physicalPolyline(points) : points)
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
  return (
    <svg
      ref={fieldRef}
      className="field"
      viewBox="0 0 1000 900"
      role="group"
      aria-label={t("fieldLabel")}
      onPointerUp={(e) => {
        if (!onLocation || (e.target as Element).closest(".player, .hit-destination")) return;
        const point = e.currentTarget.createSVGPoint(); point.x = e.clientX; point.y = e.clientY;
        const matrix = e.currentTarget.getScreenCTM();
        if (matrix) { onLocation(point.matrixTransform(matrix.inverse())); pointerPicked.current = true; }
      }}
      onClick={(e) => {
        if (pointerPicked.current) { pointerPicked.current = false; return; }
        if (!onLocation) return;
        const point = e.currentTarget.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const matrix = e.currentTarget.getScreenCTM();
        if (matrix) onLocation(point.matrixTransform(matrix.inverse()));
      }}
    >
      <defs>
        <pattern
          id="grass"
          width="130"
          height="130"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="130" height="130" fill="#397554" />
          <rect width="65" height="130" fill="#417d5c" />
        </pattern>
        <marker
          id="arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L6,3 L0,6" fill="none" stroke="context-stroke" />
        </marker>
      </defs>
      <rect width="1000" height="900" rx="16" fill="#e8eee5" />
      <path
        d="M500 770 L62 332 Q125 64 500 60 Q875 64 938 332 Z"
        fill="url(#grass)"
        stroke="#245340"
        strokeWidth="8"
      />
      <path d="M500 815 L225 540 Q500 225 775 540 Z" fill="#bd9165" />
      <path d="M500 738 L333 570 L500 403 L667 570 Z" fill="#4b865e" />
      <path
        d="M500 770 L55 325 M500 770 L945 325"
        fill="none"
        stroke="#fbf8e9"
        strokeWidth="4"
      />
      <path
        d="M500 770 L700 570 L500 370 L300 570 Z"
        fill="none"
        stroke="#f4dfbd"
        strokeWidth="3"
      />
      <circle cx="500" cy="570" r="33" fill="#bd9165" />
      <rect x="488" y="568" width="24" height="5" rx="2" fill="#fffbee" />
      {([1, 2, 3] as const).map((b) => (
        <rect
          key={b}
          x={bases[b].x - 10}
          y={bases[b].y - 10}
          width="20"
          height="20"
          transform={`rotate(45 ${bases[b].x} ${bases[b].y})`}
          fill="#fffbee"
          stroke="#805f3d"
          strokeWidth="2"
        />
      ))}
      <path d="M489 760 L511 760 L511 772 L500 782 L489 772 Z" fill="#fffbee" />
      <path
        d="M455 753 L473 753 L473 795 L455 795 Z M527 753 L545 753 L545 795 L527 795 Z"
        fill="none"
        stroke="#fffbee"
        strokeWidth="2"
      />
      {layers.annotations && (
        <g className="field-annotations">
          <text x="500" y="110" textAnchor="middle">
            {t("centreField")}
          </text>
          <text x="190" y="405" transform="rotate(-45 190 405)">
            {t("leftField")}
          </text>
          <text x="790" y="405" transform="rotate(45 790 405)">
            {t("rightField")}
          </text>
          <text x="755" y="625">
            {t("firstBase")}
          </text>
          <text x="470" y="330">
            {t("secondBase")}
          </text>
          <text x="207" y="625">
            {t("thirdBase")}
          </text>
        </g>
      )}
      {layers.trajectory && trajectory && (
        <g className="trajectory-overlay" pointerEvents="none">
          <polyline
            points={trajectory.frames
              .filter(
                (_, i) => i % 8 === 0 || i === trajectory.frames.length - 1,
              )
              .map((f) => `${f.point.x},${f.point.y}`)
              .join(" ")}
            fill="none"
            stroke="#fff9d7"
            strokeWidth="4"
            strokeDasharray="8 9"
            opacity="0.5"
          />
          {trajectory.events
            .filter((e) => e.type === "landing" || e.type === "bounce")
            .map((e, i) => (
              <circle
                key={i}
                cx={e.point.x}
                cy={e.point.y}
                r={i === 0 ? 12 : 7}
                fill="none"
                stroke="#ffda86"
                strokeWidth="3"
              >
                <title>
                  {t("projectedLanding")} · {e.t.toFixed(2)}s
                </title>
              </circle>
            ))}
          <rect
            x={trajectory.frames.at(-1)!.point.x - 9}
            y={trajectory.frames.at(-1)!.point.y - 9}
            width="18"
            height="18"
            fill="none"
            stroke="#fff9d7"
            strokeWidth="3"
          >
            <title>{t("projectedStop")}</title>
          </rect>
          {interception && (
            <>
              <polyline
                points={path([interception.start, interception.point])}
                fill="none"
                stroke="#94e2f0"
                strokeWidth="3"
                strokeDasharray="5 7"
              />
              <circle
                className="interception-point"
                cx={interception.point.x}
                cy={interception.point.y}
                r="17"
                fill="none"
                stroke="#94e2f0"
                strokeWidth="4"
              >
                <title>
                  {t("interception")} · {interception.time.toFixed(2)}s
                </title>
              </circle>
            </>
          )}
        </g>
      )}
      {frame.phase.movements.map((m) => {
        const runner =
          m.player === "BR" || (m.player.startsWith("R") && m.player !== "RF");
        if (
          !(runner ? layers.runners : layers.movement) &&
          selected !== m.player
        )
          return null;
        return (
          <polyline
            key={m.player}
            points={path(m.path)}
            fill="none"
            stroke={
              runner
                ? "#ffd18a"
                : frame.phase.assignments?.find((a) => a.player === m.player)
                      ?.type === "CoverBase"
                  ? "#b8e1ff"
                  : ["Cutoff", "Relay"].includes(
                        frame.phase.assignments?.find(
                          (a) => a.player === m.player,
                        )?.type ?? "",
                      )
                    ? "#ffdc77"
                    : ["BackupFielder", "BackupThrow"].includes(
                          frame.phase.assignments?.find(
                            (a) => a.player === m.player,
                          )?.type ?? "",
                        )
                      ? "#cbeaa6"
                      : "#c5e4ec"
            }
            strokeWidth={selected === m.player ? 5 : 3}
            strokeDasharray={runner ? "10 6" : "5 6"}
            opacity={selected && selected !== m.player ? 0.7 : 0.9}
            markerEnd="url(#arrow)"
          />
        );
      })}
      {layers.throws && frame.phase.ball.kind === "travel" && (
        <polyline
          points={path(
            flightSamples
              ?.filter((_, i) => i % 4 === 0 || i === flightSamples.length - 1)
              .map((p) => p.point) ?? frame.phase.ball.path,
          )}
          fill="none"
          stroke="#fff9ad"
          strokeWidth="4"
          strokeDasharray={frame.phase.ball.style === "throw" ? "12 7" : "3 7"}
          markerEnd="url(#arrow)"
        />
      )}
      {destination && (
        <g
          className="hit-destination"
          role="button"
          tabIndex={0}
          aria-label={t("hitLocation")}
          aria-describedby="marker-help"
          onPointerDown={(e) => {
            e.stopPropagation();
            dragging.current = true; moved.current = false;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return;
            const point = pointerPoint(e);
            if (point && Math.hypot(point.x - destination.x, point.y - destination.y) > 1) {
              moved.current = true;
              onLocation?.(point, false);
            }
          }}
          onPointerUp={(e) => {
            dragging.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => { dragging.current = false; }}
          transform={`translate(${destination.x} ${destination.y})`}
          onClick={(e) => {
            e.stopPropagation();
            if (!moved.current) onLocation?.(destination);
            moved.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault(); onLocation?.(destination); return;
            }
            const step = e.shiftKey ? 1 : 10;
            const delta: Record<string, Point> = {
              ArrowLeft: { x: -step, y: 0 },
              ArrowRight: { x: step, y: 0 },
              ArrowUp: { x: 0, y: -step },
              ArrowDown: { x: 0, y: step },
            };
            if (delta[e.key] && onLocation) {
              e.preventDefault();
              onLocation({
                x: destination.x + delta[e.key].x,
                y: destination.y + delta[e.key].y,
              }, false);
            }
          }}
        >
          <title id="marker-help">{t("markerHelp")}</title>
          <circle className="marker-target" r={touchRadius} fill="transparent" />
          <circle r={touchRadius * 0.45} fill="#173e42bb" stroke="#ffce6a" strokeWidth="3" vectorEffect="non-scaling-stroke" pointerEvents="none" />
          <path d="M-28 0H28 M0 -28V28" stroke="#ffce6a" strokeWidth="2" />
        </g>
      )}
      {frame.players.map((p) => {
        const runner = p.id === "BR" || ["R1", "R2", "R3"].includes(p.id);
        const focused = p.id === selected;
        const offset = runner && p.id !== "BR" ? -45 : runner ? 45 : 0;
        return (
          <g
            key={p.id}
            data-player={p.id}
            role="button"
            tabIndex={0}
            aria-label={`${p.id} ${t(runner ? "runner" : "defender")}: ${text(p.action)}`}
            aria-pressed={focused}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(p.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(p.id);
              }
            }}
            className="player"
            opacity={!runner && selected && !focused ? 0.67 : 1}
            transform={`translate(${p.position.x + offset} ${p.position.y + (runner ? 30 : 0)})`}
          >
            {focused && (
              <circle r="30" fill="none" stroke="#fff3b3" strokeWidth="4" />
            )}
            <circle
              className="player-disc"
              r={runner ? 21 : 23}
              fill={runner ? "#f3aa66" : "#153e42"}
              stroke={runner ? "#5f351d" : "#f1f6ee"}
              strokeWidth="2.5"
            />
            {layers.labels && (
              <text
                textAnchor="middle"
                dy="6"
                fontSize="17"
                fontWeight="700"
                fill={runner ? "#362b20" : "#ffffff"}
              >
                {p.id}
              </text>
            )}
            {p.status !== "active" && (
              <g>
                <circle
                  cx="20"
                  cy="-21"
                  r="11"
                  fill={p.status === "out" ? "#8b3431" : "#fff3b3"}
                />
                <text
                  x="20"
                  y="-17"
                  textAnchor="middle"
                  fontSize="13"
                  fill={p.status === "out" ? "white" : "#173e32"}
                >
                  {p.status === "out" ? "×" : "✓"}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {(frame.ballHeight ?? 0) > 0.05 && (
        <g pointerEvents="none">
          <ellipse
            cx={frame.ball.x}
            cy={frame.ball.y}
            rx="10"
            ry="5"
            fill="#102d25"
            opacity="0.55"
          />
          <line
            x1={frame.ball.x}
            y1={frame.ball.y}
            x2={frame.ball.x + 9}
            y2={frame.ball.y - 22 - Math.min(75, (frame.ballHeight ?? 0) * 5)}
            stroke="#fff9d7"
            strokeDasharray="4 5"
            opacity="0.5"
          />
          <rect
            x="40"
            y="38"
            width="355"
            height="45"
            rx="8"
            fill="#183e2d"
            opacity="0.94"
          />
          <text
            className="ball-height"
            x="55"
            y="70"
            fill="#fff9d7"
            fontSize="30"
          >
            {t("ballHeight")}: {(frame.ballHeight ?? 0).toFixed(1)} m
          </text>
        </g>
      )}
      <g
        pointerEvents="none"
        transform={`translate(${frame.ball.x + 9} ${frame.ball.y - 22 - Math.min(75, (frame.ballHeight ?? 0) * 5)})`}
      >
        <circle r="11" fill="#ffef9b" opacity=".4" />
        <circle r="7" fill="#fff9d7" stroke="#442f24" strokeWidth="1.5" />
        {frame.owner && (
          <circle r="14" fill="none" stroke="#ffef9b" strokeWidth="2" />
        )}
      </g>
      <g className="field-key" transform="translate(45 858)">
        <circle r="7" fill="#173e42" />
        <text x="15" y="5">
          {t("defense")}
        </text>
        <circle cx="134" r="7" fill="#f3aa66" />
        <text x="149" y="5">
          {t("runnerLegend")}
        </text>
        <circle cx="270" r="6" fill="#fff0a6" stroke="#66553a" />
        <text x="285" y="5">
          {frame.owner ? `${t("heldBall")} ${frame.owner}` : t("movingBall")}
        </text>
      </g>
    </svg>
  );
}
