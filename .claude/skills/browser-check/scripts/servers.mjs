// Runs Seghan on its own ports for a browser check: the API on :4001 and the app on :5174.
// The user's own dev servers on :4000 and :5173 are never stopped, restarted or used.
// Usage, from the repository root: node .claude/skills/browser-check/scripts/servers.mjs start|stop|status
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
// .mts: outside frontend/, a .ts config would be compiled the old CommonJS way, which breaks the
// Tailwind plugin. The .mts ending makes Vite load it as a module wherever it sits.
const VITE_CONFIG = path.join(ROOT, ".claude/skills/browser-check/vite.check.config.mts");
// A short, fixed folder: logs and the saved process IDs, never inside the repository.
const DIR = "/tmp/seghan-browser-check";
const STATE = path.join(DIR, "state.json");
const API_PORT = 4001;
const APP_PORT = 5174;
const PORTS = [
  [4000, "your API"],
  [5173, "your app"],
  [API_PORT, "check API"],
  [APP_PORT, "check app"],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Something listens on the port, over IPv4 or IPv6 (Vite may listen on ::1 only).
async function inUse(port) {
  const tryHost = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ host, port });
      socket.once("connect", () => (socket.destroy(), resolve(true)));
      socket.once("error", () => resolve(false));
    });
  return (await tryHost("127.0.0.1")) || (await tryHost("::1"));
}

async function answers(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    return true; // any reply counts, even a 503 from the API without its database
  } catch {
    return false;
  }
}

// Stops a process only if it is still one this script started: it must still lead its own process
// group, and be the check API (PORT=4001) or the check Vite (its own config). A stale or reused ID
// is left alone.
function isOurs(pid, kind) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const processGroup = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[2]);
    if (processGroup !== pid) return false;
    if (kind === "api") {
      return readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").includes(`PORT=${API_PORT}`);
    }
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("vite.check.config.mts");
  } catch {
    return false;
  }
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE, "utf8"));
  } catch {
    return null;
  }
}

function startServer(command, args, options, logName) {
  const log = openSync(path.join(DIR, logName), "w");
  const child = spawn(command, args, { ...options, detached: true, stdio: ["ignore", log, log] });
  closeSync(log);
  child.unref(); // the servers keep running after this script exits
  return child.pid;
}

async function stop(state) {
  for (const [kind, pid] of Object.entries({ api: state.api, app: state.app })) {
    if (isOurs(pid, kind)) process.kill(-pid, "SIGTERM");
    else console.log(`Left alone: process ${pid} is no longer the check's ${kind}.`);
  }
  for (let waited = 0; waited < 10000; waited += 250) {
    if (!(await inUse(API_PORT)) && !(await inUse(APP_PORT))) break;
    await sleep(250);
  }
  for (const [kind, pid] of Object.entries({ api: state.api, app: state.app })) {
    if (isOurs(pid, kind)) process.kill(-pid, "SIGKILL"); // only if SIGTERM wasn't enough
  }
  rmSync(STATE, { force: true });
}

async function main(command) {
  if (command === "status") {
    for (const [port, label] of PORTS) {
      console.log(`:${port} (${label}): ${(await inUse(port)) ? "in use" : "free"}`);
    }
    const state = readState();
    const running = state && (isOurs(state.api, "api") || isOurs(state.app, "app"));
    console.log(running ? `A check is running (API ${state.api}, app ${state.app}).` : "No check is running.");
    return 0;
  }

  if (command === "start") {
    const state = readState();
    if (state && (isOurs(state.api, "api") || isOurs(state.app, "app"))) {
      console.log("A check is already running. Run stop first. Nothing was started.");
      return 1;
    }
    for (const port of [API_PORT, APP_PORT]) {
      if (await inUse(port)) {
        console.log(`Port ${port} is in use, so the check can't start. Nothing was started.`);
        return 1;
      }
    }
    mkdirSync(DIR, { recursive: true });
    const api = startServer("npm", ["run", "dev", "-w", "backend"], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(API_PORT) },
    }, "api.log");
    const app = startServer(path.join(ROOT, "node_modules/.bin/vite"), ["--config", VITE_CONFIG], {
      cwd: path.join(ROOT, "frontend"),
    }, "app.log");
    writeFileSync(STATE, JSON.stringify({ api, app }));

    for (let waited = 0; waited < 60000; waited += 500) {
      const apiUp = await answers(`http://localhost:${API_PORT}/api/health`);
      const appUp = await answers(`http://localhost:${APP_PORT}/`);
      if (apiUp && appUp) {
        console.log(`Check is running: app http://localhost:${APP_PORT}, API http://localhost:${API_PORT}`);
        console.log(`Logs: ${DIR}/api.log and ${DIR}/app.log`);
        return 0;
      }
      await sleep(500);
    }
    console.log(`The check didn't answer within 60 seconds, so it was stopped. See the logs in ${DIR}.`);
    await stop({ api, app });
    return 1;
  }

  if (command === "stop") {
    const state = readState();
    if (!state) {
      console.log("No check is running.");
      return 0;
    }
    await stop(state);
    const stillUsed = [];
    for (const port of [API_PORT, APP_PORT]) if (await inUse(port)) stillUsed.push(port);
    console.log(stillUsed.length ? `Still in use: ${stillUsed.join(", ")}.` : `Stopped. :${API_PORT} and :${APP_PORT} are free.`);
    return stillUsed.length ? 1 : 0;
  }

  console.log("Usage: node .claude/skills/browser-check/scripts/servers.mjs start|stop|status");
  return 1;
}

process.exitCode = await main(process.argv[2]);
