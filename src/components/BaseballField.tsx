import type { Snapshot, PlayerId, Point } from "../simulation/types";
import { physicalPolyline } from "../dynamic/geometry";
import { bases } from "../simulation/geometry";
import { ui, playText, type Locale } from "../i18n";
export interface Layers {
  labels: boolean;
  movement: boolean;
  throws: boolean;
  runners: boolean;
  annotations: boolean;
}
interface Props {
  frame: Snapshot;
  selected: PlayerId | null;
  onSelect: (id: PlayerId) => void;
  layers: Layers;
  locale: Locale;
  destination?: Point;
  onLocation?: (p: Point) => void;
  picking?: boolean;
}
export function BaseballField({
  frame,
  selected,
  onSelect,
  layers,
  locale,
  destination,
  onLocation,
  picking,
}: Props) {
  const t = ui(locale),
    text = playText(locale);
  const path = (points: Point[]) =>
    (frame.phase.assignments ? physicalPolyline(points) : points)
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
  return (
    <svg
      className="field"
      viewBox="0 0 1000 900"
      role="img"
      aria-label={t("fieldLabel")}
      onClick={(e) => {
        if (!onLocation) return;
        const point = e.currentTarget.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const matrix = e.currentTarget.getScreenCTM();
        if (matrix) onLocation(point.matrixTransform(matrix.inverse()));
      }}
      onClickCapture={(e) => {
        if (!picking || !onLocation) return;
        e.stopPropagation();
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
          points={path(frame.phase.ball.path)}
          fill="none"
          stroke="#fff9ad"
          strokeWidth="4"
          strokeDasharray={frame.phase.ball.style === "throw" ? "12 7" : "3 7"}
          markerEnd="url(#arrow)"
        />
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
            opacity={selected && !focused ? 0.57 : 1}
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
      {destination && (
        <g
          className="hit-destination"
          role="button"
          tabIndex={0}
          aria-label={t("hitLocation")}
          transform={`translate(${destination.x} ${destination.y})`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            const delta: Record<string, Point> = {
              ArrowLeft: { x: -10, y: 0 },
              ArrowRight: { x: 10, y: 0 },
              ArrowUp: { x: 0, y: -10 },
              ArrowDown: { x: 0, y: 10 },
            };
            if (delta[e.key] && onLocation) {
              e.preventDefault();
              onLocation({
                x: destination.x + delta[e.key].x,
                y: destination.y + delta[e.key].y,
              });
            }
          }}
        >
          <circle r="19" fill="#fff3b355" stroke="#ffce6a" strokeWidth="3" />
          <path d="M-28 0H28 M0 -28V28" stroke="#ffce6a" strokeWidth="2" />
        </g>
      )}
      <g
        pointerEvents="none"
        transform={`translate(${frame.ball.x + 9} ${frame.ball.y - 22})`}
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
