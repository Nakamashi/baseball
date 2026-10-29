# Defensive Audit V2 evidence

Read the [structured report](../../docs/DEFENSIVE_AUDIT_V2.md) first. Production gameplay is unchanged.

Run from the repository root:

```sh
npm run audit:defense:v2 -- --strict
npm run audit:defense:v2:summary
npm run audit:defense:v2 -- --case dp-ss-average-hard-o0 --output /tmp/dp-v2
```

`summary.json` contains coverage and severities. `results.json` contains every full input and its flags. `matrix-exceptions.json` records exclusions and reinterpretations. `analysis.json` compares all nine defenders and the DP grid. `examples/index.json` lists 21 readable detailed reproductions.

`traces.jsonl.gz` contains one JSON record per distinct scenario with actual ball, defender and runner timed paths, exact events, decisions, responsibilities and runner/assignment snapshots. Hypothetical untouched projection frames are omitted; exact settings regenerate them. Full timed samples take precedence over the shortened duplicate path arrays. Use Python gzip plus line-by-line JSON parsing for bounded extraction.

`player-audits.jsonl.gz` records each defender's first movement, distance, maximum sampled speed, all role changes, final position and reception/support positions. Only `relevantBaseBackup` jobs are evaluated as backups of that particular reception; optional cutoffs and future-base support have different deadlines.

Flags ending in `review` are advisory. `double-play-coverage-floor` confirms a model timing bottleneck rather than an illegal out. `runner-first-touch-forecast` is a selected opportunity whose timing disagrees with the actual unchanged-goal first crossing. `forecast-control-drift` compares a base reception with its decision-relative forecast; intermediate cutoff receipts are excluded. `--strict` fails on Critical integrity/rules assertions, without hiding High and advisory findings.

The 2,202 distinct configurations include 1,032 valid baseline cases, 724 strength variants, 104 anticipated-bunt cases, 270 DP probes, 60 seeded variations and 12 focused cases. Sixty extra identical-input replays verify determinism. The engine is deterministic; seeds generate inputs, not random execution errors.

Verification logs and local PDF hashes are retained. The report distinguishes confirmed defects, physical assumptions, coaching alternatives and unsupported features. Large raw evidence is intentionally compressed; routine audit output stays bounded.
