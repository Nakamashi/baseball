import { createServer } from "vite";
import { createServer as createHttpServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
const args = process.argv.slice(2);
const value = (flag) =>
  args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const server = await createServer({
  server: { middlewareMode: true, hmr: { server: createHttpServer() } },
  appType: "custom",
});
try {
  const { defensiveAuditCases } = await server.ssrLoadModule(
    "/src/dynamic/auditCases.ts",
  );
  const { DynamicPlayProvider } = await server.ssrLoadModule(
    "/src/dynamic/provider.ts",
  );
  const { inspectDefense } = await server.ssrLoadModule(
    "/src/dynamic/diagnostics.ts",
  );
  const cases = defensiveAuditCases();
  if (args.includes("--list")) {
    console.log(Object.keys(cases).join("\n"));
  } else {
    const name = value("--case") ?? "ground-second";
    const settings = value("--settings")
      ? JSON.parse(await readFile(value("--settings"), "utf8"))
      : cases[name];
    if (!settings) throw new Error(`Unknown case ${name}; use --list.`);
    const scenario = new DynamicPlayProvider().generate(settings);
    const time =
      value("--time") === undefined
        ? scenario.dynamic.events.find(
            (e) => e.type === "BallFielded" || e.type === "BallBoundary",
          ).time
        : Number(value("--time"));
    if (!Number.isFinite(time))
      throw new Error("--time must be a finite number of seconds.");
    const json = JSON.stringify(inspectDefense(scenario, time), null, 2) + "\n";
    if (value("--output")) await writeFile(value("--output"), json);
    else console.log(json);
  }
} finally {
  await server.close();
}
