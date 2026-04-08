"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildManagedRuntimeWrapperSource = buildManagedRuntimeWrapperSource;
function buildManagedRuntimeWrapperSource() {
    return String.raw `const { spawn } = require("node:child_process");
const path = require("node:path");

const managerApiUrl = requireEnv("MANAGER_API_URL");
const instanceId = requireEnv("INSTANCE_ID");
const instanceSecret = requireEnv("INSTANCE_SECRET");
const heartbeatIntervalMs = Math.max(15000, Number(process.env.HEARTBEAT_INTERVAL_MS || 60000));

let childProcess = null;
let shutdownRequested = false;
const startedAt = Date.now();

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(name + " e obrigatoria para o runtime gerenciado.");
  }
  return value;
}

async function postJson(pathname, payload) {
  const response = await fetch(managerApiUrl + pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Manager respondeu " + response.status + " para " + pathname + ".");
  }

  return response.json();
}

function resolveEntrypoint() {
  const explicit = String(process.env.BOT_RUNTIME_ENTRYPOINT || "").trim();
  if (explicit) {
    return path.resolve(process.cwd(), explicit);
  }

  try {
    const pkg = require(path.join(process.cwd(), "package.json"));
    if (typeof pkg.main === "string" && pkg.main.trim()) {
      return path.resolve(process.cwd(), pkg.main.trim());
    }
  } catch {}

  return path.resolve(process.cwd(), "index.js");
}

function syncBootstrapEnv(bootstrap) {
  process.env.INSTANCE_STATUS = String(bootstrap?.instance?.status || "");
  process.env.INSTANCE_EXPIRES_AT = String(bootstrap?.instance?.expiresAt || "");
  process.env.TENANT_CUSTOMER_DISCORD_USER_ID = String(bootstrap?.tenant?.customerDiscordUserId || "");
  process.env.TENANT_ASSIGNED_GUILD_ID = String(bootstrap?.tenant?.assignedGuildId || "");
}

function spawnBotProcess() {
  const entrypoint = resolveEntrypoint();
  console.log("[managed-runtime] iniciando source em", entrypoint);

  childProcess = spawn(process.execPath, [entrypoint], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  childProcess.on("exit", (code, signal) => {
    if (shutdownRequested) {
      process.exit(code ?? 0);
      return;
    }

    console.error(
      "[managed-runtime] processo da source encerrou inesperadamente",
      JSON.stringify({ code, signal }),
    );
    process.exit(code ?? 1);
  });
}

function requestShutdown(reason) {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  console.warn("[managed-runtime] encerrando source:", reason);

  if (childProcess && !childProcess.killed) {
    childProcess.kill("SIGTERM");
  }

  setTimeout(() => {
    process.exit(0);
  }, 10000).unref();
}

async function sendHeartbeat() {
  const heartbeat = await postJson("/internal/instances/heartbeat", {
    instanceId,
    instanceSecret,
    metrics: {
      wrapperPid: process.pid,
      childPid: childProcess?.pid ?? null,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      sourceSlug: process.env.SOURCE_SLUG || process.env.INSTANCE_SOURCE_SLUG || "",
      sourceVersion: process.env.SOURCE_VERSION || "",
    },
  });

  if (String(heartbeat?.desiredState || "") !== "running") {
    requestShutdown("manager solicitou bloqueio/suspensao");
  }
}

async function main() {
  const bootstrap = await postJson("/internal/instances/bootstrap", {
    instanceId,
    instanceSecret,
  });

  syncBootstrapEnv(bootstrap);
  spawnBotProcess();
  await sendHeartbeat();

  const interval = setInterval(() => {
    sendHeartbeat().catch((error) => {
      console.error("[managed-runtime] heartbeat falhou:", error);
    });
  }, heartbeatIntervalMs);
  interval.unref();
}

process.on("SIGTERM", () => requestShutdown("SIGTERM"));
process.on("SIGINT", () => requestShutdown("SIGINT"));

main().catch((error) => {
  console.error("[managed-runtime] bootstrap falhou:", error);
  process.exit(1);
});
`;
}
